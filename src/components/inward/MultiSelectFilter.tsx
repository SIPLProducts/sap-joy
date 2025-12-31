import { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MultiSelectFilterProps {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = 'Select...',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  const handleSelectAll = () => {
    onSelectionChange(options.map(o => o.value));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 bg-background border-input hover:bg-accent"
          >
            <span className="truncate text-muted-foreground">
              {selectedValues.length === 0
                ? placeholder
                : `${selectedValues.length} selected`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-popover border-border z-50" align="start">
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-7 text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 text-xs"
            >
              Clear
            </Button>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="p-2 space-y-1">
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'flex items-center space-x-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent',
                    selectedValues.includes(option.value) && 'bg-accent'
                  )}
                  onClick={() => handleToggle(option.value)}
                >
                  <Checkbox
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={() => handleToggle(option.value)}
                  />
                  <span className="text-sm flex-1">{option.label}</span>
                  {selectedValues.includes(option.value) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
              {filteredOptions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No options found
                </p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedValues.slice(0, 3).map((value) => {
            const option = options.find(o => o.value === value);
            return (
              <Badge
                key={value}
                variant="secondary"
                className="text-xs"
              >
                {option?.label || value}
                <X
                  className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(value);
                  }}
                />
              </Badge>
            );
          })}
          {selectedValues.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{selectedValues.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
