import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Props {
  config: { config_name: string };
  isOpen: boolean;
  onClose: () => void;
}

export function SAPApiFieldsDialog({ config, isOpen, onClose }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Field Mappings — {config.config_name}</DialogTitle>
          <DialogDescription>Configure request and response field mappings for this API</DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-muted-foreground">
          Field mapping configuration coming soon. This will allow you to map SAP fields to MRB fields dynamically.
        </div>
      </DialogContent>
    </Dialog>
  );
}
