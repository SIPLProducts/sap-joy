import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, Eye, Loader2, Unlock, RefreshCw, CheckSquare, Square, History, Clock, CheckCircle2, XCircle, Download, CalendarDays, ScanEye } from 'lucide-react';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useDepartments } from '@/hooks/useDepartments';
import { useDepartmentMap } from '@/hooks/useDepartmentMap';
import { ResultRecordingModal } from '@/components/mrb/ResultRecordingModal';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { getStatusDisplayName, getStatusColor, getSLAColor, getEscalationColor, getRoleDisplayName } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeSapSync } from '@/lib/sapSyncClient';
import { useAuth } from '@/contexts/AuthContext';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import { getWorkflowReviewLabel } from '@/lib/mrbWorkflowDisplay';
import type { Database } from '@/integrations/supabase/types';
import * as XLSX from 'xlsx';

const MASTER_ADMIN_EMAIL = 'masteradmin@sharviinfotech.com';

type MRBStatus = Database['public']['Enums']['mrb_status'];
type MRBSource = Database['public']['Enums']['mrb_source'];
type SLAStatus = Database['public']['Enums']['sla_status'];
type EscalationLevel = Database['public']['Enums']['escalation_level'];
type AppRole = string;

const statuses: MRBStatus[] = ['quality_review', 'purchase_review', 'engineering_review', 'final_approval', 'approved', 'rejected', 'closed'];

type SourceType = 'all' | 'quality_inspection' | 'shop_floor' | 'inprocess';

interface UnifiedMRBRecord {
  id: string;
  mrbNumber: string;
  status: MRBStatus;
  materialNumber: string;
  materialDescription: string;
  vendorName: string;
  vendorCode: string | null;
  plant: string;
  pendingWith: AppRole | null;
  pendingDays: number;
  slaStatus: SLAStatus | null;
  escalationLevel: EscalationLevel | null;
  createdAt: string;
  source: MRBSource;
  // Additional fields from Inward Material
  inspectionLot: string | null;
  grnNumber: string | null;
  poNumber: string | null;
  blockedQuantity: number | null;
  totalQuantity: number;
  uom: string | null;
  defectDescription: string | null;
  // Department Review fields
  qualityDecision: string | null;
  qualityRemarks: string | null;
  qualityApprovedAt: string | null;
  qualityApprovedBy: string | null;
  purchaseAction: string | null;
  purchaseRemarks: string | null;
  purchaseApprovedAt: string | null;
  purchaseApprovedBy: string | null;
  engineeringDecision: string | null;
  engineeringRemarks: string | null;
  engineeringApprovedAt: string | null;
  engineeringApprovedBy: string | null;
  finalDecision: string | null;
  finalRemarks: string | null;
  finalApprovedAt: string | null;
  finalApprovedBy: string | null;
  closureStatus: string | null;
  sapStockUpdateStatus: string | null;
  // SAP unblock fields
  storageLocation: string | null;
  batch: string | null;
  // ZMRB04 InProcess fields
  inspectionDate: string | null;
  postingDate: string | null;
  blockReason: string | null;
  productionOrderNo: string | null;
  workCenter: string | null;
  orderType: string | null;
  transactionQuantity: number | null;
  // ZMRB04 customer / sales fields (in-process only)
  customerCode: string | null;
  customerName: string | null;
  salesOrder: string | null;
  salesItem: string | null;
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
  const { userRole, user, profile } = useAuth();
  const { departments } = useDepartments();
  const { roleDisplayNames } = useDepartmentMap();
  const { plantOptions: visiblePlantOptions } = useVisiblePlants();
  const workflowRoles = useMemo(() =>
    departments
      .filter(d => d.is_active && d.is_workflow_enabled && d.role_key)
      .map(d => ({ role_key: d.role_key!, name: d.name })),
    [departments]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType>('all');
  const [pendingWithFilter, setPendingWithFilter] = useState<string>('all');
  const [plantFilter, setPlantFilter] = useState<string>('all');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SAPSyncHistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ZMRB04 InProcess field cache, keyed by inspection_lot
  const [inprocessLotMap, setInprocessLotMap] = useState<Record<string, any>>({});
  
  // Posting date popup state for SAP 343/344
  const [showPostingDateDialog, setShowPostingDateDialog] = useState(false);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingSAPSyncId, setPendingSAPSyncId] = useState<string | null>(null);
  const [pendingSAPSyncNumber, setPendingSAPSyncNumber] = useState<string>('');

  // Active plant comes from the header switcher (profile.plant), validated
  // against the user's visible/assigned plants.
  const activePlant = useMemo(() => {
    const headerPlant = profile?.plant;
    if (visiblePlantOptions.length === 0) return headerPlant || '';
    if (headerPlant && visiblePlantOptions.some(p => p.code === headerPlant)) {
      return headerPlant;
    }
    return visiblePlantOptions[0].code;
  }, [profile?.plant, visiblePlantOptions]);

  // Whenever the header active plant changes, sync the in-page Plant filter
  // and clear stale row selections from the previous plant scope.
  useEffect(() => {
    if (!activePlant) return;
    setPlantFilter(activePlant);
    setSelectedIds(new Set());
  }, [activePlant]);

  // RBAC: SAP unblock access is limited to Master Admin, Admin, and Quality.
  const isMasterAdmin = profile?.email === MASTER_ADMIN_EMAIL || user?.email === MASTER_ADMIN_EMAIL;
  const canUnblockSAP = isMasterAdmin || userRole === 'admin' || userRole === 'quality';

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

  // Hydrate ZMRB04 fallback data for any InProcess MRB rows
  useEffect(() => {
    const inprocessLots = mrbRecords
      .filter(m => (m.source as any) === 'inprocess' && m.inspection_lot)
      .map(m => m.inspection_lot as string);
    const missing = inprocessLots.filter(lot => !inprocessLotMap[lot]);
    if (missing.length === 0) return;

    (async () => {
      const { data } = await supabase
        .from('zmrb_inward_report')
        .select('inspection_lot, storage_location, batch, inspection_date, posting_date, block_reason, production_order_no, work_center, order_type, transaction_quantity, customer_code, customer_name, sales_order, sales_item')
        .in('inspection_lot', missing);
      if (data && data.length > 0) {
        setInprocessLotMap(prev => {
          const next = { ...prev };
          data.forEach((row: any) => {
            if (row.inspection_lot) next[row.inspection_lot] = row;
          });
          return next;
        });
      }
    })();
  }, [mrbRecords, inprocessLotMap]);

  // Transform database records to unified format
  const unifiedRecords: UnifiedMRBRecord[] = mrbRecords.map(mrb => {
    const lot = mrb.inspection_lot ? inprocessLotMap[mrb.inspection_lot] : null;
    return ({
    id: mrb.id,
    mrbNumber: mrb.mrb_number,
    status: mrb.status,
    materialNumber: mrb.material_number,
    materialDescription: mrb.material_description,
    vendorName: mrb.vendor_name || 'N/A',
    vendorCode: mrb.vendor_code,
    plant: mrb.plant,
    pendingWith: mrb.pending_with,
    pendingDays: mrb.pending_days || 0,
    slaStatus: mrb.sla_status,
    escalationLevel: mrb.escalation_level,
    createdAt: mrb.created_at,
    source: mrb.source,
    // Additional fields from Inward Material
    inspectionLot: mrb.inspection_lot,
    grnNumber: mrb.grn_number,
    poNumber: mrb.po_number,
    blockedQuantity: mrb.blocked_quantity,
    totalQuantity: mrb.total_quantity,
    uom: mrb.uom,
    defectDescription: mrb.defect_description,
    // Department Review fields
    qualityDecision: mrb.quality_decision,
    qualityRemarks: mrb.quality_remarks,
    qualityApprovedAt: mrb.quality_approved_at,
    qualityApprovedBy: mrb.quality_approved_by,
    purchaseAction: mrb.purchase_action,
    purchaseRemarks: mrb.purchase_remarks,
    purchaseApprovedAt: mrb.purchase_approved_at,
    purchaseApprovedBy: mrb.purchase_approved_by,
    engineeringDecision: mrb.engineering_decision,
    engineeringRemarks: mrb.engineering_remarks,
    engineeringApprovedAt: mrb.engineering_approved_at,
    engineeringApprovedBy: mrb.engineering_approved_by,
    finalDecision: mrb.final_decision,
    finalRemarks: mrb.final_remarks,
    finalApprovedAt: mrb.final_approved_at,
    finalApprovedBy: mrb.final_approved_by,
    closureStatus: mrb.closure_status,
    sapStockUpdateStatus: mrb.sap_stock_update_status,
    storageLocation: (mrb as any).storage_location || lot?.storage_location || null,
    batch: (mrb as any).batch || lot?.batch || null,
    inspectionDate: lot?.inspection_date || null,
    postingDate: lot?.posting_date || null,
    blockReason: mrb.defect_description || lot?.block_reason || null,
    productionOrderNo: (mrb as any).production_order_number || lot?.production_order_no || null,
    workCenter: lot?.work_center || null,
    orderType: lot?.order_type || null,
    transactionQuantity: lot?.transaction_quantity != null ? Number(lot.transaction_quantity) : null,
    customerCode: lot?.customer_code || null,
    customerName: lot?.customer_name || null,
    salesOrder: lot?.sales_order || null,
    salesItem: lot?.sales_item || null,
    });
  });

  const filteredRecords = unifiedRecords.filter(mrb => {
    const matchesSearch = !searchTerm || 
      mrb.mrbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.materialDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || mrb.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || mrb.source === sourceFilter;
    const matchesPendingWith = pendingWithFilter === 'all' || mrb.pendingWith === pendingWithFilter;
    const matchesPlant = plantFilter === 'all' || mrb.plant === plantFilter;

    return matchesSearch && matchesStatus && matchesSource && matchesPendingWith && matchesPlant;
  });

  // Sort by created date descending
  const sortedRecords = [...filteredRecords].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Get approved, unsynced records for SAP unblock batch selection
  const approvedRecords = sortedRecords.filter(mrb => mrb.status === 'approved' && mrb.sapStockUpdateStatus !== 'synced');

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
    if ((source as string) === 'inprocess') {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">InProcess</Badge>;
    }
    return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Shop Floor</Badge>;
  };

  const getDeptReviewBadge = (decision: string | null, approvedAt: string | null, remarks: string | null) => {
    const badge = (() => {
      if (!decision && !approvedAt) {
        return <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-300 text-xs cursor-help">Pending</Badge>;
      }
      if (decision) {
        const isPositive = decision.includes('accept') || decision.includes('use_as_is') || decision === 'approved';
        return (
          <Badge 
            variant="outline" 
            className={`text-xs cursor-help ${isPositive ? 'bg-green-50 text-green-700 border-green-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}
          >
            {decision.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Badge>
        );
      }
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-300 text-xs cursor-help">Reviewed</Badge>;
    })();

    if (remarks) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-[300px]">
            <p className="text-sm font-medium mb-1">Remarks:</p>
            <p className="text-xs">{remarks}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return badge;
  };

  const getClosureStatusBadge = (closureStatus: string | null, sapSyncStatus: string | null, mrbStatus: MRBStatus) => {
    // "Completed" only when SAP synced; otherwise show "Pending SAP Sync" for approved MRBs.
    const isSynced = sapSyncStatus === 'synced' || sapSyncStatus === 'success';
    if (mrbStatus === 'approved') {
      if (isSynced) {
        return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Completed</Badge>;
      }
      return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">Pending SAP Sync</Badge>;
    }
    if (mrbStatus === 'closed' || closureStatus === 'closed') {
      return <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700 border-gray-300">Closed</Badge>;
    }
    if (mrbStatus === 'rejected') {
      return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">Rejected</Badge>;
    }
    if (!closureStatus || closureStatus === 'open') {
      return <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-300">Open</Badge>;
    }
    return (
      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-300">
        {closureStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
      </Badge>
    );
  };

  // Excel Export function
  const handleExportToExcel = () => {
    const exportData = sortedRecords.map(mrb => {
      const isInprocess = (mrb.source as string) === 'inprocess';
      return ({
      'MRB Number': mrb.mrbNumber,
      'Source': mrb.source === 'quality_inspection'
        ? 'Inward'
        : (mrb.source as string) === 'inprocess'
          ? 'Inward InProcess'
          : 'Shop Floor',
      'Status': getWorkflowReviewLabel(mrb.status, mrb.pendingWith, roleDisplayNames),
      'Inspection Lot': mrb.inspectionLot || '-',
      'Material Number': mrb.materialNumber,
      'Material Description': mrb.materialDescription,
      'Vendor Name': isInprocess ? '-' : mrb.vendorName,
      'Vendor Code': isInprocess ? '-' : (mrb.vendorCode || '-'),
      'Customer Code': isInprocess ? (mrb.customerCode || '-') : '-',
      'Customer Name': isInprocess ? (mrb.customerName || '-') : '-',
      'Sales Order': isInprocess ? (mrb.salesOrder || '-') : '-',
      'Sales Item': isInprocess ? (mrb.salesItem || '-') : '-',
      'Plant': mrb.plant,
      'GRN Number': mrb.grnNumber || '-',
      'PO Number': mrb.poNumber || '-',
      'Blocked Quantity': mrb.blockedQuantity || 0,
      'Total Quantity': mrb.totalQuantity,
      'UoM': mrb.uom || '-',
      'Defect Description': mrb.defectDescription || '-',
      // Quality Review
      'Quality Decision': mrb.qualityDecision?.replace(/_/g, ' ') || 'Pending',
      'Quality Remarks': mrb.qualityRemarks || '-',
      'Quality Approved At': mrb.qualityApprovedAt ? formatDate(mrb.qualityApprovedAt) : '-',
      'Quality Approved By': mrb.qualityApprovedBy || '-',
      // Purchase Review
      'Purchase Action': mrb.purchaseAction?.replace(/_/g, ' ') || 'Pending',
      'Purchase Remarks': mrb.purchaseRemarks || '-',
      'Purchase Approved At': mrb.purchaseApprovedAt ? formatDate(mrb.purchaseApprovedAt) : '-',
      'Purchase Approved By': mrb.purchaseApprovedBy || '-',
      // Engineering Review
      'Engineering Decision': mrb.engineeringDecision?.replace(/_/g, ' ') || 'Pending',
      'Engineering Remarks': mrb.engineeringRemarks || '-',
      'Engineering Approved At': mrb.engineeringApprovedAt ? formatDate(mrb.engineeringApprovedAt) : '-',
      'Engineering Approved By': mrb.engineeringApprovedBy || '-',
      // Final Approval
      'Final Decision': mrb.finalDecision?.replace(/_/g, ' ') || 'Pending',
      'Final Remarks': mrb.finalRemarks || '-',
      'Final Approved At': mrb.finalApprovedAt ? formatDate(mrb.finalApprovedAt) : '-',
      'Final Approved By': mrb.finalApprovedBy || '-',
      // Status
      'Pending With': mrb.pendingWith ? getRoleDisplayName(mrb.pendingWith as any) : '-',
      'Pending Days': mrb.pendingDays,
      'SLA Status': mrb.slaStatus || '-',
      'Escalation Level': mrb.escalationLevel || '-',
      'Closure Status': mrb.closureStatus?.replace(/_/g, ' ') || '-',
      'SAP Sync Status': mrb.sapStockUpdateStatus?.replace(/_/g, ' ') || '-',
      'Created At': formatDate(mrb.createdAt),
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MRB Worklist');

    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    worksheet['!cols'] = colWidths;

    const fileName = `MRB_Worklist_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: '✅ Export Successful',
      description: `Exported ${exportData.length} records to ${fileName}`,
    });
  };

  const handleViewClick = (mrb: UnifiedMRBRecord) => {
    if (mrb.source === 'quality_inspection' || (mrb.source as string) === 'inprocess') {
      navigate(`/inward/mrb/${mrb.id}`);
    } else if (mrb.source === 'shop_floor') {
      navigate(`/shop-floor/mrb/${mrb.id}`);
    } else {
      navigate(`/mrb/${mrb.id}`);
    }
  };

  // Result Recording modal state — opened from the inline action button on each row
  const [resultRecordingLot, setResultRecordingLot] = useState<string | null>(null);
  const openResultRecording = (mrb: UnifiedMRBRecord) => {
    if (!mrb.inspectionLot) return;
    setResultRecordingLot(mrb.inspectionLot);
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

  // Dynamically resolve SAP 343 and MB52 config IDs from the database
  const [sap343ConfigId, setSap343ConfigId] = useState<string | null>(null);
  const [sapMb52ConfigId, setSapMb52ConfigId] = useState<string | null>(null);

  useEffect(() => {
    const loadSapConfigIds = async () => {
      const { data: configs } = await supabase
        .from('sap_api_config')
        .select('id, config_name, api_endpoint')
        .eq('is_active', true);
      if (configs) {
        for (const c of configs) {
          const name = (c.config_name || '').toLowerCase();
          const endpoint = (c.api_endpoint || '').toLowerCase();
          if (name.includes('343') || endpoint.includes('343')) {
            setSap343ConfigId(c.id);
          }
          if (name.includes('mb52') || endpoint.includes('mb52')) {
            setSapMb52ConfigId(c.id);
          }
        }
      }
    };
    loadSapConfigIds();
  }, []);

  // Build SAP 343 request body from MRB data
  const buildUnblockRequestBody = async (mrb: UnifiedMRBRecord) => {
    // Prefer storage_location and batch directly from mrb_records (new columns)
    let storageLocation = mrb.storageLocation || '';
    let batch = mrb.batch || '';

    // Fallback: try inward_inspection_lots if inspection_lot is available
    if ((!storageLocation || !batch) && mrb.inspectionLot) {
      const { data: lot } = await supabase
        .from('inward_inspection_lots')
        .select('storage_location, batch')
        .eq('inspection_lot', mrb.inspectionLot)
        .limit(1)
        .maybeSingle();

      if (lot) {
        storageLocation = storageLocation || lot.storage_location || '';
        batch = batch || lot.batch || '';
      }
    }

    // Fallback: try shop_floor_stock
    if (!storageLocation || !batch) {
      const { data: stock } = await supabase
        .from('shop_floor_stock')
        .select('storage_location, batch')
        .eq('material_code', mrb.materialNumber)
        .eq('plant', mrb.plant)
        .limit(1)
        .maybeSingle();

      if (stock) {
        storageLocation = storageLocation || stock.storage_location || '';
        batch = batch || stock.batch || '';
      }
    }

    return {
      MATNR: String(mrb.materialNumber),
      WERKS: String(mrb.plant).replace('Plant-', '') || '1300',
      LGORT: String(storageLocation || 'S061'),
      CHARG: String(batch || ''),
      ENTRY_QNT: String(mrb.blockedQuantity || mrb.totalQuantity || 0),
      ENTRY_UOM: String(mrb.uom || 'EA'),
    };
  };

  // Format posting date from YYYY-MM-DD to YYYYMMDD for SAP
  const formatPostingDateForSAP = (dateStr: string): string => {
    const d = new Date(dateStr);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  };

  // Show posting date dialog instead of directly syncing
  const handleRequestSAPSync = (mrbId: string, mrbNumber: string) => {
    setPendingSAPSyncId(mrbId);
    setPendingSAPSyncNumber(mrbNumber);
    setPostingDate(new Date().toISOString().split('T')[0]);
    setShowPostingDateDialog(true);
  };

  const handleConfirmSAPSync = async () => {
    if (!pendingSAPSyncId || !postingDate) return;
    setShowPostingDateDialog(false);
    await handleSAPSync(pendingSAPSyncId, pendingSAPSyncNumber, postingDate);
  };

  const isSapUnblockConfirmed = (result: any) => result?.success === true;

  const getSapSyncError = (response: any, result: any) => {
    if (response?.error) {
      return typeof response.error === 'object' ? response.error.message || JSON.stringify(response.error) : String(response.error);
    }
    if (result?.already_unblocked && !result?.verified_unblocked) {
      return result?.error || `SAP did not confirm unblock. MB52 verification did not prove the stock is unblocked, so the MRB was not marked as synced. SAP Message: ${result?.message || 'No SAP message returned'}`;
    }
    return result?.error || result?.message || 'SAP API returned an error';
  };

  const handleSAPSync = async (mrbId: string, mrbNumber: string, sapPostingDate?: string) => {
    setSyncingIds(prev => new Set(prev).add(mrbId));
    
    try {
      // Find the MRB record to get material details
      const mrb = unifiedRecords.find(r => r.id === mrbId);
      if (!mrb) throw new Error('MRB record not found');

      // Build request body from MRB data
      const requestBody = await buildUnblockRequestBody(mrb);
      // Add BUDAT (posting date) in YYYYMMDD format
      if (sapPostingDate) {
        (requestBody as any).BUDAT = formatPostingDateForSAP(sapPostingDate);
      }
      console.log('SAP 343 Unblock Request:', requestBody);

      // Call SAP 343 and then verify with live MB52 stock fetch
      if (!sap343ConfigId) throw new Error('SAP 343 configuration not found. Please configure it in SAP API Settings.');

      const response = await invokeSapSync({
        action: 'unblock',
        config_id: sap343ConfigId,
        verify_config_id: sapMb52ConfigId || undefined,
        request_body: requestBody,
      });

      const result = response.data;
      console.log('SAP 343 Unblock Response:', result);

      if (!isSapUnblockConfirmed(result)) {
        throw new Error(getSapSyncError(response, result));
      }

      // Update MRB with SAP sync status
      const dbUpdated = await updateMRB(mrbId, {
        sap_stock_update_status: 'synced',
        closure_status: 'completed',
        closed_at: new Date().toISOString(),
        closed_by: user?.id,
      });

      if (!dbUpdated) {
        throw new Error('SAP unblock confirmed, but application status update failed. Please refresh and try again.');
      }

      // Log sync history with SAP response
      await logSyncHistory(mrbId, mrbNumber, 'single', 'success');

      // Show full live SAP response + live MB52 verification in toast
      const sapResponse = result.sap_response;
      const sapCode = result.code;
      const sapMsg = result.message;
      const sapMBLNR = result.material_document;
      const sapMJAHR = result.material_document_year;
      const verification = result.verification;
      const liveRecord = verification?.success && verification?.records?.length ? verification.records[0] : null;

      const successTitle = result?.code === '100' || result?.code === 100
        ? '✅ SAP unblock completed successfully'
        : '✅ SAP already appears unblocked';
      const successSummary = result?.code === '100' || result?.code === 100
        ? `Material Document: ${sapMBLNR || '—'}`
        : 'Confirmed by valid MB52 verification.';

      toast({
        title: successTitle,
        description: (
          <div className="mt-1 space-y-1 max-w-sm">
            <p className="font-semibold text-sm">{mrbNumber}</p>
            <p className="text-xs text-muted-foreground">{successSummary}</p>
            <div className="bg-muted/50 rounded p-2 text-xs space-y-0.5 border">
              <p><span className="font-medium">SAP 343 Request</span></p>
              <p className="text-muted-foreground pl-2">MATNR: {requestBody.MATNR}</p>
              <p className="text-muted-foreground pl-2">WERKS: {requestBody.WERKS} | LGORT: {requestBody.LGORT}</p>
              <p className="text-muted-foreground pl-2">CHARG: {requestBody.CHARG || '—'}</p>
              <p className="text-muted-foreground pl-2">QTY: {requestBody.ENTRY_QNT} {requestBody.ENTRY_UOM}</p>
            </div>
            <div className="bg-muted/50 rounded p-2 text-xs space-y-0.5 border">
              <p><span className="font-medium">SAP 343 Live Response</span></p>
              {sapCode !== undefined && sapCode !== null && sapCode !== '' ? (
                <>
                  <p className="text-muted-foreground pl-2">CODE: {sapCode}</p>
                  <p className="text-muted-foreground pl-2">MSG: {sapMsg || '—'}</p>
                  <p className="text-muted-foreground pl-2">MBLNR: {sapMBLNR || '—'}</p>
                  <p className="text-muted-foreground pl-2">MJAHR: {sapMJAHR || '—'}</p>
                </>
              ) : sapResponse && typeof sapResponse === 'object' && Object.keys(sapResponse).length > 0 ? (
                Object.entries(sapResponse)
                  .filter(([, val]) => val !== null && val !== undefined && val !== '')
                  .map(([key, val]) => (
                    <p key={key} className="text-muted-foreground pl-2">
                      {key.replace(/_/g, ' ')}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </p>
                  ))
              ) : (
                <p className="text-muted-foreground pl-2 italic">No payload was returned by the live 343 endpoint</p>
              )}
            </div>
            <div className="bg-muted/50 rounded p-2 text-xs space-y-0.5 border">
              <p><span className="font-medium">Live MB52 Verification</span></p>
              {verification?.success && liveRecord ? (
                <>
                  <p className="text-muted-foreground pl-2">Records found: {verification.count}</p>
                  <p className="text-muted-foreground pl-2">Material: {liveRecord.MATNR || liveRecord.material_code || '—'}</p>
                  <p className="text-muted-foreground pl-2">Batch: {liveRecord.CHARG || liveRecord.batch || '—'}</p>
                  <p className="text-muted-foreground pl-2">Plant: {liveRecord.WERKS || liveRecord.plant || '—'} | SLoc: {liveRecord.LGORT || liveRecord.storage_location || '—'}</p>
                  <p className="text-muted-foreground pl-2">Blocked Qty: {liveRecord.SPEME || liveRecord.blocked_quantity || '0'}</p>
                  <p className="text-muted-foreground pl-2">Available Qty: {liveRecord.LABST || liveRecord.available_quantity || '0'}</p>
                </>
              ) : (
                <p className="text-muted-foreground pl-2">{verification?.error || 'No live MB52 data returned'}</p>
              )}
            </div>
          </div>
        ),
        duration: 12000,
      });
    } catch (error: any) {
      console.error('SAP unblock error:', error);
      await logSyncHistory(mrbId, mrbNumber, 'single', 'failed', null, error?.message || 'Unblock failed');
      toast({
        title: 'SAP Unblock Failed',
        description: error?.message || 'Failed to unblock stock in SAP. Please try again.',
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
        // Build request body from MRB data for SAP 343 unblock
        const requestBody = await buildUnblockRequestBody(mrb);
        // Add BUDAT for batch sync using current date
        (requestBody as any).BUDAT = formatPostingDateForSAP(new Date().toISOString().split('T')[0]);

        if (!sap343ConfigId) throw new Error('SAP 343 configuration not found.');

        const response = await invokeSapSync({
          action: 'unblock',
          config_id: sap343ConfigId,
          verify_config_id: sapMb52ConfigId || undefined,
          request_body: requestBody,
        });

        const result = response.data;
        if (!isSapUnblockConfirmed(result)) {
          throw new Error(getSapSyncError(response, result));
        }
        
        const dbUpdated = await updateMRB(mrb.id, {
          sap_stock_update_status: 'synced',
          closure_status: 'completed',
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
        });

        if (!dbUpdated) {
          throw new Error('SAP unblock confirmed, but application status update failed.');
        }

        await logSyncHistory(mrb.id, mrb.mrbNumber, 'batch', 'success', batchId);
        successCount++;
      } catch (error: any) {
        console.error(`SAP sync error for ${mrb.mrbNumber}:`, error);
        await logSyncHistory(mrb.id, mrb.mrbNumber, 'batch', 'failed', batchId, error?.message || 'Batch sync failed');
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
    <TooltipProvider>
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Sticky Header with Title and Filters */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">MRB Worklist</h1>
              <p className="text-muted-foreground">View and manage all Material Review Board records</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportToExcel}
                disabled={sortedRecords.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
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
        </div>
        
        {/* Filters Section */}
        <div className="px-6 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-foreground">
                All MRB Records ({sortedRecords.length})
              </div>
              {canUnblockSAP && approvedRecords.length > 0 && (
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
                  <SelectItem value="inprocess">Inward InProcess</SelectItem>
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
              <Select value={pendingWithFilter} onValueChange={setPendingWithFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {workflowRoles.map(role => (
                    <SelectItem key={role.role_key} value={role.role_key}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={plantFilter} onValueChange={setPlantFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Plant" />
                </SelectTrigger>
                <SelectContent>
                  {visiblePlantOptions.length > 1 && (
                    <SelectItem value="all">All Plants</SelectItem>
                  )}
                  {visiblePlantOptions.map(p => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
        <div className="max-h-full rounded-md border bg-background overflow-hidden flex flex-col">
          {/* Table with sticky header */}
          <div className="overflow-auto">
            {sourceFilter === 'inprocess' ? (
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                <tr>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/80 z-10">Action</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Inspection Lot</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Material Code</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Material Description</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Plant</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">SLoc</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Batch</th>
                  <th className="h-12 px-3 text-right align-middle font-medium text-muted-foreground whitespace-nowrap">Blocked Qty</th>
                  <th className="h-12 px-3 text-right align-middle font-medium text-muted-foreground whitespace-nowrap">Trans. Qty</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">UoM</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Inspection Date</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Posting Date</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Block Reason</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Customer Code</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Customer Name</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Sales Order</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Sales Item</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Production Order</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Work Center</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Order Type</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {sortedRecords.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={21} className="p-4 text-center py-12 text-muted-foreground">
                      No InProcess MRB records found matching your criteria
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((mrb) => (
                    <tr key={mrb.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-3 align-middle sticky left-0 bg-background border-r">
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleViewClick(mrb)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openResultRecording(mrb)}
                                disabled={!mrb.inspectionLot}
                              >
                                <ScanEye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {mrb.inspectionLot
                                ? 'Result Recording'
                                : mrb.source === 'shop_floor'
                                  ? 'Not applicable for Shop Floor MRBs'
                                  : 'Inspection Lot not yet assigned'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="p-3 align-middle">
                        <Badge className={getStatusColor(mrb.status)}>
                          {getWorkflowReviewLabel(mrb.status, mrb.pendingWith, roleDisplayNames)}
                        </Badge>
                      </td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap text-primary font-medium">{mrb.inspectionLot || '-'}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.materialNumber}</td>
                      <td className="p-3 align-middle max-w-[220px] truncate">{mrb.materialDescription}</td>
                      <td className="p-3 align-middle whitespace-nowrap">{mrb.plant}</td>
                      <td className="p-3 align-middle whitespace-nowrap">{mrb.storageLocation || '-'}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.batch || '-'}</td>
                      <td className="p-3 align-middle text-right font-medium text-destructive whitespace-nowrap">{mrb.blockedQuantity?.toLocaleString() || '-'}</td>
                      <td className="p-3 align-middle text-right whitespace-nowrap">{(mrb.transactionQuantity ?? mrb.totalQuantity)?.toLocaleString() || '-'}</td>
                      <td className="p-3 align-middle whitespace-nowrap">{mrb.uom || '-'}</td>
                      <td className="p-3 align-middle whitespace-nowrap">{mrb.inspectionDate ? formatDate(mrb.inspectionDate) : '-'}</td>
                      <td className="p-3 align-middle whitespace-nowrap">{mrb.postingDate ? formatDate(mrb.postingDate) : '-'}</td>
                      <td className="p-3 align-middle max-w-[180px]">
                        <p className="text-xs truncate" title={mrb.blockReason || ''}>{mrb.blockReason || '-'}</p>
                      </td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.customerCode || '-'}</td>
                      <td className="p-3 align-middle max-w-[160px] truncate">{mrb.customerName || '-'}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.salesOrder || '-'}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.salesItem || '-'}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.productionOrderNo || '-'}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.workCenter || '-'}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">{mrb.orderType || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            ) : (
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                <tr>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap w-10">
                    {/* Checkbox header for approved items */}
                  </th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">MRB Number</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Created</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Source</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  {/* Inward Material Columns */}
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Insp. Lot</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Material</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Vendor</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Plant</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">GRN</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">PO Number</th>
                  <th className="h-12 px-3 text-right align-middle font-medium text-muted-foreground whitespace-nowrap">Blocked Qty</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">UoM</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Defect</th>
                  {/* Department Reviews — hidden per requirement */}
                  {/* <th className="h-12 px-3 text-center align-middle font-medium text-muted-foreground whitespace-nowrap bg-blue-50/50">Quality Review</th> */}
                  {/* <th className="h-12 px-3 text-center align-middle font-medium text-muted-foreground whitespace-nowrap bg-purple-50/50">Purchase Review</th> */}
                  {/* <th className="h-12 px-3 text-center align-middle font-medium text-muted-foreground whitespace-nowrap bg-amber-50/50">Engg. Review</th> */}
                  {/* <th className="h-12 px-3 text-center align-middle font-medium text-muted-foreground whitespace-nowrap bg-green-50/50">Final Approval</th> */}
                  {/* Status Columns */}
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Pending With</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">SLA</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Escalation</th>
                  <th className="h-12 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Closure</th>
                  <th className="h-12 px-3 text-right align-middle font-medium text-muted-foreground whitespace-nowrap sticky right-0 bg-muted/80">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {sortedRecords.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={19} className="p-4 text-center py-12 text-muted-foreground">
                      No MRB records found matching your criteria
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((mrb) => (
                    <tr 
                      key={mrb.id} 
                      className={`border-b transition-colors hover:bg-muted/50 ${mrb.escalationLevel && mrb.escalationLevel !== 'none' ? 'bg-red-50/50' : ''} ${selectedIds.has(mrb.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="p-3 align-middle">
                        {canUnblockSAP && mrb.status === 'approved' && (
                          <Checkbox
                            checked={selectedIds.has(mrb.id)}
                            onCheckedChange={() => toggleSelect(mrb.id)}
                            disabled={syncingIds.has(mrb.id)}
                          />
                        )}
                      </td>
                      <td className="p-3 align-middle font-medium text-primary whitespace-nowrap">
                        {mrb.mrbNumber}
                      </td>
                      <td className="p-3 align-middle whitespace-nowrap">
                        {formatDate(mrb.createdAt)}
                      </td>
                      <td className="p-3 align-middle">
                        {getSourceBadge(mrb.source)}
                      </td>
                      <td className="p-3 align-middle">
                        <Badge className={getStatusColor(mrb.status)}>
                          {getWorkflowReviewLabel(mrb.status, mrb.pendingWith, roleDisplayNames)}
                        </Badge>
                      </td>
                      {/* Inward Material Columns */}
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">
                        {mrb.inspectionLot || '-'}
                      </td>
                      <td className="p-3 align-middle">
                        <div className="max-w-[150px]">
                          <p className="font-medium text-sm">{mrb.materialNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">{mrb.materialDescription}</p>
                        </div>
                      </td>
                      <td className="p-3 align-middle">
                        <div className="max-w-[120px]">
                          <p className="text-sm truncate">{mrb.vendorName}</p>
                          {mrb.vendorCode && <p className="text-xs text-muted-foreground">{mrb.vendorCode}</p>}
                        </div>
                      </td>
                      <td className="p-3 align-middle whitespace-nowrap">{mrb.plant}</td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">
                        {mrb.grnNumber || '-'}
                      </td>
                      <td className="p-3 align-middle font-mono text-sm whitespace-nowrap">
                        {mrb.poNumber || '-'}
                      </td>
                      <td className="p-3 align-middle text-right font-medium text-destructive whitespace-nowrap">
                        {mrb.blockedQuantity?.toLocaleString() || '-'}
                      </td>
                      <td className="p-3 align-middle whitespace-nowrap">
                        {mrb.uom || '-'}
                      </td>
                      <td className="p-3 align-middle max-w-[120px]">
                        <p className="text-xs truncate" title={mrb.defectDescription || ''}>
                          {mrb.defectDescription || '-'}
                        </p>
                      </td>
                      {/* Department Reviews — hidden per requirement */}
                      {/* <td className="p-3 align-middle bg-blue-50/30 min-w-[150px]">...Quality...</td> */}
                      {/* <td className="p-3 align-middle bg-purple-50/30 min-w-[150px]">...Purchase...</td> */}
                      {/* <td className="p-3 align-middle bg-amber-50/30 min-w-[150px]">...Engg...</td> */}
                      {/* <td className="p-3 align-middle bg-green-50/30 min-w-[150px]">...Final...</td> */}
                      {/* Status Columns */}
                      <td className="p-3 align-middle whitespace-nowrap">
                        {mrb.pendingWith ? (roleDisplayNames[mrb.pendingWith as keyof typeof roleDisplayNames] || mrb.pendingWith) : '-'}
                      </td>
                      <td className="p-3 align-middle">
                        {mrb.slaStatus ? (
                          <Badge className={getSLAColor(mrb.slaStatus as any)}>
                            {mrb.pendingDays} days
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 align-middle">
                        {mrb.escalationLevel && mrb.escalationLevel !== 'none' && (
                          <Badge className={`${getEscalationColor(mrb.escalationLevel as any)} animate-pulse-slow`}>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {mrb.escalationLevel}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 align-middle">
                        {getClosureStatusBadge(mrb.closureStatus, mrb.sapStockUpdateStatus, mrb.status)}
                      </td>
                      <td className="p-3 align-middle text-right sticky right-0 bg-background border-l">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewClick(mrb)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openResultRecording(mrb)}
                                disabled={!mrb.inspectionLot}
                              >
                                <ScanEye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {mrb.inspectionLot
                                ? 'Result Recording'
                                : mrb.source === 'shop_floor'
                                  ? 'Not applicable for Shop Floor MRBs'
                                  : 'Inspection Lot not yet assigned'}
                            </TooltipContent>
                          </Tooltip>
                          {mrb.status === 'approved' && mrb.sapStockUpdateStatus === 'synced' ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-50 border border-green-200 text-green-700 text-xs font-semibold whitespace-nowrap">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              SAP Synced
                            </div>
                          ) : mrb.status === 'approved' && mrb.sapStockUpdateStatus !== 'synced' && canUnblockSAP ? (
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleRequestSAPSync(mrb.id, mrb.mrbNumber)}
                              disabled={syncingIds.has(mrb.id)}
                              className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
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
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Posting Date Dialog for SAP Sync */}
    <Dialog open={showPostingDateDialog} onOpenChange={setShowPostingDateDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            SAP Posting Date
          </DialogTitle>
          <DialogDescription>
            Enter the posting date for SAP Unblock (343 API). This is mandatory.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Posting Date <span className="text-destructive">*</span></label>
            <Input
              type="date"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Will be sent as BUDAT in YYYYMMDD format: <span className="font-mono font-medium">{postingDate ? formatPostingDateForSAP(postingDate) : ''}</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowPostingDateDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmSAPSync} disabled={!postingDate} className="bg-green-600 hover:bg-green-700 gap-2">
            <Unlock className="h-4 w-4" />
            Proceed with Unblock
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <ResultRecordingModal
      open={!!resultRecordingLot}
      inspectionLot={resultRecordingLot}
      inspOper="0010"
      onClose={() => setResultRecordingLot(null)}
    />

    </TooltipProvider>
  );
}