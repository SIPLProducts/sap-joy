import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Upload, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { ParseResult, ParsedInspectionLot } from '@/lib/csvTemplates';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UploadPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  parseResult: ParseResult;
  fileName: string;
  onConfirmUpload: () => void;
  isUploading: boolean;
}

const PREVIEW_PAGE_SIZE = 10;

export const UploadPreviewModal = ({
  isOpen,
  onClose,
  parseResult,
  fileName,
  onConfirmUpload,
  isUploading
}: UploadPreviewModalProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(parseResult.data.length / PREVIEW_PAGE_SIZE);
  const startIndex = (currentPage - 1) * PREVIEW_PAGE_SIZE;
  const endIndex = Math.min(startIndex + PREVIEW_PAGE_SIZE, parseResult.data.length);
  const currentData = parseResult.data.slice(startIndex, endIndex);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] w-full flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Preview Upload Data - {fileName}
          </DialogTitle>
          <DialogDescription>
            Review the parsed data before uploading to the database
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="flex gap-4 py-2">
          <Badge variant="outline" className="gap-1">
            Total Rows: {parseResult.totalRows}
          </Badge>
          <Badge variant={parseResult.success ? "default" : "destructive"} className="gap-1">
            {parseResult.success ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Valid: {parseResult.validRows}
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                Errors: {parseResult.errors.length}
              </>
            )}
          </Badge>
        </div>

        {/* Validation Errors */}
        {parseResult.errors.length > 0 && (
          <Alert variant="destructive" className="mb-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Validation Errors:</strong>
              <ul className="list-disc ml-4 mt-1 max-h-20 overflow-y-auto">
                {parseResult.errors.slice(0, 5).map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
                {parseResult.errors.length > 5 && (
                  <li>...and {parseResult.errors.length - 5} more errors</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Data Preview Table */}
        <ScrollArea className="flex-1 border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Inspection Lot</TableHead>
                <TableHead>Material Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Storage Loc</TableHead>
                <TableHead className="text-right">Blocked Qty</TableHead>
                <TableHead className="text-right">Trans Qty</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead>Inspection Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>PO Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentData.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {startIndex + idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.inspection_lot}</TableCell>
                  <TableCell>{row.material_code}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={row.material_description}>
                    {row.material_description || '-'}
                  </TableCell>
                  <TableCell>{row.plant}</TableCell>
                  <TableCell>{row.storage_location || '-'}</TableCell>
                  <TableCell className="text-right">{row.blocked_quantity}</TableCell>
                  <TableCell className="text-right">{row.transaction_quantity}</TableCell>
                  <TableCell>{row.uom || '-'}</TableCell>
                  <TableCell>{formatDate(row.inspection_date)}</TableCell>
                  <TableCell className="max-w-[100px] truncate" title={row.vendor_name}>
                    {row.vendor_code || '-'}
                  </TableCell>
                  <TableCell>{row.po_number || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{endIndex} of {parseResult.data.length} records
            </span>
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

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={onConfirmUpload} 
            disabled={!parseResult.success || isUploading}
          >
            {isUploading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Confirm Upload ({parseResult.validRows} records)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
