import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { sanitizeEmail, validateAuthInput, ValidationErrors } from '../api/sanitize';
import { clearQueue } from '../api/offline';
import { clearAllCache } from '../api/cache';

type AuthStore = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null; validationErrors: ValidationErrors }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; validationErrors: ValidationErrors }>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  signIn: async (email, password) => {
    const validationErrors = validateAuthInput(email, password);
    if (Object.keys(validationErrors).length) return { error: null, validationErrors };

    const { error } = await supabase.auth.signInWithPassword({
      email: sanitizeEmail(email),
      password,
    });
    return { error: error?.message ?? null, validationErrors: {} };
  },

  signUp: async (email, password) => {
    const validationErrors = validateAuthInput(email, password);
    if (Object.keys(validationErrors).length) return { error: null, validationErrors };

    const { error } = await supabase.auth.signUp({
      email: sanitizeEmail(email),
      password,
    });
    return { error: error?.message ?? null, validationErrors: {} };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await Promise.all([clearQueue(), clearAllCache()]);
    set({ session: null, user: null });
  },
}));
