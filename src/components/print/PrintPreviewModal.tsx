import { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  title: string;
  styles: string;
  orientation: 'portrait' | 'landscape';
  onPrint: () => void;
  onDownloadPDF: () => void;
}

export const PrintPreviewModal = ({
  isOpen,
  onClose,
  content,
  title,
  styles,
  orientation,
  onPrint,
  onDownloadPDF
}: PrintPreviewModalProps) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    if (isOpen && previewRef.current) {
      previewRef.current.innerHTML = content;
    }
  }, [isOpen, content]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));

  const pageWidth = orientation === 'landscape' ? '297mm' : '210mm';
  const pageHeight = orientation === 'landscape' ? '210mm' : '297mm';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Print Preview - {title}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/50 p-4 rounded-lg">
          <div 
            className="mx-auto bg-white shadow-lg"
            style={{
              width: pageWidth,
              minHeight: pageHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              padding: '10mm',
              boxSizing: 'border-box'
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: styles }} />
            <div ref={previewRef} />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button variant="secondary" onClick={onDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
