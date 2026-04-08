import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectFilter } from '@/components/inward/MultiSelectFilter';
import { 
  Search, Package, ArrowRight, RotateCcw, Factory, Upload, Download, 
  RefreshCw, Settings, Database, FileUp, CheckCircle2, AlertCircle, 
  ChevronLeft, ChevronRight, Play, History, Trash2, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useShopFloorStock, ShopFloorStockRecord } from '@/hooks/useShopFloorStock';
import { downloadShopFloorCSVTemplate, validateShopFloorStockData, ShopFloorStockParseResult } from '@/lib/shopFloorStockTemplates';
import { ShopFloorUploadPreview } from '@/components/shopFloor/ShopFloorUploadPreview';
import { SAPConfigDialog } from '@/components/shopFloor/SAPConfigDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlants } from '@/hooks/useUserPlants';
import { supabase } from '@/integrations/supabase/client';
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


export default function ShopFloorStockSelection() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userRole } = useAuth();
  const { userPlants } = useUserPlants();
  
  // All plants for admin dropdown
  const [allSystemPlants, setAllSystemPlants] = useState<{ code: string; name: string }[]>([]);
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (isAdmin) {
      supabase.from('plants').select('code, name').then(({ data }) => {
        if (data) setAllSystemPlants(data);
      });
    }
  }, [isAdmin]);

  // Plants available in dropdown based on role
  const availablePlants = useMemo(() => {
    if (isAdmin) {
      return allSystemPlants.map(p => ({ value: p.code, label: `${p.code} - ${p.name}` }));
    }
    return userPlants.map(p => ({ value: p, label: p }));
  }, [isAdmin, allSystemPlants, userPlants]);

  // Database hook
  const {
    stockRecords,
    sapConfigs,
    syncHistory,
    isLoading,
    searchStockRecords,
    fetchStockRecords,
    uploadStockRecords,
    saveSAPConfig,
    deleteSAPConfig,
    testSAPConnection,
    triggerSAPSync,
    getUniquePlants,
    getUniqueMaterials,
    getUniqueBatches,
    getUniqueStorageLocations,
  } = useShopFloorStock();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'api'>('search');
  
  // Search form states (SAP payload fields)
  const [selectedPlant, setSelectedPlant] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [materialCode, setMaterialCode] = useState('');
  const [materialType, setMaterialType] = useState('');
  
  // Search executed state
  const [hasSearched, setHasSearched] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Selection state
  const [selectedStock, setSelectedStock] = useState<ShopFloorStockRecord | null>(null);

  // Upload states
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [parseResult, setParseResult] = useState<ShopFloorStockParseResult | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  // SAP config states
  const [showSAPConfig, setShowSAPConfig] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Stock results come directly from SAP — no client-side filtering needed
  const filteredStock = useMemo(() => {
    if (!hasSearched) return [];
    return stockRecords;
  }, [hasSearched, stockRecords]);

  // Pagination
  const totalPages = Math.ceil(filteredStock.length / itemsPerPage);
  const paginatedStock = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStock.slice(start, start + itemsPerPage);
  }, [filteredStock, currentPage, itemsPerPage]);

  const handleSearch = async () => {
    // Validate mandatory fields
    const errors: string[] = [];
    if (!selectedPlant) {
      errors.push('plant');
    }
    if (!storageLocation.trim()) {
      errors.push('storageLocation');
    }
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      const missing = [];
      if (errors.includes('plant')) missing.push('Plant (WERKS)');
      if (errors.includes('storageLocation')) missing.push('Storage Location (LGORT)');
      toast.error(`Please fill mandatory fields: ${missing.join(', ')}`);
      return;
    }
    
    setValidationErrors([]);
    setSelectedStock(null);
    setCurrentPage(1);
    
    // Trigger SAP API with search params
    await searchStockRecords({
      werks: selectedPlant,
      lgort: storageLocation.trim(),
      matnr: materialCode.trim() || undefined,
      matart: materialType.trim() || undefined,
    });
    setHasSearched(true);
  };

  const handleReset = () => {
    setSelectedPlant('');
    setStorageLocation('');
    setMaterialCode('');
    setMaterialType('');
    setHasSearched(false);
    setSelectedStock(null);
    setCurrentPage(1);
    setValidationErrors([]);
  };

  const handleSelectStock = (stock: ShopFloorStockRecord) => {
    setSelectedStock(stock.id === selectedStock?.id ? null : stock);
  };

  const handleProceed = () => {
    if (selectedStock) {
      const stockItem = {
        id: selectedStock.id,
        plant: selectedStock.plant,
        materialCode: selectedStock.material_code,
        materialDescription: selectedStock.material_description || '',
        batch: selectedStock.batch || '',
        storageLocation: selectedStock.storage_location || '',
        availableQuantity: selectedStock.available_quantity,
        uom: selectedStock.uom || 'EA',
      };
      navigate('/shop-floor/material-blocking', { state: { stockItem } });
    }
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

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCSV && !isExcel) {
      toast.error('Invalid file type. Please upload a CSV or Excel file.');
      return;
    }

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
        const text = await file.text();
        parsedData = parseCSV(text);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        parsedData = XLSX.utils.sheet_to_json(worksheet);
      }

      if (parsedData.length === 0) {
        throw new Error('No data found in the file');
      }

      const validationResult = validateShopFloorStockData(parsedData);
      setParseResult(validationResult);
      setPreviewFileName(file.name);
      setShowUploadPreview(true);

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

  // Confirm upload
  const handleConfirmUpload = async () => {
    if (!parseResult || !parseResult.success) return;

    setIsUploading(true);

    try {
      const uploadBatchId = `batch-${Date.now()}`;
      const result = await uploadStockRecords(parseResult.data, uploadBatchId);

      if (result.success) {
        setUploadStatus('success');
        setUploadMessage(`Successfully uploaded ${result.insertedCount} records from ${previewFileName}.`);
        toast.success(`${result.insertedCount} records uploaded successfully!`);
        setShowUploadPreview(false);
      } else {
        setUploadStatus('error');
        setUploadMessage(`Upload failed: ${result.errors.join('; ')}`);
        toast.error('Upload failed');
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

  const handleDownloadTemplate = () => {
    downloadShopFloorCSVTemplate();
    toast.success('Template downloaded successfully!');
  };

  const handleRefreshData = async () => {
    await fetchStockRecords();
    toast.success('Data refreshed!');
  };

  const handleSAPSync = async (configId: string) => {
    setIsSyncing(true);
    const result = await triggerSAPSync(configId);
    setIsSyncing(false);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleDeleteConfig = async () => {
    if (!configToDelete) return;
    const result = await deleteSAPConfig(configToDelete);
    if (result.success) {
      toast.success('Configuration deleted');
    } else {
      toast.error(result.error || 'Failed to delete');
    }
    setConfigToDelete(null);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Factory className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Shop Floor – Material Blocking</h1>
                <p className="text-muted-foreground">Upload data, sync from SAP, or search existing stock to block</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleRefreshData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Search Stock
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Data
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Database className="h-4 w-4" />
              SAP API
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <>
            {/* Selection Screen */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Stock Selection Criteria
                </CardTitle>
                <CardDescription>
                  Enter filter criteria and click Search to find available stock
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <div className="space-y-2">
                    <Label className={validationErrors.includes('plant') ? 'text-destructive' : ''}>
                      Plant <span className="text-destructive">*</span>
                    </Label>
                    <div className={validationErrors.includes('plant') ? 'ring-2 ring-destructive rounded-md' : ''}>
                      <MultiSelectFilter
                        label="Select..."
                        options={allPlants.map(p => ({ value: p, label: p }))}
                        selectedValues={selectedPlants}
                        onSelectionChange={(vals) => {
                          setSelectedPlants(vals);
                          if (vals.length > 0) setValidationErrors(prev => prev.filter(e => e !== 'plant'));
                        }}
                      />
                    </div>
                    {validationErrors.includes('plant') && (
                      <p className="text-xs text-destructive">Plant is required</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Material</Label>
                    <MultiSelectFilter
                      label="Select..."
                      options={allMaterials.map(m => ({ value: m.code, label: `${m.code} - ${m.description}` }))}
                      selectedValues={selectedMaterials}
                      onSelectionChange={setSelectedMaterials}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Material Description</Label>
                    <Input
                      placeholder="Search description..."
                      value={materialDescFilter}
                      onChange={(e) => setMaterialDescFilter(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Batch</Label>
                    <MultiSelectFilter
                      label="Select..."
                      options={allBatches.map(b => ({ value: b, label: b }))}
                      selectedValues={selectedBatches}
                      onSelectionChange={setSelectedBatches}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Storage Location</Label>
                    <MultiSelectFilter
                      label="Select..."
                      options={allStorageLocations.map(sl => ({ value: sl, label: sl }))}
                      selectedValues={selectedStorageLocations}
                      onSelectionChange={setSelectedStorageLocations}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button onClick={handleSearch} className="gap-2">
                    <Search className="w-4 h-4" />
                    Search
                  </Button>
                  <Button variant="outline" onClick={handleReset} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {hasSearched && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Available Stock
                      </CardTitle>
                      <CardDescription>
                        {filteredStock.length} record(s) found. Select a line item to proceed.
                      </CardDescription>
                    </div>
                    {selectedStock && (
                      <Button onClick={handleProceed} className="gap-2">
                        Proceed to Block
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredStock.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No stock found</p>
                      <p className="text-sm">Try adjusting your filter criteria</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Select</TableHead>
                              <TableHead>Plant</TableHead>
                              <TableHead>Material</TableHead>
                              <TableHead className="max-w-[200px]">Description</TableHead>
                              <TableHead>Batch</TableHead>
                              <TableHead>SLoc</TableHead>
                              <TableHead className="text-right">Available Qty</TableHead>
                              <TableHead>UoM</TableHead>
                              <TableHead>Source</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedStock.map((stock) => {
                              const isSelected = selectedStock?.id === stock.id;
                              return (
                                <TableRow
                                  key={stock.id}
                                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                                  onClick={() => handleSelectStock(stock)}
                                >
                                  <TableCell>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleSelectStock(stock)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{stock.plant}</Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">{stock.material_code}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={stock.material_description || ''}>
                                    {stock.material_description || '-'}
                                  </TableCell>
                                  <TableCell>{stock.batch || '-'}</TableCell>
                                  <TableCell>{stock.storage_location || '-'}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {stock.available_quantity.toLocaleString()}
                                  </TableCell>
                                  <TableCell>{stock.uom || 'EA'}</TableCell>
                                  <TableCell>
                                    <Badge variant={stock.source === 'upload' ? 'default' : stock.source === 'sap_api' ? 'secondary' : 'outline'}>
                                      {stock.source === 'upload' ? 'Uploaded' : stock.source === 'sap_api' ? 'SAP' : 'Manual'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStock.length)} of {filteredStock.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm">Page {currentPage} of {totalPages}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Selected Item Summary */}
            {selectedStock && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Selected Stock Item</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Plant</p>
                      <p className="font-medium">{selectedStock.plant}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Material</p>
                      <p className="font-medium">{selectedStock.material_code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                      <p className="font-medium truncate" title={selectedStock.material_description || ''}>
                        {selectedStock.material_description || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Batch</p>
                      <p className="font-medium">{selectedStock.batch || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">SLoc</p>
                      <p className="font-medium">{selectedStock.storage_location || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Qty</p>
                      <p className="font-medium text-primary">{selectedStock.available_quantity} {selectedStock.uom}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button onClick={handleProceed} size="lg" className="gap-2">
                      Proceed to Material Blocking
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="w-5 h-5" />
                Upload Stock Data
              </CardTitle>
              <CardDescription>
                Upload stock data from CSV or Excel files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Download */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Download Template</p>
                  <p className="text-sm text-muted-foreground">
                    Use the template to format your stock data correctly
                  </p>
                </div>
                <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>

              {/* Upload Area */}
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">CSV or Excel files (max 10MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Upload Status */}
              {uploadStatus === 'success' && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Upload Successful</AlertTitle>
                  <AlertDescription className="text-green-600/80">{uploadMessage}</AlertDescription>
                </Alert>
              )}

              {uploadStatus === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Upload Failed</AlertTitle>
                  <AlertDescription>{uploadMessage}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* SAP API TAB */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            {/* SAP Configuration Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      SAP API Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure SAP system connections for automatic stock data sync
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowSAPConfig(true)} className="gap-2">
                    <Settings className="h-4 w-4" />
                    Add Configuration
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sapConfigs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No SAP configurations</p>
                    <p className="text-sm">Add a configuration to sync stock data from SAP</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sapConfigs.map((config) => (
                      <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{config.config_name}</p>
                            <Badge variant={config.is_active ? 'default' : 'secondary'}>
                              {config.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{config.api_endpoint}</p>
                          <p className="text-xs text-muted-foreground">
                            Last sync: {formatDateTime(config.last_sync_at)} • Frequency: {config.sync_frequency}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSAPSync(config.id)}
                            disabled={isSyncing}
                          >
                            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setConfigToDelete(config.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sync History Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Sync History
                </CardTitle>
                <CardDescription>Recent SAP synchronization activities</CardDescription>
              </CardHeader>
              <CardContent>
                {syncHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No sync history available</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Records</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncHistory.map((sync) => (
                        <TableRow key={sync.id}>
                          <TableCell>{formatDateTime(sync.started_at)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sync.sync_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sync.status === 'success' ? 'default' : sync.status === 'failed' ? 'destructive' : 'secondary'}>
                              {sync.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {sync.records_inserted + sync.records_updated}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground" title={sync.error_message || ''}>
                            {sync.error_message || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Upload Preview Modal */}
      <ShopFloorUploadPreview
        isOpen={showUploadPreview}
        parseResult={parseResult}
        fileName={previewFileName}
        isUploading={isUploading}
        onClose={() => setShowUploadPreview(false)}
        onConfirm={handleConfirmUpload}
      />

      {/* SAP Config Dialog */}
      <SAPConfigDialog
        isOpen={showSAPConfig}
        onClose={() => setShowSAPConfig(false)}
        onSave={saveSAPConfig}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!configToDelete} onOpenChange={() => setConfigToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SAP Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The configuration will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfig} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
