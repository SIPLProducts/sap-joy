import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ShopFloorStockParseResult } from '@/lib/shopFloorStockTemplates';

interface ShopFloorUploadPreviewProps {
  isOpen: boolean;
  parseResult: ShopFloorStockParseResult | null;
  fileName: string;
  isUploading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ShopFloorUploadPreview({
  isOpen,
  parseResult,
  fileName,
  isUploading,
  onClose,
  onConfirm,
}: ShopFloorUploadPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!parseResult) return null;

  const totalPages = Math.ceil(parseResult.data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = parseResult.data.slice(startIndex, endIndex);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Preview Upload Data</DialogTitle>
          <DialogDescription>
            Review the parsed data from <span className="font-medium">{fileName}</span> before uploading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-sm">
              Total Rows: {parseResult.totalRows}
            </Badge>
            <Badge 
              variant={parseResult.success ? 'default' : 'destructive'}
              className="text-sm"
            >
              Valid Rows: {parseResult.validRows}
            </Badge>
            {parseResult.errors.length > 0 && (
              <Badge variant="destructive" className="text-sm">
                Errors: {parseResult.errors.length}
              </Badge>
            )}
          </div>

          {/* Errors */}
          {parseResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation Errors</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 max-h-24 overflow-y-auto text-sm">
                  {parseResult.errors.slice(0, 10).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {parseResult.errors.length > 10 && (
                    <li className="text-muted-foreground">
                      ... and {parseResult.errors.length - 10} more errors
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Success indicator */}
          {parseResult.success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Ready to Upload</AlertTitle>
              <AlertDescription className="text-green-600/80">
                All {parseResult.validRows} records passed validation
              </AlertDescription>
            </Alert>
          )}

          {/* Data Preview Table */}
          <ScrollArea className="h-[300px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>SLoc</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>UoM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                    <TableCell>{row.plant}</TableCell>
                    <TableCell>{row.material_code}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={row.material_description || ''}>
                      {row.material_description || '-'}
                    </TableCell>
                    <TableCell>{row.batch || '-'}</TableCell>
                    <TableCell>{row.storage_location || '-'}</TableCell>
                    <TableCell className="text-right">{row.available_quantity.toLocaleString()}</TableCell>
                    <TableCell>{row.uom || 'EA'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, parseResult.data.length)} of {parseResult.data.length} records
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
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!parseResult.success || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              `Confirm Upload (${parseResult.validRows} records)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
