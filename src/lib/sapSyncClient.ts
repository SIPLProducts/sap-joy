import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

/**
 * Detect if we're running against Lovable Cloud (supabase.co)
 * or a self-hosted Supabase instance (private IP / custom domain).
 */
function isLovableCloud(): boolean {
  return SUPABASE_URL.includes('supabase.co');
}

/**
 * For self-hosted environments, call the Node.js middleware directly
 * from the browser (no edge function needed).
 */
async function invokeDirect(body: Record<string, any>): Promise<{ data: any; error: any }> {
  const { action, config_id } = body;

  if (!config_id) {
    return { data: null, error: { message: 'config_id is required' } };
  }

  // Fetch config from DB to get proxy_tunnel_url and proxy_secret
  const { data: config, error: configError } = await supabase
    .from('sap_api_config')
    .select('*')
    .eq('id', config_id)
    .single();

  if (configError || !config) {
    return { data: null, error: { message: configError?.message || 'Configuration not found' } };
  }

  const proxyUrl = config.proxy_tunnel_url;
  if (!proxyUrl) {
    return { data: null, error: { message: 'No proxy/tunnel URL configured. Set the Proxy URL in SAP API Settings.' } };
  }

  // Build the target URL
  const baseUrl = proxyUrl.replace(/\/$/, '');
  const endpointPath = config.endpoint_path || '';
  let url = `${baseUrl}${endpointPath}`;

  // Add sap-client if configured and not already in URL
  if (config.sap_client && !/[?&]sap-client=/.test(url)) {
    url += `${url.includes('?') ? '&' : '?'}sap-client=${config.sap_client}`;
  }

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
  if (config.auth_type === 'basic' && config.username) {
    headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.encrypted_password || ''}`)}`;
  } else if (config.auth_type === 'api_key' && config.api_key) {
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
      return await directTest(url, headers, config);
    }

    if (action === 'sync') {
      return await directSync(url, headers, config, body);
    }

    if (action === 'unblock') {
      return await directUnblock(url, headers, config, body);
    }

    if (action === 'update_transaction_qty') {
      return await directUpdateQty(url, headers, config, body);
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
): Promise<{ data: any; error: any }> {
  const method = (config.http_method || 'GET').toUpperCase();
  const start = Date.now();

  const fetchOpts: RequestInit = { method, headers };
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchOpts.body = JSON.stringify({});
  }

  const response = await fetch(url, fetchOpts);
  const elapsed = Date.now() - start;
  const bodyText = await response.text();

  if (response.ok) {
    return {
      data: {
        success: true,
        message: `Route reachable (${response.status}), ${elapsed}ms. Note: this only verifies network/auth — use "Trigger Sync" to validate the full payload.`,
        status: response.status,
        responseTime: elapsed,
      },
      error: null,
    };
  } else {
    return {
      data: {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}. Body: ${bodyText.substring(0, 500)}`,
        status: response.status,
        responseTime: elapsed,
      },
      error: null,
    };
  }
}

async function directSync(
  url: string,
  headers: Record<string, string>,
  config: any,
  body: Record<string, any>,
): Promise<{ data: any; error: any }> {
  const method = (config.http_method || 'GET').toUpperCase();
  const debugLabel = `[SAP Sync Debug] ${config.config_name || config.endpoint_path || body.config_id || 'Unknown API'}`;

  const maskSensitiveHeaders = (sourceHeaders: Record<string, string>): Record<string, string> => {
    return Object.fromEntries(
      Object.entries(sourceHeaders).map(([key, value]) => {
        const normalizedKey = key.toLowerCase();
        if (normalizedKey === 'authorization') {
          const scheme = value.includes(' ') ? value.split(' ')[0] : 'Basic';
          return [key, `${scheme} ***masked***`];
        }
        if (normalizedKey === 'x-proxy-secret' || normalizedKey === 'x-api-key') {
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

    console.groupCollapsed(debugLabel);
    console.log('Resolved URL:', url);
    console.log('HTTP method:', method);
    console.log('Connection mode:', config.connection_mode || 'direct');
    console.log('Auth type:', config.auth_type || 'none');
    console.log('SAP client:', config.sap_client || 'not set');
    console.log('Headers:', maskSensitiveHeaders(headers));
    console.log('Request fields count:', requestFields?.length || 0);
    if (requestBody) {
      console.log('Payload:', requestBody);
    } else {
      console.log('Payload: none');
    }
    console.groupEnd();

    const response = await fetch(url, fetchOpts);
    const bodyText = await response.text();
    const contentType = response.headers.get('content-type') || 'unknown';
    const responsePreview = bodyText.substring(0, 2000);
    const detectedSapError = extractSapErrorSummary(bodyText);

    console.groupCollapsed(`${debugLabel} response`);
    console.log('Status:', response.status, response.statusText);
    console.log('Content-Type:', contentType);
    console.log('Response preview:', responsePreview);
    if (detectedSapError) {
      console.error('Detected SAP error:', detectedSapError);
    }
    console.groupEnd();
    
    if (!response.ok) {
      console.error(`${debugLabel} HTTP failure body:`, bodyText);
      await supabase.from('sap_stock_sync_history').update({
        status: 'failed',
        error_message: `SAP API returned ${response.status}: ${bodyText.substring(0, 500)}`,
        completed_at: new Date().toISOString(),
      }).eq('id', syncRecord.id);

      return {
        data: { success: false, error: `SAP API returned ${response.status}`, sync_id: syncRecord.id },
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

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(payload),
  });

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

  return {
    data: {
      success: true,
      sap_response: responseData,
      code: responseData?.CODE || null,
      message: responseData?.MSG || null,
      material_document: responseData?.MBLNR || null,
      material_document_year: responseData?.MJAHR || null,
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

    const response = await fetch(url, { method, headers, body: JSON.stringify(sapPayload) });
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
  // Self-hosted: call middleware directly
  if (!isLovableCloud()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: { message: 'Not authenticated' } };
    }
    return invokeDirect(body);
  }

  // Lovable Cloud: use edge function
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { data: null, error: { message: 'Not authenticated' } };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sap-sync', { body });

    if (error) {
      const errMsg = typeof error === 'object'
        ? (error.message || error.name || JSON.stringify(error))
        : String(error);
      return { data: null, error: { message: errMsg } };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Edge function call failed' } };
  }
}
