import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, PlusCircle, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const { inspectionLotRecords, filters, setFilters, getFilteredRecords } = useInwardMRB();
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<InspectionLotRecord[]>([]);
  
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
    setCurrentPage(1); // Reset to first page on new search
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
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm flex-shrink-0">
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

      {/* Sticky Filter Section */}
      <div className="sticky top-[73px] z-30 bg-background border-b border-border shadow-sm flex-shrink-0">
        <div className="px-6 py-4">
          <Card className="border-border shadow-sm">
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
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-hidden bg-muted/30">
        {hasSearched && (
          <div className="h-full flex flex-col px-6 py-4">
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
              <div className="flex-1 overflow-auto">
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
          </div>
        )}
      </div>
    </div>
  );
}
