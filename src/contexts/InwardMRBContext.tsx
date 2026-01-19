import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];

interface InspectionLotRecord {
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
  status: 'pending' | 'mrb_created' | 'cleared';
}

interface InwardReportFilters {
  plants: string[];
  materialCodes: string[];
  vendors: string[];
  storageLocations: string[];
  inspectionLots: string[];
}

interface InwardMRBContextType {
  inspectionLotRecords: InspectionLotRecord[];
  inwardMRBRecords: MRBRecord[];
  isLoading: boolean;
  filters: InwardReportFilters;
  setFilters: (filters: InwardReportFilters) => void;
  getFilteredRecords: () => InspectionLotRecord[];
  refreshData: () => Promise<void>;
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
      
      // Fetch inward MRB records (source = quality_inspection)
      const { data: mrbData, error } = await supabase
        .from('mrb_records')
        .select('*')
        .eq('source', 'quality_inspection')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (mrbData) {
        setInwardMRBRecords(mrbData);
        
        // Create inspection lot records from MRB data for display
        const lotRecords: InspectionLotRecord[] = mrbData
          .filter(mrb => mrb.inspection_lot)
          .map(mrb => ({
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
            status: 'mrb_created' as const,
          }));
        
        setInspectionLotRecords(lotRecords);
      }
    } catch (error) {
      console.error('Error fetching inward MRB data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
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
          
          if (payload.eventType === 'INSERT') {
            setInwardMRBRecords((prev) => [payload.new as MRBRecord, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setInwardMRBRecords((prev) =>
              prev.map((record) =>
                record.id === (payload.new as MRBRecord).id
                  ? (payload.new as MRBRecord)
                  : record
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setInwardMRBRecords((prev) =>
              prev.filter((record) => record.id !== (payload.old as MRBRecord).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
