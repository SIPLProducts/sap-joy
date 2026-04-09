import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { 
  Search, Package, ArrowRight, RotateCcw, Factory, 
  RefreshCw, ShieldAlert,
  ChevronLeft, ChevronRight, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { useShopFloorStock, ShopFloorStockRecord } from '@/hooks/useShopFloorStock';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlants } from '@/hooks/useUserPlants';
import { supabase } from '@/integrations/supabase/client';
import { invokeSapSync } from '@/lib/sapSyncClient';

export default function ShopFloorStockSelection() {
  const navigate = useNavigate();
  
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
    isLoading,
    searchStockRecords,
    fetchStockRecords,
  } = useShopFloorStock();
  
  // Search form states (SAP payload fields)
  const [selectedPlant, setSelectedPlant] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [materialCode, setMaterialCode] = useState('');
  const [materialType, setMaterialType] = useState('');
  
  // Search executed state
  const [hasSearched, setHasSearched] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Multi-select state
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());

  // SAP 344 blocking state
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockPostingDate, setBlockPostingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockProgress, setBlockProgress] = useState({ current: 0, total: 0 });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [goToPageInput, setGoToPageInput] = useState('');

  // Stock results come directly from SAP — no client-side filtering needed
  const filteredStock = useMemo(() => {
    if (!hasSearched) return [];
    return stockRecords;
  }, [hasSearched, stockRecords]);

  // Pagination
  const totalPages = Math.ceil(filteredStock.length / pageSize);
  const paginatedStock = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStock.slice(start, start + pageSize);
  }, [filteredStock, currentPage, pageSize]);

  // Derived selected data for payload
  const selectedStocksData = useMemo(() => {
    return filteredStock.filter(s => selectedStocks.has(s.id));
  }, [filteredStock, selectedStocks]);

  // Check if all items on current page are selected
  const allPageSelected = useMemo(() => {
    return paginatedStock.length > 0 && paginatedStock.every(s => selectedStocks.has(s.id));
  }, [paginatedStock, selectedStocks]);

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  };

  const handleGoToPage = () => {
    const page = parseInt(goToPageInput);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setGoToPageInput('');
    } else {
      toast.error(`Please enter a page between 1 and ${totalPages}`);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const handleSearch = async () => {
    const errors: string[] = [];
    if (!selectedPlant) errors.push('plant');
    if (!storageLocation.trim()) errors.push('storageLocation');
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      const missing = [];
      if (errors.includes('plant')) missing.push('Plant (WERKS)');
      if (errors.includes('storageLocation')) missing.push('Storage Location (LGORT)');
      toast.error(`Please fill mandatory fields: ${missing.join(', ')}`);
      return;
    }
    
    setValidationErrors([]);
    setSelectedStocks(new Set()); // Clear selection on new search
    setCurrentPage(1);
    
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
    setSelectedStocks(new Set());
    setCurrentPage(1);
    setValidationErrors([]);
  };

  const handleToggleStock = (stockId: string) => {
    setSelectedStocks(prev => {
      const next = new Set(prev);
      if (next.has(stockId)) {
        next.delete(stockId);
      } else {
        next.add(stockId);
      }
      return next;
    });
  };

  const handleToggleAllPage = () => {
    setSelectedStocks(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        // Deselect all on current page
        paginatedStock.forEach(s => next.delete(s.id));
      } else {
        // Select all on current page
        paginatedStock.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const handleProceed = () => {
    // Use first selected item for single-item MRB flow
    if (selectedStocksData.length === 1) {
      const sel = selectedStocksData[0];
      const stockItem = {
        id: sel.id,
        plant: sel.plant,
        materialCode: sel.material_code,
        materialDescription: sel.material_description || '',
        batch: sel.batch || '',
        storageLocation: sel.storage_location || '',
        availableQuantity: sel.available_quantity,
        uom: sel.uom || 'EA',
      };
      navigate('/shop-floor/material-blocking', { state: { stockItem } });
    }
  };

  const handleRefreshData = async () => {
    await fetchStockRecords();
    toast.success('Data refreshed!');
  };

  // ---- SAP 344 Blocking ----
  const handleBlockSelected = () => {
    if (selectedStocks.size === 0) {
      toast.error('Please select at least one item to block');
      return;
    }
    setBlockPostingDate(format(new Date(), 'yyyy-MM-dd'));
    setShowBlockDialog(true);
  };

  const handleConfirmBlock = async () => {
    setShowBlockDialog(false);
    setIsBlocking(true);

    const items = selectedStocksData;
    setBlockProgress({ current: 0, total: items.length });

    // Format posting date as YYYYMMDD
    const budat = blockPostingDate.replace(/-/g, '');

    // Resolve 344 config dynamically
    const { data: configs } = await supabase
      .from('sap_api_config')
      .select('id, config_name, api_endpoint, is_active')
      .eq('is_active', true);

    const config344 = (configs || []).find((c: any) => {
      const name = (c.config_name || '').toLowerCase();
      const endpoint = (c.api_endpoint || '').toLowerCase();
      return name.includes('344') || endpoint.includes('344');
    });

    if (!config344) {
      toast.error('No active SAP 344 (Block) configuration found. Please configure it in SAP API Settings.');
      setIsBlocking(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const results: { material: string; success: boolean; doc?: string; error?: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setBlockProgress({ current: i + 1, total: items.length });

      try {
        const payload = {
          MATNR: String(item.material_code || ''),
          WERKS: String(item.plant || ''),
          LGORT: String(item.storage_location || ''),
          CHARG: String(item.batch || ''),
          ENTRY_QNT: String(item.available_quantity ?? 0),
          ENTRY_UOM: String(item.uom || 'EA'),
          BUDAT: budat,
        };

        const res = await invokeSapSync({
          action: 'unblock', // reuses same edge function action for transactional posting
          config_id: config344.id,
          request_body: payload,
        });

        const resData = res.data;
        if (resData?.success || resData?.CODE === '100' || resData?.result?.CODE === '100') {
          const docNum = resData?.MBLNR || resData?.result?.MBLNR || resData?.data?.MBLNR || '';
          successCount++;
          results.push({ material: item.material_code, success: true, doc: docNum });
        } else {
          failCount++;
          const errMsg = resData?.error || resData?.MESSAGE || resData?.result?.MESSAGE || 'Unknown error';
          results.push({ material: item.material_code, success: false, error: errMsg });
        }
      } catch (err) {
        failCount++;
        results.push({
          material: item.material_code,
          success: false,
          error: err instanceof Error ? err.message : 'Request failed',
        });
      }
    }

    setIsBlocking(false);

    if (successCount > 0) {
      const docs = results.filter(r => r.success && r.doc).map(r => r.doc).join(', ');
      toast.success(`${successCount} item(s) blocked successfully${docs ? `. Doc: ${docs}` : ''}`);
    }
    if (failCount > 0) {
      const failDetails = results.filter(r => !r.success).map(r => `${r.material}: ${r.error}`).join('; ');
      toast.error(`${failCount} item(s) failed: ${failDetails}`);
    }

    // Clear selection after blocking
    setSelectedStocks(new Set());
  };

  return (
    <div className="min-h-screen bg-muted/30 overflow-auto h-full">
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
        {/* Search Content */}
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Plant (WERKS) - Dropdown - Mandatory */}
                <div className="space-y-2">
                  <Label className={validationErrors.includes('plant') ? 'text-destructive' : ''}>
                    Plant (WERKS) <span className="text-destructive">*</span>
                  </Label>
                  <div className={validationErrors.includes('plant') ? 'ring-2 ring-destructive rounded-md' : ''}>
                    <Select
                      value={selectedPlant}
                      onValueChange={(val) => {
                        setSelectedPlant(val);
                        if (val) setValidationErrors(prev => prev.filter(e => e !== 'plant'));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Plant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlants.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {validationErrors.includes('plant') && (
                    <p className="text-xs text-destructive">Plant is required</p>
                  )}
                </div>

                {/* Storage Location (LGORT) - Input - Mandatory */}
                <div className="space-y-2">
                  <Label className={validationErrors.includes('storageLocation') ? 'text-destructive' : ''}>
                    Storage Location (LGORT) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. 0001"
                    value={storageLocation}
                    onChange={(e) => {
                      setStorageLocation(e.target.value);
                      if (e.target.value.trim()) setValidationErrors(prev => prev.filter(e => e !== 'storageLocation'));
                    }}
                    className={validationErrors.includes('storageLocation') ? 'ring-2 ring-destructive' : ''}
                  />
                  {validationErrors.includes('storageLocation') && (
                    <p className="text-xs text-destructive">Storage Location is required</p>
                  )}
                </div>

                {/* Material Code (MATNR) - Input - Optional */}
                <div className="space-y-2">
                  <Label>Material Code (MATNR)</Label>
                  <Input
                    placeholder="e.g. 100001234"
                    value={materialCode}
                    onChange={(e) => setMaterialCode(e.target.value)}
                  />
                </div>

                {/* Material Type (MATART) - Input - Optional */}
                <div className="space-y-2">
                  <Label>Material Type (MATART)</Label>
                  <Input
                    placeholder="e.g. ROH, HALB"
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={handleSearch} className="gap-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
                      {filteredStock.length} record(s) found.
                      {selectedStocks.size > 0 && ` ${selectedStocks.size} selected.`}
                      {' '}Select items to block or proceed to MRB.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedStocks.size > 0 && (
                      <Button
                        variant="destructive"
                        onClick={handleBlockSelected}
                        disabled={isBlocking}
                        className="gap-2"
                      >
                        {isBlocking ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Blocking {blockProgress.current}/{blockProgress.total}...
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-4 w-4" />
                            Block Selected ({selectedStocks.size})
                          </>
                        )}
                      </Button>
                    )}
                    {selectedStocksData.length === 1 && (
                      <Button variant="outline" onClick={handleProceed} className="gap-2">
                        Proceed to MRB
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
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
                    <div className="rounded-md border max-h-[60vh] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                          <TableRow>
                             <TableHead className="w-12">
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  checked={allPageSelected}
                                  onCheckedChange={handleToggleAllPage}
                                  aria-label="Select all on this page"
                                />
                                <span className="text-xs font-normal text-muted-foreground">All</span>
                              </div>
                             </TableHead>
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
                            const isSelected = selectedStocks.has(stock.id);
                            return (
                              <TableRow
                                key={stock.id}
                                className={`transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggleStock(stock.id)}
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
                                  {(stock.available_quantity ?? 0).toLocaleString()}
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
                      <div className="flex flex-wrap items-center justify-between mt-4 gap-4">
                        <div className="flex items-center gap-4">
                          <p className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredStock.length)} of {filteredStock.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows:</span>
                            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                              <SelectTrigger className="w-[80px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="200">200</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {getPageNumbers().map((page, idx) =>
                            page === 'ellipsis' ? (
                              <span key={`e-${idx}`} className="px-2 text-muted-foreground">…</span>
                            ) : (
                              <Button
                                key={page}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                className="w-8 h-8 p-0"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            )
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Go to:</span>
                          <Input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={goToPageInput}
                            onChange={(e) => setGoToPageInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGoToPage()}
                            className="w-16 h-8"
                            placeholder="#"
                          />
                          <Button size="sm" variant="outline" className="h-8" onClick={handleGoToPage}>Go</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Selected Items Summary */}
          {selectedStocksData.length > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Selected Stock Items ({selectedStocksData.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedStocksData.length === 1 ? (
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Plant</p>
                      <p className="font-medium">{selectedStocksData[0].plant}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Material</p>
                      <p className="font-medium">{selectedStocksData[0].material_code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                      <p className="font-medium truncate" title={selectedStocksData[0].material_description || ''}>
                        {selectedStocksData[0].material_description || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Batch</p>
                      <p className="font-medium">{selectedStocksData[0].batch || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">SLoc</p>
                      <p className="font-medium">{selectedStocksData[0].storage_location || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Qty</p>
                      <p className="font-medium text-primary">{selectedStocksData[0].available_quantity} {selectedStocksData[0].uom}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {selectedStocksData.length} items selected for blocking. Click <strong>"Block Selected"</strong> in the header to proceed with SAP 344 posting.
                  </div>
                )}
                <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                  {selectedStocksData.length === 1 && (
                    <Button variant="outline" onClick={handleProceed} className="gap-2">
                      Proceed to Material Blocking (MRB)
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="destructive" onClick={handleBlockSelected} disabled={isBlocking} className="gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Block Selected ({selectedStocks.size})
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      </div>

      {/* SAP 344 Block Confirmation Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Material Blocking (SAP 344)</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to block <strong>{selectedStocks.size} item(s)</strong> in SAP using Movement Type 344 (Unrestricted → Blocked).
              Please confirm the posting date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Posting Date (BUDAT)</Label>
            <Input
              type="date"
              value={blockPostingDate}
              onChange={(e) => setBlockPostingDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be sent to SAP as: {blockPostingDate.replace(/-/g, '')}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
