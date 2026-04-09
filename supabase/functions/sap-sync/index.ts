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
      .maybeSingle()

    if (configError || !config) {
      return new Response(JSON.stringify({ success: false, error: 'Configuration not found', details: configError?.message }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // TEST CONNECTION
    if (action === 'test') {
      const result = await testConnection(config)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // TRIGGER SYNC
    if (action === 'sync') {
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
        return new Response(JSON.stringify({ success: false, error: 'Failed to create sync record', details: syncInsertErr.message }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      try {
        const { data: responseFields } = await supabase
          .from('sap_api_response_fields')
          .select('*')
          .eq('config_id', config_id)
          .order('sort_order')

        const { data: requestFields } = await supabase
          .from('sap_api_request_fields')
          .select('*')
          .eq('config_id', config_id)
          .order('sort_order')

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
            debug: sapResponse.debug,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

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
          debug: sapResponse.debug,
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
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // UNBLOCK - SAP 343
    if (action === 'unblock') {
      const { request_body, verify_config_id } = body
      if (!request_body) {
        return new Response(JSON.stringify({ success: false, error: 'request_body is required for unblock action' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

        const response = await proxyAwareFetch(config, url, fetchOpts)
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
          const sapErrorHint = extractSapErrorHint(response.status, bodyText)
          return new Response(JSON.stringify({
            success: false,
            error: sapErrorHint || `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
            sap_response: responseData,
            http_status: response.status,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // UPDATE TRANSACTION QUANTITY
    if (action === 'update_transaction_qty') {
      const { lot_id, new_quantity, inspection_lot, material_code, plant, storage_location, batch } = body
      if (!lot_id || new_quantity === undefined || new_quantity === null) {
        return new Response(JSON.stringify({ success: false, error: 'lot_id and new_quantity are required' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (typeof new_quantity !== 'number' || new_quantity < 0) {
        return new Response(JSON.stringify({ success: false, error: 'new_quantity must be a non-negative number' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: oldRecord, error: readErr } = await supabase
        .from('inward_inspection_lots')
        .select('transaction_quantity')
        .eq('id', lot_id)
        .single()

      if (readErr || !oldRecord) {
        return new Response(JSON.stringify({ success: false, error: 'Inspection lot not found', details: readErr?.message }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const oldQuantity = oldRecord.transaction_quantity

      const { error: updateErr } = await supabase
        .from('inward_inspection_lots')
        .update({ transaction_quantity: new_quantity, updated_at: new Date().toISOString() })
        .eq('id', lot_id)

      if (updateErr) {
        return new Response(JSON.stringify({ success: false, error: 'Database update failed', details: updateErr.message }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

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

        const response = await proxyAwareFetch(config, url, fetchOpts)
        clearTimeout(timer)

        const bodyText = await response.text()
        console.log('SAP update_qty raw response:', response.status, bodyText)

        if (!response.ok) {
          await supabase
            .from('inward_inspection_lots')
            .update({ transaction_quantity: oldQuantity, updated_at: new Date().toISOString() })
            .eq('id', lot_id)

          const sapErrorHint = extractSapErrorHint(response.status, bodyText)
          return new Response(JSON.stringify({
            success: false,
            error: sapErrorHint || `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
            rolled_back: true,
            old_quantity: oldQuantity,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // FETCH LIVE - MB52 on-demand stock fetch
    if (action === 'fetch_live') {
      try {
        const { data: requestFields } = await supabase
          .from('sap_api_request_fields')
          .select('*')
          .eq('config_id', config_id)
          .order('sort_order')

        const { data: responseFields } = await supabase
          .from('sap_api_response_fields')
          .select('*')
          .eq('config_id', config_id)
          .order('sort_order')

        // Build request payload from fields + overrides
        const requestPayload: Record<string, any> = {}
        for (const field of (requestFields || [])) {
          requestPayload[field.sap_field_name || field.field_name] = field.default_value || ''
        }
        // Apply overrides from body
        if (body.request_body && typeof body.request_body === 'object') {
          Object.assign(requestPayload, body.request_body)
        }
        // Also merge search_params from the UI (WERKS, LGORT, MATNR, MATART)
        if (body.search_params && typeof body.search_params === 'object') {
          for (const [key, value] of Object.entries(body.search_params)) {
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              requestPayload[key] = String(value).trim()
            }
          }
        }

        const url = buildUrl(config)
        const headers = buildAuthHeaders(config)
        const method = (config.http_method || 'POST').toUpperCase()
        const timeout = config.timeout_ms || 30000

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        const fetchOpts: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        }
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          fetchOpts.body = JSON.stringify(requestPayload)
        }

        const response = await proxyAwareFetch(config, url, fetchOpts)
        clearTimeout(timer)

        const bodyText = await response.text()
        console.log('SAP fetch_live raw response status:', response.status)

        if (!response.ok) {
          const sapErrorHint = extractSapErrorHint(response.status, bodyText)
          return new Response(JSON.stringify({
            success: false,
            error: sapErrorHint || `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        let sapData: any = null
        try {
          const parsed = bodyText.trim() ? JSON.parse(bodyText) : {}
          // Extract array from common SAP response structures
          if (parsed.d?.results) sapData = parsed.d.results
          else if (parsed.value) sapData = parsed.value
          else if (Array.isArray(parsed)) sapData = parsed
          else sapData = parsed
        } catch {
          sapData = { raw: bodyText.substring(0, 2000) }
        }

        // Map response fields if configured
        let mappedRecords = Array.isArray(sapData) ? sapData : [sapData]
        if (responseFields && responseFields.length > 0 && Array.isArray(sapData)) {
          mappedRecords = sapData.map((item: any) => {
            const mapped: Record<string, any> = {}
            for (const field of responseFields) {
              const sapKey = field.sap_field_name || field.field_name
              const outKey = field.map_to_column || field.field_name
              mapped[outKey] = item[sapKey] ?? null
            }
            return mapped
          })
        }

        return new Response(JSON.stringify({
          success: true,
          records: mappedRecords,
          total: mappedRecords.length,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } catch (err: any) {
        const errMsg = err.name === 'AbortError'
          ? `SAP API timed out after ${config.timeout_ms || 30000}ms`
          : `Network error: ${err.message}`
        return new Response(JSON.stringify({ success: false, error: errMsg }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action. Use "test", "sync", "unblock", "fetch_live", or "update_transaction_qty".' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ═══════════════ SAP Error Detection ═══════════════

/**
 * Detect SAP-specific auth/logon errors in response body.
 * Returns a friendly message or null if not a SAP auth error.
 */
function isSapAuthError(bodyText: string): boolean {
  const lower = bodyText.toLowerCase()
  return lower.includes('logon error message') ||
    lower.includes('anmeldung fehlgeschlagen') ||
    lower.includes('login failed') ||
    lower.includes('not authenticated') ||
    lower.includes('sap logon')
}

/**
 * Extract a user-friendly error message from SAP responses.
 */
function extractSapErrorHint(status: number, bodyText: string): string | null {
  if (isSapAuthError(bodyText)) {
    return `Transport OK. SAP rejected username/password or SAP client (HTTP ${status}). Check credentials in SAP API Settings.`
  }
  if (status === 401 || status === 403) {
    return `SAP authentication failed (HTTP ${status}). Check username, password, and SAP client.`
  }
  if (status === 404 && bodyText.includes('<html')) {
    // SAP returns HTML 404 for auth errors
    return `Transport OK but SAP returned HTML error page (HTTP 404). This usually means wrong credentials or SAP client number.`
  }
  return null
}

// Build the SAP target URL (what SAP actually receives)
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

  // Extract raw credentials from Authorization header to avoid encoding issues
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

  console.log(`[fetchViaProxy] POST ${proxyEndpoint} → ${method} ${targetUrl}`)

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
    // Proxy itself failed
    return new Response(responseText, { status: response.status, statusText: response.statusText })
  }

  // Unwrap proxy response: { statusCode, headers, body/data }
  try {
    const proxyResult = JSON.parse(responseText)
    console.log(`[fetchViaProxy] Proxy response keys: ${Object.keys(proxyResult).join(', ')}, statusCode: ${proxyResult.statusCode}`)
    const sapStatus = proxyResult.statusCode || proxyResult.status || 200

    // Handle both 'body' and 'data' field names from different proxy implementations
    const rawBody = proxyResult.body ?? proxyResult.data ?? proxyResult.response ?? ''
    const sapBody = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)

    console.log(`[fetchViaProxy] SAP status: ${sapStatus}, body length: ${sapBody.length}, body preview: ${sapBody.substring(0, 300)}`)

    return new Response(sapBody, {
      status: sapStatus,
      statusText: `SAP ${sapStatus}`,
      headers: { 'content-type': proxyResult.headers?.['content-type'] || 'application/json' },
    })
  } catch {
    console.log(`[fetchViaProxy] Failed to parse proxy response, returning raw. Length: ${responseText.length}, preview: ${responseText.substring(0, 300)}`)
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

// Build URL for backward compatibility (returns SAP target URL)
function buildUrl(config: any): string {
  return buildSapTargetUrl(config)
}

// Normalize credential values
function normalizeCredential(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\r?\n/g, '').trim() : ''
}

// Build auth headers
function buildAuthHeaders(config: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }

  const authType = String(config.auth_type || 'basic').toLowerCase()
  const username = normalizeCredential(config.username)
  const password = normalizeCredential(config.encrypted_password)

  if (config.proxy_secret) {
    headers['x-proxy-secret'] = config.proxy_secret
  }

  if (config.sap_client) {
    headers['sap-client'] = String(config.sap_client)
  }

  if (authType === 'basic' && username) {
    headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
    // Forward raw credentials for proxy to reconstruct
    headers['username'] = username
    headers['password'] = password
    headers['x-sap-username'] = username
    headers['x-sap-password'] = password
  } else if (authType === 'api_key' && config.api_key) {
    headers['X-API-Key'] = config.api_key
  } else if ((authType === 'oauth' || authType === 'oauth2') && config.token_url) {
    headers['Authorization'] = `Bearer oauth-token-placeholder`
  }

  if (config.custom_headers && typeof config.custom_headers === 'object') {
    Object.entries(config.custom_headers).forEach(([key, value]) => {
      if (key && value) headers[key] = String(value)
    })
  }

  return headers
}

// Build alternate auth headers (sap-client in header only, no query param)
function buildAltAuthHeaders(config: any): Record<string, string> {
  const headers = buildAuthHeaders(config)
  // Add additional credential aliases
  const username = normalizeCredential(config.username)
  const password = normalizeCredential(config.encrypted_password)
  if (username && password) {
    headers['sap-username'] = username
    headers['sap-password'] = password
    headers['sap_user'] = username
    headers['sap_password'] = password
  }
  return headers
}

function removeSapClientFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    parsed.searchParams.delete('sap-client')
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

function buildDebugMeta(config: any, url: string, headers: Record<string, string>, method: string) {
  const username = normalizeCredential(config.username)
  const password = normalizeCredential(config.encrypted_password)

  return {
    credentials_source: 'sap_api_config',
    config_name: config.config_name || null,
    auth_type: config.auth_type || 'basic',
    username,
    username_length: username.length,
    password_length: password.length,
    sap_client: config.sap_client || null,
    connection_mode: config.connection_mode || null,
    proxy_tunnel_url: config.proxy_tunnel_url || null,
    endpoint_path: config.endpoint_path || null,
    method,
    url,
    has_proxy_secret: Boolean(config.proxy_secret),
    has_authorization_header: Boolean(headers['Authorization']),
    authorization_scheme: headers['Authorization']?.split(' ')[0] || null,
  }
}

// ═══════════════ Multi-attempt Test Connection ═══════════════

async function testConnection(config: any): Promise<{ success: boolean; message: string; status?: number; responseTime?: number; debug: ReturnType<typeof buildDebugMeta>; attempt?: string }> {
  const url = buildUrl(config)
  const headers = buildAuthHeaders(config)
  const method = (config.http_method || 'GET').toUpperCase()
  const timeout = config.timeout_ms || 30000
  const debug = buildDebugMeta(config, url, headers, method)

  console.log('[sap-sync:test] Using DB credentials', debug)

  const authType = String(config.auth_type || 'basic').toLowerCase()
  const username = normalizeCredential(config.username)
  const password = normalizeCredential(config.encrypted_password)

  // Build attempt queue similar to browser client
  const attemptQueue: Array<{ label: string; targetUrl: string; attemptHeaders: Record<string, string> }> = [
    { label: 'default', targetUrl: url, attemptHeaders: headers },
  ]

  if (authType === 'basic' && username && password) {
    // Attempt 2: sap-client in header only (remove from URL query)
    const noQueryUrl = removeSapClientFromUrl(url)
    if (noQueryUrl !== url) {
      attemptQueue.push({
        label: 'sap-client_header_only',
        targetUrl: noQueryUrl,
        attemptHeaders: headers,
      })
    }

    // Attempt 3: alt credential headers
    attemptQueue.push({
      label: 'alt_credential_headers',
      targetUrl: url,
      attemptHeaders: buildAltAuthHeaders(config),
    })
  }

  const start = Date.now()

  for (const attempt of attemptQueue) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const fetchOpts: RequestInit = { method, headers: attempt.attemptHeaders, signal: controller.signal }
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOpts.body = JSON.stringify({})
      }

      console.log(`[sap-sync:test] Attempt: ${attempt.label} → ${attempt.targetUrl}`)
      const response = await proxyAwareFetch(config, attempt.targetUrl, fetchOpts)
      clearTimeout(timer)
      const elapsed = Date.now() - start
      const bodyText = await response.text()

      if (response.ok) {
        return {
          success: true,
          message: `Connection successful (attempt: ${attempt.label}). Status: ${response.status}, Response time: ${elapsed}ms, Body length: ${bodyText.length} chars`,
          status: response.status,
          responseTime: elapsed,
          debug,
          attempt: attempt.label,
        }
      }

      // Check if this is a SAP auth error — try next attempt
      if (isSapAuthError(bodyText) || response.status === 401 || response.status === 403) {
        console.log(`[sap-sync:test] Attempt "${attempt.label}" got SAP auth error (${response.status}), trying next...`)
        continue
      }

      // Non-auth error on first attempt with HTML 404 — could be SAP login page
      if (response.status === 404 && bodyText.includes('<html')) {
        console.log(`[sap-sync:test] Attempt "${attempt.label}" got HTML 404 (possible SAP login page), trying next...`)
        continue
      }

      // Other error — return it
      const sapHint = extractSapErrorHint(response.status, bodyText)
      return {
        success: false,
        message: sapHint || `HTTP ${response.status}: ${response.statusText}. Body: ${bodyText.substring(0, 500)}`,
        status: response.status,
        responseTime: elapsed,
        debug,
        attempt: attempt.label,
      }
    } catch (err: any) {
      const elapsed = Date.now() - start
      if (err.name === 'AbortError') {
        return { success: false, message: `Connection timed out after ${timeout}ms`, responseTime: elapsed, debug, attempt: attempt.label }
      }
      return { success: false, message: `Network error: ${err.message}`, responseTime: elapsed, debug, attempt: attempt.label }
    }
  }

  // All attempts exhausted
  const elapsed = Date.now() - start
  return {
    success: false,
    message: `Transport OK but SAP rejected all ${attemptQueue.length} credential attempts. Check username, password, and SAP client number in API Settings.`,
    responseTime: elapsed,
    debug,
    attempt: 'all_exhausted',
  }
}

// Call SAP API and get data
async function callSAPApi(
  config: any,
  requestFields: any[],
  requestOverrides: Record<string, any> = {},
): Promise<{ success: boolean; data?: any; error?: string; debug: ReturnType<typeof buildDebugMeta> }> {
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

  const debug = buildDebugMeta(config, finalUrl, headers, method)
  console.log('[sap-sync:sync] Using DB credentials', debug)

  // Build attempt queue for multi-attempt auth fallback
  const authType = String(config.auth_type || 'basic').toLowerCase()
  const username = normalizeCredential(config.username)
  const password = normalizeCredential(config.encrypted_password)

  const attemptQueue: Array<{ label: string; targetUrl: string; attemptHeaders: Record<string, string> }> = [
    { label: 'default', targetUrl: finalUrl, attemptHeaders: headers },
  ]

  if (authType === 'basic' && username && password) {
    const noQueryUrl = removeSapClientFromUrl(finalUrl)
    if (noQueryUrl !== finalUrl) {
      attemptQueue.push({
        label: 'sap-client_header_only',
        targetUrl: noQueryUrl,
        attemptHeaders: headers,
      })
    }
    attemptQueue.push({
      label: 'alt_credential_headers',
      targetUrl: finalUrl,
      attemptHeaders: buildAltAuthHeaders(config),
    })
  }

  for (const attempt of attemptQueue) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const fetchOpts: RequestInit = { method, headers: attempt.attemptHeaders, signal: controller.signal }
      if (requestBody) {
        fetchOpts.body = JSON.stringify(requestBody)
      }

      console.log(`[sap-sync:sync] Attempt: ${attempt.label}`)
      const response = await proxyAwareFetch(config, attempt.targetUrl, fetchOpts)
      clearTimeout(timer)

      const bodyText = await response.text()

      if (response.ok) {
        try {
          const jsonData = JSON.parse(bodyText)
          const records = jsonData?.d?.results || jsonData?.value || jsonData?.data || (Array.isArray(jsonData) ? jsonData : [jsonData])
          return { success: true, data: records, debug }
        } catch {
          return { success: false, error: `Response is not valid JSON: ${bodyText.substring(0, 200)}`, debug }
        }
      }

      // Check for SAP auth errors — try next attempt
      if (isSapAuthError(bodyText) || response.status === 401 || response.status === 403 || (response.status === 404 && bodyText.includes('<html'))) {
        console.log(`[sap-sync:sync] Attempt "${attempt.label}" got SAP auth/login error (${response.status}), trying next...`)
        continue
      }

      // Non-retryable error
      const hint = extractSapErrorHint(response.status, bodyText)
      return { success: false, error: hint || `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`, debug }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: `SAP API timed out after ${timeout}ms`, debug }
      }
      return { success: false, error: `Network error calling SAP: ${err.message}`, debug }
    }
  }

  // All attempts exhausted
  return {
    success: false,
    error: `Transport OK but SAP rejected all ${attemptQueue.length} credential attempts. Check username, password, and SAP client in API Settings.`,
    debug,
  }
}

// Map SAP response data to database tables
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
      'plant', 'material_code', 'material_description', 'batch', 'storage_location',
      'storage_location_desc', 'available_quantity', 'blocked_quantity', 'quality_inspection_qty',
      'transfer_qty', 'unrestricted_value', 'blocked_value', 'quality_inspection_value',
      'transfer_value', 'row_number_custom', 'shelf_number', 'rack_number', 'bin_number',
      'uom', 'production_order', 'reservation_number', 'sap_sync_id', 'source', 'status',
    ]),
    inward_inspection_lots: new Set([
      'inspection_lot', 'material_code', 'material_description', 'plant', 'storage_location',
      'batch', 'uom', 'blocked_quantity', 'transaction_quantity', 'status', 'block_reason',
      'vendor_code', 'vendor_name', 'po_number', 'po_item_number', 'grn_number', 'uploaded_by', 'upload_batch_id',
      'inspection_date', 'posting_date',
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
      material: 'material_code', matnr: 'material_code', material_desc: 'material_description',
      maktx: 'material_description', unrestricted_qty: 'available_quantity', labst: 'available_quantity',
      charg: 'batch', lgobe: 'storage_location_desc', speme: 'blocked_quantity',
      insme: 'quality_inspection_qty', trame: 'transfer_qty', wlabs: 'unrestricted_value',
      wspem: 'blocked_value', winsm: 'quality_inspection_value', wtram: 'transfer_value',
      rowno: 'row_number_custom', shelfno: 'shelf_number', rackno: 'rack_number', binno: 'bin_number',
    },
    inward_inspection_lots: {
      matnr: 'material_code', material: 'material_code', maktx: 'material_description',
      material_desc: 'material_description', werks: 'plant', charg: 'batch',
      lgort: 'storage_location', prueflos: 'inspection_lot', lifnr: 'vendor_code',
      name1: 'vendor_name', ebeln: 'po_number', ebelp: 'po_item_number', mblnr: 'grn_number',
      meins: 'uom', menge: 'blocked_quantity',
      inspection_lot: 'inspection_lot', storage_location: 'storage_location',
      vendor_code: 'vendor_code', vendor_name: 'vendor_name', po_item_number: 'po_item_number',
      grn_number: 'grn_number',
      qals_prueflos: 'inspection_lot', inspection_date: 'inspection_date', posting_date: 'posting_date',
    },
    materials: {
      material: 'material_number', matnr: 'material_number',
      material_desc: 'description', maktx: 'description',
    },
    vendors: {
      vendor_code: 'code', lifnr: 'code', vendor_name: 'name', name1: 'name',
    },
  }

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
          if (!allowedColumns.has(normalizedColumn)) return

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
        const upsertOptions = tableName === 'inward_inspection_lots'
          ? { onConflict: 'inspection_lot' }
          : tableName === 'shop_floor_stock'
          ? { onConflict: 'stock_key' }
          : undefined

        const { data, error } = await supabase
          .from(tableName)
          .upsert(batch, upsertOptions)
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
