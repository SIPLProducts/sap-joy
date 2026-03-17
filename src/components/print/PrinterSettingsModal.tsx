import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Settings, Save, RotateCcw, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface PrinterSettings {
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter' | 'legal';
  margins: 'default' | 'narrow' | 'wide' | 'custom';
  customMargin: number;
  scale: number;
  printBackgrounds: boolean;
  headerFooter: boolean;
  copies: number;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  orientation: 'portrait',
  paperSize: 'a4',
  margins: 'default',
  customMargin: 10,
  scale: 100,
  printBackgrounds: true,
  headerFooter: false,
  copies: 1
};

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrinterSettings;
  onSave: (settings: PrinterSettings) => void;
}

export const PrinterSettingsModal = ({
  isOpen,
  onClose,
  settings,
  onSave
}: PrinterSettingsModalProps) => {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<PrinterSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    // Store settings in localStorage for persistence
    localStorage.setItem('mrb-printer-settings', JSON.stringify(localSettings));
    toast({
      title: 'Settings Saved',
      description: 'Your printer settings have been saved and will be applied to future prints.'
    });
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    toast({
      title: 'Settings Reset',
      description: 'Printer settings have been reset to defaults.'
    });
  };

  const updateSetting = <K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Printer Configuration
          </DialogTitle>
          <DialogDescription>
            Configure default print settings for MRB documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              These settings will be applied as defaults. Your browser's print dialog will still allow final adjustments.
            </AlertDescription>
          </Alert>

          {/* Orientation */}
          <div className="space-y-2">
            <Label>Page Orientation</Label>
            <Select 
              value={localSettings.orientation} 
              onValueChange={(v) => updateSetting('orientation', v as 'portrait' | 'landscape')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Paper Size */}
          <div className="space-y-2">
            <Label>Paper Size</Label>
            <Select 
              value={localSettings.paperSize} 
              onValueChange={(v) => updateSetting('paperSize', v as 'a4' | 'letter' | 'legal')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                <SelectItem value="letter">Letter (8.5 × 11 in)</SelectItem>
                <SelectItem value="legal">Legal (8.5 × 14 in)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Margins */}
          <div className="space-y-2">
            <Label>Margins</Label>
            <Select 
              value={localSettings.margins} 
              onValueChange={(v) => updateSetting('margins', v as 'default' | 'narrow' | 'wide' | 'custom')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (10mm)</SelectItem>
                <SelectItem value="narrow">Narrow (5mm)</SelectItem>
                <SelectItem value="wide">Wide (20mm)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {localSettings.margins === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={localSettings.customMargin}
                  onChange={(e) => updateSetting('customMargin', parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">mm</span>
              </div>
            )}
          </div>

          {/* Scale */}
          <div className="space-y-2">
            <Label>Scale (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={50}
                max={200}
                value={localSettings.scale}
                onChange={(e) => updateSetting('scale', parseInt(e.target.value) || 100)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {/* Copies */}
          <div className="space-y-2">
            <Label>Number of Copies</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={localSettings.copies}
              onChange={(e) => updateSetting('copies', parseInt(e.target.value) || 1)}
              className="w-20"
            />
          </div>

          {/* Print Backgrounds */}
          <div className="flex items-center justify-between">
            <Label htmlFor="printBackgrounds">Print Background Colors</Label>
            <Switch
              id="printBackgrounds"
              checked={localSettings.printBackgrounds}
              onCheckedChange={(v) => updateSetting('printBackgrounds', v)}
            />
          </div>

          {/* Header/Footer */}
          <div className="flex items-center justify-between">
            <Label htmlFor="headerFooter">Include Headers & Footers</Label>
            <Switch
              id="headerFooter"
              checked={localSettings.headerFooter}
              onCheckedChange={(v) => updateSetting('headerFooter', v)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const loadPrinterSettings = (): PrinterSettings => {
  const stored = localStorage.getItem('mrb-printer-settings');
  if (stored) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
};
