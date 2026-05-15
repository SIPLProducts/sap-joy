import { useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export function AppHeader() {
  const { profile, updatePlant, isLoading, isAllPlantsView, setAllPlantsView } = useAuth();
  const { plantOptions, loading: plantsLoading } = useVisiblePlants();

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
  const offerAllPlants = availablePlants.length >= 2;

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4 shadow-sm">
      <div className="flex items-center">
        <SidebarTrigger className="-ml-2 mr-4" />
        <h2 className="text-sm md:text-base font-semibold truncate hidden sm:block text-muted-foreground mr-4">
          Material Review Board
        </h2>
      </div>
      
      {showPlantSwitcher && availablePlants.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md border border-border/50">
            <Building2 className="w-3.5 h-3.5 mr-2 text-primary" />
            <span className="font-medium mr-2 hidden sm:inline">Default Plant:</span>
            <Select 
              value={isAllPlantsView ? ALL_PLANTS : (profile.plant || '1300')}
              onValueChange={(val) => {
                if (val === ALL_PLANTS) {
                  setAllPlantsView(true);
                } else {
                  setAllPlantsView(false);
                  updatePlant(val);
                }
              }}
            >
              <SelectTrigger className="h-6 text-xs border-none bg-transparent shadow-none px-0 py-0 focus:ring-0 font-bold text-foreground min-w-[60px] cursor-pointer hover:text-primary transition-colors">
                <SelectValue placeholder="Plant" />
              </SelectTrigger>
              <SelectContent align="end" className="text-sm">
                {offerAllPlants && (
                  <SelectItem key={ALL_PLANTS} value={ALL_PLANTS} className="cursor-pointer">
                    <span className="font-bold">All Plants</span>
                    <span className="ml-2 text-muted-foreground text-xs block sm:inline">View across plants</span>
                  </SelectItem>
                )}
                {availablePlants.map(p => (
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
