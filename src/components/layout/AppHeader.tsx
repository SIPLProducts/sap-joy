import { useState, useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { usePlants } from '@/hooks/usePlantConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export function AppHeader() {
  const { profile, updatePlant, isLoading, userRole } = useAuth();
  const plants = usePlants();

  // If we are still loading or no profile, show minimal header
  if (isLoading || !profile) {
    return (
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4">
        <SidebarTrigger className="-ml-2" />
      </header>
    );
  }

  // Only show plant switcher for admin/executive roles
  const showPlantSwitcher = userRole === 'admin' || userRole === 'executive';

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4 shadow-sm">
      <div className="flex items-center">
        <SidebarTrigger className="-ml-2 mr-4" />
        <h2 className="text-sm font-semibold truncate hidden sm:block text-muted-foreground mr-4">
          Material Review Board
        </h2>
      </div>
      
      {showPlantSwitcher && plants.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md border border-border/50">
            <Building2 className="w-3.5 h-3.5 mr-2 text-primary" />
            <span className="font-medium mr-2 hidden sm:inline">Active Plant:</span>
            <Select 
              value={profile.plant || '1300'} 
              onValueChange={(val) => updatePlant(val)}
            >
              <SelectTrigger className="h-6 text-xs border-none bg-transparent shadow-none px-0 py-0 focus:ring-0 font-bold text-foreground min-w-[60px] cursor-pointer hover:text-primary transition-colors">
                <SelectValue placeholder="Plant" />
              </SelectTrigger>
              <SelectContent align="end" className="text-sm">
                {plants.map(p => (
                  <SelectItem key={p.code} value={p.code} className="cursor-pointer">
                    <span className="font-bold">{p.code}</span>
                    {p.name && <span className="ml-2 text-muted-foreground text-xs block sm:inline">{p.name}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </header>
  );
}
