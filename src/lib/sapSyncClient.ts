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
  };

  if (config.proxy_secret) {
    headers['x-proxy-secret'] = config.proxy_secret;
  }

  // Auth headers (for direct SAP, middleware handles auth; for proxy mode, pass through)
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
        message: `Connection successful. Status: ${response.status}, Response time: ${elapsed}ms, Body length: ${bodyText.length} chars`,
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
    return { data: { success: false, error: 'Failed to create sync record' }, error: null };
  }

  try {
    // Build request body from request fields
    const { data: requestFields } = await supabase
      .from('sap_api_request_fields')
      .select('*')
      .eq('config_id', body.config_id)
      .order('sort_order');

    let requestBody: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method) && requestFields?.length) {
      requestBody = {};
      requestFields.forEach((field: any) => {
        const key = field.sap_field_name || field.field_name;
        requestBody[key] = field.default_value ?? '';
      });
    }

    const fetchOpts: RequestInit = { method, headers };
    if (requestBody) {
      fetchOpts.body = JSON.stringify(requestBody);
    }

    const response = await fetch(url, fetchOpts);
    const bodyText = await response.text();

    if (!response.ok) {
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
      await supabase.from('sap_stock_sync_history').update({
        status: 'failed',
        error_message: 'Response is not valid JSON',
        completed_at: new Date().toISOString(),
      }).eq('id', syncRecord.id);

      return { data: { success: false, error: 'Response is not valid JSON', sync_id: syncRecord.id }, error: null };
    }

    const records = jsonData?.d?.results || jsonData?.value || jsonData?.data || (Array.isArray(jsonData) ? jsonData : [jsonData]);

    // Get response field mappings
    const { data: responseFields } = await supabase
      .from('sap_api_response_fields')
      .select('*')
      .eq('config_id', body.config_id)
      .order('sort_order');

    // Map and insert (reuse edge function's mapping logic client-side)
    const mappingResult = await mapAndInsertClientSide(records, responseFields || [], syncRecord.id);

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

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let responseData: any;
  try {
    responseData = bodyText.trim() ? JSON.parse(bodyText) : { http_status: response.status };
  } catch {
    responseData = { raw: bodyText.substring(0, 1000), http_status: response.status };
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
 * Client-side version of mapAndInsertData for self-hosted mode.
 * Maps SAP response fields to DB columns and upserts.
 */
async function mapAndInsertClientSide(
  records: any[],
  responseFields: any[],
  syncId: string,
): Promise<{ fetched: number; inserted: number; updated: number; errors: string[] }> {
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
      'vendor_code', 'vendor_name', 'po_number', 'grn_number', 'uploaded_by', 'upload_batch_id',
    ]),
  };

  const aliasMap: Record<string, Record<string, string>> = {
    shop_floor_stock: {
      matnr: 'material_code', maktx: 'material_description', labst: 'available_quantity',
      charg: 'batch', lgobe: 'storage_location_desc', speme: 'blocked_quantity',
      insme: 'quality_inspection_qty', trame: 'transfer_qty', wlabs: 'unrestricted_value',
      wspem: 'blocked_value', winsm: 'quality_inspection_value', wtram: 'transfer_value',
      rowno: 'row_number_custom', shelfno: 'shelf_number', rackno: 'rack_number', binno: 'bin_number',
    },
    inward_inspection_lots: {
      matnr: 'material_code', maktx: 'material_description', werks: 'plant', charg: 'batch',
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
    const allowedColumns = allowedColumnsByTable[tableName];
    if (!allowedColumns) {
      result.errors.push(`Unsupported target table: ${tableName}`);
      continue;
    }

    const aliases = aliasMap[tableName] || {};
    const sanitizedRows = records.map((record, index) => {
      const row: Record<string, any> = {};

      fields.forEach((field: any) => {
        const value = record[field.sap_field_name || field.field_name];
        if (value === undefined || value === null || value === '') return;

        const requestedColumn = String(field.map_to_column).trim();
        const normalizedColumn = aliases[requestedColumn.toLowerCase()] || requestedColumn;
        if (!allowedColumns.has(normalizedColumn)) return;

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
        result.errors.push(`Skipped ${tableName} row ${index + 1}: missing (${missing.join(', ')})`);
        return null;
      }

      return row;
    }).filter(Boolean) as Record<string, any>[];

    if (sanitizedRows.length === 0) continue;

    // Insert in batches
    const batchSize = 500;
    for (let i = 0; i < sanitizedRows.length; i += batchSize) {
      const batch = sanitizedRows.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from(tableName)
        .upsert(batch, tableName === 'inward_inspection_lots' ? { onConflict: 'inspection_lot' } : undefined)
        .select();

      if (error) {
        result.errors.push(`Error inserting into ${tableName}: ${error.message}`);
        break;
      }
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
