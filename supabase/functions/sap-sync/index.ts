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

    // Auth client to verify user
    const authClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userEmail = claimsData.claims.email as string

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

    return new Response(JSON.stringify({ error: 'Invalid action. Use "test" or "sync".' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Build the full URL based on connection mode
function buildUrl(config: any): string {
  if (config.connection_mode === 'vpn_tunnel' && config.proxy_tunnel_url) {
    return `${config.proxy_tunnel_url.replace(/\/$/, '')}${config.endpoint_path || ''}`
  }
  if (config.connection_mode === 'proxy' && config.proxy_tunnel_url) {
    return `${config.proxy_tunnel_url.replace(/\/$/, '')}${config.endpoint_path || ''}`
  }
  const base = config.base_url || ''
  const path = config.endpoint_path || config.api_endpoint || ''
  return `${base.replace(/\/$/, '')}${path}`
}

// Build auth headers
function buildAuthHeaders(config: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  if (config.sap_client) {
    headers['sap-client'] = config.sap_client
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

    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    })
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
async function callSAPApi(config: any, requestFields: any[]): Promise<{ success: boolean; data?: any; error?: string }> {
  const url = buildUrl(config)
  const headers = buildAuthHeaders(config)
  const method = (config.http_method || 'GET').toUpperCase()
  const timeout = config.timeout_ms || 30000

  // Build request body from request fields (for POST/PUT)
  let requestBody: any = undefined
  if (['POST', 'PUT', 'PATCH'].includes(method) && requestFields.length > 0) {
    requestBody = {}
    requestFields.forEach((field) => {
      const key = field.sap_field_name || field.field_name
      requestBody[key] = field.default_value || ''
    })
  }

  // Build query params from request fields (for GET)
  let finalUrl = url
  if (method === 'GET' && requestFields.length > 0) {
    const params = new URLSearchParams()
    requestFields.forEach((field) => {
      if (field.default_value) {
        params.set(field.sap_field_name || field.field_name, field.default_value)
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

    // Try to parse as JSON
    try {
      const jsonData = JSON.parse(bodyText)
      // SAP often wraps data in d.results or value
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
      'available_quantity',
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
          .insert(batch)
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
