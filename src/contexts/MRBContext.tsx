import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];
type EmailLog = Database['public']['Tables']['email_logs']['Row'];

interface MRBFilters {
  status?: string[];
  source?: string[];
  plant?: string[];
  vendor?: string[];
  slaStatus?: string[];
  escalationLevel?: string[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface MRBContextType {
  mrbRecords: MRBRecord[];
  emailLogs: EmailLog[];
  filters: MRBFilters;
  isLoading: boolean;
  setFilters: (filters: MRBFilters) => void;
  getMRBById: (id: string) => MRBRecord | undefined;
  getFilteredMRBs: () => MRBRecord[];
  refreshData: () => Promise<void>;
}

const MRBContext = createContext<MRBContextType | undefined>(undefined);

export function MRBProvider({ children }: { children: ReactNode }) {
  const [mrbRecords, setMRBRecords] = useState<MRBRecord[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [filters, setFilters] = useState<MRBFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const { profile, userRole } = useAuth();

  // Plant-based filtering: admin and executive see all plants, others see only their plant
  const shouldFilterByPlant = userRole && !['admin', 'executive'].includes(userRole);
  const userPlant = profile?.plant;

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [mrbResult, emailResult] = await Promise.all([
        supabase
          .from('mrb_records')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('email_logs')
          .select('*')
          .order('sent_at', { ascending: false }),
      ]);

      if (mrbResult.error) {
        console.error('[MRBContext] mrb_records fetch error:', mrbResult.error);
      }
      if (mrbResult.data) {
        // Apply plant-based filtering on client side
        const filtered = shouldFilterByPlant && userPlant
          ? mrbResult.data.filter(r => r.plant === userPlant)
          : mrbResult.data;
        console.log(
          `[MRBContext] Loaded ${mrbResult.data.length} mrb_records (after plant filter: ${filtered.length}). ` +
          `shop_floor=${filtered.filter((r: any) => r.source === 'shop_floor').length}, ` +
          `quality_inspection=${filtered.filter((r: any) => r.source === 'quality_inspection').length}`
        );
        setMRBRecords(filtered);
      }
      if (emailResult.data) {
        setEmailLogs(emailResult.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [shouldFilterByPlant, userPlant]);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates for MRB records
    const mrbChannel = supabase
      .channel('mrb_context_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrb_records',
        },
        (payload) => {
          console.log('Real-time MRB context update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setMRBRecords((prev) => [payload.new as MRBRecord, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMRBRecords((prev) =>
              prev.map((record) =>
                record.id === (payload.new as MRBRecord).id
                  ? (payload.new as MRBRecord)
                  : record
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setMRBRecords((prev) =>
              prev.filter((record) => record.id !== (payload.old as MRBRecord).id)
            );
          }
        }
      )
      .subscribe();

    // Subscribe to real-time updates for email logs
    const emailChannel = supabase
      .channel('email_context_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs',
        },
        (payload) => {
          console.log('Real-time email context update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setEmailLogs((prev) => [payload.new as EmailLog, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setEmailLogs((prev) =>
              prev.map((record) =>
                record.id === (payload.new as EmailLog).id
                  ? (payload.new as EmailLog)
                  : record
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setEmailLogs((prev) =>
              prev.filter((record) => record.id !== (payload.old as EmailLog).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(mrbChannel);
      supabase.removeChannel(emailChannel);
    };
  }, [fetchData]);

  const getMRBById = (id: string): MRBRecord | undefined => {
    return mrbRecords.find(mrb => mrb.id === id);
  };

  const getFilteredMRBs = (): MRBRecord[] => {
    let filtered = [...mrbRecords];

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(mrb => filters.status!.includes(mrb.status));
    }

    if (filters.source && filters.source.length > 0) {
      filtered = filtered.filter(mrb => filters.source!.includes(mrb.source));
    }

    if (filters.plant && filters.plant.length > 0) {
      filtered = filtered.filter(mrb => filters.plant!.includes(mrb.plant));
    }

    if (filters.vendor && filters.vendor.length > 0) {
      filtered = filtered.filter(mrb => mrb.vendor_code && filters.vendor!.includes(mrb.vendor_code));
    }

    if (filters.slaStatus && filters.slaStatus.length > 0) {
      filtered = filtered.filter(mrb => mrb.sla_status && filters.slaStatus!.includes(mrb.sla_status));
    }

    if (filters.escalationLevel && filters.escalationLevel.length > 0) {
      filtered = filtered.filter(mrb => mrb.escalation_level && filters.escalationLevel!.includes(mrb.escalation_level));
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        mrb =>
          mrb.mrb_number.toLowerCase().includes(searchLower) ||
          mrb.material_number.toLowerCase().includes(searchLower) ||
          mrb.material_description.toLowerCase().includes(searchLower) ||
          (mrb.vendor_name && mrb.vendor_name.toLowerCase().includes(searchLower))
      );
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(mrb => mrb.created_at >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      filtered = filtered.filter(mrb => mrb.created_at <= filters.dateTo!);
    }

    return filtered;
  };

  return (
    <MRBContext.Provider
      value={{
        mrbRecords,
        emailLogs,
        filters,
        isLoading,
        setFilters,
        getMRBById,
        getFilteredMRBs,
        refreshData: fetchData,
      }}
    >
      {children}
    </MRBContext.Provider>
  );
}

export function useMRB() {
  const context = useContext(MRBContext);
  if (context === undefined) {
    throw new Error('useMRB must be used within a MRBProvider');
  }
  return context;
}
