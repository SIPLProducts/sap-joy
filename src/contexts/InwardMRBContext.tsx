import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ParsedInspectionLot } from '@/lib/csvTemplates';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];

export interface InspectionLotRecord {
  id: string;
  inspectionLot: string;
  plant: string;
  materialCode: string;
  materialDescription: string;
  vendorCode: string;
  vendorName: string;
  storageLocation: string;
  batch: string;
  poNumber: string;
  transactionQuantity: number;
  uom: string;
  blockedQuantity: number;
  blockReason: string;
  inspectionDate: string;
  postingDate: string;
  grnNumber: string;
  status: 'pending' | 'mrb_created' | 'cleared';
  source: 'upload' | 'api' | 'mrb';
}

interface InwardReportFilters {
  plants: string[];
  materialCodes: string[];
  vendors: string[];
  storageLocations: string[];
  inspectionLots: string[];
}

interface UploadResult {
  success: boolean;
  insertedCount: number;
  errors: string[];
}

interface InwardMRBContextType {
  inspectionLotRecords: InspectionLotRecord[];
  inwardMRBRecords: MRBRecord[];
  isLoading: boolean;
  filters: InwardReportFilters;
  setFilters: (filters: InwardReportFilters) => void;
  getFilteredRecords: () => InspectionLotRecord[];
  refreshData: () => Promise<void>;
  uploadInspectionLots: (data: ParsedInspectionLot[], uploadBatchId: string) => Promise<UploadResult>;
  updateLotStatus: (id: string, status: 'pending' | 'mrb_created' | 'cleared') => Promise<void>;
}

const InwardMRBContext = createContext<InwardMRBContextType | undefined>(undefined);

export function InwardMRBProvider({ children }: { children: ReactNode }) {
  const [inspectionLotRecords, setInspectionLotRecords] = useState<InspectionLotRecord[]>([]);
  const [inwardMRBRecords, setInwardMRBRecords] = useState<MRBRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<InwardReportFilters>({
    plants: [],
    materialCodes: [],
    vendors: [],
    storageLocations: [],
    inspectionLots: [],
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch uploaded inspection lots
      const { data: uploadedLots, error: uploadError } = await supabase
        .from('inward_inspection_lots')
        .select('*')
        .order('created_at', { ascending: false });

      if (uploadError) {
        console.error('Error fetching uploaded lots:', uploadError);
      }

      // Fetch inward MRB records (source = quality_inspection)
      const { data: mrbData, error: mrbError } = await supabase
        .from('mrb_records')
        .select('*')
        .eq('source', 'quality_inspection')
        .order('created_at', { ascending: false });

      if (mrbError) {
        console.error('Error fetching MRB data:', mrbError);
      }
      
      if (mrbData) {
        setInwardMRBRecords(mrbData);
      }

      // Combine both sources into inspection lot records
      const lotRecords: InspectionLotRecord[] = [];

      // Add uploaded lots
      if (uploadedLots) {
        uploadedLots.forEach(lot => {
          lotRecords.push({
            id: lot.id,
            inspectionLot: lot.inspection_lot,
            plant: lot.plant,
            materialCode: lot.material_code,
            materialDescription: lot.material_description || '',
            vendorCode: lot.vendor_code || '',
            vendorName: lot.vendor_name || '',
            storageLocation: lot.storage_location || '',
            batch: lot.batch || '',
            poNumber: lot.po_number || '',
            transactionQuantity: Number(lot.transaction_quantity) || 0,
            uom: lot.uom || 'EA',
            blockedQuantity: Number(lot.blocked_quantity) || 0,
            blockReason: lot.block_reason || '',
            inspectionDate: lot.inspection_date || lot.created_at,
            postingDate: lot.posting_date || lot.created_at,
            grnNumber: lot.grn_number || '',
            status: lot.status as 'pending' | 'mrb_created' | 'cleared',
            source: 'upload'
          });
        });
      }

      // Add MRB-derived lots (for backwards compatibility)
      if (mrbData) {
        mrbData
          .filter(mrb => mrb.inspection_lot)
          .forEach(mrb => {
            // Check if this lot already exists from uploads
            const exists = lotRecords.some(r => r.inspectionLot === mrb.inspection_lot);
            if (!exists) {
              lotRecords.push({
                id: mrb.id,
                inspectionLot: mrb.inspection_lot || '',
                plant: mrb.plant,
                materialCode: mrb.material_number,
                materialDescription: mrb.material_description,
                vendorCode: mrb.vendor_code || '',
                vendorName: mrb.vendor_name || '',
                storageLocation: '',
                batch: '',
                poNumber: mrb.po_number || '',
                transactionQuantity: mrb.total_quantity,
                uom: mrb.uom || 'EA',
                blockedQuantity: mrb.blocked_quantity || 0,
                blockReason: mrb.defect_description || '',
                inspectionDate: mrb.created_at,
                postingDate: mrb.created_at,
                grnNumber: mrb.grn_number || '',
                status: 'mrb_created',
                source: 'mrb'
              });
            }
          });
      }
      
      setInspectionLotRecords(lotRecords);
    } catch (error) {
      console.error('Error fetching inward MRB data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates for both tables
    const mrbChannel = supabase
      .channel('inward_mrb_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrb_records',
          filter: 'source=eq.quality_inspection',
        },
        (payload) => {
          console.log('Real-time inward MRB update:', payload);
          fetchData(); // Refresh all data on changes
        }
      )
      .subscribe();

    const lotsChannel = supabase
      .channel('inward_lots_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inward_inspection_lots',
        },
        (payload) => {
          console.log('Real-time inspection lots update:', payload);
          fetchData(); // Refresh all data on changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(mrbChannel);
      supabase.removeChannel(lotsChannel);
    };
  }, [fetchData]);

  const getFilteredRecords = (): InspectionLotRecord[] => {
    let filtered = [...inspectionLotRecords];

    if (filters.plants.length > 0) {
      filtered = filtered.filter(r => filters.plants.includes(r.plant));
    }
    if (filters.materialCodes.length > 0) {
      filtered = filtered.filter(r => filters.materialCodes.includes(r.materialCode));
    }
    if (filters.vendors.length > 0) {
      filtered = filtered.filter(r => filters.vendors.includes(r.vendorCode));
    }
    if (filters.storageLocations.length > 0) {
      filtered = filtered.filter(r => filters.storageLocations.includes(r.storageLocation));
    }
    if (filters.inspectionLots.length > 0) {
      filtered = filtered.filter(r => filters.inspectionLots.includes(r.inspectionLot));
    }

    return filtered;
  };

  const uploadInspectionLots = async (
    data: ParsedInspectionLot[], 
    uploadBatchId: string
  ): Promise<UploadResult> => {
    const result: UploadResult = {
      success: true,
      insertedCount: 0,
      errors: []
    };

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Prepare rows for insertion
      const rows = data.map(row => ({
        inspection_lot: row.inspection_lot,
        material_code: row.material_code,
        material_description: row.material_description || null,
        plant: row.plant,
        storage_location: row.storage_location || null,
        batch: row.batch || null,
        blocked_quantity: row.blocked_quantity,
        transaction_quantity: row.transaction_quantity,
        uom: row.uom || 'EA',
        inspection_date: row.inspection_date || null,
        posting_date: row.posting_date || null,
        block_reason: row.block_reason || null,
        vendor_code: row.vendor_code || null,
        vendor_name: row.vendor_name || null,
        po_number: row.po_number || null,
        grn_number: row.grn_number || null,
        status: 'pending',
        uploaded_by: user?.email || 'unknown',
        upload_batch_id: uploadBatchId
      }));

      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase
          .from('inward_inspection_lots')
          .insert(batch);

        if (error) {
          result.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          result.success = false;
        } else {
          result.insertedCount += batch.length;
        }
      }

      // Refresh data after upload
      await fetchData();

    } catch (error) {
      result.success = false;
      result.errors.push(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  };

  const updateLotStatus = async (id: string, status: 'pending' | 'mrb_created' | 'cleared') => {
    const { error } = await supabase
      .from('inward_inspection_lots')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error updating lot status:', error);
      throw error;
    }

    await fetchData();
  };

  return (
    <InwardMRBContext.Provider
      value={{
        inspectionLotRecords,
        inwardMRBRecords,
        isLoading,
        filters,
        setFilters,
        getFilteredRecords,
        refreshData: fetchData,
        uploadInspectionLots,
        updateLotStatus,
      }}
    >
      {children}
    </InwardMRBContext.Provider>
  );
}

export function useInwardMRB() {
  const context = useContext(InwardMRBContext);
  if (context === undefined) {
    throw new Error('useInwardMRB must be used within an InwardMRBProvider');
  }
  return context;
}
