import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DynamicField {
  id: string;
  field_name: string;
  field_type: string;
  sap_field_name: string | null;
  map_to_column: string | null;
  map_to_table: string | null;
  description: string | null;
  sort_order: number | null;
  json_path: string | null;
}

/**
 * Fetches dynamic field definitions from sap_api_response_fields
 * for a given target table. These represent columns added via SAP API Settings → Fields.
 *
 * Returns only fields that have both map_to_table and map_to_column set.
 */
export function useDynamicFields(targetTable: string) {
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sap_api_response_fields')
        .select('id, field_name, field_type, sap_field_name, map_to_column, map_to_table, description, sort_order, json_path')
        .eq('map_to_table', targetTable)
        .not('map_to_column', 'is', null)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching dynamic fields:', error);
        setDynamicFields([]);
      } else {
        // Deduplicate by map_to_column (keep first occurrence)
        const seen = new Set<string>();
        const unique = (data || []).filter((f) => {
          const col = f.map_to_column as string;
          if (seen.has(col)) return false;
          seen.add(col);
          return true;
        });
        setDynamicFields(unique as DynamicField[]);
      }
    } catch (err) {
      console.error('Failed to load dynamic fields:', err);
      setDynamicFields([]);
    }
    setIsLoading(false);
  }, [targetTable]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  return { dynamicFields, isLoading, refetch: fetchFields };
}

/**
 * Known/base columns for each table — used to filter out fields that are
 * already rendered by the hardcoded UI so we don't duplicate them.
 */
export const BASE_COLUMNS: Record<string, Set<string>> = {
  inward_inspection_lots: new Set([
    'id', 'inspection_lot', 'plant', 'material_code', 'material_description',
    'vendor_code', 'vendor_name', 'storage_location', 'batch',
    'po_number', 'po_item_number', 'transaction_quantity', 'uom',
    'blocked_quantity', 'block_reason', 'inspection_date', 'posting_date',
    'grn_number', 'grn_item_no', 'grn_date', 'status', 'source', 'upload_batch_id', 'uploaded_by',
    'created_at', 'updated_at',
  ]),
  shop_floor_stock: new Set([
    'id', 'material_code', 'material_description', 'plant', 'batch',
    'storage_location', 'storage_location_desc', 'available_quantity',
    'blocked_quantity', 'blocked_value', 'quality_inspection_qty',
    'quality_inspection_value', 'transfer_qty', 'transfer_value',
    'unrestricted_value', 'uom', 'production_order', 'reservation_number',
    'status', 'source', 'stock_key', 'sap_sync_id',
    'row_number_custom', 'rack_number', 'shelf_number', 'bin_number',
    'upload_batch_id', 'uploaded_by', 'created_at', 'updated_at',
  ]),
};

/**
 * Returns only truly "extra" dynamic fields — those whose map_to_column
 * is NOT in the base column set for the table.
 */
export function useExtraDynamicFields(targetTable: string) {
  const { dynamicFields, isLoading, refetch } = useDynamicFields(targetTable);
  const baseSet = BASE_COLUMNS[targetTable] || new Set();

  const extraFields = dynamicFields.filter(
    (f) => f.map_to_column && !baseSet.has(f.map_to_column)
  );

  return { extraFields, allDynamicFields: dynamicFields, isLoading, refetch };
}
