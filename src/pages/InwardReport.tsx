import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, PlusCircle, FileSpreadsheet, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, CheckCircle2, Loader2, Layers, XCircle, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useInwardMRB, InspectionLotRecord } from '@/contexts/InwardMRBContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { MultiSelectFilter } from '@/components/inward/MultiSelectFilter';
import {} from '@/data/mockData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

import { useExtraDynamicFields } from '@/hooks/useDynamicFields';
const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function InwardReport() {
  const navigate = useNavigate();
  const { inspectionLotRecords, filters, setFilters, getFilteredRecords, refreshData, isLoading, uploadInspectionLots, createBatchMRBs, updateTransactionQuantity } = useInwardMRB();
  const { userRole } = useAuth();
  const { extraFields } = useExtraDynamicFields('inward_inspection_lots');

  // Role-based permissions
  const canCreateMRB = userRole && ['quality', 'quality_head', 'admin'].includes(userRole);
  
  const canEditQuantity = userRole && ['quality', 'quality_head', 'admin'].includes(userRole);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<InspectionLotRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingBatchMRBs, setIsCreatingBatchMRBs] = useState(false);

  // Confirmation dialog state
  const [showSingleConfirm, setShowSingleConfirm] = useState(false);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [pendingSingleRecord, setPendingSingleRecord] = useState<InspectionLotRecord | null>(null);

  // Inline quantity editing state
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>('');
  const [savingQtyId, setSavingQtyId] = useState<string | null>(null);

  // SAP config for ZMRB01/04 (Inward Report endpoint)
  const [sapConfigId, setSapConfigId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [relativeTime, setRelativeTime] = useState<string>('');
  const [nextSyncIn, setNextSyncIn] = useState<string>('');

  // Helper to compute relative time string
  const computeRelativeTime = useCallback((isoStr: string | null) => {
    if (!isoStr) return 'Never';
    const diff = Date.now() - new Date(isoStr).getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return new Date(isoStr).toLocaleString();
  }, []);

  const computeNextSync = useCallback((isoStr: string | null) => {
    if (!isoStr) return 'Soon';
    const next = new Date(isoStr).getTime() + 5 * 60_000; // 5-min schedule
    const remaining = next - Date.now();
    if (remaining <= 0) return 'Any moment';
    const mins = Math.ceil(remaining / 60_000);
    return `~${mins} min`;
  }, []);

  // Fetch the inward SAP API config on mount
  useEffect(() => {
    const fetchSapConfig = async () => {
      const { data } = await supabase
        .from('sap_api_config')
        .select('id, config_name, last_sync_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data && data.length > 0) {
        const inwardConfig = data.find(c => 
          c.config_name.toLowerCase().includes('zmrb') || 
          c.config_name.toLowerCase().includes('inward')
        );
        const chosen = inwardConfig || data[0];
        setSapConfigId(chosen.id);
        setLastSyncAt(chosen.last_sync_at);
      }
    };
    fetchSapConfig();
  }, []);

  // Update relative time every 30s
  useEffect(() => {
    setRelativeTime(computeRelativeTime(lastSyncAt));
    setNextSyncIn(computeNextSync(lastSyncAt));
    const timer = setInterval(() => {
      setRelativeTime(computeRelativeTime(lastSyncAt));
      setNextSyncIn(computeNextSync(lastSyncAt));
    }, 30_000);
    return () => clearInterval(timer);
  }, [lastSyncAt, computeRelativeTime, computeNextSync]);

  const handleStartEditQty = (record: InspectionLotRecord) => {
    setEditingQtyId(record.id);
    setEditingQtyValue(String(record.transactionQuantity));
  };

  const handleCancelEditQty = () => {
    setEditingQtyId(null);
    setEditingQtyValue('');
  };

  const handleSaveQty = useCallback(async (record: InspectionLotRecord) => {
    const newQty = parseFloat(editingQtyValue);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Quantity must be a non-negative number');
      return;
    }
    if (newQty === record.transactionQuantity) {
      handleCancelEditQty();
      return;
    }
    if (!sapConfigId) {
      toast.error('No SAP API configuration found. Please configure SAP settings first.');
      return;
    }

    setSavingQtyId(record.id);
    try {
      const result = await updateTransactionQuantity(record, newQty, sapConfigId);
      if (result.success) {
        toast.success(`Transaction quantity updated to ${newQty}`);
        setEditingQtyId(null);
        setEditingQtyValue('');
      } else {
        if (result.rolled_back) {
          toast.error(`SAP sync failed. Database reverted to ${result.old_quantity}. Error: ${result.error}`);
        } else {
          toast.error(`Update failed: ${result.error}`);
        }
      }
    } catch (err) {
      toast.error('Failed to update quantity');
    } finally {
      setSavingQtyId(null);
    }
  }, [editingQtyValue, sapConfigId, updateTransactionQuantity]);

  // Build options for filters from real DB data only
  const allPlants = [...new Set(inspectionLotRecords.map(r => r.plant))];
  const allMaterials = [...new Set(inspectionLotRecords.map(r => r.materialCode))];
  const allVendors = [...new Set(inspectionLotRecords.map(r => r.vendorCode).filter(Boolean))];
  const allSlocs = [...new Set(inspectionLotRecords.map(r => r.storageLocation).filter(Boolean))];
  
  const plantOptions = allPlants.map(p => ({ value: p, label: p }));
  const materialOptions = allMaterials.map(m => {
    const record = inspectionLotRecords.find(r => r.materialCode === m);
    return { value: m, label: record?.materialDescription ? `${m} - ${record.materialDescription}` : m };
  });
  const vendorOptions = allVendors.map(v => {
    const record = inspectionLotRecords.find(r => r.vendorCode === v);
    return { value: v, label: record?.vendorName ? `${v} - ${record.vendorName}` : v };
  });
  const slocOptions = allSlocs.map(s => ({ value: s, label: s }));
  // Only show pending lots in the filter dropdown (eligible for MRB creation)
  const inspectionLotOptions = inspectionLotRecords
    .filter(r => r.status === 'pending')
    .map(r => ({ 
      value: r.inspectionLot, 
      label: r.inspectionLot 
    }));

  // Pagination logic
  const totalPages = Math.ceil(searchResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResults = useMemo(() => 
    searchResults.slice(startIndex, endIndex),
    [searchResults, startIndex, endIndex]
  );

  const handleSearch = () => {
    const results = getFilteredRecords();
    setSearchResults(results);
    setHasSearched(true);
    setCurrentPage(1);
    setSelectedIds(new Set()); // Clear selection on new search
  };

  // Auto-load all records on mount and when data refreshes
  useEffect(() => {
    if (!isLoading && inspectionLotRecords.length > 0) {
      setSearchResults(inspectionLotRecords);
      if (!hasSearched) setHasSearched(true);
    }
  }, [isLoading, inspectionLotRecords]);

  const handleReset = () => {
    setFilters({
      plants: [],
      materialCodes: [],
      vendors: [],
      storageLocations: [],
      inspectionLots: [],
      postingDateFrom: '',
      postingDateTo: '',
    });
    setSearchResults([]);
    setHasSearched(false);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const handleCreateMRB = (record: InspectionLotRecord) => {
    setPendingSingleRecord(record);
    setShowSingleConfirm(true);
  };

  const confirmSingleMRB = () => {
    if (pendingSingleRecord) {
      navigate('/inward/create-mrb', { state: { inspectionLot: pendingSingleRecord } });
    }
    setShowSingleConfirm(false);
    setPendingSingleRecord(null);
  };

  // Bulk selection helpers
  const selectableRecords = useMemo(() => 
    searchResults.filter(r => r.status !== 'mrb_created'),
    [searchResults]
  );

  const paginatedSelectableRecords = useMemo(() => 
    paginatedResults.filter(r => r.status !== 'mrb_created'),
    [paginatedResults]
  );

  const isAllPageSelected = useMemo(() => {
    if (paginatedSelectableRecords.length === 0) return false;
    return paginatedSelectableRecords.every(r => selectedIds.has(r.id));
  }, [paginatedSelectableRecords, selectedIds]);

  const isAllSelected = useMemo(() => {
    if (selectableRecords.length === 0) return false;
    return selectableRecords.every(r => selectedIds.has(r.id));
  }, [selectableRecords, selectedIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(selectableRecords.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectPage = (checked: boolean) => {
    const newSelected = new Set(selectedIds);
    paginatedSelectableRecords.forEach(r => {
      if (checked) {
        newSelected.add(r.id);
      } else {
        newSelected.delete(r.id);
      }
    });
    setSelectedIds(newSelected);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchCreateMRBs = () => {
    if (selectedIds.size === 0) return;
    setShowBatchConfirm(true);
  };

  const confirmBatchMRBs = async () => {
    setShowBatchConfirm(false);
    setIsCreatingBatchMRBs(true);
    try {
      const selectedRecords = searchResults.filter(r => selectedIds.has(r.id));
      const result = await createBatchMRBs(selectedRecords);

      if (result.success) {
        toast.success(`Successfully created ${result.createdCount} MRB(s)!`);
        setSelectedIds(new Set());
        // Update search results to reflect new status
        const updatedResults = searchResults.map(r => 
          selectedIds.has(r.id) ? { ...r, status: 'mrb_created' as const } : r
        );
        setSearchResults(updatedResults);
      } else {
        toast.error(`Created ${result.createdCount} MRB(s) with ${result.errors.length} errors`);
        console.error('Batch MRB errors:', result.errors);
      }
    } catch (error) {
      console.error('Batch MRB creation failed:', error);
      toast.error('Failed to create MRBs');
    } finally {
      setIsCreatingBatchMRBs(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };




  // API sync handler
  const handleAPISync = async () => {
    setIsSyncing(true);
    try {
      await refreshData();
      toast.success('Data refreshed successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Eligible
          </Badge>
        );
      case 'mrb_created':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            MRB Created
          </Badge>
        );
      case 'cleared':
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">
            <XCircle className="h-3 w-3 mr-1" />
            Cleared
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isEligibleForMRB = (record: InspectionLotRecord) => {
    return record.status === 'pending';
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4 max-w-full overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-foreground">MRB - Inward Materials</h1>
                <p className="text-sm text-muted-foreground">
                  Upload data or sync from external systems for MRB creation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={handleAPISync}
                disabled={isSyncing || isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Refresh Data'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="h-4 w-4 mr-2" />
                Search / Execute
              </Button>
            </div>
          </div>
        </div>
          <Card className="mx-6 mb-4 border-border shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Selection Criteria</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {inspectionLotRecords.length} total records available
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <MultiSelectFilter
                      label="Plant"
                      options={plantOptions}
                      selectedValues={filters.plants}
                      onSelectionChange={(values) => setFilters({ ...filters, plants: values })}
                      placeholder="Select Plant(s)"
                    />
                    <MultiSelectFilter
                      label="Material Code"
                      options={materialOptions}
                      selectedValues={filters.materialCodes}
                      onSelectionChange={(values) => setFilters({ ...filters, materialCodes: values })}
                      placeholder="Select Material(s)"
                    />
                    <MultiSelectFilter
                      label="Vendor"
                      options={vendorOptions}
                      selectedValues={filters.vendors}
                      onSelectionChange={(values) => setFilters({ ...filters, vendors: values })}
                      placeholder="Select Vendor(s)"
                    />
                    <MultiSelectFilter
                      label="Storage Location"
                      options={slocOptions}
                      selectedValues={filters.storageLocations}
                      onSelectionChange={(values) => setFilters({ ...filters, storageLocations: values })}
                      placeholder="Select SLoc(s)"
                    />
                    <MultiSelectFilter
                      label="Inspection Lot"
                      options={inspectionLotOptions}
                      selectedValues={filters.inspectionLots}
                      onSelectionChange={(values) => setFilters({ ...filters, inspectionLots: values })}
                      placeholder="Select Lot(s)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Posting Date From
                      </label>
                      <input
                        type="date"
                        value={filters.postingDateFrom}
                        onChange={(e) => setFilters({ ...filters, postingDateFrom: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Posting Date To
                      </label>
                      <input
                        type="date"
                        value={filters.postingDateTo}
                        onChange={(e) => setFilters({ ...filters, postingDateTo: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
        </div>


      {/* Content Area */}
      <div className="bg-muted/30">
        {/* Search Content */}
        {true && (
          <>
            {/* Results Section */}
            {hasSearched && (
              <div className="h-full flex flex-col px-6 py-4 min-h-0">
                {/* Bulk Action Bar */}
                {selectedIds.size > 0 && canCreateMRB && (
                  <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        id="select-all-records"
                      />
                      <span className="font-medium text-foreground">
                        {selectedIds.size} record{selectedIds.size > 1 ? 's' : ''} selected
                      </span>
                      {selectedIds.size < selectableRecords.length && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleSelectAll(true)}
                          className="text-primary h-auto p-0"
                        >
                          Select all {selectableRecords.length} eligible records
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedIds(new Set())}
                      >
                        Clear Selection
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Navigate to create MRB form with first selected record
                          const firstSelected = searchResults.find(r => selectedIds.has(r.id));
                          if (firstSelected) {
                            handleCreateMRB(firstSelected);
                          }
                        }}
                        className="gap-2"
                        disabled={selectedIds.size !== 1}
                      >
                        <PlusCircle className="h-4 w-4" />
                        Create with Form
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleBatchCreateMRBs}
                        disabled={isCreatingBatchMRBs}
                        className="gap-2"
                        variant="secondary"
                        title="Quick create MRBs with default values (no form)"
                      >
                        {isCreatingBatchMRBs ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Layers className="h-4 w-4" />
                        )}
                        Quick Create {selectedIds.size} MRB{selectedIds.size > 1 ? 's' : ''}
                      </Button>
                    </div>
                  </div>
                )}
                <Card className="border-border shadow-sm">
                  <CardHeader className="border-b border-border bg-muted/30 py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        Search Results ({searchResults.length} records)
                      </CardTitle>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Rows per page:</span>
                          <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                            <SelectTrigger className="w-[80px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEMS_PER_PAGE_OPTIONS.map(option => (
                                <SelectItem key={option} value={String(option)}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {searchResults.length > 0 ? `${startIndex + 1}-${Math.min(endIndex, searchResults.length)} of ${searchResults.length}` : '0 records'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {/* Scrollable Table Container */}
                  <div className="max-h-[60vh] overflow-auto">
                    <div className="min-w-max">
                      <Table>
                        <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm">
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={isAllPageSelected && paginatedSelectableRecords.length > 0}
                                onCheckedChange={(checked) => handleSelectPage(!!checked)}
                                aria-label="Select all on page"
                                disabled={paginatedSelectableRecords.length === 0}
                              />
                            </TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Action</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Inspection Lot</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Material Code</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Material Description</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Plant</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">SLoc</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Batch</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap text-right">Blocked Qty</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap text-right">Trans. Qty</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">UoM</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Inspection Date</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Posting Date</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Block Reason</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Vendor Code</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Vendor Name</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">PO Number</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">PO Item Number</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">GRN Number</TableHead>
                            {extraFields.map((df) => (
                              <TableHead key={df.id} className="font-semibold whitespace-nowrap">
                                {df.description || df.field_name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedResults.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={20 + extraFields.length} className="text-center py-12 text-muted-foreground">
                                No records found matching the selection criteria
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedResults.map((record) => {
                              const eligible = isEligibleForMRB(record);
                              return (
                              <TableRow 
                                key={record.id} 
                                className={`transition-colors ${
                                  selectedIds.has(record.id) 
                                    ? 'bg-primary/5' 
                                    : eligible 
                                      ? 'hover:bg-muted/30' 
                                      : 'bg-muted/20 opacity-60'
                                }`}
                                data-state={selectedIds.has(record.id) ? 'selected' : undefined}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(record.id)}
                                    onCheckedChange={(checked) => handleSelectRow(record.id, !!checked)}
                                    disabled={!eligible}
                                    aria-label={`Select ${record.inspectionLot}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  {canCreateMRB ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCreateMRB(record)}
                                      className="whitespace-nowrap"
                                      disabled={!eligible}
                                      variant={eligible ? "default" : "outline"}
                                    >
                                      <PlusCircle className="h-4 w-4 mr-1" />
                                      {eligible ? 'Create MRB' : 'Not Eligible'}
                                    </Button>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      View Only
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(record.status)}
                                </TableCell>
                                <TableCell className="font-medium text-primary">
                                  {record.inspectionLot}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.materialCode}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {record.materialDescription}
                                </TableCell>
                                <TableCell>{record.plant}</TableCell>
                                <TableCell>{record.storageLocation || '-'}</TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.batch || '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium text-destructive">
                                  {record.blockedQuantity.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right min-w-[140px]">
                                  {editingQtyId === record.id ? (
                                    <div className="flex items-center gap-1 justify-end">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={editingQtyValue}
                                        onChange={(e) => setEditingQtyValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveQty(record);
                                          if (e.key === 'Escape') handleCancelEditQty();
                                        }}
                                        className="h-7 w-20 text-right text-sm"
                                        autoFocus
                                        disabled={savingQtyId === record.id}
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                                        onClick={() => handleSaveQty(record)}
                                        disabled={savingQtyId === record.id}
                                      >
                                        {savingQtyId === record.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Save className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={handleCancelEditQty}
                                        disabled={savingQtyId === record.id}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    canEditQuantity ? (
                                    <span
                                      className="cursor-pointer hover:underline hover:text-primary transition-colors"
                                      onClick={() => handleStartEditQty(record)}
                                      title="Click to edit"
                                    >
                                      {record.transactionQuantity.toLocaleString()}
                                    </span>
                                    ) : (
                                    <span>{record.transactionQuantity.toLocaleString()}</span>
                                    )
                                  )}
                                </TableCell>
                                <TableCell>{record.uom}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {formatDate(record.inspectionDate)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {formatDate(record.postingDate)}
                                </TableCell>
                                <TableCell>
                                  {record.blockReason ? (
                                    <Badge variant="outline" className="whitespace-nowrap text-xs">
                                      {record.blockReason}
                                    </Badge>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.vendorCode || '-'}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {record.vendorName || '-'}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.poNumber || '-'}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.poItemNumber || '-'}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.grnNumber || '-'}
                                </TableCell>
                                {extraFields.map((df) => (
                                  <TableCell key={df.id} className="text-sm">
                                    {record._raw && df.map_to_column
                                      ? String(record._raw[df.map_to_column] ?? '-')
                                      : '-'}
                                  </TableCell>
                                ))}
                              </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Pagination Footer */}
                  {searchResults.length > 0 && (
                    <div className="border-t border-border bg-background px-4 py-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {startIndex + 1} to {Math.min(endIndex, searchResults.length)} of {searchResults.length} entries
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          
                          {getPageNumbers().map((page, index) => (
                            typeof page === 'number' ? (
                              <Button
                                key={index}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className="w-9"
                              >
                                {page}
                              </Button>
                            ) : (
                              <span key={index} className="px-2 text-muted-foreground">...</span>
                            )
                          ))}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Initial State Message */}
            {!hasSearched && (
              <div className="p-6">
                <Card className="border-border shadow-sm">
                  <CardContent className="py-16">
                    <div className="text-center">
                      <FileSpreadsheet className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Select Criteria and Search
                      </h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Use the filter options above to search for inspection lots. 
                        Click "Search / Execute" to view the results.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>


      {/* Single MRB Creation Confirmation Dialog */}
      <AlertDialog open={showSingleConfirm} onOpenChange={setShowSingleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create MRB?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to create an MRB for:</p>
              {pendingSingleRecord && (
                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                  <p><span className="font-medium">Inspection Lot:</span> {pendingSingleRecord.inspectionLot}</p>
                  <p><span className="font-medium">Material:</span> {pendingSingleRecord.materialCode}</p>
                  <p><span className="font-medium">Blocked Qty:</span> {pendingSingleRecord.blockedQuantity} {pendingSingleRecord.uom}</p>
                </div>
              )}
              <p className="text-muted-foreground">This action will open the MRB creation form.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSingleMRB}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch MRB Creation Confirmation Dialog */}
      <AlertDialog open={showBatchConfirm} onOpenChange={setShowBatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create {selectedIds.size} MRB(s)?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to create <span className="font-semibold text-foreground">{selectedIds.size}</span> MRB record(s) for the selected inspection lots.</p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-sm">
                <p className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBatchMRBs}>
              Create {selectedIds.size} MRB(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
