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
  Search, Package, ArrowRight, RotateCcw, Factory, 
  RefreshCw, 
  ChevronLeft, ChevronRight, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

import { useShopFloorStock, ShopFloorStockRecord } from '@/hooks/useShopFloorStock';
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
  
  // Tab state
  
  
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


  const handleRefreshData = async () => {
    await fetchStockRecords();
    toast.success('Data refreshed!');
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
        {true && (
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
                    <div className="rounded-md border max-h-[60vh] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
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


      </div>
    </div>
  );
}
