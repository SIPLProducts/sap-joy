import { useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon, Filter } from 'lucide-react';

interface DashboardFiltersProps {
  selectedPlant: string;
  setSelectedPlant: (value: string) => void;
  dateFrom?: Date;
  setDateFrom: (date: Date | undefined) => void;
  dateTo?: Date;
  setDateTo: (date: Date | undefined) => void;
  selectedVendor?: string;
  setSelectedVendor?: (value: string) => void;
  selectedMaterial?: string;
  setSelectedMaterial?: (value: string) => void;
  showVendor?: boolean;
  showMaterial?: boolean;
  onClear: () => void;
  plants?: string[];
  vendors?: { code: string; name: string }[];
  materials?: { number: string; description: string }[];
}

export function DashboardFilters({
  selectedPlant,
  setSelectedPlant,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  selectedVendor,
  setSelectedVendor,
  selectedMaterial,
  setSelectedMaterial,
  showVendor = false,
  showMaterial = false,
  onClear,
  plants = [],
  vendors = [],
  materials = [],
}: DashboardFiltersProps) {
  return (
    <div className="px-6 py-3 bg-muted/50 border-t border-border">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Plant</Label>
          <Select value={selectedPlant} onValueChange={setSelectedPlant}>
            <SelectTrigger className="w-[140px] h-9 bg-background">
              <SelectValue placeholder="All Plants" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border shadow-lg z-50">
              {plants.length !== 1 && <SelectItem value="all">All Plants</SelectItem>}
              {plants.map(plant => (
                <SelectItem key={plant} value={plant}>{plant}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showVendor && setSelectedVendor && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vendor</Label>
            <Select value={selectedVendor || 'all'} onValueChange={setSelectedVendor}>
              <SelectTrigger className="w-[180px] h-9 bg-background">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(vendor => (
                  <SelectItem key={vendor.code} value={vendor.code}>{vendor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showMaterial && setSelectedMaterial && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Material</Label>
            <Select value={selectedMaterial || 'all'} onValueChange={setSelectedMaterial}>
              <SelectTrigger className="w-[180px] h-9 bg-background">
                <SelectValue placeholder="All Materials" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">All Materials</SelectItem>
                {materials.map(mat => (
                  <SelectItem key={mat.number} value={mat.number}>{mat.number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] h-9 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yy") : "Select"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] h-9 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yy") : "Select"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <Button variant="ghost" size="sm" onClick={onClear} className="h-9">
          <Filter className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  );
}
