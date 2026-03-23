import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth client to verify user - use getUser() for broad compatibility
    const authClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData?.user) {
      console.error('Auth error:', userError?.message || 'No user found')
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userEmail = userData.user.email || 'unknown'

    // Service client for DB operations
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const { action, config_id } = body

    // Fetch the SAP config
    const { data: config, error: configError } = await supabase
      .from('sap_api_config')
      .select('*')
      .eq('id', config_id)
      .single()

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'Configuration not found', details: configError?.message }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // TEST CONNECTION
    if (action === 'test') {
      const result = await testConnection(config)
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // TRIGGER SYNC
    if (action === 'sync') {
      // Create sync history record
      const { data: syncRecord, error: syncInsertErr } = await supabase
        .from('sap_stock_sync_history')
        .insert({
          config_id,
          sync_type: 'manual',
          status: 'in_progress',
          synced_by: userEmail,
        })
        .select()
        .single()

      if (syncInsertErr) {
        return new Response(JSON.stringify({ error: 'Failed to create sync record', details: syncInsertErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      try {
        // Fetch response field mappings
        const { data: responseFields } = await supabase
          .from('sap_api_response_fields')
          .select('*')
          .eq('config_id', config_id)
          .order('sort_order')

        // Fetch request field defaults
        const { data: requestFields } = await supabase
          .from('sap_api_request_fields')
          .select('*')
          .eq('config_id', config_id)
          .order('sort_order')

        // Build the SAP API request
        const sapResponse = await callSAPApi(config, requestFields || [])

        if (!sapResponse.success) {
          await supabase.from('sap_stock_sync_history').update({
            status: 'failed',
            error_message: sapResponse.error,
            completed_at: new Date().toISOString(),
          }).eq('id', syncRecord.id)

          return new Response(JSON.stringify({
            success: false,
            error: sapResponse.error,
            sync_id: syncRecord.id,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Map and insert data
        const mappingResult = await mapAndInsertData(
          supabase,
          sapResponse.data,
          responseFields || [],
          config,
          syncRecord.id,
        )

        const hasErrors = mappingResult.errors.length > 0
        const finalStatus = (mappingResult.inserted === 0 && hasErrors) ? 'failed' : (hasErrors ? 'partial' : 'success')
        await supabase.from('sap_stock_sync_history').update({
          status: finalStatus,
          records_fetched: mappingResult.fetched,
          records_inserted: mappingResult.inserted,
          records_updated: mappingResult.updated,
          completed_at: new Date().toISOString(),
          error_message: hasErrors ? mappingResult.errors.join('; ') : null,
        }).eq('id', syncRecord.id)

        // Update config last_sync_at
        await supabase.from('sap_api_config').update({
          last_sync_at: new Date().toISOString(),
        }).eq('id', config_id)

        return new Response(JSON.stringify({
          success: true,
          sync_id: syncRecord.id,
          records_fetched: mappingResult.fetched,
          records_inserted: mappingResult.inserted,
          records_updated: mappingResult.updated,
          errors: mappingResult.errors,
          sample_data: sapResponse.data?.slice?.(0, 3) || null,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } catch (syncErr: any) {
        await supabase.from('sap_stock_sync_history').update({
          status: 'failed',
          error_message: syncErr.message || 'Unknown sync error',
          completed_at: new Date().toISOString(),
        }).eq('id', syncRecord.id)

        return new Response(JSON.stringify({
          success: false,
          error: syncErr.message,
          sync_id: syncRecord.id,
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // UNBLOCK - Call SAP 343 (Blocked to Unrestricted) with dynamic MRB data,
    // then optionally verify live stock via MB52
    if (action === 'unblock') {
      const { request_body, verify_config_id } = body
      if (!request_body) {
        return new Response(JSON.stringify({ error: 'request_body is required for unblock action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      try {
        const url = buildUrl(config)
        const headers = buildAuthHeaders(config)
        const method = (config.http_method || 'PUT').toUpperCase()
        const timeout = config.timeout_ms || 30000

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        const fetchOpts: RequestInit = {
          method,
          headers,
          signal: controller.signal,
          body: JSON.stringify(Array.isArray(request_body) ? request_body : [request_body]),
        }

        const response = await fetch(url, fetchOpts)
        clearTimeout(timer)

        const bodyText = await response.text()
        console.log('SAP 343 raw response status:', response.status, 'body:', bodyText)

        const normalizedBodyText = bodyText.trim()
        const emptyResponseMeta = {
          response_type: 'empty_body',
          source: config.config_name || 'SAP_343_Blocked_To_Unrestricted',
          note: 'Upstream SAP endpoint returned success with no payload',
          http_status: response.status,
          method,
          endpoint: url,
          received_at: new Date().toISOString(),
          content_type: response.headers.get('content-type') || null,
          upstream_date: response.headers.get('date') || null,
          upstream_server: response.headers.get('server') || null,
          request_matnr: request_body.MATNR ?? null,
          request_werks: request_body.WERKS ?? null,
          request_lgort: request_body.LGORT ?? null,
          request_charg: request_body.CHARG ?? null,
          request_qty: request_body.ENTRY_QNT ?? null,
          request_uom: request_body.ENTRY_UOM ?? null,
        }

        let responseData: any = null
        try {
          const parsed = normalizedBodyText ? JSON.parse(bodyText) : null
          responseData = parsed === '' || parsed === null ? emptyResponseMeta : parsed
        } catch {
          responseData = normalizedBodyText
            ? {
                response_type: 'text_body',
                http_status: response.status,
                method,
                endpoint: url,
                body: bodyText.substring(0, 2000),
              }
            : emptyResponseMeta
        }

        if (!response.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
            sap_response: responseData,
            http_status: response.status,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const sapCode = responseData?.CODE || responseData?.code || responseData?.Code || null
        const sapMsg = responseData?.MSG || responseData?.msg || responseData?.Message || responseData?.message || responseData?.note || null
        const sapMBLNR = responseData?.MBLNR || responseData?.mblnr || responseData?.MaterialDocument || null
        const sapMJAHR = responseData?.MJAHR || responseData?.mjahr || responseData?.MaterialDocumentYear || null

        let verification: any = null
        if (verify_config_id) {
          const { data: verifyConfig, error: verifyConfigError } = await supabase
            .from('sap_api_config')
            .select('*')
            .eq('id', verify_config_id)
            .single()

          if (verifyConfigError || !verifyConfig) {
            verification = { success: false, error: 'Verification config not found' }
          } else {
            const { data: verifyRequestFields } = await supabase
              .from('sap_api_request_fields')
              .select('*')
              .eq('config_id', verify_config_id)
              .order('sort_order')

            const verifyResponse = await callSAPApi(verifyConfig, verifyRequestFields || [], {
              WERKS: request_body.WERKS,
              LGORT: request_body.LGORT,
              MATNR: request_body.MATNR,
              CHARG: request_body.CHARG,
            })

            verification = verifyResponse.success
              ? {
                  success: true,
                  count: Array.isArray(verifyResponse.data) ? verifyResponse.data.length : 0,
                  records: Array.isArray(verifyResponse.data) ? verifyResponse.data.slice(0, 3) : [],
                }
              : {
                  success: false,
                  error: verifyResponse.error,
                }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          sap_response: responseData,
          code: sapCode,
          message: sapMsg,
          material_document: sapMBLNR,
          material_document_year: sapMJAHR,
          http_status: response.status,
          raw_body_length: bodyText.length,
          verification,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } catch (err: any) {
        const errMsg = err.name === 'AbortError'
          ? `SAP API timed out after ${config.timeout_ms || 30000}ms`
          : `Network error: ${err.message}`
        return new Response(JSON.stringify({ success: false, error: errMsg }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // UPDATE TRANSACTION QUANTITY - Updates qty in DB and calls SAP API
    if (action === 'update_transaction_qty') {
      const { lot_id, new_quantity, inspection_lot, material_code, plant, storage_location, batch } = body
      if (!lot_id || new_quantity === undefined || new_quantity === null) {
        return new Response(JSON.stringify({ error: 'lot_id and new_quantity are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (typeof new_quantity !== 'number' || new_quantity < 0) {
        return new Response(JSON.stringify({ error: 'new_quantity must be a non-negative number' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Step 1: Read old value for rollback
      const { data: oldRecord, error: readErr } = await supabase
        .from('inward_inspection_lots')
        .select('transaction_quantity')
        .eq('id', lot_id)
        .single()

      if (readErr || !oldRecord) {
        return new Response(JSON.stringify({ error: 'Inspection lot not found', details: readErr?.message }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const oldQuantity = oldRecord.transaction_quantity

      // Step 2: Update DB first (optimistic)
      const { error: updateErr } = await supabase
        .from('inward_inspection_lots')
        .update({ transaction_quantity: new_quantity, updated_at: new Date().toISOString() })
        .eq('id', lot_id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: 'Database update failed', details: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Step 3: Call SAP API to update quantity
      try {
        const url = buildUrl(config)
        const headers = buildAuthHeaders(config)
        const method = (config.http_method || 'POST').toUpperCase()
        const timeout = config.timeout_ms || 30000

        const sapPayload = {
          MATNR: material_code || '',
          WERKS: plant || '',
          LGORT: storage_location || '',
          CHARG: batch || '',
          INSPECTION_LOT: inspection_lot || '',
          ENTRY_QNT: String(new_quantity),
          ACTION: 'UPDATE_QTY',
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        const fetchOpts: RequestInit = {
          method,
          headers,
          signal: controller.signal,
          body: JSON.stringify(sapPayload),
        }

        const response = await fetch(url, fetchOpts)
        clearTimeout(timer)

        const bodyText = await response.text()
        console.log('SAP update_qty raw response:', response.status, bodyText)

        if (!response.ok) {
          // Step 4: Rollback DB on SAP failure
          await supabase
            .from('inward_inspection_lots')
            .update({ transaction_quantity: oldQuantity, updated_at: new Date().toISOString() })
            .eq('id', lot_id)

          return new Response(JSON.stringify({
            success: false,
            error: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
            rolled_back: true,
            old_quantity: oldQuantity,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        let sapResponseData: any = null
        try {
          sapResponseData = bodyText.trim() ? JSON.parse(bodyText) : { status: 'ok', http_status: response.status }
        } catch {
          sapResponseData = { raw: bodyText.substring(0, 1000), http_status: response.status }
        }

        return new Response(JSON.stringify({
          success: true,
          new_quantity,
          old_quantity: oldQuantity,
          sap_response: sapResponseData,
          http_status: response.status,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } catch (err: any) {
        // Rollback DB on network error
        await supabase
          .from('inward_inspection_lots')
          .update({ transaction_quantity: oldQuantity, updated_at: new Date().toISOString() })
          .eq('id', lot_id)

        const errMsg = err.name === 'AbortError'
          ? `SAP API timed out after ${config.timeout_ms || 30000}ms`
          : `Network error: ${err.message}`
        return new Response(JSON.stringify({
          success: false,
          error: errMsg,
          rolled_back: true,
          old_quantity: oldQuantity,
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "test", "sync", "unblock", or "update_transaction_qty".' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Build the full URL based on connection mode, including sap-client query param only when missing
function buildUrl(config: any): string {
  let url: string
  if (config.connection_mode === 'vpn_tunnel' && config.proxy_tunnel_url) {
    url = `${config.proxy_tunnel_url.replace(/\/$/, '')}${config.endpoint_path || ''}`
  } else if (config.connection_mode === 'proxy' && config.proxy_tunnel_url) {
    url = `${config.proxy_tunnel_url.replace(/\/$/, '')}${config.endpoint_path || ''}`
  } else {
    const base = config.base_url || ''
    const path = config.endpoint_path || config.api_endpoint || ''
    url = `${base.replace(/\/$/, '')}${path}`
  }

  if (config.sap_client && !/[?&]sap-client=/.test(url)) {
    url += `${url.includes('?') ? '&' : '?'}sap-client=${config.sap_client}`
  }

  return url
}

// Build auth headers
function buildAuthHeaders(config: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  if (config.proxy_secret) {
    headers['x-proxy-secret'] = config.proxy_secret
  }

  if (config.auth_type === 'basic' && config.username) {
    const credentials = `${config.username}:${config.encrypted_password || ''}`
    headers['Authorization'] = `Basic ${btoa(credentials)}`
  } else if (config.auth_type === 'api_key' && config.api_key) {
    headers['X-API-Key'] = config.api_key
  } else if (config.auth_type === 'oauth2' && config.token_url) {
    // OAuth would need a token exchange first - placeholder
    headers['Authorization'] = `Bearer oauth-token-placeholder`
  }

  // Parse custom headers
  if (config.custom_headers && typeof config.custom_headers === 'object') {
    Object.entries(config.custom_headers).forEach(([key, value]) => {
      if (key && value) headers[key] = String(value)
    })
  }

  return headers
}

// Test SAP connection
async function testConnection(config: any): Promise<{ success: boolean; message: string; status?: number; responseTime?: number }> {
  const url = buildUrl(config)
  const headers = buildAuthHeaders(config)
  const method = (config.http_method || 'GET').toUpperCase()
  const timeout = config.timeout_ms || 30000

  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const fetchOpts: RequestInit = { method, headers, signal: controller.signal }
    // For POST/PUT methods, send a minimal valid request body
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOpts.body = JSON.stringify({})
    }

    const response = await fetch(url, fetchOpts)
    clearTimeout(timer)
    const elapsed = Date.now() - start
    const bodyText = await response.text()

    if (response.ok) {
      return {
        success: true,
        message: `Connection successful. Status: ${response.status}, Response time: ${elapsed}ms, Body length: ${bodyText.length} chars`,
        status: response.status,
        responseTime: elapsed,
      }
    } else {
      return {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}. Body: ${bodyText.substring(0, 500)}`,
        status: response.status,
        responseTime: elapsed,
      }
    }
  } catch (err: any) {
    const elapsed = Date.now() - start
    if (err.name === 'AbortError') {
      return { success: false, message: `Connection timed out after ${timeout}ms`, responseTime: elapsed }
    }
    return { success: false, message: `Network error: ${err.message}`, responseTime: elapsed }
  }
}

// Call SAP API and get data
async function callSAPApi(
  config: any,
  requestFields: any[],
  requestOverrides: Record<string, any> = {},
): Promise<{ success: boolean; data?: any; error?: string }> {
  const url = buildUrl(config)
  const headers = buildAuthHeaders(config)
  const method = (config.http_method || 'GET').toUpperCase()
  const timeout = config.timeout_ms || 30000

  let requestBody: any = undefined
  if (['POST', 'PUT', 'PATCH'].includes(method) && requestFields.length > 0) {
    requestBody = {}
    requestFields.forEach((field) => {
      const key = field.sap_field_name || field.field_name
      requestBody[key] = requestOverrides[key] ?? field.default_value ?? ''
    })
  }

  let finalUrl = url
  if (method === 'GET' && requestFields.length > 0) {
    const params = new URLSearchParams()
    requestFields.forEach((field) => {
      const key = field.sap_field_name || field.field_name
      const value = requestOverrides[key] ?? field.default_value
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

    const fetchOpts: RequestInit = { method, headers, signal: controller.signal }
    if (requestBody) {
      fetchOpts.body = JSON.stringify(requestBody)
    }

    const response = await fetch(finalUrl, fetchOpts)
    clearTimeout(timer)

    const bodyText = await response.text()
    if (!response.ok) {
      return { success: false, error: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}` }
    }

    try {
      const jsonData = JSON.parse(bodyText)
      const records = jsonData?.d?.results || jsonData?.value || jsonData?.data || (Array.isArray(jsonData) ? jsonData : [jsonData])
      return { success: true, data: records }
    } catch {
      return { success: false, error: `Response is not valid JSON: ${bodyText.substring(0, 200)}` }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: `SAP API timed out after ${timeout}ms` }
    }
    return { success: false, error: `Network error calling SAP: ${err.message}` }
  }
}

// Map SAP response data to database tables using field mappings
async function mapAndInsertData(
  supabase: any,
  records: any[],
  responseFields: any[],
  config: any,
  syncId: string,
): Promise<{ fetched: number; inserted: number; updated: number; errors: string[] }> {
  const result = { fetched: records.length, inserted: 0, updated: 0, errors: [] as string[] }

  if (!records.length || !responseFields.length) {
    if (!responseFields.length) result.errors.push('No response field mappings configured')
    if (!records.length) result.errors.push('No records returned from SAP')
    return result
  }

  const allowedColumnsByTable = {
    shop_floor_stock: new Set([
      'plant',
      'material_code',
      'material_description',
      'batch',
      'storage_location',
      'storage_location_desc',
      'available_quantity',
      'blocked_quantity',
      'quality_inspection_qty',
      'transfer_qty',
      'unrestricted_value',
      'blocked_value',
      'quality_inspection_value',
      'transfer_value',
      'row_number_custom',
      'shelf_number',
      'rack_number',
      'bin_number',
      'uom',
      'production_order',
      'reservation_number',
      'sap_sync_id',
      'source',
      'status',
    ]),
    inward_inspection_lots: new Set([
      'inspection_lot',
      'material_code',
      'material_description',
      'plant',
      'storage_location',
      'batch',
      'uom',
      'blocked_quantity',
      'transaction_quantity',
      'status',
      'block_reason',
      'vendor_code',
      'vendor_name',
      'po_number',
      'grn_number',
      'uploaded_by',
      'upload_batch_id',
    ]),
    materials: new Set(['material_number', 'description', 'uom', 'category']),
    vendors: new Set(['code', 'name', 'contact_email', 'contact_phone', 'address', 'is_active']),
  } as const

  const requiredColumnsByTable = {
    shop_floor_stock: ['plant', 'material_code', 'available_quantity'],
    inward_inspection_lots: ['inspection_lot', 'material_code', 'plant'],
    materials: ['material_number', 'description'],
    vendors: ['code', 'name'],
  } as const

  const aliasMapByTable: Record<string, Record<string, string>> = {
    shop_floor_stock: {
      material: 'material_code',
      matnr: 'material_code',
      material_desc: 'material_description',
      maktx: 'material_description',
      unrestricted_qty: 'available_quantity',
      labst: 'available_quantity',
      charg: 'batch',
      lgobe: 'storage_location_desc',
      speme: 'blocked_quantity',
      insme: 'quality_inspection_qty',
      trame: 'transfer_qty',
      wlabs: 'unrestricted_value',
      wspem: 'blocked_value',
      winsm: 'quality_inspection_value',
      wtram: 'transfer_value',
      rowno: 'row_number_custom',
      shelfno: 'shelf_number',
      rackno: 'rack_number',
      binno: 'bin_number',
    },
    inward_inspection_lots: {
      matnr: 'material_code',
      material: 'material_code',
      maktx: 'material_description',
      material_desc: 'material_description',
      werks: 'plant',
      charg: 'batch',
    },
    materials: {
      material: 'material_number',
      matnr: 'material_number',
      material_desc: 'description',
      maktx: 'description',
    },
    vendors: {
      vendor_code: 'code',
      lifnr: 'code',
      vendor_name: 'name',
      name1: 'name',
    },
  }

  // Group fields by target table
  const tableFieldMap = new Map<string, any[]>()
  responseFields.forEach((field) => {
    const table = field.map_to_table
    if (!table || !field.map_to_column) return
    if (!tableFieldMap.has(table)) tableFieldMap.set(table, [])
    tableFieldMap.get(table)!.push(field)
  })

  for (const [tableName, fields] of tableFieldMap) {
    try {
      const allowedColumns = allowedColumnsByTable[tableName as keyof typeof allowedColumnsByTable]
      if (!allowedColumns) {
        result.errors.push(`Unsupported target table: ${tableName}`)
        continue
      }

      const aliases = aliasMapByTable[tableName] || {}
      const sanitizedRows = records.map((record, index) => {
        const row: Record<string, any> = {}

        fields.forEach((field) => {
          let value: any
          if (field.json_path) {
            value = getNestedValue(record, field.json_path)
          } else {
            value = record[field.sap_field_name || field.field_name]
          }

          if (value === undefined || value === null || value === '') return

          const requestedColumn = String(field.map_to_column).trim()
          const normalizedColumn = aliases[requestedColumn.toLowerCase()] || requestedColumn
          if (!allowedColumns.has(normalizedColumn)) {
            return
          }

          row[normalizedColumn] = value
        })

        if (tableName === 'shop_floor_stock') {
          row.status = ['available', 'blocked', 'reserved'].includes(String(row.status || '').toLowerCase())
            ? String(row.status).toLowerCase()
            : 'available'
          row.source = 'sap_api'
          row.sap_sync_id = syncId
          if (row.available_quantity !== undefined) {
            const quantity = Number(row.available_quantity)
            row.available_quantity = Number.isFinite(quantity) ? quantity : undefined
          }
        }

        if (tableName === 'inward_inspection_lots') {
          row.status = row.status || 'pending'
        }

        const requiredColumns = requiredColumnsByTable[tableName as keyof typeof requiredColumnsByTable] || []
        const missingRequired = requiredColumns.filter((column) => {
          const value = row[column]
          return value === undefined || value === null || value === ''
        })

        if (missingRequired.length > 0) {
          result.errors.push(
            `Skipped ${tableName} row ${index + 1}: missing required mapped fields (${missingRequired.join(', ')})`,
          )
          return null
        }

        return row
      }).filter(Boolean) as Record<string, any>[]

      if (sanitizedRows.length === 0) continue

      const batchSize = 500

      for (let index = 0; index < sanitizedRows.length; index += batchSize) {
        const batch = sanitizedRows.slice(index, index + batchSize)
        const { data, error } = await supabase
          .from(tableName)
          .upsert(batch, tableName === 'inward_inspection_lots'
            ? { onConflict: 'inspection_lot' }
            : undefined)
          .select()

        if (error) {
          result.errors.push(`Error inserting into ${tableName}: ${error.message}`)
          break
        }

        result.inserted += data?.length || 0
      }
    } catch (tableErr: any) {
      result.errors.push(`Error processing table ${tableName}: ${tableErr.message}`)
    }
  }

  return result
}

// Get nested value from object using dot notation path
function getNestedValue(obj: any, path: string): any {
  const normalizedPath = path
    .replace(/^\$\[\*\]\./, '')
    .replace(/^\$\./, '')
    .replace(/^\$/, '')

  if (!normalizedPath) return obj

  return normalizedPath.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      return current[arrayMatch[1]]?.[parseInt(arrayMatch[2])]
    }
    return current[key]
  }, obj)
}

// btoa is available globally in Deno
