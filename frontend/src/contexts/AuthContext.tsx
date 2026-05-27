import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

type UserRole = 'admin' | 'employee';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: { role: UserRole; full_name: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ role: UserRole; full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        supabase.auth.signOut();
      }, INACTIVITY_TIMEOUT_MS);
    };

    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll', 'wheel'];
    for (const event of events) {
      document.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      for (const event of events) {
        document.removeEventListener(event, resetTimer);
      }
    };
  }, [session]);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
