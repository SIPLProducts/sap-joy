import { useState, useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function AppHeader() {
  const { profile, userRole } = useAuth();
  const [plants, setPlants] = useState<{ code: string; name: string }[]>([]);
  const [selectedPlant, setSelectedPlant] = useState(profile?.plant || '1300');

  useEffect(() => {
    supabase.from('plants').select('code, name').order('code').then(({ data }) => {
      if (data) setPlants(data);
    });
  }, []);

  useEffect(() => {
    if (profile?.plant) setSelectedPlant(profile.plant);
  }, [profile?.plant]);

  const handlePlantChange = async (value: string) => {
    setSelectedPlant(value);
    if (profile?.user_id) {
      await supabase.from('profiles').update({ plant: value }).eq('user_id', profile.user_id);
      // Reload to apply plant filter globally
      window.location.reload();
    }
  };

  // Only show plant switcher for admin/executive roles
  const showPlantSwitcher = userRole === 'admin' || userRole === 'executive';

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4">
      <SidebarTrigger className="-ml-2" />
      
      {showPlantSwitcher && plants.length > 0 && (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedPlant} onValueChange={handlePlantChange}>
            <SelectTrigger className="w-[200px] h-8 text-sm">
              <SelectValue placeholder="Select Plant" />
            </SelectTrigger>
            <SelectContent>
              {plants.map(p => (
                <SelectItem key={p.code} value={p.code}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </header>
  );
}
