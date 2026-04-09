import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

function normalizeAuthType(authType: string | null | undefined): string {
  return (authType || 'none').toLowerCase().trim();
}

function removeSapClientFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete('sap-client');
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeCredential(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\r?\n/g, '').trim() : '';
}

function addCredentialQueryParams(rawUrl: string, username: string, password: string, sapClient?: string | null): string {
  if (!username || !password) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set('username', username);
    parsed.searchParams.set('password', password);
    parsed.searchParams.set('user', username);
    parsed.searchParams.set('pass', password);
    parsed.searchParams.set('sap_user', username);
    parsed.searchParams.set('sap_password', password);
    parsed.searchParams.set('sapUsername', username);
    parsed.searchParams.set('sapPassword', password);
    if (sapClient) {
      const client = String(sapClient);
      parsed.searchParams.set('sap_client', client);
      parsed.searchParams.set('sap-client', client);
      parsed.searchParams.set('sapClient', client);
      parsed.searchParams.set('client', client);
      parsed.searchParams.set('mandt', client);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function buildCredentialForwardHeaders(username: string, password: string, sapClient?: string | null): Record<string, string> {
  const forwarded: Record<string, string> = {
    username,
    password,
    user: username,
    pass: password,
    'x-sap-username': username,
    'x-sap-password': password,
    'x-sap-user': username,
    'x-sap-pass': password,
    'sap-username': username,
    'sap-password': password,
    'sap_user': username,
    'sap_password': password,
    sapUsername: username,
    sapPassword: password,
    'x-username': username,
    'x-password': password,
    'x-auth-username': username,
    'x-auth-password': password,
  };

  if (sapClient) {
    const client = String(sapClient);
    forwarded['sap-client'] = client;
    forwarded['sap_client'] = client;
    forwarded['sapClient'] = client;
    forwarded['x-sap-client'] = client;
    forwarded['x-client'] = client;
    forwarded['client'] = client;
    forwarded['mandt'] = client;
  }

  return forwarded;
}

/**
 * Detect if we're running against Lovable Cloud (supabase.co)
 * or a self-hosted Supabase instance (private IP / custom domain).
 */
function isLovableCloud(): boolean {
  return SUPABASE_URL.includes('supabase.co');
}

/**
 * Route a fetch request through the Node.js proxy's POST /proxy endpoint.
 * The proxy expects: { url, method, headers, body } in the request body
 * and returns: { statusCode, headers, body } in the response.
 */
async function fetchViaProxy(
  proxyBaseUrl: string,
  targetUrl: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    proxySecret?: string;
  }
): Promise<{ ok: boolean; status: number; statusText: string; bodyText: string; headers: Record<string, string> }> {
  const proxyEndpoint = `${proxyBaseUrl.replace(/\/$/, '')}/proxy`;

  const proxyHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  if (options.proxySecret) {
    proxyHeaders['x-proxy-secret'] = options.proxySecret;
  }

  // Build the forwarded headers (exclude proxy-specific ones)
  const forwardHeaders = { ...options.headers };
  delete forwardHeaders['x-proxy-secret'];
  delete forwardHeaders['ngrok-skip-browser-warning'];

  const proxyBody: Record<string, any> = {
    url: targetUrl,
    method: options.method,
    headers: forwardHeaders,
    body: options.body ? ((() => { try { return JSON.parse(options.body); } catch { return options.body; } })()) : undefined,
  };

  // Also send raw credentials so proxy can rebuild Authorization header fresh
  // This avoids encoding issues with special characters going through JSON serialization
  if (forwardHeaders['Authorization']?.startsWith('Basic ')) {
    try {
      const decoded = atob(forwardHeaders['Authorization'].replace('Basic ', ''));
      const colonIdx = decoded.indexOf(':');
      if (colonIdx > 0) {
        proxyBody.auth = {
          username: decoded.substring(0, colonIdx),
          password: decoded.substring(colonIdx + 1),
        };
      }
    } catch { /* ignore decode errors */ }
  }

  console.log(`[fetchViaProxy] POST ${proxyEndpoint} → ${options.method} ${targetUrl}`);

  const response = await fetch(proxyEndpoint, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify(proxyBody),
  });

  const responseText = await response.text();

  // If the proxy itself fails (network error, unauthorized, etc.)
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      bodyText: responseText,
      headers: {},
    };
  }

  // Parse the proxy's wrapped response
  try {
    const proxyResult = JSON.parse(responseText);
    const sapStatus = proxyResult.statusCode || 200;
    const sapBody = typeof proxyResult.body === 'string' ? proxyResult.body : JSON.stringify(proxyResult.body || '');
    return {
      ok: sapStatus >= 200 && sapStatus < 300,
      status: sapStatus,
      statusText: `SAP ${sapStatus}`,
      bodyText: sapBody,
      headers: proxyResult.headers || {},
    };
  } catch {
    // Proxy returned non-JSON — treat as error
    return {
      ok: false,
      status: 502,
      statusText: 'Proxy returned invalid response',
      bodyText: responseText,
      headers: {},
    };
  }
}

/**
 * Wrapper that replaces direct fetch() calls — routes through POST /proxy.
 * Builds the real SAP target URL from config, then sends via proxy.
 */
async function proxyAwareFetch(
  proxyBaseUrl: string,
  sapTargetUrl: string,
  fetchOpts: RequestInit,
  config: any,
): Promise<Response> {
  const method = (fetchOpts.method || 'GET').toUpperCase();
  const headers = fetchOpts.headers as Record<string, string> || {};
  const bodyStr = fetchOpts.body as string | undefined;

  const result = await fetchViaProxy(proxyBaseUrl, sapTargetUrl, {
    method,
    headers,
    body: bodyStr,
    proxySecret: config.proxy_secret,
  });

  // Create a Response-like object for backward compatibility
  return new Response(result.bodyText, {
    status: result.status,
    statusText: result.statusText,
  });
}

/**
 * Build the real SAP target URL (not the proxy URL).
 * This is what the proxy will call on SAP's side.
 */
function buildSapTargetUrl(config: any): string {
  const base = (config.base_url || config.api_endpoint || '').replace(/\/$/, '');
  const path = config.endpoint_path || '';
  let url = `${base}${path}`;

  if (config.sap_client && !/[?&]sap-client=/.test(url)) {
    url += `${url.includes('?') ? '&' : '?'}sap-client=${config.sap_client}`;
  }

  return url;
}

/**
 * For self-hosted environments, call the Node.js middleware directly
 * from the browser (no edge function needed).
 */
async function invokeDirect(body: Record<string, any>): Promise<{ data: any; error: any }> {
  const { action, config_id } = body;
  console.log(`%c[SAP Direct] invokeDirect called — action="${action}", config_id="${config_id}"`, 'color: #4caf50; font-weight: bold;');

  if (!config_id) {
    return { data: null, error: { message: 'config_id is required' } };
  }

  const getFallbackTokens = (currentAction: string): string[] => {
    switch (currentAction) {
      case 'unblock':
        return ['343', '/sap/api/343', 'blocked_to_unrestricted'];
      case 'fetch_live':
        return ['mb52', '/sap/api/mb52', 'stock_report'];
      case 'update_transaction_qty':
        return ['344', '/sap/api/344', 'unrestricted_to_blocked'];
      default:
        return [];
    }
  };

  // Fetch config from DB to get proxy_tunnel_url and proxy_secret
  let config: any = null;

  const { data: exactConfig, error: configError } = await supabase
    .from('sap_api_config')
    .select('*')
    .eq('id', config_id)
    .maybeSingle();

  if (configError) {
    console.error('[SAP Direct] Config fetch error:', configError);
    return { data: null, error: { message: configError?.message || 'Failed to load configuration' } };
  }

  config = exactConfig;

  if (!config) {
    const fallbackTokens = getFallbackTokens(action);

    if (fallbackTokens.length > 0) {
      const { data: configs, error: fallbackError } = await supabase
        .from('sap_api_config')
        .select('*')
        .eq('is_active', true);

      if (fallbackError) {
        console.error('[SAP Direct] Fallback config fetch error:', fallbackError);
        return { data: null, error: { message: fallbackError?.message || 'Failed to load fallback configuration' } };
      }

      config = (configs || []).find((entry: any) => {
        const name = String(entry.config_name || '').toLowerCase();
        const endpoint = String(entry.api_endpoint || '').toLowerCase();
        return fallbackTokens.some((token) => name.includes(token) || endpoint.includes(token));
      }) || null;

      if (config) {
        console.warn(`[SAP Direct] Config id "${config_id}" was not found. Falling back to "${config.config_name}" (${config.id}) for action "${action}".`);
        body.config_id = config.id;
      }
    }
  }

  if (!config) {
    return { data: null, error: { message: `Configuration not found for id ${config_id}` } };
  }

  const authType = normalizeAuthType(config.auth_type);
  const username = normalizeCredential(config.username);
  const passwordRaw = normalizeCredential(config.encrypted_password);

  console.log(`[SAP Direct] Config loaded: "${config.config_name}", auth_type="${authType}", username="${username}", password_length=${passwordRaw.length || 0}, proxy_url="${config.proxy_tunnel_url}", sap_client="${config.sap_client}", credential_source="sap_api_config"`);

  const proxyUrl = config.proxy_tunnel_url;
  if (!proxyUrl) {
    return { data: null, error: { message: 'No proxy/tunnel URL configured. Set the Proxy URL in SAP API Settings.' } };
  }

  // Build the real SAP target URL (what the proxy will call)
  const sapTargetUrl = buildSapTargetUrl(config);

  // Build the proxy base URL (where the proxy is running)
  const proxyBaseUrl = proxyUrl.replace(/\/$/, '');

  // For backward compat, keep 'url' pointing to proxy endpoint for logging
  const url = sapTargetUrl;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  if (config.proxy_secret) {
    headers['x-proxy-secret'] = config.proxy_secret;
  }

  if (config.sap_client) {
    headers['sap-client'] = String(config.sap_client);
  }

  // Auth headers — send SAP credentials from the config (edit section)
  if (authType === 'basic' && username && passwordRaw) {
    headers['Authorization'] = `Basic ${btoa(`${username}:${passwordRaw}`)}`;
    Object.assign(headers, buildCredentialForwardHeaders(username, passwordRaw, config.sap_client));
  } else if (authType === 'api_key' && config.api_key) {
    headers['X-API-Key'] = config.api_key;
  }

  // Custom headers
  if (config.custom_headers && typeof config.custom_headers === 'object') {
    Object.entries(config.custom_headers as Record<string, unknown>).forEach(([key, value]) => {
      if (key && value) headers[key] = String(value);
    });
  }

  try {
    if (action === 'test') {
      return await directTest(url, headers, config, proxyBaseUrl);
    }

    if (action === 'sync') {
      return await directSync(url, headers, config, body, proxyBaseUrl);
    }

    if (action === 'unblock') {
      return await directUnblock(url, headers, config, body, proxyBaseUrl);
    }

    if (action === 'update_transaction_qty') {
      return await directUpdateQty(url, headers, config, body, proxyBaseUrl);
    }

    if (action === 'fetch_live') {
      return await directFetchLive(url, headers, config, body, proxyBaseUrl);
    }

    return { data: { success: false, error: 'Invalid action' }, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Direct call failed' } };
  }
}

async function directTest(
  url: string,
  headers: Record<string, string>,
  config: any,
  proxyBaseUrl: string,
): Promise<{ data: any; error: any }> {
  const method = (config.http_method || 'GET').toUpperCase();
  const start = Date.now();

  const authType = normalizeAuthType(config.auth_type);
  const trimmedUsername = normalizeCredential(config.username);
  const trimmedPassword = normalizeCredential(config.encrypted_password);

  // Build attempt queue for multi-attempt auth fallback
  const attemptQueue: Array<{ label: string; requestUrl: string; requestHeaders: Record<string, string> }> = [
    { label: 'default', requestUrl: url, requestHeaders: headers },
  ];

  if (authType === 'basic' && trimmedUsername && trimmedPassword) {
    // Attempt: sap-client in header only (remove from URL query)
    const noQueryUrl = removeSapClientFromUrl(url);
    if (noQueryUrl !== url) {
      attemptQueue.push({
        label: 'sap-client_header_only',
        requestUrl: noQueryUrl,
        requestHeaders: headers,
      });
    }

    // Attempt: alt credential headers
    attemptQueue.push({
      label: 'alt_credential_headers',
      requestUrl: url,
      requestHeaders: {
        ...headers,
        Authorization: `Basic ${btoa(`${trimmedUsername}:${trimmedPassword}`)}`,
        ...buildCredentialForwardHeaders(trimmedUsername, trimmedPassword, config.sap_client),
      },
    });
  }

  const extractSapErrorSummary = (rawBody: string): string | null => {
    const normalized = rawBody.toLowerCase();
    if (normalized.includes('anmeldung fehlgeschlagen') || normalized.includes('logon error message')) {
      return 'SAP login failed: username/password or sap-client was rejected by SAP.';
    }
    if (normalized.includes('login failed') || normalized.includes('not authenticated')) {
      return 'SAP authentication failed.';
    }
    return null;
  };

  for (const attempt of attemptQueue) {
    const fetchOpts: RequestInit = { method, headers: attempt.requestHeaders };
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOpts.body = JSON.stringify({});
    }

    console.log(`[SAP Direct Test] Attempt: ${attempt.label} → ${attempt.requestUrl}`);
    const response = await proxyAwareFetch(proxyBaseUrl, attempt.requestUrl, fetchOpts, config);
    const elapsed = Date.now() - start;
    const bodyText = await response.text();

    if (response.ok) {
      return {
        data: {
          success: true,
          message: `Route reachable (${response.status}), ${elapsed}ms (attempt: ${attempt.label}). Note: this only verifies network/auth — use "Trigger Sync" to validate the full payload.`,
          status: response.status,
          responseTime: elapsed,
          attempt: attempt.label,
        },
        error: null,
      };
    }

    // Check for SAP auth errors — try next attempt
    const sapError = extractSapErrorSummary(bodyText);
    if (sapError || response.status === 401 || response.status === 403 || (response.status === 404 && bodyText.includes('<html'))) {
      console.log(`[SAP Direct Test] Attempt "${attempt.label}" got SAP auth error (${response.status}), trying next...`);
      continue;
    }

    // Non-auth error — return immediately
    return {
      data: {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}. Body: ${bodyText.substring(0, 500)}`,
        status: response.status,
        responseTime: elapsed,
        attempt: attempt.label,
      },
      error: null,
    };
  }

  // All attempts exhausted
  const elapsed = Date.now() - start;
  return {
    data: {
      success: false,
      message: `Transport OK but SAP rejected all ${attemptQueue.length} credential attempts. Check username, password, and SAP client number in API Settings.`,
      responseTime: elapsed,
      attempt: 'all_exhausted',
    },
    error: null,
  };
}

async function directSync(
  url: string,
  headers: Record<string, string>,
  config: any,
  body: Record<string, any>,
  proxyBaseUrl: string,
): Promise<{ data: any; error: any }> {
  const method = (config.http_method || 'GET').toUpperCase();
  const debugLabel = `[SAP Sync Debug] ${config.config_name || config.endpoint_path || body.config_id || 'Unknown API'}`;

  const maskSensitiveHeaders = (sourceHeaders: Record<string, string>): Record<string, string> => {
    return Object.fromEntries(
      Object.entries(sourceHeaders).map(([key, value]) => {
        const normalizedKey = key.toLowerCase();
        if (normalizedKey.includes('authorization')) {
          const scheme = value.includes(' ') ? value.split(' ')[0] : 'Basic';
          return [key, `${scheme} ***masked***`];
        }
        if (
          normalizedKey.includes('password') ||
          normalizedKey.includes('secret') ||
          normalizedKey.includes('api-key') ||
          normalizedKey.includes('token')
        ) {
          return [key, '***masked***'];
        }
        return [key, value];
      })
    );
  };

  const extractSapErrorSummary = (rawBody: string): string | null => {
    const normalized = rawBody.toLowerCase();
    if (normalized.includes('anmeldung fehlgeschlagen') || normalized.includes('logon error message')) {
      return 'SAP login failed: username/password or sap-client was rejected by SAP.';
    }

    const h1Match = rawBody.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match?.[1]) {
      return h1Match[1].replace(/<[^>]+>/g, '').trim();
    }

    return null;
  };

  // Get user email for sync record
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email || 'unknown';

  // Create sync history record
  const { data: syncRecord, error: syncInsertErr } = await supabase
    .from('sap_stock_sync_history')
    .insert({
      config_id: body.config_id,
      sync_type: 'manual',
      status: 'in_progress',
      synced_by: userEmail,
    })
    .select()
    .single();

  if (syncInsertErr || !syncRecord) {
    console.error(`${debugLabel} Failed to create sync history record:`, syncInsertErr);
    return { data: { success: false, error: 'Failed to create sync record' }, error: null };
  }

  try {
    // Build request body from request fields
    const { data: requestFields } = await supabase
      .from('sap_api_request_fields')
      .select('*')
      .eq('config_id', body.config_id)
      .order('sort_order');

    // Validate required fields before building request
    const invalidRequired = (requestFields || []).filter(
      (f: any) => f.is_required && (!f.default_value || String(f.default_value).trim() === '')
    );
    if (invalidRequired.length > 0) {
      const names = invalidRequired.map((f: any) => f.sap_field_name || f.field_name).join(', ');
      const errMsg = `Config error: required fields [${names}] have no default value. Either set a default or mark them optional in Field Mappings.`;
      console.error(`${debugLabel} ${errMsg}`);
      await supabase.from('sap_stock_sync_history').update({
        status: 'failed',
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      }).eq('id', syncRecord.id);
      return { data: { success: false, error: errMsg }, error: null };
    }

    let requestBody: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      requestBody = {};
      if (requestFields?.length) {
        requestFields.forEach((field: any) => {
          const key = field.sap_field_name || field.field_name;
          if (field.is_required || (field.default_value && String(field.default_value).trim() !== '')) {
            let val = field.default_value ?? '';
            
            // Fix: Do NOT parseInt here. SAP often requires strings even for numeric values like "01"
            // Ensure specific fields are correctly formatted
            if (key === 'ART' || key === 'INSPECTION_TYPE') {
              val = String(val).trim().padStart(2, '0');
            } else if (key === 'WERKS' || key === 'LGORT') {
              val = String(val).trim();
            }
            
            requestBody[key] = val;
          }
        });
      }

      // INJECT GLOBAL MAX RECORDS SETTING
      // The Advanced Settings tab has a "Max Records per Sync" field which defaults to 1000/5000.
      // We automatically append this as common ABAP row limit parameters in case they weren't mapped in Request Fields
      if (config.max_records) {
        if (requestBody.MAX_ROWS === undefined) requestBody.MAX_ROWS = config.max_records;
        if (requestBody.MAX_HITS === undefined) requestBody.MAX_HITS = config.max_records;
        if (requestBody.max_rows === undefined) requestBody.max_rows = config.max_records;
      }
    }

    const fetchOpts: RequestInit = { method, headers };
    if (requestBody && Object.keys(requestBody).length > 0) {
      fetchOpts.body = JSON.stringify(requestBody);
    } else {
      requestBody = undefined;
    }

    console.log(`%c${debugLabel} ========= REQUEST =========`, 'color: #00bcd4; font-weight: bold; font-size: 14px;');
    console.log(`${debugLabel} Resolved URL:`, url);
    console.log(`${debugLabel} HTTP method:`, method);
    console.log(`${debugLabel} Connection mode:`, config.connection_mode || 'direct');
    console.log(`${debugLabel} Auth type:`, config.auth_type || 'none');
    console.log(`${debugLabel} Username:`, config.username || 'NOT SET');
    console.log(`${debugLabel} Password present:`, config.encrypted_password ? `YES (${config.encrypted_password.length} chars)` : 'NO / EMPTY');
    console.log(`${debugLabel} SAP client:`, config.sap_client || 'not set');
    console.log(`${debugLabel} Headers (masked):`, maskSensitiveHeaders(headers));
    console.log(`${debugLabel} Authorization header present:`, !!headers['Authorization']);
    console.log(`${debugLabel} Request fields count:`, requestFields?.length || 0);
    if (requestBody) {
      console.log(`${debugLabel} Payload:`, JSON.parse(JSON.stringify(requestBody)));
    } else {
      console.log(`${debugLabel} Payload: none (${method} request)`);
    }

    const authType = normalizeAuthType(config.auth_type);
    const trimmedUsername = normalizeCredential(config.username);
    const trimmedPassword = normalizeCredential(config.encrypted_password);

    const attemptQueue: Array<{ label: string; requestUrl: string; requestHeaders: Record<string, string> }> = [
      { label: 'default', requestUrl: url, requestHeaders: headers },
    ];

    if (authType === 'basic' && trimmedUsername && trimmedPassword) {
      const minimalHeaders: Record<string, string> = {
        'Content-Type': headers['Content-Type'],
        Accept: headers['Accept'],
        'ngrok-skip-browser-warning': headers['ngrok-skip-browser-warning'],
      };
      if (headers['x-proxy-secret']) minimalHeaders['x-proxy-secret'] = headers['x-proxy-secret'];
      if (headers['sap-client']) minimalHeaders['sap-client'] = headers['sap-client'];
      minimalHeaders.Authorization = `Basic ${btoa(`${trimmedUsername}:${trimmedPassword}`)}`;

      attemptQueue.push({
        label: 'basic_auth_minimal_headers',
        requestUrl: url,
        requestHeaders: minimalHeaders,
      });

      const noQuerySapClientUrl = removeSapClientFromUrl(url);
      if (noQuerySapClientUrl !== url) {
        attemptQueue.push({
          label: 'basic_auth_header_only_client',
          requestUrl: noQuerySapClientUrl,
          requestHeaders: headers,
        });
      }

      attemptQueue.push({
        label: 'basic_auth_trimmed_creds',
        requestUrl: url,
        requestHeaders: {
          ...headers,
          Authorization: `Basic ${btoa(`${trimmedUsername}:${trimmedPassword}`)}`,
          ...buildCredentialForwardHeaders(trimmedUsername, trimmedPassword, config.sap_client),
        },
      });

      attemptQueue.push({
        label: 'basic_auth_payload_credentials',
        requestUrl: url,
        requestHeaders: {
          ...headers,
          Authorization: `Basic ${btoa(`${trimmedUsername}:${trimmedPassword}`)}`,
          ...buildCredentialForwardHeaders(trimmedUsername, trimmedPassword, config.sap_client),
        },
      });

      const queryCredentialUrl = addCredentialQueryParams(url, trimmedUsername, trimmedPassword, config.sap_client);
      if (queryCredentialUrl !== url) {
        attemptQueue.push({
          label: 'basic_auth_query_credentials',
          requestUrl: queryCredentialUrl,
          requestHeaders: {
            ...headers,
            Authorization: `Basic ${btoa(`${trimmedUsername}:${trimmedPassword}`)}`,
            ...buildCredentialForwardHeaders(trimmedUsername, trimmedPassword, config.sap_client),
          },
        });
      }
    }

    let response: Response | null = null;
    let bodyText = '';
    let contentType = 'unknown';
    let responsePreview = '';
    let detectedSapError: string | null = null;
    let selectedAttempt = 'default';

    for (const attempt of attemptQueue) {
      const attemptOpts: RequestInit = { method, headers: attempt.requestHeaders };
      if (requestBody && Object.keys(requestBody).length > 0) {
        if (attempt.label === 'basic_auth_payload_credentials' && authType === 'basic' && trimmedUsername && trimmedPassword) {
          attemptOpts.body = JSON.stringify({
            ...requestBody,
            username: trimmedUsername,
            password: trimmedPassword,
            user: trimmedUsername,
            pass: trimmedPassword,
            sap_user: trimmedUsername,
            sap_password: trimmedPassword,
            sapUsername: trimmedUsername,
            sapPassword: trimmedPassword,
            sap_client: config.sap_client || undefined,
            sapClient: config.sap_client || undefined,
            client: config.sap_client || undefined,
            mandt: config.sap_client || undefined,
            USERNAME: trimmedUsername,
            PASSWORD: trimmedPassword,
            USER: trimmedUsername,
            PASS: trimmedPassword,
            SAP_USER: trimmedUsername,
            SAP_PASSWORD: trimmedPassword,
            SAP_CLIENT: config.sap_client || undefined,
          });
        } else {
          attemptOpts.body = JSON.stringify(requestBody);
        }
      }

      console.log(`${debugLabel} Attempt: ${attempt.label}`);
      const currentResponse = await proxyAwareFetch(proxyBaseUrl, attempt.requestUrl, attemptOpts, config);
      const currentBodyText = await currentResponse.text();
      const currentContentType = currentResponse.headers.get('content-type') || 'unknown';
      const currentPreview = currentBodyText.substring(0, 2000);
      const currentDetectedSapError = extractSapErrorSummary(currentBodyText);

      console.log(`${debugLabel} Attempt status (${attempt.label}):`, currentResponse.status, currentResponse.statusText);

      response = currentResponse;
      bodyText = currentBodyText;
      contentType = currentContentType;
      responsePreview = currentPreview;
      detectedSapError = currentDetectedSapError;
      selectedAttempt = attempt.label;

      if (currentResponse.ok || currentResponse.status !== 401) {
        break;
      }
    }

    if (!response) {
      throw new Error('No response received from middleware');
    }

    console.log(`%c${debugLabel} ========= RESPONSE =========`, 'color: #ff9800; font-weight: bold; font-size: 14px;');
    console.log(`${debugLabel} Final attempt used:`, selectedAttempt);
    console.log(`${debugLabel} Status:`, response.status, response.statusText);
    console.log(`${debugLabel} Content-Type:`, contentType);
    console.log(`${debugLabel} Response preview:`, responsePreview);
    if (detectedSapError) {
      console.error(`%c${debugLabel} SAP ERROR DETECTED: ${detectedSapError}`, 'color: red; font-weight: bold; font-size: 14px;');
      console.error(`${debugLabel} HINT: Check username/password in SAP API Settings Edit form. Current username="${config.username}", sap-client="${config.sap_client}"`);
    }
    
    if (!response.ok) {
      console.error(`${debugLabel} HTTP failure body:`, bodyText);
      await supabase.from('sap_stock_sync_history').update({
        status: 'failed',
        error_message: `SAP API returned ${response.status} (attempt: ${selectedAttempt}): ${bodyText.substring(0, 500)}`,
        completed_at: new Date().toISOString(),
      }).eq('id', syncRecord.id);

      return {
        data: { success: false, error: `SAP API returned ${response.status} (attempt: ${selectedAttempt})`, sync_id: syncRecord.id },
        error: null,
      };
    }

    let jsonData: any;
    try {
      jsonData = JSON.parse(bodyText);
    } catch {
      console.error(`${debugLabel} Response is not valid JSON. Raw body:`, bodyText);
      await supabase.from('sap_stock_sync_history').update({
        status: 'failed',
        error_message: 'Response is not valid JSON',
        completed_at: new Date().toISOString(),
      }).eq('id', syncRecord.id);

      return { data: { success: false, error: 'Response is not valid JSON', sync_id: syncRecord.id }, error: null };
    }

    const records = jsonData?.d?.results || jsonData?.value || jsonData?.data || (Array.isArray(jsonData) ? jsonData : [jsonData]);
    console.log(`${debugLabel} Extracted records:`, records?.length || 0);
    if (Array.isArray(records) && records.length > 0) {
      console.log(`${debugLabel} First record sample:`, records[0]);
    }

    // Get response field mappings
    const { data: responseFields } = await supabase
      .from('sap_api_response_fields')
      .select('*')
      .eq('config_id', body.config_id)
      .order('sort_order');
    console.log(`${debugLabel} Response field mappings:`, responseFields?.length || 0, responseFields);

    // Map and insert (reuse edge function's mapping logic client-side)
    console.log(`${debugLabel} Calling mapAndInsertClientSide...`);
    const mappingResult = await mapAndInsertClientSide(records, responseFields || [], syncRecord.id);
    console.log(`${debugLabel} mapAndInsertClientSide result:`, mappingResult);

    const hasErrors = mappingResult.errors.length > 0;
    const finalStatus = (mappingResult.inserted === 0 && hasErrors) ? 'failed' : (hasErrors ? 'partial' : 'success');

    await supabase.from('sap_stock_sync_history').update({
      status: finalStatus,
      records_fetched: mappingResult.fetched,
      records_inserted: mappingResult.inserted,
      records_updated: mappingResult.updated,
      completed_at: new Date().toISOString(),
      error_message: hasErrors ? mappingResult.errors.join('; ') : null,
    }).eq('id', syncRecord.id);

    await supabase.from('sap_api_config').update({
      last_sync_at: new Date().toISOString(),
    }).eq('id', body.config_id);

    return {
      data: {
        success: true,
        sync_id: syncRecord.id,
        records_fetched: mappingResult.fetched,
        records_inserted: mappingResult.inserted,
        records_updated: mappingResult.updated,
        errors: mappingResult.errors,
        sample_data: records?.slice?.(0, 3) || null,
      },
      error: null,
    };
  } catch (err: any) {
    console.error(`${debugLabel} Exception:`, err);
    await supabase.from('sap_stock_sync_history').update({
      status: 'failed',
      error_message: err.message || 'Unknown sync error',
      completed_at: new Date().toISOString(),
    }).eq('id', syncRecord.id);

    return { data: { success: false, error: err.message, sync_id: syncRecord.id }, error: null };
  }
}

async function directUnblock(
  url: string,
  headers: Record<string, string>,
  config: any,
  body: Record<string, any>,
  proxyBaseUrl: string,
): Promise<{ data: any; error: any }> {
  const { request_body } = body;
  if (!request_body) {
    return { data: { success: false, error: 'request_body is required for unblock action' }, error: null };
  }

  const method = (config.http_method || 'PUT').toUpperCase();
  const payload = Array.isArray(request_body) ? request_body : [request_body];

  console.log(`[SAP Unblock API Request] %c${config.config_name || 'Unblock 343/344'}`, 'color: #f59e0b; font-weight: bold;');
  console.log(`[SAP Unblock API Request] URL: ${url}`);
  console.log(`[SAP Unblock API Request] Method: ${method}`);
  console.log(`[SAP Unblock API Request] Payload:`, payload);

  const response = await proxyAwareFetch(proxyBaseUrl, url, {
    method,
    headers,
    body: JSON.stringify(payload),
  }, config);

  const bodyText = await response.text();
  console.log(`[SAP Unblock API Response] Status: ${response.status}`);

  let responseData: any;
  try {
    responseData = bodyText.trim() ? JSON.parse(bodyText) : { http_status: response.status };
    console.log(`[SAP Unblock API Response] Data:`, responseData);
  } catch {
    responseData = { raw: bodyText.substring(0, 1000), http_status: response.status };
    console.log(`[SAP Unblock API Response] Raw Data (not JSON):`, bodyText);
  }

  if (!response.ok) {
    return {
      data: {
        success: false,
        error: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
        sap_response: responseData,
        http_status: response.status,
      },
      error: null,
    };
  }

  // Business-level success: only when SAP CODE is '100'
  const sapCode = responseData?.CODE || responseData?.code || null;
  const sapMsg = responseData?.MSG || responseData?.msg || responseData?.Message || null;
  const sapMBLNR = responseData?.MBLNR || responseData?.mblnr || null;
  const sapMJAHR = responseData?.MJAHR || responseData?.mjahr || null;
  const isBusinessSuccess = sapCode === '100' || sapCode === 100;

  return {
    data: {
      success: isBusinessSuccess,
      error: isBusinessSuccess ? undefined : (sapMsg || `SAP returned CODE ${sapCode}`),
      sap_response: responseData,
      code: sapCode,
      CODE: sapCode,
      message: sapMsg,
      MESSAGE: sapMsg,
      material_document: sapMBLNR,
      MBLNR: sapMBLNR,
      material_document_year: sapMJAHR,
      MJAHR: sapMJAHR,
      http_status: response.status,
    },
    error: null,
  };
}

async function directUpdateQty(
  url: string,
  headers: Record<string, string>,
  config: any,
  body: Record<string, any>,
  proxyBaseUrl: string,
): Promise<{ data: any; error: any }> {
  const { lot_id, new_quantity, inspection_lot, material_code, plant, storage_location, batch } = body;

  if (!lot_id || new_quantity === undefined || new_quantity === null) {
    return { data: { success: false, error: 'lot_id and new_quantity are required' }, error: null };
  }

  // Read old value
  const { data: oldRecord, error: readErr } = await supabase
    .from('inward_inspection_lots')
    .select('transaction_quantity')
    .eq('id', lot_id)
    .single();

  if (readErr || !oldRecord) {
    return { data: { success: false, error: 'Inspection lot not found' }, error: null };
  }

  const oldQuantity = oldRecord.transaction_quantity;

  // Update DB first
  const { error: updateErr } = await supabase
    .from('inward_inspection_lots')
    .update({ transaction_quantity: new_quantity, updated_at: new Date().toISOString() })
    .eq('id', lot_id);

  if (updateErr) {
    return { data: { success: false, error: 'Database update failed' }, error: null };
  }

  try {
    const method = (config.http_method || 'POST').toUpperCase();
    const sapPayload = {
      MATNR: material_code || '',
      WERKS: plant || '',
      LGORT: storage_location || '',
      CHARG: batch || '',
      INSPECTION_LOT: inspection_lot || '',
      ENTRY_QNT: String(new_quantity),
      ACTION: 'UPDATE_QTY',
    };

    const response = await proxyAwareFetch(proxyBaseUrl, url, { method, headers, body: JSON.stringify(sapPayload) }, config);
    const bodyText = await response.text();

    if (!response.ok) {
      // Rollback
      await supabase.from('inward_inspection_lots')
        .update({ transaction_quantity: oldQuantity, updated_at: new Date().toISOString() })
        .eq('id', lot_id);

      return {
        data: {
          success: false,
          error: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
          rolled_back: true,
          old_quantity: oldQuantity,
        },
        error: null,
      };
    }

    let sapResponseData: any;
    try {
      sapResponseData = bodyText.trim() ? JSON.parse(bodyText) : { status: 'ok' };
    } catch {
      sapResponseData = { raw: bodyText.substring(0, 1000) };
    }

    return {
      data: {
        success: true,
        new_quantity,
        old_quantity: oldQuantity,
        sap_response: sapResponseData,
        http_status: response.status,
      },
      error: null,
    };
  } catch (err: any) {
    // Rollback on error
    await supabase.from('inward_inspection_lots')
      .update({ transaction_quantity: oldQuantity, updated_at: new Date().toISOString() })
      .eq('id', lot_id);

    return {
      data: { success: false, error: err.message, rolled_back: true, old_quantity: oldQuantity },
      error: null,
    };
  }
}

/**
 * Fetch MB52 stock data live from SAP without saving to Supabase.
 * Returns the mapped records directly for display.
 */
async function directFetchLive(
  url: string,
  headers: Record<string, string>,
  config: any,
  body: Record<string, any>,
  proxyBaseUrl: string,
): Promise<{ data: any; error: any }> {
  const method = (config.http_method || 'POST').toUpperCase();
  const debugLabel = `[SAP Live Fetch] ${config.config_name || 'MB52'}`;

  try {
    const { data: requestFields } = await supabase
      .from('sap_api_request_fields')
      .select('*')
      .eq('config_id', body.config_id)
      .order('sort_order');

    let requestBody: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      requestBody = {};
      if (requestFields?.length) {
        requestFields.forEach((field: any) => {
          const key = field.sap_field_name || field.field_name;
          if (field.is_required || (field.default_value && String(field.default_value).trim() !== '')) {
            requestBody[key] = String(field.default_value ?? '').trim();
          }
        });
      }
      // Merge search params from the UI (WERKS, LGORT, MATNR, MATART etc.)
      if (body.search_params && typeof body.search_params === 'object') {
        Object.entries(body.search_params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            requestBody[key] = String(value).trim();
          }
        });
      }
      if (config.max_records) {
        if (requestBody.MAX_ROWS === undefined) requestBody.MAX_ROWS = config.max_records;
        if (requestBody.MAX_HITS === undefined) requestBody.MAX_HITS = config.max_records;
      }
    }

    const fetchOpts: RequestInit = { method, headers };
    if (requestBody && Object.keys(requestBody).length > 0) {
      fetchOpts.body = JSON.stringify(requestBody);
    }

    console.log(`${debugLabel} Fetching live data from SAP... URL: ${url}`);
    const response = await proxyAwareFetch(proxyBaseUrl, url, fetchOpts, config);
    const bodyText = await response.text();

    if (!response.ok) {
      return { data: { success: false, error: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}` }, error: null };
    }

    let jsonData: any;
    try { jsonData = JSON.parse(bodyText); } catch {
      return { data: { success: false, error: 'Response is not valid JSON' }, error: null };
    }

    const records = jsonData?.d?.results || jsonData?.value || jsonData?.data || (Array.isArray(jsonData) ? jsonData : [jsonData]);
    console.log(`${debugLabel} Fetched ${records?.length || 0} records from SAP`);

    const { data: responseFields } = await supabase
      .from('sap_api_response_fields')
      .select('*')
      .eq('config_id', body.config_id)
      .order('sort_order');

    if (!responseFields?.length || !records?.length) {
      return { data: { success: true, records: [], total: 0, message: !records?.length ? 'No records from SAP' : 'No field mappings configured' }, error: null };
    }

    const aliasMap: Record<string, string> = {
      matnr: 'material_code', maktx: 'material_description', labst: 'available_quantity',
      charg: 'batch', lgobe: 'storage_location_desc', speme: 'blocked_quantity',
      insme: 'quality_inspection_qty', trame: 'transfer_qty', wlabs: 'unrestricted_value',
      wspem: 'blocked_value', winsm: 'quality_inspection_value', wtram: 'transfer_value',
      werks: 'plant', werk: 'plant', lgort: 'storage_location', meins: 'uom',
    };

    const mappedRecords = records.map((record: any, idx: number) => {
      const row: Record<string, any> = { id: `sap-live-${idx}`, source: 'sap_live', status: 'available', created_at: new Date().toISOString() };

      responseFields.forEach((field: any) => {
        const sapKey = field.sap_field_name || field.field_name;
        let value = record[sapKey];
        if (value === undefined) {
          const lowerKey = sapKey.toLowerCase();
          const matchingKey = Object.keys(record).find(k => k.toLowerCase() === lowerKey);
          if (matchingKey) value = record[matchingKey];
        }
        if (value === undefined) {
          const upKey = String(sapKey).toUpperCase();
          if (upKey === 'WERKS' && record['WERK'] !== undefined) value = record['WERK'];
          if (upKey === 'WERK' && record['WERKS'] !== undefined) value = record['WERKS'];
        }
        if (value === undefined || value === null || value === '') return;

        const requestedColumn = String(field.map_to_column || '').trim();
        const normalizedColumn = aliasMap[requestedColumn.toLowerCase()] || requestedColumn;
        row[normalizedColumn] = value;
      });

      if (row.available_quantity !== undefined) {
        const qty = Number(row.available_quantity);
        row.available_quantity = Number.isFinite(qty) ? qty : 0;
      } else {
        row.available_quantity = 0;
      }

      return row;
    }).filter((r: any) => r.plant && r.material_code);

    console.log(`${debugLabel} Mapped ${mappedRecords.length} valid records for display`);

    return { data: { success: true, records: mappedRecords, total: mappedRecords.length }, error: null };
  } catch (err: any) {
    console.error(`${debugLabel} Exception:`, err);
    return { data: { success: false, error: err.message }, error: null };
  }
}

/**
 * Normalize SAP date formats to YYYY-MM-DD for Postgres date columns.
 * Handles: YYYYMMDD, /Date(ms)/, YYYY-MM-DD (passthrough)
 */
function normalizeSapDate(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === '00000000') return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
  }

  // /Date(1234567890000)/
  const msMatch = str.match(/\/Date\((\d+)\)\//);
  if (msMatch) {
    const d = new Date(parseInt(msMatch[1], 10));
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  return null;
}

/**
 * Client-side version of mapAndInsertData for self-hosted mode.
 * Maps SAP response fields to DB columns and upserts.
 */
async function mapAndInsertClientSide(
  records: any[],
  responseFields: any[],
  syncId: string,
): Promise<{ fetched: number; inserted: number; updated: number; errors: string[] }> {
  console.log(`[SAP Sync Mapping] Starting mapping for ${records.length} records with ${responseFields.length} response fields`);
  const result = { fetched: records.length, inserted: 0, updated: 0, errors: [] as string[] };

  if (!records.length || !responseFields.length) {
    if (!responseFields.length) result.errors.push('No response field mappings configured');
    if (!records.length) result.errors.push('No records returned from SAP');
    return result;
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
      'vendor_code', 'vendor_name', 'po_number', 'po_item_number', 'po_line_item', 'grn_number', 'uploaded_by', 'upload_batch_id',
      'inspection_date', 'posting_date',
    ]),
  };

  const aliasMap: Record<string, Record<string, string>> = {
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
      lgort: 'storage_location', prueflos: 'inspection_lot', lifnr: 'vendor_code',
      name1: 'vendor_name', ebeln: 'po_number', ebelp: 'po_item_number', po_line_item: 'po_line_item', mblnr: 'grn_number', meins: 'uom', menge: 'blocked_quantity',
      inspection_lot: 'inspection_lot', storage_location: 'storage_location',
      vendor_code: 'vendor_code', vendor_name: 'vendor_name',
      qals_prueflos: 'inspection_lot', inspection_date: 'inspection_date', posting_date: 'posting_date',
    },
  };

  const requiredByTable: Record<string, string[]> = {
    shop_floor_stock: ['plant', 'material_code', 'available_quantity'],
    inward_inspection_lots: ['inspection_lot', 'material_code', 'plant'],
  };

  // Group fields by target table
  const tableFieldMap = new Map<string, any[]>();
  responseFields.forEach((field) => {
    const table = field.map_to_table;
    if (!table || !field.map_to_column) return;
    if (!tableFieldMap.has(table)) tableFieldMap.set(table, []);
    tableFieldMap.get(table)!.push(field);
  });

  for (const [tableName, fields] of tableFieldMap) {
    console.log(`[SAP Sync Mapping] Processing target table: ${tableName} using ${fields.length} mapped fields`, fields);
    const allowedColumns = allowedColumnsByTable[tableName];
    if (!allowedColumns) {
      result.errors.push(`Unsupported target table: ${tableName}`);
      continue;
    }

    const aliases = aliasMap[tableName] || {};
    const sanitizedRows = records.map((record, index) => {
      const row: Record<string, any> = {};

      fields.forEach((field: any) => {
        const sapKey = field.sap_field_name || field.field_name;
        // Case-insensitive lookup: try exact match first, then case-insensitive
        let value = record[sapKey];
        if (value === undefined) {
          const lowerKey = sapKey.toLowerCase();
          const matchingKey = Object.keys(record).find(k => k.toLowerCase() === lowerKey);
          if (matchingKey) value = record[matchingKey];
        }
        
        // Fallback for SAP naming inconsistencies (e.g. WERKS vs WERK)
        if (value === undefined) {
          const upKey = String(sapKey).toUpperCase();
          if (upKey === 'WERKS' && record['WERK'] !== undefined) value = record['WERK'];
          if (upKey === 'WERK' && record['WERKS'] !== undefined) value = record['WERKS'];
        }

        if (value === undefined || value === null || value === '') return;

        const requestedColumn = String(field.map_to_column).trim();
        const normalizedColumn = aliases[requestedColumn.toLowerCase()] || requestedColumn;
        if (!allowedColumns.has(normalizedColumn)) return;

        // Normalize SAP date formats for date columns
        if (['inspection_date', 'posting_date'].includes(normalizedColumn)) {
          value = normalizeSapDate(value);
          if (!value) return; // skip invalid dates
        }

        row[normalizedColumn] = value;
      });

      if (tableName === 'shop_floor_stock') {
        row.source = 'sap_api';
        row.sap_sync_id = syncId;
        if (row.available_quantity !== undefined) {
          const qty = Number(row.available_quantity);
          row.available_quantity = Number.isFinite(qty) ? qty : undefined;
        }
        // Generate composite stock_key for deduplication
        const keyParts = [
          String(row.plant || ''),
          String(row.material_code || ''),
          String(row.batch || ''),
          String(row.storage_location || ''),
        ];
        row.stock_key = keyParts.join('_');
      }

      if (tableName === 'inward_inspection_lots') {
        row.status = row.status || 'pending';
      }

      const required = requiredByTable[tableName] || [];
      const missing = required.filter((col) => !row[col] && row[col] !== 0);
      if (missing.length > 0) {
        console.warn(`[SAP Sync Mapping] Skipping row ${index + 1} for ${tableName} due to missing required fields: ${missing.join(', ')}`);
        console.warn(`[SAP Sync Mapping] Mapped row data:`, row);
        console.warn(`[SAP Sync Mapping] Original SAP record:`, record);
        // For first skipped row, include raw SAP keys to help debug mapping issues
        if (index === 0 || result.errors.length < 3) {
          const rawKeys = Object.keys(record).join(', ');
          result.errors.push(`Skipped ${tableName} row ${index + 1}: missing (${missing.join(', ')}). SAP fields in row: [${rawKeys}]`);
        } else if (result.errors.length === 3) {
          result.errors.push(`... and more rows skipped for ${tableName}`);
        }
        return null;
      }

      return row;
    }).filter(Boolean) as Record<string, any>[];

    console.log(`[SAP Sync Mapping] Successfully mapped ${sanitizedRows.length} valid rows for ${tableName}. First row preview:`, sanitizedRows[0]);

    if (sanitizedRows.length === 0) {
      console.log(`[SAP Sync Mapping] No valid rows to insert for ${tableName}`);
      continue;
    }

    // Insert in batches
    const batchSize = 500;
    for (let i = 0; i < sanitizedRows.length; i += batchSize) {
      const batch = sanitizedRows.slice(i, i + batchSize);
      console.log(`[SAP Sync DB] Upserting batch of ${batch.length} rows to ${tableName}...`);
      
      const upsertOptions = tableName === 'inward_inspection_lots'
        ? { onConflict: 'inspection_lot' }
        : tableName === 'shop_floor_stock'
        ? { onConflict: 'stock_key' }
        : undefined;

      const { data, error } = await (supabase
        .from(tableName as 'shop_floor_stock')
        .upsert(batch as any, upsertOptions as any) as any)
        .select();

      if (error) {
        console.error(`[SAP Sync DB] Supabase Upsert Error for ${tableName}:`, error);
        result.errors.push(`Error inserting into ${tableName}: ${error.message}`);
        break;
      }
      
      console.log(`[SAP Sync DB] Supabase Upsert Success for ${tableName}. Returned data length:`, data?.length);
      result.inserted += data?.length || 0;
    }
  }

  return result;
}

/**
 * Main entry point — auto-detects environment.
 * Lovable Cloud → Edge Function
 * Self-hosted → Direct middleware call
 */
export async function invokeSapSync(body: Record<string, any>): Promise<{ data: any; error: any }> {
  // Get current session first — do NOT call refreshSession() unconditionally
  // as it triggers a SIGNED_OUT event if the refresh token is stale
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { data: null, error: { message: 'Not authenticated. Please log in again.' } };
  }

  // Only refresh if token expires within 60 seconds
  const expiresAt = session.expires_at || 0;
  if (expiresAt - Math.floor(Date.now() / 1000) < 60) {
    try {
      await supabase.auth.refreshSession();
    } catch (e) {
      console.warn('[SAP Sync] Token refresh failed, proceeding with current token:', e);
    }
  }

  // Dual-mode routing:
  // Lovable Cloud (supabase.co) → Edge Function (avoids mixed-content HTTPS→HTTP)
  // Self-hosted (private IP) → Direct browser→middleware call
  if (isLovableCloud()) {
    console.log('[SAP Sync] Lovable Cloud detected — routing through Edge Function');
    try {
      const { data, error } = await supabase.functions.invoke('sap-sync', { body });
      if (error) {
        console.error('[SAP Sync] Edge Function error:', error);
        return { data: null, error: { message: error.message || 'Edge Function call failed' } };
      }
      return { data, error: null };
    } catch (err: any) {
      console.error('[SAP Sync] Edge Function exception:', err);
      return { data: null, error: { message: err?.message || 'Edge Function call failed' } };
    }
  }

  // Self-hosted: direct browser → middleware
  return invokeDirect(body);
}
