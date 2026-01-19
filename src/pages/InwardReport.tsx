import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, PlusCircle, FileSpreadsheet, ChevronLeft, ChevronRight, Upload, RefreshCw, Database, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
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
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { MultiSelectFilter } from '@/components/inward/MultiSelectFilter';
import { plants, vendors, materials } from '@/data/mockData';
import { storageLocations } from '@/data/inwardReportData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Local interface matching the context's InspectionLotRecord
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

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function InwardReport() {
  const navigate = useNavigate();
  const { inspectionLotRecords, filters, setFilters, getFilteredRecords, refreshData, isLoading } = useInwardMRB();
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<InspectionLotRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'api'>('search');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Build options for filters
  const plantOptions = plants.map(p => ({ value: p, label: p }));
  const materialOptions = materials.map(m => ({ value: m.number, label: `${m.number} - ${m.description}` }));
  const vendorOptions = vendors.map(v => ({ value: v.code, label: `${v.code} - ${v.name}` }));
  const slocOptions = storageLocations.map(s => ({ value: s.code, label: `${s.code} - ${s.name}` }));
  const inspectionLotOptions = inspectionLotRecords.map(r => ({ 
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
  };

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
  };

  const handleCreateMRB = (record: InspectionLotRecord) => {
    navigate('/inward/create-mrb', { state: { inspectionLot: record } });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Invalid file type. Please upload a CSV or Excel file.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');
    setUploadMessage('');

    try {
      // Simulate file processing (in production, this would call an edge function)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo: show success
      setUploadStatus('success');
      setUploadMessage(`Successfully processed ${file.name}. Records will be available after API sync.`);
      toast.success('File uploaded successfully!');
      
      // Refresh data
      await refreshData();
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadMessage('Failed to process file. Please check the format and try again.');
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // API sync handler
  const handleAPISync = async () => {
    setIsSyncing(true);
    try {
      // Simulate API sync (in production, this would call external SAP/ERP APIs)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast.success('API sync completed! Data refreshed from external systems.');
      await refreshData();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('API sync failed. Please try again.');
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
                disabled={isSyncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync from API'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSearch}>
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
                  <CardTitle className="text-base font-semibold">Selection Criteria</CardTitle>
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
                          {startIndex + 1}-{Math.min(endIndex, searchResults.length)} of {searchResults.length}
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
                            <TableHead className="font-semibold whitespace-nowrap">Action</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Inspection Lot</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Material Code</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Material Description</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Plant</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">SLoc</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Batch</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap text-right">Blocked Qty</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap text-right">Trans. Qty</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">UoM</TableHead>
                            <TableHead className="font-semibold whitespace-nowrap">Lot Created</TableHead>
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
                              <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                                No records found matching the selection criteria
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedResults.map((record) => (
                              <TableRow 
                                key={record.id} 
                                className="hover:bg-muted/30 transition-colors"
                              >
                                <TableCell>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCreateMRB(record)}
                                    className="whitespace-nowrap"
                                  >
                                    <PlusCircle className="h-4 w-4 mr-1" />
                                    Create MRB
                                  </Button>
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
                                <TableCell>{record.storageLocation}</TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.batch}
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
                                  {formatDate(record.inspectionDate)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="whitespace-nowrap text-xs">
                                    {record.blockReason}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.vendorCode}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {record.vendorName}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {record.poNumber}
                                </TableCell>
                              </TableRow>
                            ))
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
                            disabled={currentPage === totalPages}
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
                        Use the filter options above to search for blocked inspection lots. 
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground mb-6">
                      <Badge variant="outline">Inspection Lot</Badge>
                      <Badge variant="outline">Material Code</Badge>
                      <Badge variant="outline">Plant</Badge>
                      <Badge variant="outline">Vendor Code</Badge>
                      <Badge variant="outline">Blocked Qty</Badge>
                      <Badge variant="outline">PO Number</Badge>
                    </div>
                  </div>

                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {isUploading ? 'Processing...' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports CSV, XLS, XLSX files (max 10MB)
                    </p>
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

                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Template Download</h4>
                    <p className="mb-2">
                      Download the template file to ensure your data is in the correct format.
                    </p>
                    <Button variant="outline" size="sm">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Download Template
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
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                              Connected
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Fetches inspection lots, quality decisions, and blocked stock data.
                          </p>
                          <Button variant="outline" size="sm" className="w-full" onClick={handleAPISync} disabled={isSyncing}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sync Now
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
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                              Connected
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Syncs vendor info, purchase orders, and GRN data.
                          </p>
                          <Button variant="outline" size="sm" className="w-full" onClick={handleAPISync} disabled={isSyncing}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sync Now
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Webhook Integration */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <RefreshCw className="h-5 w-5 text-purple-500" />
                              </div>
                              <div>
                                <h4 className="font-medium">Webhooks</h4>
                                <p className="text-xs text-muted-foreground">Real-time Updates</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                              Active
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Receives push notifications from external systems.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            Configure Webhooks
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Custom API */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                                <Database className="h-5 w-5 text-gray-500" />
                              </div>
                              <div>
                                <h4 className="font-medium">Custom API</h4>
                                <p className="text-xs text-muted-foreground">REST Integration</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Pending
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Configure custom REST API endpoints for data sync.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            Configure API
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Automatic Sync</AlertTitle>
                      <AlertDescription>
                        Data is automatically synced every 15 minutes. Last sync: {new Date().toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
