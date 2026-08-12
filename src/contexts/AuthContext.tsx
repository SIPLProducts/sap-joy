import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { clearAuthStorage, hasCurrentBrowserSession, markCurrentBrowserSession } from '@/lib/authStorage';

export type AppRole = string;

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_id: string | null;
  plant: string | null;
  department: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: AppRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePlant: (newPlant: string) => Promise<{ error: Error | null }>;
  isAuthenticated: boolean;
  isAllPlantsView: boolean;
  setAllPlantsView: (v: boolean) => void;
  selectedPlants: string[];
  setSelectedPlants: (plants: string[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isAllPlantsView, setIsAllPlantsView] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('mrb.allPlantsView') === '1';
    } catch { return false; }
  });
  const setAllPlantsView = (v: boolean) => {
    setIsAllPlantsView(v);
    try { window.localStorage.setItem('mrb.allPlantsView', v ? '1' : '0'); } catch {}
  };

  // Multi-plant selection from the header switcher. Empty array = "everything
  // the user can see" (backward compatible with the old All Plants toggle).
  const [selectedPlants, setSelectedPlantsState] = useState<string[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('mrb.selectedPlants') : null;
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((p: unknown) => typeof p === 'string') : [];
    } catch { return []; }
  });
  const setSelectedPlants = (plants: string[]) => {
    setSelectedPlantsState(plants);
    try { window.localStorage.setItem('mrb.selectedPlants', JSON.stringify(plants)); } catch {}
  };

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Fetch user role
  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      setUserRole(data?.role as AppRole || null);
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    if (!hasCurrentBrowserSession()) {
      clearAuthStorage();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            if (mounted) {
              fetchProfile(session.user.id);
              fetchUserRole(session.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
        }
        
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchUserRole(session.user.id);
      }
      
      setIsLoading(false);
    }).catch((error) => {
      console.warn('Session fetch error (will retry on next auth event):', error?.message);
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        const message = error.message === 'Failed to fetch' 
          ? 'Network error. Please check your connection and try again.'
          : error.message;
        toast({
          title: "Sign in failed",
          description: message,
          variant: "destructive",
        });
        return { error };
      }
      
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      markCurrentBrowserSession();
      
      return { error: null };
    } catch (error: any) {
      const message = error?.message === 'Failed to fetch'
        ? 'Network error. Please check your connection and try again.'
        : (error?.message || 'An unexpected error occurred');
      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
      return { error: error as Error };
    }
  };

  const updatePlant = async (newPlant: string) => {
    if (!user) return { error: new Error("No user logged in") };
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ plant: newPlant })
        .eq('user_id', user.id);
      
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, plant: newPlant } : null);
      toast({
        title: "Plant Updated",
        description: `Default plant changed to ${newPlant}.`,
      });
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Error fetching/updating plant",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      clearAuthStorage();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        isLoading,
        signIn,
        signOut,
        updatePlant,
        isAuthenticated: !!session,
        isAllPlantsView,
        setAllPlantsView,
        selectedPlants,
        setSelectedPlants,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
