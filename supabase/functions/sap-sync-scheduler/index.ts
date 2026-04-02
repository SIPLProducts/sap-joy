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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({}))
    const ignoreSchedule = body?.ignoreSchedule === true
    const requestedConfigIds = Array.isArray(body?.config_ids) ? body.config_ids : null

    const { data: configs, error: configError } = await supabase
      .from('sap_api_config')
      .select('*')
      .eq('is_active', true)
      .eq('scheduler_enabled', true)

    if (configError) {
      throw configError
    }

    const now = new Date()
    const results: Array<Record<string, unknown>> = []

    for (const config of configs || []) {
      if (requestedConfigIds && !requestedConfigIds.includes(config.id)) continue
      if (!ignoreSchedule && !shouldRunNow(config, now)) continue

      const { data: dbResponseFields } = await supabase
        .from('sap_api_response_fields')
        .select('*')
        .eq('config_id', config.id)
        .order('sort_order')

      let activeResponseFields = (dbResponseFields || []).filter((field: any) => field.map_to_table && field.map_to_column)
      
      // If no DB-configured response fields, auto-generate from built-in mappings
      if (activeResponseFields.length === 0) {
        const autoFields = generateBuiltInResponseFields(config)
        if (autoFields.length === 0) {
          results.push({ config_id: config.id, config_name: config.config_name, skipped: true, reason: 'No mapped response fields and no built-in mapping for this endpoint' })
          continue
        }
        activeResponseFields = autoFields
        console.log(`[scheduler] Using ${autoFields.length} built-in field mappings for ${config.config_name}`)
      }

      const { data: requestFields } = await supabase
        .from('sap_api_request_fields')
        .select('*')
        .eq('config_id', config.id)
        .order('sort_order')

      const invalidRequired = (requestFields || []).filter(
        (field: any) => field.is_required && (!field.default_value || String(field.default_value).trim() === ''),
      )
      if (invalidRequired.length > 0) {
        results.push({
          config_id: config.id,
          config_name: config.config_name,
          skipped: true,
          reason: `Missing required defaults: ${invalidRequired.map((field: any) => field.sap_field_name || field.field_name).join(', ')}`,
        })
        continue
      }

      const { data: syncRecord, error: syncError } = await supabase
        .from('sap_stock_sync_history')
        .insert({
          config_id: config.id,
          sync_type: 'scheduled',
          status: 'in_progress',
          synced_by: 'scheduler',
        })
        .select()
        .single()

      if (syncError || !syncRecord) {
        results.push({ config_id: config.id, config_name: config.config_name, success: false, error: syncError?.message || 'Failed to create sync record' })
        continue
      }

      try {
        const sapResponse = await callSAPApi(config, requestFields || [])

        if (!sapResponse.success) {
          await supabase.from('sap_stock_sync_history').update({
            status: 'failed',
            error_message: sapResponse.error,
            completed_at: new Date().toISOString(),
          }).eq('id', syncRecord.id)

          results.push({ config_id: config.id, config_name: config.config_name, success: false, error: sapResponse.error })
          continue
        }

        const syncResult = await mapAndInsertData(supabase, sapResponse.data || [], responseFields || [], syncRecord.id, config.max_records)
        const hasErrors = syncResult.errors.length > 0
        const finalStatus = syncResult.inserted === 0 && hasErrors ? 'failed' : hasErrors ? 'partial' : 'success'

        await supabase.from('sap_stock_sync_history').update({
          status: finalStatus,
          records_fetched: syncResult.fetched,
          records_inserted: syncResult.inserted,
          records_updated: syncResult.updated,
          completed_at: new Date().toISOString(),
          error_message: hasErrors ? syncResult.errors.join('; ') : null,
        }).eq('id', syncRecord.id)

        await supabase.from('sap_api_config').update({
          last_sync_at: new Date().toISOString(),
        }).eq('id', config.id)

        results.push({
          config_id: config.id,
          config_name: config.config_name,
          success: true,
          records_fetched: syncResult.fetched,
          records_inserted: syncResult.inserted,
          records_updated: syncResult.updated,
          errors: syncResult.errors,
        })
      } catch (error: any) {
        await supabase.from('sap_stock_sync_history').update({
          status: 'failed',
          error_message: error.message || 'Unknown scheduler error',
          completed_at: new Date().toISOString(),
        }).eq('id', syncRecord.id)

        results.push({ config_id: config.id, config_name: config.config_name, success: false, error: error.message || 'Unknown scheduler error' })
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || 'Scheduler failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Auto-generate response field mappings based on endpoint path/config name
 * when no sap_api_response_fields rows exist in the DB.
 * This mirrors the hardcoded alias logic used by the client-side manual sync.
 */
function generateBuiltInResponseFields(config: any): any[] {
  const endpoint = String(config.endpoint_path || config.api_endpoint || '').toLowerCase()
  const name = String(config.config_name || '').toLowerCase()

  // Detect target table from endpoint or config name
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

function buildUrl(config: any): string {
  let url: string
  if ((config.connection_mode === 'vpn_tunnel' || config.connection_mode === 'proxy') && config.proxy_tunnel_url) {
    url = `${config.proxy_tunnel_url.replace(/\/$/, '')}${config.endpoint_path || ''}`
  } else {
    url = `${(config.base_url || '').replace(/\/$/, '')}${config.endpoint_path || config.api_endpoint || ''}`
  }

  if (config.sap_client && !/[?&]sap-client=/.test(url)) {
    url += `${url.includes('?') ? '&' : '?'}sap-client=${config.sap_client}`
  }

  return url
}

function buildAuthHeaders(config: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }

  if (config.proxy_secret) headers['x-proxy-secret'] = config.proxy_secret
  if (config.auth_type === 'basic' && config.username) {
    headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.encrypted_password || ''}`)}`
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

async function callSAPApi(config: any, requestFields: any[]): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const url = buildUrl(config)
  const headers = buildAuthHeaders(config)
  const method = String(config.http_method || 'GET').toUpperCase()
  const timeout = config.timeout_ms || 30000

  let requestBody: Record<string, any> | undefined
  if (['POST', 'PUT', 'PATCH'].includes(method) && requestFields.length > 0) {
    requestBody = {}
    requestFields.forEach((field: any) => {
      const key = field.sap_field_name || field.field_name
      if (field.is_required || (field.default_value && String(field.default_value).trim() !== '')) {
        requestBody![key] = field.default_value ?? ''
      }
    })
  }

  let finalUrl = url
  if (method === 'GET' && requestFields.length > 0) {
    const params = new URLSearchParams()
    requestFields.forEach((field: any) => {
      const key = field.sap_field_name || field.field_name
      const value = field.default_value
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value))
      }
    })
    const qs = params.toString()
    if (qs) finalUrl = `${url}${url.includes('?') ? '&' : '?'}${qs}`
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const response = await fetch(finalUrl, {
      method,
      headers,
      signal: controller.signal,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    })
    clearTimeout(timer)

    const bodyText = await response.text()
    if (!response.ok) {
      return { success: false, error: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}` }
    }

    const jsonData = JSON.parse(bodyText)
    const records = jsonData?.d?.results || jsonData?.value || jsonData?.data || (Array.isArray(jsonData) ? jsonData : [jsonData])
    return { success: true, data: Array.isArray(records) ? records : [records] }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: `SAP API timed out after ${timeout}ms` }
    }
    return { success: false, error: error.message || 'SAP call failed' }
  }
}

async function mapAndInsertData(
  supabase: any,
  records: any[],
  responseFields: any[],
  syncId: string,
  maxRecords?: number | null,
): Promise<SyncResult> {
  const limitedRecords = typeof maxRecords === 'number' && maxRecords > 0 ? records.slice(0, maxRecords) : records
  const result: SyncResult = { fetched: limitedRecords.length, inserted: 0, updated: 0, errors: [] }

  if (!limitedRecords.length || !responseFields.length) {
    if (!responseFields.length) result.errors.push('No response field mappings configured')
    if (!limitedRecords.length) result.errors.push('No records returned from SAP')
    return result
  }

  const allowedColumnsByTable: Record<string, Set<string>> = {
    shop_floor_stock: new Set([
      'plant', 'material_code', 'material_description', 'batch', 'storage_location',
      'storage_location_desc', 'available_quantity', 'blocked_quantity', 'quality_inspection_qty',
      'transfer_qty', 'unrestricted_value', 'blocked_value', 'quality_inspection_value',
      'transfer_value', 'row_number_custom', 'shelf_number', 'rack_number', 'bin_number',
      'uom', 'production_order', 'reservation_number', 'sap_sync_id', 'source', 'status',
    ]),
    inward_inspection_lots: new Set([
      'inspection_lot', 'material_code', 'material_description', 'plant', 'storage_location',
      'batch', 'uom', 'blocked_quantity', 'transaction_quantity', 'status', 'block_reason',
      'vendor_code', 'vendor_name', 'po_number', 'grn_number', 'uploaded_by', 'upload_batch_id',
      'inspection_date', 'posting_date',
    ]),
  }

  const aliasMapByTable: Record<string, Record<string, string>> = {
    shop_floor_stock: {
      matnr: 'material_code', maktx: 'material_description', labst: 'available_quantity',
      charg: 'batch', lgobe: 'storage_location_desc', speme: 'blocked_quantity',
      insme: 'quality_inspection_qty', trame: 'transfer_qty', wlabs: 'unrestricted_value',
      wspem: 'blocked_value', winsm: 'quality_inspection_value', wtram: 'transfer_value',
      rowno: 'row_number_custom', shelfno: 'shelf_number', rackno: 'rack_number', binno: 'bin_number',
      werks: 'plant', werk: 'plant', lgort: 'storage_location',
    },
    inward_inspection_lots: {
      matnr: 'material_code', maktx: 'material_description', werks: 'plant', werk: 'plant', charg: 'batch',
      lgort: 'storage_location', prueflos: 'inspection_lot', lifnr: 'vendor_code', name1: 'vendor_name',
      ebeln: 'po_number', meins: 'uom', menge: 'blocked_quantity', qals_prueflos: 'inspection_lot',
    },
  }

  const requiredByTable: Record<string, string[]> = {
    shop_floor_stock: ['plant', 'material_code', 'available_quantity'],
    inward_inspection_lots: ['inspection_lot', 'material_code', 'plant'],
  }

  const tableFieldMap = new Map<string, any[]>()
  responseFields.forEach((field: any) => {
    if (!field.map_to_table || !field.map_to_column) return
    if (!tableFieldMap.has(field.map_to_table)) tableFieldMap.set(field.map_to_table, [])
    tableFieldMap.get(field.map_to_table)!.push(field)
  })

  for (const [tableName, fields] of tableFieldMap.entries()) {
    const aliases = aliasMapByTable[tableName] || {}
    const allowed = allowedColumnsByTable[tableName]
    if (!allowed) continue

    const rows = limitedRecords.map((record) => {
      const row: Record<string, any> = {}
      fields.forEach((field: any) => {
        const sapKey = field.sap_field_name || field.field_name
        let value = record[sapKey]
        if (value === undefined) {
          const matchingKey = Object.keys(record).find((key) => key.toLowerCase() === String(sapKey).toLowerCase())
          if (matchingKey) value = record[matchingKey]
        }
        if (value === undefined || value === null || value === '') return

        const normalizedColumn = aliases[String(field.map_to_column).trim().toLowerCase()] || String(field.map_to_column).trim()
        if (!allowed.has(normalizedColumn)) return
        row[normalizedColumn] = value
      })

      if (tableName === 'shop_floor_stock') {
        row.source = 'sap_api'
        row.sap_sync_id = syncId
        row.status = ['available', 'blocked', 'reserved'].includes(String(row.status || '').toLowerCase())
          ? String(row.status).toLowerCase()
          : 'available'
        if (row.available_quantity !== undefined) row.available_quantity = Number(row.available_quantity) || 0
      }

      if (tableName === 'inward_inspection_lots') {
        row.status = row.status || 'pending'
      }

      const missing = (requiredByTable[tableName] || []).filter((column) => row[column] === undefined || row[column] === null || row[column] === '')
      return missing.length ? null : row
    }).filter(Boolean)

    if (!rows.length) continue

    const upsertOptions = tableName === 'shop_floor_stock'
      ? { onConflict: 'stock_key' }
      : tableName === 'inward_inspection_lots'
      ? { onConflict: 'inspection_lot' }
      : undefined

    const { data, error } = await supabase.from(tableName).upsert(rows, upsertOptions).select()
    if (error) {
      result.errors.push(`Error inserting into ${tableName}: ${error.message}`)
      continue
    }

    result.inserted += data?.length || 0
  }

  return result
}