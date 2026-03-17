import { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, ZoomIn, ZoomOut } from 'lucide-react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceElement?: HTMLDivElement | null;
  content?: string;
  title: string;
  styles?: string;
  orientation: 'portrait' | 'landscape';
  onPrint: () => void;
  onDownloadPDF: () => void;
}

export const PrintPreviewModal = ({
  isOpen,
  onClose,
  sourceElement,
  content,
  title,
  orientation,
  onPrint,
  onDownloadPDF,
}: PrintPreviewModalProps) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    if (!isOpen || !previewRef.current) return;

    previewRef.current.innerHTML = '';

    if (sourceElement) {
      const clonedContent = sourceElement.cloneNode(true) as HTMLDivElement;
      clonedContent.classList.remove('mx-auto');
      previewRef.current.appendChild(clonedContent);
      return;
    }

    if (content) {
      previewRef.current.innerHTML = content;
    }
  }, [isOpen, sourceElement, content]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.3));

  const pageWidth = orientation === 'landscape' ? '297mm' : '210mm';
  const pageHeight = orientation === 'landscape' ? '210mm' : '297mm';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[95vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="text-sm">Preview - {title}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-7 w-7">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="min-w-[45px] text-center text-xs text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-7 w-7">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-lg bg-muted/50 p-4">
          <div
            className="mx-auto bg-background shadow-lg"
            style={{
              width: pageWidth,
              minHeight: pageHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            <div ref={previewRef} className="min-h-full bg-white p-4" />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Close
          </Button>
          <Button variant="secondary" size="sm" onClick={onDownloadPDF}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button size="sm" onClick={onPrint}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
