import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelectFilter } from '@/components/inward/MultiSelectFilter';
import { Search, Package, ArrowRight, RotateCcw, Factory } from 'lucide-react';
import {
  mockAvailableStock,
  getUniquePlants,
  getUniqueMaterials,
  getUniqueBatches,
  getUniqueStorageLocations,
  AvailableStockRecord,
} from '@/data/shopFloorStockData';

export default function ShopFloorStockSelection() {
  const navigate = useNavigate();
  
  // Filter states
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [materialDescFilter, setMaterialDescFilter] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedStorageLocations, setSelectedStorageLocations] = useState<string[]>([]);
  
  // Search executed state
  const [hasSearched, setHasSearched] = useState(false);
  
  // Selection state
  const [selectedStock, setSelectedStock] = useState<AvailableStockRecord | null>(null);

  // Filter options
  const plants = getUniquePlants();
  const materials = getUniqueMaterials();
  const batches = getUniqueBatches();
  const storageLocations = getUniqueStorageLocations();

  // Filtered stock results
  const filteredStock = useMemo(() => {
    if (!hasSearched) return [];
    
    return mockAvailableStock.filter(stock => {
      if (selectedPlants.length > 0 && !selectedPlants.includes(stock.plant)) return false;
      if (selectedMaterials.length > 0 && !selectedMaterials.includes(stock.materialCode)) return false;
      if (materialDescFilter && !stock.materialDescription.toLowerCase().includes(materialDescFilter.toLowerCase())) return false;
      if (selectedBatches.length > 0 && !selectedBatches.includes(stock.batch)) return false;
      if (selectedStorageLocations.length > 0 && !selectedStorageLocations.includes(stock.storageLocation)) return false;
      return true;
    });
  }, [hasSearched, selectedPlants, selectedMaterials, materialDescFilter, selectedBatches, selectedStorageLocations]);

  const handleSearch = () => {
    setHasSearched(true);
    setSelectedStock(null);
  };

  const handleReset = () => {
    setSelectedPlants([]);
    setSelectedMaterials([]);
    setMaterialDescFilter('');
    setSelectedBatches([]);
    setSelectedStorageLocations([]);
    setHasSearched(false);
    setSelectedStock(null);
  };

  const handleSelectStock = (stock: AvailableStockRecord) => {
    setSelectedStock(stock.id === selectedStock?.id ? null : stock);
  };

  const handleProceed = () => {
    if (selectedStock) {
      navigate('/shop-floor/material-blocking', { state: { stockItem: selectedStock } });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Factory className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Shop Floor – Material Blocking</h1>
              <p className="text-muted-foreground">Select stock to block and create MRB</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* PART 1: Selection Screen */}
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
              {/* Plant Filter */}
              <div className="space-y-2">
                <Label>Plant</Label>
                <MultiSelectFilter
                  label="Select Plant(s)"
                  options={plants.map(p => ({ value: p, label: p }))}
                  selectedValues={selectedPlants}
                  onSelectionChange={setSelectedPlants}
                />
              </div>

              {/* Material Filter */}
              <div className="space-y-2">
                <Label>Material</Label>
                <MultiSelectFilter
                  label="Select Material(s)"
                  options={materials.map(m => ({ value: m.code, label: `${m.code} - ${m.description}` }))}
                  selectedValues={selectedMaterials}
                  onSelectionChange={setSelectedMaterials}
                />
              </div>

              {/* Material Description Filter */}
              <div className="space-y-2">
                <Label>Material Description</Label>
                <Input
                  placeholder="Search description..."
                  value={materialDescFilter}
                  onChange={(e) => setMaterialDescFilter(e.target.value)}
                />
              </div>

              {/* Batch Filter */}
              <div className="space-y-2">
                <Label>Batch</Label>
                <MultiSelectFilter
                  label="Select Batch(es)"
                  options={batches.map(b => ({ value: b, label: b }))}
                  selectedValues={selectedBatches}
                  onSelectionChange={setSelectedBatches}
                />
              </div>

              {/* Storage Location Filter */}
              <div className="space-y-2">
                <Label>Storage Location</Label>
                <MultiSelectFilter
                  label="Select SLoc(s)"
                  options={storageLocations.map(sl => ({ value: sl, label: sl }))}
                  selectedValues={selectedStorageLocations}
                  onSelectionChange={setSelectedStorageLocations}
                />
              </div>
            </div>

            {/* Action Buttons */}
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

        {/* PART 2: Output List (Available Stock) */}
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Plant</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="max-w-[200px]">Material Description</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Storage Location</TableHead>
                        <TableHead className="text-right">Available Qty</TableHead>
                        <TableHead>UoM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStock.map((stock) => {
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
                            <TableCell className="font-medium">{stock.materialCode}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={stock.materialDescription}>
                              {stock.materialDescription}
                            </TableCell>
                            <TableCell>{stock.batch}</TableCell>
                            <TableCell>{stock.storageLocation}</TableCell>
                            <TableCell className="text-right font-medium">
                              {stock.availableQuantity.toLocaleString()}
                            </TableCell>
                            <TableCell>{stock.uom}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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
                  <p className="font-medium">{selectedStock.materialCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                  <p className="font-medium truncate" title={selectedStock.materialDescription}>
                    {selectedStock.materialDescription}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Batch</p>
                  <p className="font-medium">{selectedStock.batch}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">SLoc</p>
                  <p className="font-medium">{selectedStock.storageLocation}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Qty</p>
                  <p className="font-medium text-primary">{selectedStock.availableQuantity} {selectedStock.uom}</p>
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
      </div>
    </div>
  );
}
