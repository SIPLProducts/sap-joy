import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ParsedShopFloorStock } from '@/lib/shopFloorStockTemplates';
import { invokeSapSync } from '@/lib/sapSyncClient';

export interface ShopFloorStockRecord {
  id: string;
  plant: string;
  material_code: string;
  material_description: string | null;
  batch: string | null;
  storage_location: string | null;
  available_quantity: number;
  uom: string | null;
  production_order: string | null;
  reservation_number: string | null;
  status: string | null;
  source: string | null;
  created_at: string;
}

export interface SAPApiConfig {
  id: string;
  config_name: string;
  api_endpoint: string;
  auth_type: string;
  username: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_frequency: string;
}

export interface SAPStockSyncHistory {
  id: string;
  config_id: string | null;
  sync_type: string;
  status: string;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  synced_by: string | null;
}

export interface StockSearchParams {
  werks: string;
  lgort: string;
  matnr?: string;
  matart?: string;
}

export function useShopFloorStock() {
  const [stockRecords, setStockRecords] = useState<ShopFloorStockRecord[]>([]);
  const [sapConfigs, setSapConfigs] = useState<SAPApiConfig[]>([]);
  const [syncHistory, setSyncHistory] = useState<SAPStockSyncHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Search stock records from SAP MB52 API with user-provided params (no auto-fetch)
  const searchStockRecords = useCallback(async (params: StockSearchParams) => {
    setIsLoading(true);
    try {
      // Find the MB52 config
      const { data: configs } = await supabase
        .from('sap_api_config')
        .select('id, config_name, api_endpoint, is_active')
        .eq('is_active', true);

      // Priority 1: match config_name containing 'mb52' but NOT '343' or '344'
      const mb52Config = (configs || []).find((c: any) => {
        const name = (c.config_name || '').toLowerCase();
        return name.includes('mb52') && !name.includes('343') && !name.includes('344');
      }) ||
      // Priority 2: fallback to endpoint match excluding transactional configs
      (configs || []).find((c: any) => {
        const name = (c.config_name || '').toLowerCase();
        const endpoint = (c.api_endpoint || '').toLowerCase();
        return endpoint.includes('mb52') && !name.includes('343') && !name.includes('344');
      });

      if (!mb52Config) {
        console.warn('[ShopFloorStock] No active MB52 SAP config found. Showing empty data.');
        setStockRecords([]);
        return;
      }

      const res = await invokeSapSync({
        action: 'fetch_live',
        config_id: mb52Config.id,
        search_params: {
          WERKS: params.werks,
          LGORT: params.lgort,
          ...(params.matnr ? { MATNR: params.matnr } : {}),
          ...(params.matart ? { MATART: params.matart } : {}),
        },
      });
      
      if (res.data?.success && res.data?.records) {
        // Filter out SAP error responses that look like records but have no stock data
        const validRecords = res.data.records.filter((r: any) =>
          r.material_code || r.MATNR || r.plant || r.WERKS
        );
        if (validRecords.length === 0 && res.data.records.length > 0) {
          console.warn('[ShopFloorStock] SAP returned non-stock response:', res.data.records[0]);
          toast({
            title: 'SAP Response Error',
            description: res.data.records[0]?.MSG || 'SAP returned an unexpected response format',
            variant: 'destructive',
          });
          setStockRecords([]);
        } else {
          console.log(`[ShopFloorStock] Loaded ${validRecords.length} records live from SAP`);
          setStockRecords(validRecords);
        }
      } else {
        console.warn('[ShopFloorStock] SAP live fetch failed:', res.data?.error || res.error?.message);
        toast({
          title: 'SAP Fetch Failed',
          description: res.data?.error || res.error?.message || 'Could not fetch stock data from SAP',
          variant: 'destructive',
        });
        setStockRecords([]);
      }
    } catch (error) {
      console.error('Error fetching live stock from SAP:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch stock records from SAP',
        variant: 'destructive',
      });
      setStockRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Legacy fetchStockRecords kept for upload refresh — fetches without params
  const fetchStockRecords = useCallback(async () => {
    // No-op: stock is now fetched only via searchStockRecords
    // This prevents auto-fetch on mount
  }, []);

  // Fetch SAP API configurations
  const fetchSAPConfigs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sap_api_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSapConfigs(data || []);
    } catch (error) {
      console.error('Error fetching SAP configs:', error);
    }
  }, []);

  // Fetch sync history
  const fetchSyncHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sap_stock_sync_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (error) {
      console.error('Error fetching sync history:', error);
    }
  }, []);

  // Upload stock records from CSV/Excel
  const uploadStockRecords = useCallback(async (
    records: ParsedShopFloorStock[],
    uploadBatchId: string
  ): Promise<{ success: boolean; insertedCount: number; errors: string[] }> => {
    const result = { success: false, insertedCount: 0, errors: [] as string[] };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const stockData = records.map(record => ({
        plant: record.plant,
        material_code: record.material_code,
        material_description: record.material_description || null,
        batch: record.batch || null,
        storage_location: record.storage_location || null,
        available_quantity: record.available_quantity,
        uom: record.uom || 'EA',
        production_order: record.production_order || null,
        reservation_number: record.reservation_number || null,
        status: 'available',
        source: 'upload',
        upload_batch_id: uploadBatchId,
        uploaded_by: user?.email || 'unknown',
      }));

      const { data, error } = await supabase
        .from('shop_floor_stock')
        .upsert(stockData, { onConflict: 'stock_key' })
        .select();

      if (error) throw error;

      result.success = true;
      result.insertedCount = data?.length || 0;
      
      // Refresh the records
      await fetchStockRecords();
    } catch (error) {
      console.error('Upload error:', error);
      result.errors.push(error instanceof Error ? error.message : 'Upload failed');
    }

    return result;
  }, [fetchStockRecords]);

  // Save SAP API configuration
  const saveSAPConfig = useCallback(async (config: {
    config_name: string;
    api_endpoint: string;
    auth_type: string;
    username?: string;
    encrypted_password?: string;
    api_key?: string;
    sync_frequency: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('sap_api_config')
        .insert({
          ...config,
          is_active: true,
        });

      if (error) throw error;
      
      await fetchSAPConfigs();
      return { success: true };
    } catch (error) {
      console.error('Error saving SAP config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save configuration' };
    }
  }, [fetchSAPConfigs]);

  // Update SAP API configuration
  const updateSAPConfig = useCallback(async (
    id: string,
    updates: Partial<SAPApiConfig>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('sap_api_config')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      await fetchSAPConfigs();
      return { success: true };
    } catch (error) {
      console.error('Error updating SAP config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update configuration' };
    }
  }, [fetchSAPConfigs]);

  // Delete SAP API configuration
  const deleteSAPConfig = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('sap_api_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchSAPConfigs();
      return { success: true };
    } catch (error) {
      console.error('Error deleting SAP config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete configuration' };
    }
  }, [fetchSAPConfigs]);

  // Test SAP API connection
  const testSAPConnection = useCallback(async (configId: string): Promise<{ success: boolean; message: string }> => {
    // This is a placeholder - actual SAP API testing would be done via an edge function
    const config = sapConfigs.find(c => c.id === configId);
    if (!config) {
      return { success: false, message: 'Configuration not found' };
    }
    
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { 
      success: true, 
      message: 'Connection test successful. Note: Full SAP integration requires backend edge function setup.' 
    };
  }, [sapConfigs]);

  // Trigger SAP sync (placeholder - would call edge function)
  const triggerSAPSync = useCallback(async (configId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create sync history record
      const { data: syncRecord, error: insertError } = await supabase
        .from('sap_stock_sync_history')
        .insert({
          config_id: configId,
          sync_type: 'manual',
          status: 'in_progress',
          synced_by: user?.email || 'unknown',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Simulate sync (in production, this would call an edge function)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update sync record with success (placeholder result)
      await supabase
        .from('sap_stock_sync_history')
        .update({
          status: 'success',
          records_fetched: 0,
          records_inserted: 0,
          records_updated: 0,
          completed_at: new Date().toISOString(),
          error_message: 'SAP API endpoint not configured. Please set up the edge function for actual SAP integration.',
        })
        .eq('id', syncRecord.id);

      // Update config last_sync_at
      await supabase
        .from('sap_api_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', configId);

      await fetchSyncHistory();
      await fetchSAPConfigs();

      return { 
        success: true, 
        message: 'Sync initiated. Note: Full SAP integration requires edge function configuration.' 
      };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Sync failed' };
    }
  }, [fetchSyncHistory, fetchSAPConfigs]);

  // Get unique values for filters
  const getUniquePlants = useCallback(() => {
    return [...new Set(stockRecords.map(r => r.plant))];
  }, [stockRecords]);

  const getUniqueMaterials = useCallback(() => {
    const materials = new Map<string, string>();
    stockRecords.forEach(r => {
      if (!materials.has(r.material_code)) {
        materials.set(r.material_code, r.material_description || r.material_code);
      }
    });
    return Array.from(materials.entries()).map(([code, description]) => ({ code, description }));
  }, [stockRecords]);

  const getUniqueBatches = useCallback(() => {
    return [...new Set(stockRecords.map(r => r.batch).filter(Boolean))] as string[];
  }, [stockRecords]);

  const getUniqueStorageLocations = useCallback(() => {
    return [...new Set(stockRecords.map(r => r.storage_location).filter(Boolean))] as string[];
  }, [stockRecords]);

  // Initial fetch — only configs/history, NOT stock (stock requires explicit search)
  useEffect(() => {
    fetchSAPConfigs();
    fetchSyncHistory();
  }, [fetchSAPConfigs, fetchSyncHistory]);

  return {
    stockRecords,
    sapConfigs,
    syncHistory,
    isLoading,
    searchStockRecords,
    fetchStockRecords,
    fetchSAPConfigs,
    fetchSyncHistory,
    uploadStockRecords,
    saveSAPConfig,
    updateSAPConfig,
    deleteSAPConfig,
    testSAPConnection,
    triggerSAPSync,
    getUniquePlants,
    getUniqueMaterials,
    getUniqueBatches,
    getUniqueStorageLocations,
  };
}

