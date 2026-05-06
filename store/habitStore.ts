import { create } from 'zustand';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { calculateCurrentStreak, calculateLongestStreak } from '../lib/streakUtils';
import { CreateHabitInput, Habit, HabitCompletion, HabitWithStats } from '../types';
import {
  sanitizeHabitInput,
  validateHabitInput,
  ValidationErrors,
} from '../api/sanitize';
import {
  enqueueOperation,
  flushQueue,
  clearQueue,
  isNetworkError,
  QueuedOperation,
} from '../api/offline';
import {
  getCached,
  setCached,
  invalidateCache,
  CACHE_KEYS,
  TTL,
} from '../api/cache';

// ============================================================
// Types
// ============================================================

type HabitStore = {
  habits: HabitWithStats[];
  completions: Record<string, HabitCompletion[]>;
  loading: boolean;
  error: string | null;
  pendingSync: number; // how many offline ops are queued

  fetchHabits: () => Promise<void>;
  fetchCompletions: (habitId: string) => Promise<HabitCompletion[]>;
  toggleCompletion: (habitId: string) => Promise<void>;
  createHabit: (input: CreateHabitInput) => Promise<{ error: string | null; validationErrors: ValidationErrors }>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<{ error: string | null; validationErrors: ValidationErrors }>;
  archiveHabit: (id: string) => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
  reset: () => void;
};

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

// ============================================================
// Store
// ============================================================

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  completions: {},
  loading: false,
  error: null,
  pendingSync: 0,

  // ----------------------------------------------------------
  // FETCH — serves cache immediately, then updates from network
  // ----------------------------------------------------------
  fetchHabits: async () => {
    set({ loading: true, error: null });

    // Serve stale data instantly so the UI isn't blank
    const cached = await getCached<{ habits: HabitWithStats[]; completions: Record<string, HabitCompletion[]> }>(
      CACHE_KEYS.habits
    );
    if (cached) {
      set({ habits: cached.habits, completions: cached.completions });
    }

    const { data: habitsData, error: habitsErr } = await supabase
      .from('habits')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: true });

    if (habitsErr) {
      // On network error, cached data is already displayed — just stop loading
      set({ loading: false, error: isNetworkError(habitsErr) ? null : habitsErr.message });
      return;
    }

    const habits = habitsData ?? [];
    const { data: completionsData } = habits.length
      ? await supabase
          .from('habit_completions')
          .select('*')
          .in('habit_id', habits.map((h) => h.id))
      : { data: [] };

    const completionsByHabit: Record<string, HabitCompletion[]> = {};
    for (const c of completionsData ?? []) {
      if (!completionsByHabit[c.habit_id]) completionsByHabit[c.habit_id] = [];
      completionsByHabit[c.habit_id].push(c);
    }

    const today = todayStr();
    const habitsWithStats: HabitWithStats[] = habits.map((habit) => {
      const hc = completionsByHabit[habit.id] ?? [];
      return {
        ...habit,
        current_streak: calculateCurrentStreak(hc),
        longest_streak: calculateLongestStreak(hc),
        completed_today: hc.some((c) => c.completed_at === today),
        last_completed_at: hc.length
          ? [...hc].sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0].completed_at
          : null,
      };
    });

    await setCached(CACHE_KEYS.habits, { habits: habitsWithStats, completions: completionsByHabit }, TTL.MEDIUM);
    set({ habits: habitsWithStats, completions: completionsByHabit, loading: false });
  },

  // ----------------------------------------------------------
  // FETCH COMPLETIONS for a single habit
  // ----------------------------------------------------------
  fetchCompletions: async (habitId) => {
    const cacheKey = CACHE_KEYS.completions(habitId);
    const cached = await getCached<HabitCompletion[]>(cacheKey);
    if (cached) {
      set((s) => ({ completions: { ...s.completions, [habitId]: cached } }));
    }

    const { data } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('habit_id', habitId)
      .order('completed_at', { ascending: false });

    const list = data ?? [];
    await setCached(cacheKey, list, TTL.LONG);
    set((s) => ({ completions: { ...s.completions, [habitId]: list } }));
    return list;
  },

  // ----------------------------------------------------------
  // TOGGLE — optimistic update, queues on network failure
  // ----------------------------------------------------------
  toggleCompletion: async (habitId) => {
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return;

    const action = habit.completed_today ? 'remove' : 'add';
    const today = todayStr();

    // Optimistic update
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id !== habitId
          ? h
          : {
              ...h,
              completed_today: !h.completed_today,
              current_streak: !h.completed_today ? h.current_streak + 1 : Math.max(0, h.current_streak - 1),
            }
      ),
    }));

    try {
      if (action === 'remove') {
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('completed_at', today);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { error } = await supabase.from('habit_completions').insert({
          habit_id: habitId,
          user_id: user.id,
          completed_at: today,
          count: 1,
        });
        if (error) throw error;
      }

      await invalidateCache(CACHE_KEYS.habits);
    } catch (err) {
      if (isNetworkError(err)) {
        // Keep the optimistic flip; queue the real write for later
        await enqueueOperation('toggle_completion', { habitId, action, date: today });
        set((s) => ({ pendingSync: s.pendingSync + 1 }));
      } else {
        // Non-network error — roll back the optimistic flip
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id !== habitId
              ? h
              : {
                  ...h,
                  completed_today: habit.completed_today,
                  current_streak: habit.current_streak,
                }
          ),
        }));
      }
    }
  },

  // ----------------------------------------------------------
  // CREATE — validates, sanitizes, queues on network failure
  // ----------------------------------------------------------
  createHabit: async (input) => {
    const validationErrors = validateHabitInput(input as Record<string, unknown>);
    if (Object.keys(validationErrors).length) {
      return { error: null, validationErrors };
    }

    const clean = sanitizeHabitInput(input);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', validationErrors: {} };

    const { error } = await supabase.from('habits').insert({ ...clean, user_id: user.id });

    if (error) {
      if (isNetworkError(error)) {
        await enqueueOperation('create_habit', { ...clean, user_id: user.id });
        set((s) => ({ pendingSync: s.pendingSync + 1 }));
        return { error: null, validationErrors: {} };
      }
      return { error: error.message, validationErrors: {} };
    }

    await invalidateCache(CACHE_KEYS.habits);
    await get().fetchHabits();
    return { error: null, validationErrors: {} };
  },

  // ----------------------------------------------------------
  // UPDATE — validates sanitized fields, queues on network failure
  // ----------------------------------------------------------
  updateHabit: async (id, updates) => {
    const validationErrors = validateHabitInput({ name: 'placeholder', ...updates } as Record<string, unknown>);
    delete validationErrors.name; // only validate fields that were actually passed
    if (Object.keys(validationErrors).length) {
      return { error: null, validationErrors };
    }

    const { error } = await supabase
      .from('habits')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      if (isNetworkError(error)) {
        await enqueueOperation('update_habit', { id, updates });
        set((s) => ({ pendingSync: s.pendingSync + 1 }));
        return { error: null, validationErrors: {} };
      }
      return { error: error.message, validationErrors: {} };
    }

    await invalidateCache(CACHE_KEYS.habits);
    await get().fetchHabits();
    return { error: null, validationErrors: {} };
  },

  // ----------------------------------------------------------
  // ARCHIVE — queues on network failure
  // ----------------------------------------------------------
  archiveHabit: async (id) => {
    const { error } = await supabase
      .from('habits')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error && isNetworkError(error)) {
      await enqueueOperation('archive_habit', { id, archived_at: new Date().toISOString() });
      set((s) => ({ pendingSync: s.pendingSync + 1 }));
      // Optimistically remove from list
      set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
      return;
    }

    await invalidateCache(CACHE_KEYS.habits);
    await get().fetchHabits();
  },

  // ----------------------------------------------------------
  // SYNC — replay the offline queue (call on app foreground / reconnect)
  // ----------------------------------------------------------
  syncOfflineQueue: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await flushQueue(async (op: QueuedOperation) => {
      try {
        switch (op.type) {
          case 'toggle_completion': {
            const { habitId, action, date } = op.payload as { habitId: string; action: 'add' | 'remove'; date: string };
            if (action === 'remove') {
              const { error } = await supabase
                .from('habit_completions')
                .delete()
                .eq('habit_id', habitId)
                .eq('completed_at', date);
              return !error;
            } else {
              const { error } = await supabase.from('habit_completions').insert({
                habit_id: habitId,
                user_id: user.id,
                completed_at: date,
                count: 1,
              });
              // 409 unique conflict = already exists, treat as success
              return !error || error.code === '23505';
            }
          }

          case 'create_habit': {
            const { error } = await supabase.from('habits').insert(op.payload as Record<string, unknown>);
            return !error || error.code === '23505';
          }

          case 'update_habit': {
            const { id, updates } = op.payload as { id: string; updates: Partial<Habit> };
            const { error } = await supabase
              .from('habits')
              .update({ ...updates, updated_at: new Date().toISOString() })
              .eq('id', id);
            return !error;
          }

          case 'archive_habit': {
            const { id, archived_at } = op.payload as { id: string; archived_at: string };
            const { error } = await supabase
              .from('habits')
              .update({ archived_at })
              .eq('id', id);
            return !error;
          }

          case 'toggle_joint_completion': {
            const { jointHabitId, action, date } = op.payload as {
              jointHabitId: string; action: 'add' | 'remove'; date: string;
            };
            if (action === 'remove') {
              const { error } = await supabase
                .from('joint_habit_completions')
                .delete()
                .eq('joint_habit_id', jointHabitId)
                .eq('user_id', user.id)
                .eq('completed_at', date);
              return !error;
            } else {
              const { error } = await supabase.from('joint_habit_completions').insert({
                joint_habit_id: jointHabitId,
                user_id: user.id,
                completed_at: date,
                count: 1,
              });
              return !error || error.code === '23505';
            }
          }

          default:
            return true; // unknown op type — drop it
        }
      } catch {
        return false;
      }
    });

    set({ pendingSync: result.remaining });

    if (result.succeeded > 0) {
      await invalidateCache(CACHE_KEYS.habits);
      await get().fetchHabits();
    }
  },

  // ----------------------------------------------------------
  // RESET — called on sign-out
  // ----------------------------------------------------------
  reset: async () => {
    await clearQueue();
    set({ habits: [], completions: {}, loading: false, error: null, pendingSync: 0 });
  },
}));
