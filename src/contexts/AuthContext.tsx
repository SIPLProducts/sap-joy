import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential race conditions with Supabase internals
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

    // THEN check for existing session
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
      // Handle AbortError and network errors gracefully
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

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
          },
        },
      });
      
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // If signup successful and we have a user, assign the role
      if (data.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: role,
          });
        
        if (roleError) {
          console.error('Error assigning role:', roleError);
        }
      }
      
      toast({
        title: "Account created!",
        description: "You have successfully signed up.",
      });
      
      return { error: null };
    } catch (error) {
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
        description: `Active plant changed to ${newPlant}.`,
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
    await supabase.auth.signOut();
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
