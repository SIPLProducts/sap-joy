import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, Eye, Loader2, Unlock, RefreshCw, CheckSquare, Square, History, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { getStatusDisplayName, getStatusColor, getSLAColor, getEscalationColor, getRoleDisplayName } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MRBStatus = Database['public']['Enums']['mrb_status'];
type MRBSource = Database['public']['Enums']['mrb_source'];
type SLAStatus = Database['public']['Enums']['sla_status'];
type EscalationLevel = Database['public']['Enums']['escalation_level'];
type AppRole = Database['public']['Enums']['app_role'];

const statuses: MRBStatus[] = ['draft', 'quality_review', 'purchase_review', 'engineering_review', 'final_approval', 'approved', 'rejected', 'closed'];

type SourceType = 'all' | 'quality_inspection' | 'shop_floor';

interface UnifiedMRBRecord {
  id: string;
  mrbNumber: string;
  status: MRBStatus;
  materialNumber: string;
  materialDescription: string;
  vendorName: string;
  plant: string;
  pendingWith: AppRole | null;
  pendingDays: number;
  slaStatus: SLAStatus | null;
  escalationLevel: EscalationLevel | null;
  createdAt: string;
  source: MRBSource;
}

interface SAPSyncHistoryEntry {
  id: string;
  mrb_id: string;
  mrb_number: string;
  sync_type: string;
  batch_id: string | null;
  status: string;
  error_message: string | null;
  synced_by: string;
  synced_at: string;
}

export default function Worklist() {
  const navigate = useNavigate();
  const { mrbRecords, isLoading, updateMRB } = useMRBDatabase();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType>('all');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SAPSyncHistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch sync history
  const fetchSyncHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('sap_sync_history')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (error) {
      console.error('Error fetching sync history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSyncHistory();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('sap_sync_history_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sap_sync_history' },
        () => {
          fetchSyncHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Transform database records to unified format
  const unifiedRecords: UnifiedMRBRecord[] = mrbRecords.map(mrb => ({
    id: mrb.id,
    mrbNumber: mrb.mrb_number,
    status: mrb.status,
    materialNumber: mrb.material_number,
    materialDescription: mrb.material_description,
    vendorName: mrb.vendor_name || 'N/A',
    plant: mrb.plant,
    pendingWith: mrb.pending_with,
    pendingDays: mrb.pending_days || 0,
    slaStatus: mrb.sla_status,
    escalationLevel: mrb.escalation_level,
    createdAt: mrb.created_at,
    source: mrb.source,
  }));

  const filteredRecords = unifiedRecords.filter(mrb => {
    const matchesSearch = !searchTerm || 
      mrb.mrbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.materialDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || mrb.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || mrb.source === sourceFilter;
    
    return matchesSearch && matchesStatus && matchesSource;
  });

  // Sort by created date descending
  const sortedRecords = [...filteredRecords].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Get approved records for batch selection
  const approvedRecords = sortedRecords.filter(mrb => mrb.status === 'approved');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceBadge = (source: MRBSource) => {
    if (source === 'quality_inspection') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Inward</Badge>;
    }
    return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Shop Floor</Badge>;
  };

  const handleViewClick = (mrb: UnifiedMRBRecord) => {
    if (mrb.source === 'quality_inspection') {
      navigate(`/inward/mrb/${mrb.id}`);
    } else {
      navigate(`/mrb/${mrb.id}`);
    }
  };

  const logSyncHistory = async (
    mrbId: string, 
    mrbNumber: string, 
    syncType: 'single' | 'batch',
    status: 'success' | 'failed',
    batchId: string | null = null,
    errorMessage: string | null = null
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('sap_sync_history').insert({
        mrb_id: mrbId,
        mrb_number: mrbNumber,
        sync_type: syncType,
        batch_id: batchId,
        status,
        error_message: errorMessage,
        synced_by: user?.email || 'Unknown',
      });
    } catch (error) {
      console.error('Error logging sync history:', error);
    }
  };

  const handleSAPSync = async (mrbId: string, mrbNumber: string) => {
    setSyncingIds(prev => new Set(prev).add(mrbId));
    
    try {
      // Simulate SAP sync - in production this would call SAP API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update MRB with SAP sync status
      await updateMRB(mrbId, {
        sap_stock_update_status: 'synced',
        closure_status: 'completed',
        closed_at: new Date().toISOString(),
      });

      // Log sync history
      await logSyncHistory(mrbId, mrbNumber, 'single', 'success');

      toast({
        title: '✅ SAP Sync Completed',
        description: (
          <div className="mt-1">
            <p><strong>{mrbNumber}</strong> has been synced with SAP.</p>
            <p className="text-xs text-muted-foreground mt-1">Stock has been unblocked and updated in SAP.</p>
          </div>
        ),
        duration: 5000,
      });
    } catch (error) {
      console.error('SAP sync error:', error);
      await logSyncHistory(mrbId, mrbNumber, 'single', 'failed', null, 'Sync failed');
      toast({
        title: 'SAP Sync Failed',
        description: 'Failed to sync with SAP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSyncingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(mrbId);
        return newSet;
      });
    }
  };

  const handleBatchSync = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'No MRBs Selected',
        description: 'Please select at least one approved MRB to sync.',
        variant: 'destructive',
      });
      return;
    }

    setIsBatchSyncing(true);
    const batchId = crypto.randomUUID();
    const selectedMRBs = approvedRecords.filter(mrb => selectedIds.has(mrb.id));
    let successCount = 0;
    let failCount = 0;

    for (const mrb of selectedMRBs) {
      setSyncingIds(prev => new Set(prev).add(mrb.id));
      
      try {
        // Simulate SAP sync for each MRB
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await updateMRB(mrb.id, {
          sap_stock_update_status: 'synced',
          closure_status: 'completed',
          closed_at: new Date().toISOString(),
        });

        await logSyncHistory(mrb.id, mrb.mrbNumber, 'batch', 'success', batchId);
        successCount++;
      } catch (error) {
        console.error(`SAP sync error for ${mrb.mrbNumber}:`, error);
        await logSyncHistory(mrb.id, mrb.mrbNumber, 'batch', 'failed', batchId, 'Batch sync failed');
        failCount++;
      } finally {
        setSyncingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(mrb.id);
          return newSet;
        });
      }
    }

    setIsBatchSyncing(false);
    setSelectedIds(new Set());

    toast({
      title: '🔄 Batch SAP Sync Complete',
      description: (
        <div className="mt-1">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span><strong>{successCount}</strong> synced successfully</span>
          </p>
          {failCount > 0 && (
            <p className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span><strong>{failCount}</strong> failed</span>
            </p>
          )}
        </div>
      ),
      duration: 6000,
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === approvedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvedRecords.map(mrb => mrb.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getSyncStatusBadge = (status: string) => {
    if (status === 'success') {
      return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
    }
    if (status === 'failed') {
      return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading MRB records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Sticky Header with Title and Filters */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">MRB Worklist</h1>
              <p className="text-muted-foreground">View and manage all Material Review Board records</p>
            </div>
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <History className="h-4 w-4" />
                  SAP Sync History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    SAP Sync History Log
                  </DialogTitle>
                  <DialogDescription>
                    View all SAP synchronization operations with timestamps and status
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[500px] mt-4">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : syncHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No sync history available
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {syncHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className={`p-4 rounded-lg border ${
                            entry.status === 'success' 
                              ? 'bg-green-50/50 border-green-200' 
                              : entry.status === 'failed'
                              ? 'bg-red-50/50 border-red-200'
                              : 'bg-muted/50 border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-primary">{entry.mrb_number}</span>
                                {getSyncStatusBadge(entry.status)}
                                <Badge variant="outline" className="text-xs">
                                  {entry.sync_type === 'batch' ? 'Batch' : 'Single'}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDateTime(entry.synced_at)}
                                </p>
                                <p className="text-xs mt-1">By: {entry.synced_by}</p>
                                {entry.error_message && (
                                  <p className="text-xs text-red-600 mt-1">Error: {entry.error_message}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Filters Section */}
        <div className="px-6 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-foreground">
                All MRB Records ({sortedRecords.length})
              </div>
              {approvedRecords.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={toggleSelectAll}
                    className="gap-2"
                  >
                    {selectedIds.size === approvedRecords.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Select All Approved ({approvedRecords.length})
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleBatchSync}
                      disabled={isBatchSyncing}
                      className="bg-green-600 hover:bg-green-700 gap-2"
                    >
                      {isBatchSyncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Syncing {selectedIds.size}...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Batch SAP Sync ({selectedIds.size})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search MRB, material, vendor..."
                  className="pl-9 w-full sm:w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={sourceFilter} onValueChange={(val) => setSourceFilter(val as SourceType)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="quality_inspection">Inward</SelectItem>
                  <SelectItem value="shop_floor">Shop Floor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusDisplayName(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="h-full rounded-md border bg-background overflow-hidden flex flex-col">
          {/* Table with sticky header */}
          <div className="flex-1 overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                <tr>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap w-10">
                    {/* Checkbox header for approved items */}
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">MRB Number</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Source</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Material</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Vendor</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Plant</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Pending With</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">SLA</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Created</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Escalation</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {sortedRecords.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={12} className="p-4 text-center py-12 text-muted-foreground">
                      No MRB records found matching your criteria
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((mrb) => (
                    <tr 
                      key={mrb.id} 
                      className={`border-b transition-colors hover:bg-muted/50 ${mrb.escalationLevel && mrb.escalationLevel !== 'none' ? 'bg-red-50/50' : ''} ${selectedIds.has(mrb.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="p-4 align-middle">
                        {mrb.status === 'approved' && (
                          <Checkbox
                            checked={selectedIds.has(mrb.id)}
                            onCheckedChange={() => toggleSelect(mrb.id)}
                            disabled={syncingIds.has(mrb.id)}
                          />
                        )}
                      </td>
                      <td className="p-4 align-middle font-medium text-primary whitespace-nowrap">
                        {mrb.mrbNumber}
                      </td>
                      <td className="p-4 align-middle">
                        {getSourceBadge(mrb.source)}
                      </td>
                      <td className="p-4 align-middle">
                        <Badge className={getStatusColor(mrb.status)}>
                          {getStatusDisplayName(mrb.status)}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle">
                        <div>
                          <p className="font-medium">{mrb.materialNumber}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{mrb.materialDescription}</p>
                        </div>
                      </td>
                      <td className="p-4 align-middle max-w-[120px] truncate">{mrb.vendorName}</td>
                      <td className="p-4 align-middle whitespace-nowrap">{mrb.plant}</td>
                      <td className="p-4 align-middle whitespace-nowrap">
                        {mrb.pendingWith ? getRoleDisplayName(mrb.pendingWith as any) : '-'}
                      </td>
                      <td className="p-4 align-middle">
                        {mrb.slaStatus ? (
                          <Badge className={getSLAColor(mrb.slaStatus as any)}>
                            {mrb.pendingDays} days
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4 align-middle whitespace-nowrap">
                        {formatDate(mrb.createdAt)}
                      </td>
                      <td className="p-4 align-middle">
                        {mrb.escalationLevel && mrb.escalationLevel !== 'none' && (
                          <Badge className={`${getEscalationColor(mrb.escalationLevel as any)} animate-pulse-slow`}>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {mrb.escalationLevel}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewClick(mrb)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {mrb.status === 'approved' && (
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleSAPSync(mrb.id, mrb.mrbNumber)}
                              disabled={syncingIds.has(mrb.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {syncingIds.has(mrb.id) ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                  Syncing...
                                </>
                              ) : (
                                <>
                                  <Unlock className="h-4 w-4 mr-1" />
                                  Unblock & SAP Sync
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}