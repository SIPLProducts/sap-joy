import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, PlusCircle, FileSpreadsheet, ChevronLeft, ChevronRight, Upload, RefreshCw, Database, FileUp, AlertCircle, CheckCircle2, Download, Loader2, Layers, XCircle } from 'lucide-react';
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { downloadCSVTemplate, validateParsedData, ParseResult } from '@/lib/csvTemplates';
import * as XLSX from 'xlsx';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadPreviewModal } from '@/components/inward/UploadPreviewModal';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function InwardReport() {
  const navigate = useNavigate();
  const { inspectionLotRecords, filters, setFilters, getFilteredRecords, refreshData, isLoading, uploadInspectionLots, createBatchMRBs } = useInwardMRB();
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<InspectionLotRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'api'>('search');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewFileName, setPreviewFileName] = useState('');
  
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

  // Parse CSV content
  const parseCSV = (content: string): Record<string, unknown>[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data: Record<string, unknown>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
    
    return data;
  };

  // File upload handler - now shows preview first
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || 
                    file.type === 'application/vnd.ms-excel' || 
                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isCSV && !isExcel) {
      toast.error('Invalid file type. Please upload a CSV or Excel file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    setUploadStatus('idle');
    setUploadMessage('');
    setParseResult(null);

    try {
      let parsedData: Record<string, unknown>[] = [];

      if (isCSV) {
        // Parse CSV
        const text = await file.text();
        parsedData = parseCSV(text);
      } else {
        // Parse Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        parsedData = XLSX.utils.sheet_to_json(worksheet);
      }

      if (parsedData.length === 0) {
        throw new Error('No data found in the file');
      }

      // Validate the parsed data
      const validationResult = validateParsedData(parsedData);
      setParseResult(validationResult);
      setPreviewFileName(file.name);
      
      // Show preview modal instead of directly uploading
      setShowPreview(true);

    } catch (error) {
      console.error('Parse error:', error);
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Failed to process file');
      toast.error('Failed to parse file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Confirm upload from preview modal
  const handleConfirmUpload = async () => {
    if (!parseResult || !parseResult.success) return;

    setIsUploading(true);

    try {
      const uploadBatchId = `batch-${Date.now()}`;
      const uploadResult = await uploadInspectionLots(parseResult.data, uploadBatchId);

      if (uploadResult.success) {
        setUploadStatus('success');
        setUploadMessage(`Successfully uploaded ${uploadResult.insertedCount} records from ${previewFileName}.`);
        toast.success(`${uploadResult.insertedCount} records uploaded successfully!`);
        setShowPreview(false);
      } else {
        setUploadStatus('error');
        setUploadMessage(`Partial upload: ${uploadResult.insertedCount} records inserted. Errors: ${uploadResult.errors.join('; ')}`);
        toast.error('Some records failed to upload');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Failed to upload data');
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Close preview modal
  const handleClosePreview = () => {
    setShowPreview(false);
    setParseResult(null);
    setPreviewFileName('');
  };

  // Template download handler
  const handleDownloadTemplate = () => {
    downloadCSVTemplate();
    toast.success('Template downloaded successfully!');
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
    <div className="flex flex-col h-full min-h-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm flex-shrink-0">
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
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-[73px] z-30 bg-background border-b border-border shadow-sm flex-shrink-0">
        <div className="px-6 py-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Data
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                API Integration
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-muted/30 min-h-0">
        {/* Search Tab Content */}
        {activeTab === 'search' && (
          <>
            {/* Filter Section */}
            <div className="px-6 py-4 border-b border-border bg-background">
              <Card className="border-border shadow-sm overflow-hidden">
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
                </CardContent>
              </Card>
            </div>

            {/* Results Section */}
            {hasSearched && (
              <div className="h-full flex flex-col px-6 py-4 min-h-0">
                {/* Bulk Action Bar */}
                {selectedIds.size > 0 && (
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
                <Card className="border-border shadow-sm flex-1 flex flex-col overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/30 py-3 flex-shrink-0">
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
                  <div className="flex-1 overflow-auto min-h-0">
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedResults.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={18} className="text-center py-12 text-muted-foreground">
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
                                <TableCell className="text-right">
                                  {record.transactionQuantity.toLocaleString()}
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

        {/* Upload Tab Content */}
        {activeTab === 'upload' && (
          <div className="p-6">
            <Card className="border-border shadow-sm max-w-2xl mx-auto">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5" />
                  Upload Inspection Lot Data
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      Upload a CSV or Excel file containing inspection lot data. The file should include columns for:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground mb-6">
                      <Badge variant="outline">inspection_lot *</Badge>
                      <Badge variant="outline">material_code *</Badge>
                      <Badge variant="outline">plant *</Badge>
                      <Badge variant="outline">blocked_quantity</Badge>
                      <Badge variant="outline">vendor_code</Badge>
                      <Badge variant="outline">vendor_name</Badge>
                      <Badge variant="outline">po_number</Badge>
                      <Badge variant="outline">block_reason</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">* Required fields</p>
                  </div>

                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isUploading ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <>
                        <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                        <p className="text-lg font-medium mb-2">Processing file...</p>
                        <p className="text-sm text-muted-foreground">
                          Please wait while we parse and validate your data
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Supports CSV, XLS, XLSX files (max 10MB)
                        </p>
                      </>
                    )}
                  </div>

                  {uploadStatus !== 'idle' && (
                    <Alert variant={uploadStatus === 'success' ? 'default' : 'destructive'}>
                      {uploadStatus === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        {uploadStatus === 'success' ? 'Upload Successful' : 'Upload Failed'}
                      </AlertTitle>
                      <AlertDescription>{uploadMessage}</AlertDescription>
                    </Alert>
                  )}

                  {parseResult && (
                    <div className="text-sm bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Parse Summary</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>Total rows: {parseResult.totalRows}</div>
                        <div>Valid rows: {parseResult.validRows}</div>
                      </div>
                      {parseResult.errors.length > 0 && (
                        <div className="mt-2 text-destructive">
                          <p className="font-medium">Errors ({parseResult.errors.length}):</p>
                          <ul className="list-disc list-inside text-xs max-h-32 overflow-auto">
                            {parseResult.errors.slice(0, 10).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                            {parseResult.errors.length > 10 && (
                              <li>... and {parseResult.errors.length - 10} more errors</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Template Download</h4>
                    <p className="mb-3">
                      Download the template file to ensure your data is in the correct format.
                    </p>
                    <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* API Integration Tab Content */}
        {activeTab === 'api' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader className="border-b border-border bg-muted/30">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    External System Integration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <p className="text-muted-foreground">
                      This screen integrates with external systems to fetch and sync inspection lot data automatically. 
                      Data is pulled from SAP, ERP, and other connected systems.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* SAP Integration */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Database className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <h4 className="font-medium">SAP QM</h4>
                                <p className="text-xs text-muted-foreground">Quality Management</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Configure
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Fetches inspection lots, quality decisions, and blocked stock data.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            Configure Connection
                          </Button>
                        </CardContent>
                      </Card>

                      {/* MM Integration */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Database className="h-5 w-5 text-orange-500" />
                              </div>
                              <div>
                                <h4 className="font-medium">SAP MM</h4>
                                <p className="text-xs text-muted-foreground">Materials Management</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Configure
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Syncs vendor info, purchase orders, and GRN data.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            Configure Connection
                          </Button>
                        </CardContent>
                      </Card>

                      {/* REST API */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <RefreshCw className="h-5 w-5 text-purple-500" />
                              </div>
                              <div>
                                <h4 className="font-medium">REST API</h4>
                                <p className="text-xs text-muted-foreground">Custom Integration</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Configure
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Connect to any REST API endpoint for data sync.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            Configure Endpoint
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Webhook */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Database className="h-5 w-5 text-green-500" />
                              </div>
                              <div>
                                <h4 className="font-medium">Webhooks</h4>
                                <p className="text-xs text-muted-foreground">Push Notifications</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Configure
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Receive real-time updates from external systems.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            View Webhook URL
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>API Configuration Required</AlertTitle>
                      <AlertDescription>
                        Configure your external system connections to enable automatic data synchronization. 
                        Contact your administrator for API credentials and endpoint URLs.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Upload Preview Modal */}
      {parseResult && (
        <UploadPreviewModal
          isOpen={showPreview}
          onClose={handleClosePreview}
          parseResult={parseResult}
          fileName={previewFileName}
          onConfirmUpload={handleConfirmUpload}
          isUploading={isUploading}
        />
      )}

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
