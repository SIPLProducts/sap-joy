import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const buildPreviewDocument = (markup: string, extraStyles?: string) => {
  const documentStyles = typeof document === 'undefined'
    ? ''
    : Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((node) => node.outerHTML)
        .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${documentStyles}
    ${extraStyles ? `<style>${extraStyles}</style>` : ''}
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: white;
      }

      body {
        width: fit-content;
        min-height: 100%;
      }
    </style>
  </head>
  <body>
    ${markup}
  </body>
</html>`;
};

export const PrintPreviewModal = ({
  isOpen,
  onClose,
  sourceElement,
  content,
  title,
  styles,
  orientation,
  onPrint,
  onDownloadPDF,
}: PrintPreviewModalProps) => {
  const [zoom, setZoom] = useState(0.6);

  const previewDocument = useMemo(() => {
    if (content) {
      return buildPreviewDocument(content, styles);
    }

    if (sourceElement) {
      return buildPreviewDocument(sourceElement.outerHTML, styles);
    }

    return buildPreviewDocument('<div></div>', styles);
  }, [content, sourceElement, styles]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.3));

  const pageWidth = orientation === 'landscape' ? '297mm' : '210mm';
  const pageHeight = orientation === 'landscape' ? '210mm' : '297mm';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[95vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="text-sm">Preview - {title}</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={handleZoomOut} className="h-7 w-7">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="min-w-[45px] text-center text-xs text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button type="button" variant="ghost" size="icon" onClick={handleZoomIn} className="h-7 w-7">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Print preview dialog for the selected MRB document.
          </DialogDescription>
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
            <iframe
              title={title}
              srcDoc={previewDocument}
              className="block w-full border-0 bg-white"
              style={{ height: pageHeight }}
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Close
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onDownloadPDF}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button type="button" size="sm" onClick={onPrint}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
