import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextWorkflowStep, ROLE_TO_DEPT } from '@/lib/workflowRouting';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];
type MRBInsert = Database['public']['Tables']['mrb_records']['Insert'];
type MRBUpdate = Database['public']['Tables']['mrb_records']['Update'];
type ApprovalHistoryInsert = Database['public']['Tables']['mrb_approval_history']['Insert'];
type MRBStatus = Database['public']['Enums']['mrb_status'];
type AppRole = Database['public']['Enums']['app_role'];

export function useMRBDatabase() {
  const [mrbRecords, setMRBRecords] = useState<MRBRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  // Fetch all MRB records
  const fetchMRBRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('mrb_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMRBRecords(data || []);
    } catch (error) {
      console.error('Error fetching MRB records:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch MRB records',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMRBRecords();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('mrb_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mrb_records',
        },
        (payload) => {
          console.log('Real-time MRB update:', payload);
          
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMRBRecords]);

  // Get MRB by ID
  const getMRBById = useCallback(async (id: string): Promise<MRBRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('mrb_records')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching MRB:', error);
      return null;
    }
  }, []);

  // Create new MRB with optional workflow routing
  const createMRB = useCallback(async (mrb: MRBInsert, workflowRouting?: string[]): Promise<MRBRecord | null> => {
    try {
      // Attach workflow_routing to the insert payload
      const insertData = {
        ...mrb,
        ...(workflowRouting && workflowRouting.length > 0 ? { workflow_routing: workflowRouting } : {}),
      };

      const { data, error } = await supabase
        .from('mrb_records')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      
      // Add to approval history
      await supabase.from('mrb_approval_history').insert({
        mrb_id: data.id,
        stage: 'Creation',
        action: 'created',
        performed_by: user?.id || '',
        performed_by_role: userRole || 'shop_floor',
        remarks: `MRB created from ${mrb.source}${workflowRouting ? ` — Routing: ${workflowRouting.join(' → ')}` : ''}`,
      });

      await fetchMRBRecords();
      return data;
    } catch (error) {
      console.error('Error creating MRB:', error);
      toast({
        title: 'Error',
        description: 'Failed to create MRB',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, userRole, fetchMRBRecords, toast]);

  // Update MRB status and add to approval history
  const updateMRBStatus = useCallback(async (
    id: string,
    newStatus: MRBStatus,
    action: string,
    remarks: string,
    additionalUpdates?: MRBUpdate
  ): Promise<boolean> => {
    try {
      // First get the current MRB to know the current stage and workflow_routing
      const { data: currentMRB } = await supabase
        .from('mrb_records')
        .select('status, pending_with, workflow_routing')
        .eq('id', id)
        .single();

      const currentStage = currentMRB?.status || 'quality_review';
      const workflowRouting = (currentMRB as any)?.workflow_routing as string[] | null;

      // If the action is 'approved' (not reject) and there's a workflow_routing,
      // use the routing sequence to determine the next status instead of the caller's newStatus
      let effectiveStatus = newStatus;
      let effectivePendingWith: AppRole | null = null;

      if (
        action === 'approved' &&
        workflowRouting &&
        workflowRouting.length > 0 &&
        newStatus !== 'rejected' &&
        newStatus !== 'approved' &&
        newStatus !== 'closed'
      ) {
        const currentRole = currentMRB?.pending_with || userRole || 'quality';
        const nextStep = getNextWorkflowStep(workflowRouting, currentRole);

        if (nextStep) {
          if (nextStep.isLast && nextStep.nextStatus === 'approved') {
            effectiveStatus = 'approved';
            effectivePendingWith = null;
          } else {
            effectiveStatus = nextStep.nextStatus;
            effectivePendingWith = nextStep.nextRole;
          }
        }
      }

      const updates: MRBUpdate = {
        status: effectiveStatus,
        updated_at: new Date().toISOString(),
        ...additionalUpdates,
      };

      // Set pending_with — prefer the routing-derived value, fallback to status-based
      if (effectivePendingWith !== null) {
        updates.pending_with = effectivePendingWith;
      } else {
        const statusToPendingWith: Record<MRBStatus, AppRole | null> = {
          draft: null,
          quality_review: 'quality',
          purchase_review: 'purchase',
          engineering_review: 'engineering',
          final_approval: 'executive',
          approved: null,
          rejected: null,
          closed: null,
        };
        if (statusToPendingWith[effectiveStatus] !== undefined) {
          updates.pending_with = statusToPendingWith[effectiveStatus];
        }
      }

      // Set approval timestamps based on the CURRENT role (who is taking action)
      if (userRole?.includes('quality')) {
        updates.quality_approved_at = new Date().toISOString();
        updates.quality_approved_by = user?.id;
      } else if (userRole?.includes('purchase')) {
        updates.purchase_approved_at = new Date().toISOString();
        updates.purchase_approved_by = user?.id;
      } else if (userRole?.includes('engineering')) {
        updates.engineering_approved_at = new Date().toISOString();
        updates.engineering_approved_by = user?.id;
      } else if (userRole === 'executive' || userRole === 'admin') {
        updates.final_approved_at = new Date().toISOString();
        updates.final_approved_by = user?.id;
        if (effectiveStatus === 'approved' || effectiveStatus === 'rejected') {
          updates.final_decision = effectiveStatus === 'approved' ? 'approved' : 'rejected';
        }
      }

      // If approved, set closure fields
      if (effectiveStatus === 'approved') {
        updates.closure_status = 'completed';
        updates.closed_at = new Date().toISOString();
        updates.closed_by = user?.id;
        updates.final_approved_at = updates.final_approved_at || new Date().toISOString();
        updates.final_approved_by = updates.final_approved_by || user?.id;
        updates.final_decision = 'approved';
      }

      const { error } = await supabase
        .from('mrb_records')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Add to approval history - use CURRENT stage (where action was taken), not new status
      await supabase.from('mrb_approval_history').insert({
        mrb_id: id,
        stage: getStageFromStatus(currentStage as MRBStatus),
        action: action,
        performed_by: user?.id || '',
        performed_by_role: userRole || 'quality',
        remarks: remarks,
      });

      await fetchMRBRecords();
      return true;
    } catch (error) {
      console.error('Error updating MRB status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update MRB status',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, userRole, fetchMRBRecords, toast]);

  // Update MRB fields without changing status
  const updateMRB = useCallback(async (id: string, updates: MRBUpdate): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('mrb_records')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchMRBRecords();
      return true;
    } catch (error) {
      console.error('Error updating MRB:', error);
      toast({
        title: 'Error',
        description: 'Failed to update MRB',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchMRBRecords, toast]);

  // Get approval history for an MRB with user names
  const getApprovalHistory = useCallback(async (mrbId: string) => {
    try {
      const { data, error } = await supabase
        .from('mrb_approval_history')
        .select('*')
        .eq('mrb_id', mrbId)
        .order('performed_at', { ascending: true });

      if (error) throw error;
      
      // Fetch user names for all performers
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(item => item.performed_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        const userNameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        
        return data.map(item => ({
          ...item,
          performer_name: userNameMap.get(item.performed_by) || 'Unknown User',
        }));
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching approval history:', error);
      return [];
    }
  }, []);

  // Generate next MRB number
  const getNextMRBNumber = useCallback(async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `MRB-${year}-`;
    
    try {
      const { data } = await supabase
        .from('mrb_records')
        .select('mrb_number')
        .like('mrb_number', `${prefix}%`)
        .order('mrb_number', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = parseInt(data[0].mrb_number.replace(prefix, ''), 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
      
      return `${prefix}${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating MRB number:', error);
      return `${prefix}${String(Date.now()).slice(-4)}`;
    }
  }, []);

  return {
    mrbRecords,
    isLoading,
    fetchMRBRecords,
    getMRBById,
    createMRB,
    updateMRB,
    updateMRBStatus,
    getApprovalHistory,
    getNextMRBNumber,
  };
}

function getStageFromStatus(status: MRBStatus): string {
  const stageMap: Record<MRBStatus, string> = {
    draft: 'Draft',
    quality_review: 'Quality Review',
    purchase_review: 'Purchase Review',
    engineering_review: 'Engineering Review',
    final_approval: 'Final Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
  };
  return stageMap[status] || status;
}
