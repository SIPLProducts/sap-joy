import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeSapSync } from '@/lib/sapSyncClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import { ParsedInspectionLot } from '@/lib/csvTemplates';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];
type MRBInsert = Database['public']['Tables']['mrb_records']['Insert'];

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
  poItemNumber: string;
  transactionQuantity: number;
  uom: string;
  blockedQuantity: number;
  blockReason: string;
  inspectionDate: string;
  postingDate: string;
  grnNumber: string;
  grnItemNo: string;
  grnDate: string;
  status: 'pending' | 'mrb_created' | 'cleared';
  source: 'upload' | 'api' | 'mrb';
  /** Raw DB row — carries any dynamic columns added via SAP field config */
  _raw?: Record<string, unknown>;
}

interface InwardReportFilters {
  plants: string[];
  materialCodes: string[];
  vendors: string[];
  storageLocations: string[];
  inspectionLots: string[];
  postingDateFrom: string;
  postingDateTo: string;
}

interface UploadResult {
  success: boolean;
  insertedCount: number;
  errors: string[];
}

interface BatchMRBResult {
  success: boolean;
  createdCount: number;
  errors: string[];
  createdMRBs: MRBRecord[];
}

interface UpdateQtyResult {
  success: boolean;
  error?: string;
  rolled_back?: boolean;
  old_quantity?: number;
  new_quantity?: number;
  sap_response?: any;
}

interface InwardInProcessMRBContextType {
  inspectionLotRecords: InspectionLotRecord[];
  inwardMRBRecords: MRBRecord[];
  isLoading: boolean;
  filters: InwardReportFilters;
  setFilters: (filters: InwardReportFilters) => void;
  getFilteredRecords: () => InspectionLotRecord[];
  refreshData: () => Promise<void>;
  uploadInspectionLots: (data: ParsedInspectionLot[], uploadBatchId: string) => Promise<UploadResult>;
  updateLotStatus: (id: string, status: 'pending' | 'mrb_created' | 'cleared') => Promise<void>;
  createBatchMRBs: (records: InspectionLotRecord[]) => Promise<BatchMRBResult>;
  updateTransactionQuantity: (record: InspectionLotRecord, newQty: number, sapConfigId: string) => Promise<UpdateQtyResult>;
}

const InwardInProcessMRBContext = createContext<InwardInProcessMRBContextType | undefined>(undefined); // stable context ref

export function InwardInProcessMRBProvider({ children }: { children: ReactNode }) {
  const [inspectionLotRecords, setInspectionLotRecords] = useState<InspectionLotRecord[]>([]);
  const [inwardMRBRecords, setInwardMRBRecords] = useState<MRBRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { profile, userRole } = useAuth();
  const shouldFilterByPlant = userRole && !['admin', 'executive'].includes(userRole);
  const userPlant = profile?.plant;
  const [filters, setFilters] = useState<InwardReportFilters>({
    plants: [],
    materialCodes: [],
    vendors: [],
    storageLocations: [],
    inspectionLots: [],
    postingDateFrom: '',
    postingDateTo: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch all inspection lots synced from SAP (ZMRB04 — In-Process) so the page can show the full live picture
      let lotsQuery = supabase
        .from('zmrb_inward_report')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply plant filter if needed
      if (shouldFilterByPlant && userPlant) {
        lotsQuery = lotsQuery.eq('plant', userPlant);
      }

      const { data: uploadedLots, error: uploadError } = await lotsQuery;

      if (uploadError) {
        console.error('Error fetching uploaded lots:', uploadError);
      }

      // Fetch inward MRB records (source = inprocess)
      let mrbQuery = supabase
        .from('mrb_records')
        .select('*')
        .eq('source', 'inprocess' as any)
        .order('created_at', { ascending: false });

      if (shouldFilterByPlant && userPlant) {
        mrbQuery = mrbQuery.eq('plant', userPlant);
      }

      const { data: mrbData, error: mrbError } = await mrbQuery;

      if (mrbError) {
        console.error('Error fetching MRB data:', mrbError);
      }
      
      if (mrbData) {
        setInwardMRBRecords(mrbData);
      }

      // Build a set of inspection lots that already have MRBs so we can reflect status correctly
      const lotsWithMRB = new Set<string>();
      if (mrbData) {
        mrbData.forEach(mrb => {
          if (mrb.inspection_lot) {
            lotsWithMRB.add(mrb.inspection_lot);
          }
        });
      }

      const lotRecords: InspectionLotRecord[] = [];

      if (uploadedLots) {
        uploadedLots.forEach(lot => {
          const effectiveStatus = lotsWithMRB.has(lot.inspection_lot)
            ? 'mrb_created'
            : (lot.status as 'pending' | 'mrb_created' | 'cleared');

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
            poItemNumber: lot.po_item_number || '',
            transactionQuantity: Number(lot.transaction_quantity) || 0,
            uom: lot.uom || 'EA',
            blockedQuantity: Number(lot.blocked_quantity) || 0,
            blockReason: lot.block_reason || '',
            inspectionDate: lot.inspection_date || lot.created_at,
            postingDate: lot.posting_date || lot.created_at,
            grnNumber: lot.grn_number || '',
            grnItemNo: (lot as any).grn_item_no || '',
            grnDate: (lot as any).grn_date || '',
            status: effectiveStatus,
            source: lot.upload_batch_id ? 'upload' : 'api',
            _raw: lot as unknown as Record<string, unknown>,
          });
        });
      }
      
      setInspectionLotRecords(lotRecords.filter(r => r.status !== 'mrb_created'));
    } catch (error) {
      console.error('Error fetching inward MRB data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [shouldFilterByPlant, userPlant]);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates for both tables
    const mrbChannel = supabase
      .channel('inward_inprocess_mrb_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrb_records',
          filter: 'source=eq.inprocess',
        },
        (payload) => {
          console.log('Real-time inward in-process MRB update:', payload);
          fetchData(); // Refresh all data on changes
        }
      )
      .subscribe();

    const lotsChannel = supabase
      .channel('inward_inprocess_lots_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zmrb_inward_report',
        },
        (payload) => {
          console.log('Real-time in-process inspection lots update:', payload);
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
    // All records in inspectionLotRecords are already 'pending' status (fetched from DB with filter)
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
    if (filters.postingDateFrom) {
      filtered = filtered.filter(r => {
        if (!r.postingDate) return false;
        const dateOnly = r.postingDate.substring(0, 10);
        return dateOnly >= filters.postingDateFrom;
      });
    }
    if (filters.postingDateTo) {
      filtered = filtered.filter(r => {
        if (!r.postingDate) return false;
        const dateOnly = r.postingDate.substring(0, 10);
        return dateOnly <= filters.postingDateTo;
      });
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
        po_item_number: row.po_item_number || null,
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

  const createBatchMRBs = async (records: InspectionLotRecord[]): Promise<BatchMRBResult> => {
    const result: BatchMRBResult = {
      success: true,
      createdCount: 0,
      errors: [],
      createdMRBs: []
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Use actual user role instead of hardcoded 'quality'
      const actualRole = userRole || 'quality';

      // Determine initial pending_with and status based on user role
      // Quality users create MRBs that start at quality_review
      // Other roles also create at quality_review by default
      const initialPendingWith = actualRole;
      const initialStatus: Database['public']['Enums']['mrb_status'] = 
        actualRole === 'quality' || actualRole === 'quality_head' ? 'quality_review' :
        actualRole === 'purchase' || actualRole === 'purchase_head' ? 'purchase_review' :
        actualRole === 'engineering' || actualRole === 'engineering_head' ? 'engineering_review' :
        'quality_review';

      // Generate MRB numbers
      const year = new Date().getFullYear();
      const prefix = `MRB-${year}-`;
      
      const { data: existingMRBs } = await supabase
        .from('mrb_records')
        .select('mrb_number')
        .like('mrb_number', `${prefix}%`)
        .order('mrb_number', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingMRBs && existingMRBs.length > 0) {
        const lastNumber = parseInt(existingMRBs[0].mrb_number.replace(prefix, ''), 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      // Filter out invalid records (cleared or already has MRB)
      const validRecords = records.filter(record => {
        if (record.status === 'cleared') {
          result.errors.push(`Lot ${record.inspectionLot} is already cleared and cannot be used for MRB creation`);
          return false;
        }
        if (record.status === 'mrb_created') {
          result.errors.push(`Lot ${record.inspectionLot} already has an MRB created`);
          return false;
        }
        return true;
      });

      if (validRecords.length === 0) {
        result.success = false;
        return result;
      }

      // Create MRBs one by one to ensure proper numbering
      for (const record of validRecords) {
        try {
          const mrbNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
          
          const mrbData: MRBInsert = {
            mrb_number: mrbNumber,
            source: 'quality_inspection',
            created_by: user.id,
            status: initialStatus,
            plant: record.plant,
            material_number: record.materialCode,
            material_description: record.materialDescription,
            total_quantity: record.transactionQuantity,
            blocked_quantity: record.blockedQuantity,
            uom: record.uom,
            vendor_code: record.vendorCode || null,
            vendor_name: record.vendorName || null,
            po_number: record.poNumber || null,
            issue_description: record.poItemNumber ? `PO Item: ${record.poItemNumber}` : null,
            grn_number: record.grnNumber || null,
            inspection_lot: record.inspectionLot,
            batch: record.batch || null,
            storage_location: record.storageLocation || null,
            defect_description: record.blockReason || null,
            pending_with: initialPendingWith as string
          };

          const { data: createdMRB, error } = await supabase
            .from('mrb_records')
            .insert(mrbData)
            .select()
            .single();

          if (error) throw error;

          // Update lot status in inward_inspection_lots table
          await supabase
            .from('inward_inspection_lots')
            .update({ status: 'mrb_created' })
            .eq('inspection_lot', record.inspectionLot);

          // Add to approval history with actual user role
          await supabase.from('mrb_approval_history').insert({
            mrb_id: createdMRB.id,
            stage: 'Creation',
            action: 'created',
            performed_by: user.id,
            performed_by_role: actualRole as string,
            remarks: `MRB created from inspection lot ${record.inspectionLot} by ${actualRole}`,
          });

          result.createdMRBs.push(createdMRB);
          result.createdCount++;
          nextNumber++;
        } catch (err) {
          result.errors.push(`Failed to create MRB for lot ${record.inspectionLot}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          result.success = false;
        }
      }

      await fetchData();
    } catch (error) {
      result.success = false;
      result.errors.push(`Batch creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  };

  const updateTransactionQuantity = async (
    record: InspectionLotRecord,
    newQty: number,
    sapConfigId: string
  ): Promise<UpdateQtyResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await invokeSapSync({
        action: 'update_transaction_qty',
        config_id: sapConfigId,
        lot_id: record.id,
        new_quantity: newQty,
        inspection_lot: record.inspectionLot,
        material_code: record.materialCode,
        plant: record.plant,
        storage_location: record.storageLocation,
        batch: record.batch,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'SAP update failed',
          rolled_back: data.rolled_back,
          old_quantity: data.old_quantity,
        };
      }

      // Refresh data to reflect the change
      await fetchData();

      return {
        success: true,
        new_quantity: data.new_quantity,
        old_quantity: data.old_quantity,
        sap_response: data.sap_response,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
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
        createBatchMRBs,
        updateTransactionQuantity,
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
