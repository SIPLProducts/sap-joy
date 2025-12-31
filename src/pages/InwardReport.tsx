import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, PlusCircle, FileSpreadsheet } from 'lucide-react';
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
import { InspectionLotRecord } from '@/types/inwardReport';

export default function InwardReport() {
  const navigate = useNavigate();
  const { inspectionLotRecords, filters, setFilters, getFilteredRecords } = useInwardMRB();
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<InspectionLotRecord[]>([]);

  // Build options for filters
  const plantOptions = plants.map(p => ({ value: p, label: p }));
  const materialOptions = materials.map(m => ({ value: m.number, label: `${m.number} - ${m.description}` }));
  const vendorOptions = vendors.map(v => ({ value: v.code, label: `${v.code} - ${v.name}` }));
  const slocOptions = storageLocations.map(s => ({ value: s.code, label: `${s.code} - ${s.name}` }));
  const inspectionLotOptions = inspectionLotRecords.map(r => ({ 
    value: r.inspectionLot, 
    label: r.inspectionLot 
  }));

  const handleSearch = () => {
    const results = getFilteredRecords();
    setSearchResults(results);
    setHasSearched(true);
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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-foreground">MRB Inward Report</h1>
                <p className="text-sm text-muted-foreground">
                  Search and view blocked inspection lots for MRB creation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Selection Screen */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">Selection Criteria</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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

        {/* Results Table */}
        {hasSearched && (
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border bg-muted/30 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Search Results ({searchResults.length} records)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
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
                    {searchResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                          No records found matching the selection criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      searchResults.map((record) => (
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
                            {formatDate(record.inspectionLotCreatedDate)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(record.postingDate)}
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
                            {record.purchaseOrderNumber}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Initial State Message */}
        {!hasSearched && (
          <Card className="border-border shadow-sm">
            <CardContent className="py-16">
              <div className="text-center">
                <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Search for Inspection Lots
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Use the selection criteria above to filter blocked inspection lots. 
                  Click "Search / Execute" to view results.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
