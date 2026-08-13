import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Layers, ChevronDown } from 'lucide-react';

export function AppHeader() {
  const {
    profile,
    updatePlant,
    isLoading,
    isAllPlantsView,
    setAllPlantsView,
    selectedPlants,
    setSelectedPlants,
  } = useAuth();
  const { plantOptions, loading: plantsLoading } = useVisiblePlants();
  const { pathname } = useLocation();
  const isSinglePlantScreen =
    pathname.startsWith('/inward/report') || pathname.startsWith('/inward/inprocess');

  // If the user's default plant isn't in their visible plants, auto-switch
  // to the first allowed one so all screens fetch the right data.
  useEffect(() => {
    if (plantsLoading || !profile || plantOptions.length === 0) return;
    if (isAllPlantsView) return;
    const current = profile.plant;
    const isAllowed = current && plantOptions.some(p => p.code === current);
    if (!isAllowed) {
      updatePlant(plantOptions[0].code);
    }
  }, [plantsLoading, profile?.plant, plantOptions.map(p => p.code).join('|'), isAllPlantsView]);

  if (isLoading || !profile) {
    return (
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4">
        <SidebarTrigger className="-ml-2" />
      </header>
    );
  }

  // Strict scoping: dropdown lists ONLY the plants visible to this user
  // (Master Admin sees all; everyone else sees only assigned plants).
  const availablePlants = plantOptions;
  const showPlantSwitcher = availablePlants.length > 1;
  const ALL_PLANTS = '__ALL__';
  const offerAllPlants = availablePlants.length >= 2 && !isSinglePlantScreen;
  const showAsAllPlants = isAllPlantsView && !isSinglePlantScreen;

  const allowedCodes = availablePlants.map(p => p.code);
  const currentSelection = showAsAllPlants
    ? allowedCodes
    : (() => {
        const picked = (selectedPlants || []).filter(c => allowedCodes.includes(c));
        if (picked.length > 0) return picked;
        const single = profile.plant && allowedCodes.includes(profile.plant)
          ? profile.plant
          : allowedCodes[0];
        return single ? [single] : [];
      })();

  const applySelection = (codes: string[]) => {
    const next = codes.filter(c => allowedCodes.includes(c));
    if (next.length === 0) return;
    setSelectedPlants(next);
    if (next.length === allowedCodes.length && allowedCodes.length > 1) {
      setAllPlantsView(true);
    } else {
      setAllPlantsView(false);
      if (next.length === 1 && next[0] !== profile.plant) {
        updatePlant(next[0]);
      }
    }
  };

  const togglePlant = (code: string) => {
    const set = new Set(currentSelection);
    if (set.has(code)) {
      if (set.size === 1) return; // never leave the selection empty
      set.delete(code);
    } else {
      set.add(code);
    }
    applySelection(allowedCodes.filter(c => set.has(c)));
  };

  const selectionLabel =
    currentSelection.length === allowedCodes.length && allowedCodes.length > 1
      ? 'All Plants'
      : currentSelection.length === 1
        ? currentSelection[0]
        : `${currentSelection.length} plants`;

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4 shadow-sm">
      <div className="flex items-center">
        <SidebarTrigger className="-ml-2 mr-4" />
        <h2 className="text-sm md:text-base font-semibold truncate hidden sm:block text-muted-foreground mr-4">
          Material Review Board
        </h2>
      </div>
      
      {showPlantSwitcher && availablePlants.length > 0 && isSinglePlantScreen && (
        <div className="flex items-center">
          <div className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 h-8 rounded-full shadow-sm">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="text-xs font-medium hidden sm:inline opacity-90">Plant</span>
            <Select
              value={showAsAllPlants ? ALL_PLANTS : (profile.plant || availablePlants[0]?.code || '1300')}
              onValueChange={(val) => {
                if (val === ALL_PLANTS) {
                  setAllPlantsView(true);
                } else {
                  setAllPlantsView(false);
                  setSelectedPlants([val]);
                  updatePlant(val);
                }
              }}
            >
              <SelectTrigger className="h-6 text-sm border-none bg-transparent shadow-none px-0 py-0 gap-1 focus:ring-0 focus:ring-offset-0 font-semibold text-primary-foreground min-w-[80px] cursor-pointer">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent align="end" className="text-sm min-w-[170px] p-1">
                {offerAllPlants && (
                  <SelectItem
                    key={ALL_PLANTS}
                    value={ALL_PLANTS}
                    className="cursor-pointer py-1.5 rounded-md mb-1 border-b border-border/60 font-semibold text-primary focus:bg-primary focus:text-primary-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5" />
                      <span>All Plants</span>
                    </div>
                  </SelectItem>
                )}
                {availablePlants.map(p => (
                  <SelectItem
                    key={p.code}
                    value={p.code}
                    className="cursor-pointer py-1.5 rounded-md focus:bg-primary focus:text-primary-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 opacity-70" />
                      <span className="font-medium">{p.code}</span>
                      {p.name && <span className="text-xs opacity-70 truncate max-w-[110px]">— {p.name}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {showPlantSwitcher && availablePlants.length > 0 && !isSinglePlantScreen && (
        <div className="flex items-center">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 h-8 rounded-full shadow-sm"
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium hidden sm:inline opacity-90">Plant</span>
                <span className="text-sm font-semibold">{selectionLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[240px] p-0 bg-popover border-border z-50">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-muted/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applySelection(allowedCodes)}
                >
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  All Plants
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applySelection([profile.plant && allowedCodes.includes(profile.plant) ? profile.plant : allowedCodes[0]])}
                >
                  Clear
                </Button>
              </div>
              <ScrollArea className="max-h-[260px]">
                <div className="p-1">
                  {availablePlants.map(p => (
                    <div
                      key={p.code}
                      onClick={() => togglePlant(p.code)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={currentSelection.includes(p.code)}
                        onCheckedChange={() => togglePlant(p.code)}
                      />
                      <span className="font-medium">{p.code}</span>
                      {p.name && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">— {p.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </header>
  );
}
