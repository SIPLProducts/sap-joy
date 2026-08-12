import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
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
  const allCodes = availablePlants.map(p => p.code);
  const showAsAllPlants = isAllPlantsView && !isSinglePlantScreen;

  // Plants currently checked in the header switcher.
  const validSelection = selectedPlants.filter(c => allCodes.includes(c));
  const currentSelection = showAsAllPlants
    ? (validSelection.length > 0 ? validSelection : allCodes)
    : [profile.plant || allCodes[0]].filter(Boolean) as string[];
  const isAllSelected = currentSelection.length >= allCodes.length && allCodes.length > 0;

  const applySelection = (next: string[]) => {
    if (next.length === 0) return; // at least one plant must stay selected
    if (next.length === 1) {
      setAllPlantsView(false);
      setSelectedPlants(next);
      if (next[0] !== profile.plant) updatePlant(next[0]);
    } else {
      setAllPlantsView(true);
      setSelectedPlants(next);
    }
  };

  const togglePlant = (code: string) => {
    const next = currentSelection.includes(code)
      ? currentSelection.filter(c => c !== code)
      : [...currentSelection, code];
    applySelection(allCodes.filter(c => next.includes(c)));
  };

  const selectionLabel = isAllSelected
    ? 'All Plants'
    : currentSelection.length > 1
      ? `${currentSelection[0]} +${currentSelection.length - 1}`
      : (currentSelection[0] || 'Select');

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4 shadow-sm">
      <div className="flex items-center">
        <SidebarTrigger className="-ml-2 mr-4" />
        <h2 className="text-sm md:text-base font-semibold truncate hidden sm:block text-muted-foreground mr-4">
          Material Review Board
        </h2>
      </div>
      
      {showPlantSwitcher && availablePlants.length > 0 && (
        <div className="flex items-center">
          <div className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 h-8 rounded-full shadow-sm">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="text-xs font-medium hidden sm:inline opacity-90">Plant</span>
            {isSinglePlantScreen ? (
              <Select
                value={profile.plant || availablePlants[0]?.code || '1300'}
                onValueChange={(val) => {
                  setAllPlantsView(false);
                  setSelectedPlants([val]);
                  updatePlant(val);
                }}
              >
                <SelectTrigger className="h-6 text-sm border-none bg-transparent shadow-none px-0 py-0 gap-1 focus:ring-0 focus:ring-offset-0 font-semibold text-primary-foreground min-w-[80px] cursor-pointer">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent align="end" className="text-sm min-w-[170px] p-1">
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
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-6 items-center gap-1 text-sm font-semibold text-primary-foreground min-w-[80px] cursor-pointer focus:outline-none"
                  >
                    <span className="truncate">{selectionLabel}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[230px] p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => applySelection(allCodes)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 mb-1 border-b border-border/60 font-semibold text-primary hover:bg-accent hover:text-accent-foreground"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>All Plants</span>
                  </button>
                  <div className="max-h-[260px] overflow-y-auto">
                    {availablePlants.map(p => {
                      const checked = currentSelection.includes(p.code);
                      return (
                        <label
                          key={p.code}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePlant(p.code)}
                            disabled={checked && currentSelection.length === 1}
                          />
                          <span className="font-medium">{p.code}</span>
                          {p.name && (
                            <span className="text-xs opacity-70 truncate max-w-[110px]">— {p.name}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
