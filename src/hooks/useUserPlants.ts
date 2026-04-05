import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserPlant {
  id: string;
  user_id: string;
  plant_code: string;
}

export function useUserPlants() {
  const { user } = useAuth();
  const [userPlants, setUserPlants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPlants = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_plants')
        .select('plant_code')
        .eq('user_id', user.id);

      if (!error && data) {
        setUserPlants(data.map(d => d.plant_code));
      }
    } catch (e) {
      console.error('Error fetching user plants:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPlants();
  }, [user?.id]);

  return { userPlants, loading, refetch: fetchUserPlants };
}
