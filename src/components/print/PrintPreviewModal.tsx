import { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, ZoomIn, ZoomOut } from 'lucide-react';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    if (isOpen && iframeRef.current && content) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      // Collect all stylesheets from parent document for Tailwind classes
      const parentStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${parentStyles}
  <style>
    ${styles}
    body { 
      margin: 0; 
      padding: 10mm; 
      background: white; 
      font-family: Arial, sans-serif; 
      font-size: 10px; 
      color: #000;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    img { max-width: 100%; }
  </style>
</head>
<body>${content}</body>
</html>`);
      doc.close();
    }
  }, [isOpen, content, styles]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));

  const pageWidth = orientation === 'landscape' ? '297mm' : '210mm';
  const pageHeight = orientation === 'landscape' ? '210mm' : '297mm';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="text-sm">Preview - {title}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-7 w-7">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[45px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-7 w-7">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/50 p-4 rounded-lg">
          <div 
            className="mx-auto shadow-lg"
            style={{
              width: pageWidth,
              minHeight: pageHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            <iframe
              ref={iframeRef}
              title="Print Preview"
              className="w-full border-0 bg-white"
              style={{
                width: pageWidth,
                minHeight: pageHeight,
                height: '100%',
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Close
          </Button>
          <Button variant="secondary" size="sm" onClick={onDownloadPDF}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            PDF
          </Button>
          <Button size="sm" onClick={onPrint}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
