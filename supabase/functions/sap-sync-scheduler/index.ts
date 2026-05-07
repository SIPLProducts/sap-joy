import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SyncResult = {
  fetched: number
  inserted: number
  updated: number
  errors: string[]
}

const LOCK_KEY = 'sap_scheduler_global'
const port = Number(Deno.env.get('PORT') || '3100')

Deno.serve({ port }, async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ success: false, error: `Missing env: ${!supabaseUrl ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'}` }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // ── 1. Acquire global lock to prevent duplicate runs ──
    const { data: lockAcquired } = await supabase.rpc('acquire_scheduler_lock', {
      _lock_key: LOCK_KEY,
      _locked_by: 'edge-function',
    })

    if (!lockAcquired) {
      console.log('[scheduler] Lock not acquired — another run is in progress')
      return jsonResp({ success: false, error: 'Scheduler already running. Duplicate run prevented.' })
    }

    console.log('[scheduler] Lock acquired, starting run')

    const body = await req.json().catch(() => ({}))
    const ignoreSchedule = body?.ignoreSchedule === true
    const isCronTrigger = body?.source === 'pg_cron'
    const requestedConfigIds = Array.isArray(body?.config_ids) ? body.config_ids : null

    // ── 2. Fetch active scheduler-enabled configs ──
    const { data: configs, error: configError } = await supabase
      .from('sap_api_config')
      .select('*')
      .eq('is_active', true)
      .eq('scheduler_enabled', true)

    if (configError) {
      await releaseLock(supabase)
      throw configError
    }

    const now = new Date()
    const results: Array<Record<string, unknown>> = []

    // ── 3. Fetch all plants for fallback ──
    const { data: plants } = await supabase.from('plants').select('code')
    const allPlantCodes = (plants || []).map((p: any) => p.code)
    if (allPlantCodes.length === 0) allPlantCodes.push('1300') // Fallback default

    for (const config of configs || []) {
      if (requestedConfigIds && !requestedConfigIds.includes(config.id)) continue

      // Result Recording API is on-demand only (called from MRB Worklist).
      // Hard guardrail so it can never be picked up by the scheduler/pg_cron.
      {
        const _cn = String(config.config_name || '').toLowerCase()
        const _ep = String(config.endpoint_path || config.api_endpoint || '').toLowerCase()
        if ((_cn.includes('result') && _cn.includes('record')) ||
            (_ep.includes('result') && _ep.includes('record'))) {
          results.push({
            config_id: config.id,
            config_name: config.config_name,
            skipped: true,
            reason: 'Result Recording API is on-demand only — scheduler disabled',
          })
          continue
        }
      }

      // When triggered by pg_cron, always run — the cron schedule itself handles timing
      if (!ignoreSchedule && !isCronTrigger && !shouldRunNow(config, now)) continue

      // Fetch response field mappings
      const { data: dbResponseFields } = await supabase
        .from('sap_api_response_fields')
        .select('*')
        .eq('config_id', config.id)
        .order('sort_order')

      let activeResponseFields = (dbResponseFields || []).filter((f: any) => f.map_to_table && f.map_to_column)

      if (activeResponseFields.length === 0) {
        const autoFields = generateBuiltInResponseFields(config)
        if (autoFields.length === 0) {
          results.push({ config_id: config.id, config_name: config.config_name, skipped: true, reason: 'No mapped response fields and no built-in mapping for this endpoint' })
          continue
        }
        activeResponseFields = autoFields
        console.log(`[scheduler] Using ${autoFields.length} built-in field mappings for ${config.config_name}`)
      }

      // Fetch request field mappings
      const { data: requestFields } = await supabase
        .from('sap_api_request_fields')
        .select('*')
        .eq('config_id', config.id)
        .order('sort_order')

      // Validate required fields
      const invalidRequired = (requestFields || []).filter(
        (f: any) => f.is_required && (!f.default_value || String(f.default_value).trim() === ''),
      )
      if (invalidRequired.length > 0) {
        results.push({
          config_id: config.id,
          config_name: config.config_name,
          skipped: true,
          reason: `Missing required defaults: ${invalidRequired.map((f: any) => f.sap_field_name || f.field_name).join(', ')}`,
        })
        continue
      }

      // ── 4. Multi-plant iteration: process each plant independently ──
      // Determine if config uses WERKS field for plant filtering
      const hasPlantField = (requestFields || []).some(
        (f: any) => ['WERKS', 'WERK', 'werks', 'werk'].includes(f.sap_field_name || f.field_name)
      )

      // Only sync plants explicitly selected in scheduler_plants
      const configPlants: string[] = Array.isArray(config.scheduler_plants) && config.scheduler_plants.length > 0
        ? config.scheduler_plants
        : []

      if (hasPlantField && configPlants.length === 0) {
        results.push({ config_id: config.id, config_name: config.config_name, skipped: true, reason: 'No plants selected for scheduler sync' })
        continue
      }

      const plantsToProcess = hasPlantField ? configPlants : ['ALL']

      for (const plantCode of plantsToProcess) {
        const plantLabel = plantCode === 'ALL' ? 'All Plants' : plantCode

        // Create per-plant sync history record
        const { data: syncRecord, error: syncError } = await supabase
          .from('sap_stock_sync_history')
          .insert({
            config_id: config.id,
            sync_type: 'scheduled',
            status: 'in_progress',
            synced_by: 'scheduler',
            plant: plantCode === 'ALL' ? null : plantCode,
          })
          .select()
          .single()

        if (syncError || !syncRecord) {
          results.push({ config_id: config.id, config_name: config.config_name, plant: plantLabel, success: false, error: syncError?.message || 'Failed to create sync record' })
          continue // Failure in one plant should not stop others
        }

        try {
          // Build plant-specific request overrides
          const plantOverrides: Record<string, any> = {}
          if (plantCode !== 'ALL') {
            plantOverrides['WERKS'] = plantCode
            plantOverrides['WERK'] = plantCode
          }

          // Force-set ART based on config name so a wrong default_value in DB
          // can never silently swap Inward Inspection (01) and In-Process (04).
          const cn = String(config.config_name || '').toLowerCase()
          if (cn.includes('inward') && cn.includes('inspection') && !cn.includes('process')) {
            plantOverrides['ART'] = '01'
          } else if (cn.includes('process')) {
            plantOverrides['ART'] = '04'
          }

          const sapResponse = await callSAPApi(config, requestFields || [], plantOverrides)

          if (!sapResponse.success) {
            await updateSyncRecord(supabase, syncRecord.id, 'failed', sapResponse.error)
            results.push({ config_id: config.id, config_name: config.config_name, plant: plantLabel, success: false, error: sapResponse.error })
            continue // Failure in one plant should not stop others
          }

          // ── 5. Dynamic column creation before insert ──
          await ensureDynamicColumns(supabase, activeResponseFields, sapResponse.data || [])

          // ── 6. Map and insert using unified logic matching manual sync ──
          const syncResult = await mapAndInsertData(
            supabase,
            sapResponse.data || [],
            activeResponseFields,
            syncRecord.id,
            config.max_records,
            plantCode,
          )

          // ── 6b. Reconcile: remove rows missing from SAP response that have no MRB ──
          let reconcileSummary: { table: string; removed: number; preserved: number } | null = null
          try {
            if (
              Array.isArray(sapResponse.data) &&
              plantCode !== 'ALL' &&
              syncResult.errors.length === 0
            ) {
              const cnLower = String(config.config_name || '').toLowerCase()
              const isInward = cnLower.includes('inward') && cnLower.includes('inspection') && !cnLower.includes('process')
              const isInProcess = cnLower.includes('process')
              const reconcileTable = isInward
                ? 'inward_inspection_lots'
                : isInProcess
                ? 'zmrb_inward_report'
                : null
              const mrbSource = isInward ? 'quality_inspection' : isInProcess ? 'inprocess' : null

              if (reconcileTable && mrbSource) {
                // Build set of inspection_lots returned in this SAP response
                const returnedLots = new Set<string>()
                for (const rec of sapResponse.data as any[]) {
                  const lot = rec?.PRUEFLOS ?? rec?.prueflos ?? rec?.QALS_PRUEFLOS
                    ?? rec?.qals_prueflos ?? rec?.inspection_lot
                  if (lot !== undefined && lot !== null && String(lot).trim() !== '') {
                    returnedLots.add(String(lot))
                  }
                }

                if (returnedLots.size > 0) {
                  // Fetch existing inspection_lots in destination table for this plant
                  const { data: existingRows } = await supabase
                    .from(reconcileTable)
                    .select('inspection_lot')
                    .eq('plant', plantCode)

                  const existingLots: string[] = (existingRows || [])
                    .map((r: any) => r?.inspection_lot)
                    .filter((v: any) => v !== null && v !== undefined && String(v).trim() !== '')
                    .map((v: any) => String(v))

                  const missing = existingLots.filter((lot) => !returnedLots.has(lot))

                  if (missing.length > 0) {
                    // Preserve any inspection_lot already attached to an MRB
                    const { data: mrbRows } = await supabase
                      .from('mrb_records')
                      .select('inspection_lot')
                      .eq('plant', plantCode)
                      .eq('source', mrbSource)
                      .in('inspection_lot', missing)

                    const preservedSet = new Set<string>(
                      (mrbRows || [])
                        .map((r: any) => r?.inspection_lot)
                        .filter(Boolean)
                        .map((v: any) => String(v)),
                    )

                    const deletable = missing.filter((lot) => !preservedSet.has(lot))

                    if (deletable.length > 0) {
                      const { error: delErr } = await supabase
                        .from(reconcileTable)
                        .delete()
                        .eq('plant', plantCode)
                        .in('inspection_lot', deletable)

                      if (delErr) {
                        console.log(`[scheduler] Reconcile delete error on ${reconcileTable}/${plantCode}: ${delErr.message}`)
                      }
                    }

                    reconcileSummary = {
                      table: reconcileTable,
                      removed: deletable.length,
                      preserved: preservedSet.size,
                    }
                    console.log(
                      `[scheduler] Reconciled ${reconcileTable}/${plantCode}: removed ${deletable.length} orphan rows (kept ${preservedSet.size} with MRB)`,
                    )
                  } else {
                    console.log(`[scheduler] Reconcile ${reconcileTable}/${plantCode}: nothing to remove`)
                  }
                }
              }
            }
          } catch (reconcileErr: any) {
            console.log(`[scheduler] Reconcile step failed: ${reconcileErr?.message || reconcileErr}`)
          }

          const hasErrors = syncResult.errors.length > 0
          const finalStatus = syncResult.inserted === 0 && hasErrors ? 'failed' : hasErrors ? 'partial' : 'success'

          await supabase.from('sap_stock_sync_history').update({
            status: finalStatus,
            records_fetched: syncResult.fetched,
            records_inserted: syncResult.inserted,
            records_updated: syncResult.updated,
            completed_at: new Date().toISOString(),
            error_message: hasErrors ? syncResult.errors.join('; ').substring(0, 2000) : null,
          }).eq('id', syncRecord.id)

          results.push({
            config_id: config.id,
            config_name: config.config_name,
            plant: plantLabel,
            success: true,
            records_fetched: syncResult.fetched,
            records_inserted: syncResult.inserted,
            records_updated: syncResult.updated,
            records_deleted: reconcileSummary?.removed ?? 0,
            records_preserved_with_mrb: reconcileSummary?.preserved ?? 0,
            errors: syncResult.errors.length > 0 ? syncResult.errors.slice(0, 5) : undefined,
          })
        } catch (error: any) {
          await updateSyncRecord(supabase, syncRecord.id, 'failed', error.message || 'Unknown scheduler error')
          results.push({ config_id: config.id, config_name: config.config_name, plant: plantLabel, success: false, error: error.message || 'Unknown scheduler error' })
          // Continue to next plant
        }
      }

      // Update last_sync_at on the config
      await supabase.from('sap_api_config').update({
        last_sync_at: new Date().toISOString(),
      }).eq('id', config.id)
    }

    // ── Release lock ──
    await releaseLock(supabase)

    return jsonResp({ success: true, processed: results.length, results })
  } catch (error: any) {
    // Always try to release lock on error
    try { await releaseLock(supabase) } catch {}
    return jsonResp({ success: false, error: error.message || 'Scheduler failed' }, 500)
  }
})

// ═══════════════ Helper Functions ═══════════════

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function releaseLock(supabase: any) {
  await supabase.rpc('release_scheduler_lock', { _lock_key: LOCK_KEY })
  console.log('[scheduler] Lock released')
}

async function updateSyncRecord(supabase: any, id: string, status: string, errorMessage?: string) {
  await supabase.from('sap_stock_sync_history').update({
    status,
    error_message: errorMessage?.substring(0, 2000) || null,
    completed_at: new Date().toISOString(),
  }).eq('id', id)
}

// ═══════════════ Dynamic Column Creation ═══════════════

/**
 * Requirement #7: Auto-create columns if not exists.
 * Checks response fields against target tables and creates missing columns dynamically.
 */
async function ensureDynamicColumns(supabase: any, responseFields: any[], sampleData: any[]) {
  if (!sampleData.length) return

  const tableColumns = new Map<string, Set<string>>()

  for (const field of responseFields) {
    if (!field.map_to_table || !field.map_to_column) continue
    const table = field.map_to_table
    const column = field.map_to_column

    if (!tableColumns.has(table)) {
      // Fetch existing columns for this table
      const { data: cols } = await supabase.rpc('get_table_columns', { _table_name: table })
      tableColumns.set(table, new Set((cols || []).map((c: any) => c.column_name)))
    }

    const existing = tableColumns.get(table)!
    if (!existing.has(column)) {
      // Determine column type from config
      const pgType = mapFieldTypeToPg(field.field_type)
      console.log(`[scheduler] Dynamic column creation: ALTER TABLE ${table} ADD COLUMN ${column} ${pgType}`)

      try {
        // Use RPC to add column (requires a helper function in DB)
        await supabase.rpc('add_dynamic_column', {
          _table_name: table,
          _column_name: column,
          _column_type: pgType,
        })
        existing.add(column)
        console.log(`[scheduler] Column ${column} added to ${table}`)
      } catch (e: any) {
        // Column might already exist or name conflict — log but don't fail
        console.log(`[scheduler] Could not add column ${column} to ${table}: ${e.message}`)
      }
    }
  }
}

function mapFieldTypeToPg(fieldType: string): string {
  switch ((fieldType || 'string').toLowerCase()) {
    case 'number':
    case 'decimal':
    case 'float': return 'numeric'
    case 'integer':
    case 'int': return 'integer'
    case 'boolean':
    case 'bool': return 'boolean'
    case 'date': return 'date'
    case 'datetime':
    case 'timestamp': return 'timestamptz'
    default: return 'text'
  }
}

// ═══════════════ Built-in Response Field Mappings ═══════════════

function generateBuiltInResponseFields(config: any): any[] {
  const endpoint = String(config.endpoint_path || config.api_endpoint || '').toLowerCase()
  const name = String(config.config_name || '').toLowerCase()

  let targetTable: string | null = null
  if (endpoint.includes('zmrb') || endpoint.includes('inward') || name.includes('inward') || name.includes('zmrb')) {
    targetTable = 'inward_inspection_lots'
  } else if (endpoint.includes('mb52') || endpoint.includes('stock') || name.includes('stock') || name.includes('mb52')) {
    targetTable = 'shop_floor_stock'
  }

  if (!targetTable) return []

  const builtInMappings: Record<string, Array<{ sap: string; col: string; type: string }>> = {
    inward_inspection_lots: [
      { sap: 'PRUEFLOS', col: 'inspection_lot', type: 'string' },
      { sap: 'WERK', col: 'plant', type: 'string' },
      { sap: 'ENSTEHDAT', col: 'inspection_date', type: 'string' },
      { sap: 'MATNR', col: 'material_code', type: 'string' },
      { sap: 'SELLIFNR', col: 'vendor_code', type: 'string' },
      { sap: 'MBLNR', col: 'grn_number', type: 'string' },
      { sap: 'CHARG', col: 'batch', type: 'string' },
      { sap: 'EBELN', col: 'po_number', type: 'string' },
      { sap: 'EBELP', col: 'po_item_number', type: 'string' },
      { sap: 'BUDAT_MKPF', col: 'posting_date', type: 'string' },
      { sap: 'SGTXT', col: 'block_reason', type: 'string' },
      { sap: 'MENGENEINH', col: 'uom', type: 'string' },
      { sap: 'LMENGE04', col: 'blocked_quantity', type: 'number' },
      { sap: 'LMENGE04', col: 'transaction_quantity', type: 'number' },
      { sap: 'MAKTX', col: 'material_description', type: 'string' },
      { sap: 'NAME1', col: 'vendor_name', type: 'string' },
      { sap: 'LGORT', col: 'storage_location', type: 'string' },
      { sap: 'LIFNR', col: 'vendor_code', type: 'string' },
      { sap: 'MEINS', col: 'uom', type: 'string' },
      { sap: 'MENGE', col: 'blocked_quantity', type: 'number' },
    ],
    shop_floor_stock: [
      { sap: 'WERKS', col: 'plant', type: 'string' },
      { sap: 'LGORT', col: 'storage_location', type: 'string' },
      { sap: 'LGOBE', col: 'storage_location_desc', type: 'string' },
      { sap: 'MATNR', col: 'material_code', type: 'string' },
      { sap: 'MAKTX', col: 'material_description', type: 'string' },
      { sap: 'CHARG', col: 'batch', type: 'string' },
      { sap: 'LABST', col: 'available_quantity', type: 'number' },
      { sap: 'SPEME', col: 'blocked_quantity', type: 'number' },
      { sap: 'INSME', col: 'quality_inspection_qty', type: 'number' },
      { sap: 'TRAME', col: 'transfer_qty', type: 'number' },
      { sap: 'WLABS', col: 'unrestricted_value', type: 'number' },
      { sap: 'WSPEM', col: 'blocked_value', type: 'number' },
      { sap: 'WINSM', col: 'quality_inspection_value', type: 'number' },
      { sap: 'WTRAM', col: 'transfer_value', type: 'number' },
    ],
  }

  const mappings = builtInMappings[targetTable] || []
  return mappings.map((m, i) => ({
    field_name: m.sap,
    sap_field_name: m.sap,
    field_type: m.type,
    map_to_table: targetTable,
    map_to_column: m.col,
    sort_order: i,
  }))
}

// ═══════════════ Schedule Logic ═══════════════

function shouldRunNow(config: any, now: Date): boolean {
  if (!config.scheduler_enabled || !config.is_active) return false
  const frequency = String(config.sync_frequency || 'manual')
  if (frequency === 'manual') return false

  const lastRun = config.last_sync_at ? new Date(config.last_sync_at) : null
  if (frequency === 'custom') {
    return matchesSupportedCron(config.cron_expression, now, lastRun)
  }

  const intervalMs = getFrequencyIntervalMs(frequency)
  if (!intervalMs) return false
  if (!lastRun || Number.isNaN(lastRun.getTime())) return true
  return now.getTime() - lastRun.getTime() >= intervalMs
}

function getFrequencyIntervalMs(frequency: string): number | null {
  switch (frequency) {
    case 'every_5_min': return 5 * 60 * 1000
    case 'every_15_min': return 15 * 60 * 1000
    case 'every_30_min': return 30 * 60 * 1000
    case 'hourly': return 60 * 60 * 1000
    case 'every_6_hours': return 6 * 60 * 60 * 1000
    case 'daily': return 24 * 60 * 60 * 1000
    case 'weekly': return 7 * 24 * 60 * 60 * 1000
    default: return null
  }
}

function matchesSupportedCron(cronExpression: string | null, now: Date, lastRun: Date | null): boolean {
  const cron = String(cronExpression || '').trim()
  if (!cron) return false

  const normalized = cron.replace(/\s+/g, ' ')
  const minute = now.getUTCMinutes()
  const hour = now.getUTCHours()
  const weekday = now.getUTCDay()

  const matched =
    (normalized === '*/5 * * * *' && minute % 5 === 0) ||
    (normalized === '*/15 * * * *' && minute % 15 === 0) ||
    (normalized === '*/30 * * * *' && minute % 30 === 0) ||
    (normalized === '0 * * * *' && minute === 0) ||
    (normalized === '0 */6 * * *' && minute === 0 && hour % 6 === 0) ||
    (normalized === '0 0 * * *' && minute === 0 && hour === 0) ||
    ((normalized === '0 0 * * 0' || normalized === '0 0 * * 7') && minute === 0 && hour === 0 && weekday === 0)

  if (!matched) return false
  if (!lastRun || Number.isNaN(lastRun.getTime())) return true
  return now.getTime() - lastRun.getTime() >= 60 * 1000
}

// ═══════════════ SAP API Calling (Proxy-Aware, matches manual sync logic) ═══════════════

// Build the real SAP target URL (what SAP actually receives)
function buildSapTargetUrl(config: any): string {
  const base = (config.base_url || config.api_endpoint || '').replace(/\/$/, '')
  const path = config.endpoint_path || ''
  let url = `${base}${path}`

  if (config.sap_client && !/[?&]sap-client=/.test(url)) {
    url += `${url.includes('?') ? '&' : '?'}sap-client=${config.sap_client}`
  }

  return url
}

// Get proxy base URL
function getProxyBaseUrl(config: any): string | null {
  if ((config.connection_mode === 'vpn_tunnel' || config.connection_mode === 'proxy' || config.connection_mode === 'internal') && config.proxy_tunnel_url) {
    return config.proxy_tunnel_url.replace(/\/$/, '')
  }
  return null
}

function normalizeCredential(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\r?\n/g, '').trim() : ''
}

// Route fetch through the proxy's POST /proxy endpoint
async function fetchViaProxy(
  proxyBaseUrl: string,
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  proxySecret?: string,
  timeout?: number,
): Promise<Response> {
  const proxyEndpoint = `${proxyBaseUrl}/proxy`

  const proxyHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (proxySecret) {
    proxyHeaders['x-proxy-secret'] = proxySecret
  }

  // Forward headers (exclude proxy-specific)
  const forwardHeaders = { ...headers }
  delete forwardHeaders['x-proxy-secret']

  let parsedBody: any = undefined
  if (body) {
    try { parsedBody = JSON.parse(body) } catch { parsedBody = body }
  }

  // Extract raw credentials from Authorization header
  let authInfo: { username: string; password: string } | undefined
  if (forwardHeaders['Authorization']?.startsWith('Basic ')) {
    try {
      const decoded = atob(forwardHeaders['Authorization'].replace('Basic ', ''))
      const colonIdx = decoded.indexOf(':')
      if (colonIdx > 0) {
        authInfo = {
          username: decoded.substring(0, colonIdx),
          password: decoded.substring(colonIdx + 1),
        }
      }
    } catch { /* ignore */ }
  }

  const proxyPayload: Record<string, any> = {
    url: targetUrl,
    method,
    headers: forwardHeaders,
    body: parsedBody,
  }
  if (authInfo) {
    proxyPayload.auth = authInfo
  }

  console.log(`[scheduler:fetchViaProxy] POST ${proxyEndpoint} → ${method} ${targetUrl}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout || 60000)

  const response = await fetch(proxyEndpoint, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify(proxyPayload),
    signal: controller.signal,
  })
  clearTimeout(timer)

  const responseText = await response.text()

  if (!response.ok) {
    return new Response(responseText, { status: response.status, statusText: response.statusText })
  }

  // Unwrap proxy response: { statusCode, headers, body }
  try {
    const proxyResult = JSON.parse(responseText)
    const sapStatus = proxyResult.statusCode || 200
    const sapBody = typeof proxyResult.body === 'string' ? proxyResult.body : JSON.stringify(proxyResult.body || '')
    return new Response(sapBody, {
      status: sapStatus,
      statusText: `SAP ${sapStatus}`,
      headers: { 'content-type': proxyResult.headers?.['content-type'] || 'application/json' },
    })
  } catch {
    return new Response(responseText, { status: 502, statusText: 'Proxy returned invalid response' })
  }
}

// Proxy-aware fetch: routes through POST /proxy when proxy is configured
async function proxyAwareFetch(config: any, targetUrl: string, fetchOpts: RequestInit): Promise<Response> {
  const proxyBaseUrl = getProxyBaseUrl(config)
  const method = (fetchOpts.method || 'GET').toUpperCase()
  const headers = fetchOpts.headers as Record<string, string> || {}
  const body = fetchOpts.body as string | undefined

  if (proxyBaseUrl) {
    return fetchViaProxy(proxyBaseUrl, targetUrl, method, headers, body, config.proxy_secret, config.timeout_ms)
  }

  // Direct mode (no proxy)
  return fetch(targetUrl, fetchOpts)
}

function buildUrl(config: any): string {
  return buildSapTargetUrl(config)
}

function buildAuthHeaders(config: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }

  const username = normalizeCredential(config.username)
  const password = normalizeCredential(config.encrypted_password)

  if (config.proxy_secret) headers['x-proxy-secret'] = config.proxy_secret
  if (config.sap_client) headers['sap-client'] = String(config.sap_client)

  if (config.auth_type === 'basic' && username) {
    headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
    headers['username'] = username
    headers['password'] = password
    headers['x-sap-username'] = username
    headers['x-sap-password'] = password
  } else if (config.auth_type === 'api_key' && config.api_key) {
    headers['X-API-Key'] = config.api_key
  }

  if (config.custom_headers && typeof config.custom_headers === 'object') {
    Object.entries(config.custom_headers).forEach(([key, value]) => {
      if (key && value) headers[key] = String(value)
    })
  }

  return headers
}

function isSapAuthError(bodyText: string): boolean {
  const lower = bodyText.toLowerCase()
  return lower.includes('logon error message') ||
    lower.includes('anmeldung fehlgeschlagen') ||
    lower.includes('login failed') ||
    lower.includes('not authenticated')
}

async function callSAPApi(
  config: any,
  requestFields: any[],
  plantOverrides: Record<string, any> = {},
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const url = buildUrl(config)
  const headers = buildAuthHeaders(config)
  const method = String(config.http_method || 'GET').toUpperCase()
  const timeout = config.timeout_ms || 30000

  let requestBody: Record<string, any> | undefined
  if (['POST', 'PUT', 'PATCH'].includes(method) && requestFields.length > 0) {
    requestBody = {}
    requestFields.forEach((field: any) => {
      const key = field.sap_field_name || field.field_name

      if (plantOverrides[key] !== undefined) {
        requestBody![key] = plantOverrides[key]
        return
      }

      if (field.is_required || (field.default_value && String(field.default_value).trim() !== '')) {
        let val = field.default_value ?? ''
        if (key === 'ART' || key === 'INSPECTION_TYPE') {
          val = String(val).trim().padStart(2, '0')
        }
        requestBody![key] = val
      }
    })

    if (config.max_records) {
      if (requestBody.MAX_ROWS === undefined) requestBody.MAX_ROWS = config.max_records
      if (requestBody.MAX_HITS === undefined) requestBody.MAX_HITS = config.max_records
    }

    for (const optionalKey of ['MATNR', 'CHARG']) {
      if (requestBody[optionalKey] !== undefined && String(requestBody[optionalKey]).trim() === '') {
        delete requestBody[optionalKey]
      }
    }
  }

  let finalUrl = url
  if (method === 'GET' && requestFields.length > 0) {
    const params = new URLSearchParams()
    requestFields.forEach((field: any) => {
      const key = field.sap_field_name || field.field_name
      const value = plantOverrides[key] ?? field.default_value
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value))
      }
    })
    const qs = params.toString()
    if (qs) finalUrl = `${url}${url.includes('?') ? '&' : '?'}${qs}`
  }

  console.log(`[scheduler] Calling SAP: ${method} ${finalUrl}`)
  if (requestBody) console.log(`[scheduler] Payload keys: ${Object.keys(requestBody).join(', ')}`)

  try {
    const fetchOpts: RequestInit = {
      method,
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    }

    const response = await proxyAwareFetch(config, finalUrl, fetchOpts)

    const bodyText = await response.text()
    if (!response.ok) {
      const friendlyMsg = extractFriendlyError(response.status, bodyText)
      return { success: false, error: friendlyMsg }
    }

    const jsonData = JSON.parse(bodyText)
    const records = jsonData?.d?.results || jsonData?.value || jsonData?.data || (Array.isArray(jsonData) ? jsonData : [jsonData])
    return { success: true, data: Array.isArray(records) ? records : [records] }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: `SAP API timed out after ${timeout}ms` }
    }
    return { success: false, error: `Connection failed: ${error.message}` }
  }
}

function extractFriendlyError(status: number, bodyText: string): string {
  if (isSapAuthError(bodyText)) {
    return 'Transport OK. SAP rejected username/password or SAP client. Check credentials in API Settings.'
  }
  if (status === 401 || status === 403) {
    return 'SAP authentication failed — check credentials in API Settings.'
  }
  if (status === 404 && bodyText.includes('<html')) {
    return 'Transport OK but SAP returned HTML error page (HTTP 404). Usually means wrong credentials or SAP client.'
  }
  if (status === 404) {
    return 'SAP endpoint not found — verify the endpoint path in API Settings.'
  }
  if (status === 500) {
    return 'SAP server error — the SAP system returned an internal error. Try again later.'
  }
  if (status === 503) {
    return 'SAP system unavailable — the server may be under maintenance.'
  }
  return `SAP API returned HTTP ${status}. Please check API Settings configuration.`
}

// ═══════════════ Data Mapping (unified with manual sync) ═══════════════

async function mapAndInsertData(
  supabase: any,
  records: any[],
  responseFields: any[],
  syncId: string,
  maxRecords?: number | null,
  plantCode?: string,
): Promise<SyncResult> {
  const limitedRecords = typeof maxRecords === 'number' && maxRecords > 0 ? records.slice(0, maxRecords) : records
  const result: SyncResult = { fetched: limitedRecords.length, inserted: 0, updated: 0, errors: [] }

  if (!limitedRecords.length || !responseFields.length) {
    if (!responseFields.length) result.errors.push('No response field mappings configured')
    if (!limitedRecords.length) result.errors.push('No records returned from SAP')
    return result
  }

  // Whitelist matching manual sync exactly
  const allowedColumnsByTable: Record<string, Set<string>> = {
    shop_floor_stock: new Set([
      'plant', 'material_code', 'material_description', 'batch', 'storage_location',
      'storage_location_desc', 'available_quantity', 'blocked_quantity', 'quality_inspection_qty',
      'transfer_qty', 'unrestricted_value', 'blocked_value', 'quality_inspection_value',
      'transfer_value', 'row_number_custom', 'shelf_number', 'rack_number', 'bin_number',
      'uom', 'production_order', 'reservation_number', 'sap_sync_id', 'source', 'status',
      'stock_key',
    ]),
    inward_inspection_lots: new Set([
      'inspection_lot', 'material_code', 'material_description', 'plant', 'storage_location',
      'batch', 'uom', 'blocked_quantity', 'transaction_quantity', 'status', 'block_reason',
      'vendor_code', 'vendor_name', 'po_number', 'po_item_number', 'grn_number', 'uploaded_by', 'upload_batch_id',
      'inspection_date', 'posting_date', 'grn_item_no', 'grn_date',
    ]),
    materials: new Set(['material_number', 'description', 'uom', 'category']),
    vendors: new Set(['code', 'name', 'contact_email', 'contact_phone', 'address', 'is_active']),
  }
  allowedColumnsByTable.zmrb_inward_report = new Set([
    'inspection_lot','material_code','material_description','plant',
    'storage_location','batch','uom','blocked_quantity','transaction_quantity',
    'status','block_reason','vendor_code','vendor_name','po_number','po_item_number',
    'grn_number','grn_item_no','grn_date','inspection_date','posting_date',
    'production_order_no','work_center','order_type','confirmation_no',
    'customer_code','customer_name','sales_order','sales_item',
    'uploaded_by','upload_batch_id','source',
  ])

  // Alias maps matching manual sync exactly
  const aliasMapByTable: Record<string, Record<string, string>> = {
    shop_floor_stock: {
      material: 'material_code', matnr: 'material_code', material_desc: 'material_description',
      maktx: 'material_description', unrestricted_qty: 'available_quantity', labst: 'available_quantity',
      charg: 'batch', lgobe: 'storage_location_desc', speme: 'blocked_quantity',
      insme: 'quality_inspection_qty', trame: 'transfer_qty', wlabs: 'unrestricted_value',
      wspem: 'blocked_value', winsm: 'quality_inspection_value', wtram: 'transfer_value',
      rowno: 'row_number_custom', shelfno: 'shelf_number', rackno: 'rack_number', binno: 'bin_number',
      werks: 'plant', werk: 'plant', lgort: 'storage_location',
    },
    inward_inspection_lots: {
      matnr: 'material_code', material: 'material_code', maktx: 'material_description',
      material_desc: 'material_description', werks: 'plant', werk: 'plant', charg: 'batch',
      lgort: 'storage_location', prueflos: 'inspection_lot', lifnr: 'vendor_code',
      name1: 'vendor_name', ebeln: 'po_number', ebelp: 'po_item_number', mblnr: 'grn_number',
      meins: 'uom', menge: 'blocked_quantity',
      inspection_lot: 'inspection_lot', storage_location: 'storage_location',
      vendor_code: 'vendor_code', vendor_name: 'vendor_name', po_item_number: 'po_item_number',
      grn_number: 'grn_number',
      qals_prueflos: 'inspection_lot', inspection_date: 'inspection_date', posting_date: 'posting_date',
      zeile: 'grn_item_no', bldat: 'grn_date', grn_item_no: 'grn_item_no', grn_date: 'grn_date',
    },
    materials: {
      material: 'material_number', matnr: 'material_number',
      material_desc: 'description', maktx: 'description',
    },
    vendors: {
      vendor_code: 'code', lifnr: 'code', vendor_name: 'name', name1: 'name',
    },
  }
  aliasMapByTable.zmrb_inward_report = {
    matnr: 'material_code', maktx: 'material_description',
    werks: 'plant', werk: 'plant', charg: 'batch', lgort: 'storage_location',
    prueflos: 'inspection_lot', lifnr: 'vendor_code', name1: 'vendor_name',
    ebeln: 'po_number', ebelp: 'po_item_number', mblnr: 'grn_number',
    meins: 'uom', mengeneinh: 'uom', menge: 'blocked_quantity', lmenge04: 'blocked_quantity',
    qty: 'transaction_quantity', sgtxt: 'block_reason',
    enstehdat: 'inspection_date', budat_mkpf: 'posting_date',
    zeile: 'grn_item_no', bldat: 'grn_date',
    aufnr: 'production_order_no', arbpl: 'work_center', auart: 'order_type',
    rueck: 'confirmation_no', kunnr: 'customer_code', name1_cust: 'customer_name',
    vbeln: 'sales_order', posnr: 'sales_item',
  }

  const requiredByTable: Record<string, string[]> = {
    shop_floor_stock: ['plant', 'material_code', 'available_quantity'],
    inward_inspection_lots: ['inspection_lot', 'material_code', 'plant'],
    materials: ['material_number', 'description'],
    vendors: ['code', 'name'],
  }
  requiredByTable.zmrb_inward_report = ['inspection_lot', 'material_code', 'plant']

  const tableFieldMap = new Map<string, any[]>()
  responseFields.forEach((field: any) => {
    if (!field.map_to_table || !field.map_to_column) return
    if (!tableFieldMap.has(field.map_to_table)) tableFieldMap.set(field.map_to_table, [])
    tableFieldMap.get(field.map_to_table)!.push(field)
  })

  for (const [tableName, fields] of tableFieldMap.entries()) {
    const aliases = aliasMapByTable[tableName] || {}
    const allowed = allowedColumnsByTable[tableName]
    if (!allowed) {
      console.log(`[scheduler] Table "${tableName}" not in allowedColumns whitelist, skipping`)
      continue
    }

    if (limitedRecords.length > 0) {
      console.log(`[scheduler] Sample SAP record keys:`, Object.keys(limitedRecords[0]))
    }
    console.log(`[scheduler] Mapping ${limitedRecords.length} records to "${tableName}" using ${fields.length} field mappings`)

    let droppedCount = 0

    const rows = limitedRecords.map((record) => {
      const row: Record<string, any> = {}

      fields.forEach((field: any) => {
        const sapKey = field.sap_field_name || field.field_name

        // Case-insensitive key matching (matches manual sync)
        let value = record[sapKey]
        if (value === undefined) {
          const matchingKey = Object.keys(record).find((key) => key.toLowerCase() === String(sapKey).toLowerCase())
          if (matchingKey) value = record[matchingKey]
        }

        // Also try json_path like manual sync
        if ((value === undefined || value === null) && field.json_path) {
          value = getNestedValue(record, field.json_path)
        }

        if (value === undefined || value === null || value === '') return

        const normalizedColumn = aliases[String(field.map_to_column).trim().toLowerCase()] || String(field.map_to_column).trim()
        if (!allowed.has(normalizedColumn)) return
        row[normalizedColumn] = value
      })

      // Table-specific defaults matching manual sync
      if (tableName === 'shop_floor_stock') {
        row.source = 'sap_api'
        row.sap_sync_id = syncId
        row.status = ['available', 'blocked', 'reserved'].includes(String(row.status || '').toLowerCase())
          ? String(row.status).toLowerCase()
          : 'available'
        if (row.available_quantity !== undefined) {
          const qty = Number(row.available_quantity)
          row.available_quantity = Number.isFinite(qty) ? qty : 0
        }
        // Generate composite stock_key for deduplication
        const keyParts = [
          String(row.plant || ''),
          String(row.material_code || ''),
          String(row.batch || ''),
          String(row.storage_location || ''),
        ]
        row.stock_key = keyParts.join('_')
      }

      if (tableName === 'inward_inspection_lots') {
        row.status = row.status || 'pending'
      }

      if (tableName === 'zmrb_inward_report') {
        row.status = row.status || 'pending'
        row.source = row.source || 'sap_api'
      }

      const missing = (requiredByTable[tableName] || []).filter(
        (column) => row[column] === undefined || row[column] === null || row[column] === '',
      )

      if (missing.length > 0) {
        droppedCount++
        if (droppedCount <= 3) {
          console.log(`[scheduler] Record DROPPED - missing: ${missing.join(',')}`)
        }
        return null
      }

      return row
    }).filter(Boolean)

    console.log(`[scheduler] ${tableName}: ${rows.length} valid rows, ${droppedCount} dropped`)

    if (!rows.length) continue

    const batchSize = 500

    // ── Strategy per table ──
    if (tableName === 'shop_floor_stock') {
      // FULL REFRESH: Delete existing SAP-synced records for this plant, then insert fresh
      const deletePlant = plantCode && plantCode !== 'ALL' ? plantCode : null
      if (deletePlant) {
        const { error: delErr } = await supabase
          .from('shop_floor_stock')
          .delete()
          .eq('source', 'sap_api')
          .eq('plant', deletePlant)
        if (delErr) {
          console.log(`[scheduler] Delete error for shop_floor_stock plant=${deletePlant}:`, delErr.message)
          result.errors.push(`Error clearing old stock data: ${delErr.message}`)
        } else {
          console.log(`[scheduler] Cleared existing SAP stock records for plant ${deletePlant}`)
        }
      } else {
        // No specific plant — clear all SAP-synced stock
        const { error: delErr } = await supabase
          .from('shop_floor_stock')
          .delete()
          .eq('source', 'sap_api')
        if (delErr) {
          console.log(`[scheduler] Delete error for shop_floor_stock (all):`, delErr.message)
          result.errors.push(`Error clearing old stock data: ${delErr.message}`)
        } else {
          console.log(`[scheduler] Cleared all existing SAP stock records`)
        }
      }

      // Insert all as new rows
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { data, error } = await supabase.from(tableName).insert(batch).select()
        if (error) {
          console.log(`[scheduler] Insert error for ${tableName}:`, error.message)
          result.errors.push(`Error inserting into ${tableName}: ${error.message}`)
          break
        }
        result.inserted += data?.length || 0
      }
    } else if (tableName === 'inward_inspection_lots') {
      // UPSERT: Existing inspection lots get updated, new ones get inserted
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)

        // Pre-fetch existing inspection_lot keys as a Set for accurate counting
        const lotKeys = batch.map((r: any) => r.inspection_lot).filter(Boolean)
        const existingKeys = new Set<string>()
        if (lotKeys.length > 0) {
          const { data: existingRows } = await supabase
            .from(tableName)
            .select('inspection_lot')
            .in('inspection_lot', lotKeys)
          for (const row of existingRows || []) {
            existingKeys.add(row.inspection_lot)
          }
        }

        // Count genuinely new keys before upsert
        const newKeyCount = lotKeys.filter(k => !existingKeys.has(k)).length

        const { data, error } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict: 'inspection_lot', ignoreDuplicates: false })
          .select()
        if (error) {
          console.log(`[scheduler] Upsert error for ${tableName}:`, error.message)
          result.errors.push(`Error upserting into ${tableName}: ${error.message}`)
          break
        }
        const totalProcessed = data?.length || 0
        result.inserted += newKeyCount
        result.updated += Math.max(0, totalProcessed - newKeyCount)

        console.log(`[scheduler] ${tableName} batch: ${newKeyCount} new, ${totalProcessed - newKeyCount} updated`)
      }
    } else if (tableName === 'zmrb_inward_report') {
      // UPSERT on inspection_lot
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const lotKeys = batch.map((r: any) => r.inspection_lot).filter(Boolean)
        const existingKeys = new Set<string>()
        if (lotKeys.length > 0) {
          const { data: existingRows } = await supabase
            .from(tableName)
            .select('inspection_lot')
            .in('inspection_lot', lotKeys)
          for (const row of existingRows || []) {
            existingKeys.add(row.inspection_lot)
          }
        }
        const newKeyCount = lotKeys.filter((k: string) => !existingKeys.has(k)).length

        const { data, error } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict: 'inspection_lot', ignoreDuplicates: false })
          .select()
        if (error) {
          console.log(`[scheduler] Upsert error for ${tableName}:`, error.message)
          result.errors.push(`Error upserting into ${tableName}: ${error.message}`)
          break
        }
        const totalProcessed = data?.length || 0
        result.inserted += newKeyCount
        result.updated += Math.max(0, totalProcessed - newKeyCount)
        console.log(`[scheduler] ${tableName} batch: ${newKeyCount} new, ${totalProcessed - newKeyCount} updated`)
      }
    } else {
      // Generic insert for other tables (materials, vendors)
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { data, error } = await supabase.from(tableName).insert(batch).select()
        if (error) {
          console.log(`[scheduler] Insert error for ${tableName}:`, error.message)
          result.errors.push(`Error inserting into ${tableName}: ${error.message}`)
          break
        }
        result.inserted += data?.length || 0
      }
    }
  }

  return result
}

function getNestedValue(obj: any, path: string): any {
  const normalizedPath = path
    .replace(/^\$\[\*\]\./, '')
    .replace(/^\$\./, '')
    .replace(/^\$/, '')

  if (!normalizedPath) return obj

  return normalizedPath.split('.').reduce((current: any, key: string) => {
    if (current === null || current === undefined) return undefined
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      return current[arrayMatch[1]]?.[parseInt(arrayMatch[2])]
    }
    return current[key]
  }, obj)
}
