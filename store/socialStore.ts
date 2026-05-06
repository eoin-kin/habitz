import { create } from 'zustand';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { calculateCurrentStreak, calculateLongestStreak } from '../lib/streakUtils';
import {
  FriendWithProfile,
  FriendshipStatus,
  JointHabitCompletion,
  JointHabitWithStats,
  CreateJointHabitInput,
  Profile,
} from '../types';
import {
  enqueueOperation,
  isNetworkError,
} from '../api/offline';
import {
  getCached,
  setCached,
  invalidateCache,
  TTL,
} from '../api/cache';

// ============================================================
// Cache keys (scoped to social)
// ============================================================

const SOCIAL_CACHE = {
  friends: 'social:friends',
  jointHabits: 'social:joint_habits',
};

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

// ============================================================
// Store type
// ============================================================

type SocialStore = {
  friends: FriendWithProfile[];
  jointHabits: JointHabitWithStats[];
  loading: boolean;
  error: string | null;

  // Friends
  fetchFriends: () => Promise<void>;
  searchUsers: (query: string) => Promise<Profile[]>;
  sendFriendRequest: (addresseeId: string) => Promise<string | null>;
  respondToFriendRequest: (friendshipId: string, status: 'accepted' | 'blocked') => Promise<string | null>;
  unfriend: (friendshipId: string) => Promise<void>;

  // Joint habits
  fetchJointHabits: () => Promise<void>;
  createJointHabit: (input: CreateJointHabitInput) => Promise<string | null>;
  respondToJointInvite: (jointHabitId: string, status: 'accepted' | 'declined') => Promise<void>;
  toggleJointCompletion: (jointHabitId: string) => Promise<void>;
  archiveJointHabit: (jointHabitId: string) => Promise<void>;

  reset: () => void;
};

// ============================================================
// Store implementation
// ============================================================

export const useSocialStore = create<SocialStore>((set, get) => ({
  friends: [],
  jointHabits: [],
  loading: false,
  error: null,

  // ── FRIENDS ─────────────────────────────────────────────────

  fetchFriends: async () => {
    set({ loading: true, error: null });

    const cached = await getCached<FriendWithProfile[]>(SOCIAL_CACHE.friends);
    if (cached) set({ friends: cached });

    // Query the friend_list view, then join profiles
    const { data: entries, error } = await supabase
      .from('friend_list')
      .select('*');

    if (error) {
      set({ loading: false, error: isNetworkError(error) ? null : error.message });
      return;
    }

    if (!entries?.length) {
      set({ friends: [], loading: false });
      await setCached(SOCIAL_CACHE.friends, [], TTL.MEDIUM);
      return;
    }

    const friendIds = entries.map((e: { friend_id: string }) => e.friend_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', friendIds);

    const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]));

    const enriched: FriendWithProfile[] = entries.map((e: { friend_id: string; friendship_id: string; status: FriendshipStatus; direction: 'incoming' | 'outgoing'; requested_at: string; responded_at: string }) => ({
      friendship_id: e.friendship_id,
      friend_id: e.friend_id,
      status: e.status,
      direction: e.direction,
      requested_at: e.requested_at,
      responded_at: e.responded_at,
      profile: profileMap.get(e.friend_id) ?? {
        id: e.friend_id,
        username: 'unknown',
        display_name: null,
        avatar_url: null,
        created_at: '',
        updated_at: '',
      },
    }));

    await setCached(SOCIAL_CACHE.friends, enriched, TTL.MEDIUM);
    set({ friends: enriched, loading: false });
  },

  searchUsers: async (query) => {
    if (!query.trim()) return [];
    const { data, error } = await supabase.rpc('search_users', { query: query.trim() });
    if (error) return [];
    return data ?? [];
  },

  sendFriendRequest: async (addresseeId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Not authenticated';

    // Prevent requesting someone you already have a relationship with
    const existing = get().friends.find((f) => f.friend_id === addresseeId);
    if (existing) return 'You already have a relationship with this user.';

    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: 'pending',
    });

    if (error) return error.message;
    await invalidateCache(SOCIAL_CACHE.friends);
    await get().fetchFriends();
    return null;
  },

  respondToFriendRequest: async (friendshipId, status) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Not authenticated';

    const { error } = await supabase
      .from('friendships')
      .update({ status })
      .eq('id', friendshipId)
      .eq('addressee_id', user.id); // can only respond as the addressee

    if (error) return error.message;
    await invalidateCache(SOCIAL_CACHE.friends);
    await get().fetchFriends();
    return null;
  },

  unfriend: async (friendshipId) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    await invalidateCache(SOCIAL_CACHE.friends);
    set((s) => ({ friends: s.friends.filter((f) => f.friendship_id !== friendshipId) }));
  },

  // ── JOINT HABITS ─────────────────────────────────────────────

  fetchJointHabits: async () => {
    set({ loading: true, error: null });

    const cached = await getCached<JointHabitWithStats[]>(SOCIAL_CACHE.jointHabits);
    if (cached) set({ jointHabits: cached });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false }); return; }

    // Fetch joint habits the current user is a member of (any active status)
    const { data: memberRows, error: memberErr } = await supabase
      .from('joint_habit_members')
      .select('joint_habit_id, status')
      .eq('user_id', user.id)
      .in('status', ['invited', 'accepted']);

    if (memberErr) {
      set({ loading: false, error: isNetworkError(memberErr) ? null : memberErr.message });
      return;
    }

    if (!memberRows?.length) {
      set({ jointHabits: [], loading: false });
      return;
    }

    const habitIds = memberRows.map((m: { joint_habit_id: string }) => m.joint_habit_id);
    const myStatusMap = new Map(memberRows.map((m: { joint_habit_id: string; status: string }) => [m.joint_habit_id, m.status]));

    // Fetch habit definitions
    const { data: habits, error: habitsErr } = await supabase
      .from('joint_habits')
      .select('*')
      .in('id', habitIds)
      .is('archived_at', null);

    if (habitsErr) { set({ loading: false }); return; }

    // Fetch all members for these habits + their profiles
    const { data: allMembers } = await supabase
      .from('joint_habit_members')
      .select('*, profiles(*)')
      .in('joint_habit_id', habitIds)
      .eq('status', 'accepted');

    // Fetch all completions for these habits
    const { data: allCompletions } = await supabase
      .from('joint_habit_completions')
      .select('*')
      .in('joint_habit_id', habitIds);

    // Group by habit
    const membersByHabit = new Map<string, typeof allMembers>();
    const completionsByHabit = new Map<string, JointHabitCompletion[]>();

    for (const m of allMembers ?? []) {
      if (!membersByHabit.has(m.joint_habit_id)) membersByHabit.set(m.joint_habit_id, []);
      membersByHabit.get(m.joint_habit_id)!.push(m);
    }
    for (const c of allCompletions ?? []) {
      if (!completionsByHabit.has(c.joint_habit_id)) completionsByHabit.set(c.joint_habit_id, []);
      completionsByHabit.get(c.joint_habit_id)!.push(c);
    }

    const today = todayStr();

    const habitsWithStats: JointHabitWithStats[] = (habits ?? []).map((habit) => {
      const members = membersByHabit.get(habit.id) ?? [];
      const completions = completionsByHabit.get(habit.id) ?? [];
      const memberCount = members.length;

      // Convert to plain HabitCompletion shape keyed per user for streak calc
      // For joint streaks: a day counts only when all members completed
      const jointCompleteDates = getJointCompleteDates(completions, memberCount);
      const fakeCompletions = jointCompleteDates.map((d) => ({
        id: d, habit_id: habit.id, user_id: '', completed_at: d, count: 1, note: null, created_at: '',
      }));

      const todayCompletionsForHabit = completions.filter((c) => c.completed_at === today);
      const myCompletion = todayCompletionsForHabit.find((c) => c.user_id === user.id);
      const allCompleted = memberCount > 0 && todayCompletionsForHabit.length >= memberCount;

      return {
        ...habit,
        members,
        current_streak: calculateCurrentStreak(fakeCompletions),
        longest_streak: calculateLongestStreak(fakeCompletions),
        completed_today: !!myCompletion,
        all_completed_today: allCompleted,
        my_status: (myStatusMap.get(habit.id) as JointHabitWithStats['my_status']) ?? 'invited',
      };
    });

    await setCached(SOCIAL_CACHE.jointHabits, habitsWithStats, TTL.MEDIUM);
    set({ jointHabits: habitsWithStats, loading: false });
  },

  createJointHabit: async (input) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Not authenticated';

    // Validate at least a name
    if (!input.name.trim()) return 'Name is required.';

    const { invite_user_ids, ...habitData } = input;

    const { data: habit, error: habitErr } = await supabase
      .from('joint_habits')
      .insert({ ...habitData, created_by: user.id })
      .select()
      .single();

    if (habitErr) return habitErr.message;

    // Add creator as accepted member
    const memberRows = [
      { joint_habit_id: habit.id, user_id: user.id, status: 'accepted', invited_by: user.id, joined_at: new Date().toISOString() },
      ...invite_user_ids.map((uid) => ({
        joint_habit_id: habit.id,
        user_id: uid,
        status: 'invited',
        invited_by: user.id,
        joined_at: null,
      })),
    ];

    const { error: memberErr } = await supabase.from('joint_habit_members').insert(memberRows);
    if (memberErr) return memberErr.message;

    await invalidateCache(SOCIAL_CACHE.jointHabits);
    await get().fetchJointHabits();
    return null;
  },

  respondToJointInvite: async (jointHabitId, status) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: Record<string, unknown> = { status };
    if (status === 'accepted') updates.joined_at = new Date().toISOString();

    await supabase
      .from('joint_habit_members')
      .update(updates)
      .eq('joint_habit_id', jointHabitId)
      .eq('user_id', user.id);

    await invalidateCache(SOCIAL_CACHE.jointHabits);
    await get().fetchJointHabits();
  },

  toggleJointCompletion: async (jointHabitId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const habit = get().jointHabits.find((h) => h.id === jointHabitId);
    if (!habit || habit.my_status !== 'accepted') return;

    const today = todayStr();
    const action = habit.completed_today ? 'remove' : 'add';

    // Optimistic update
    set((s) => ({
      jointHabits: s.jointHabits.map((h) =>
        h.id !== jointHabitId ? h : { ...h, completed_today: !h.completed_today }
      ),
    }));

    try {
      if (action === 'remove') {
        const { error } = await supabase
          .from('joint_habit_completions')
          .delete()
          .eq('joint_habit_id', jointHabitId)
          .eq('user_id', user.id)
          .eq('completed_at', today);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('joint_habit_completions').insert({
          joint_habit_id: jointHabitId,
          user_id: user.id,
          completed_at: today,
          count: 1,
        });
        if (error) throw error;
      }
      await invalidateCache(SOCIAL_CACHE.jointHabits);
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOperation('toggle_joint_completion', { jointHabitId, action, date: today, userId: user.id });
      } else {
        // Roll back optimistic update
        set((s) => ({
          jointHabits: s.jointHabits.map((h) =>
            h.id !== jointHabitId ? h : { ...h, completed_today: habit.completed_today }
          ),
        }));
      }
    }
  },

  archiveJointHabit: async (jointHabitId) => {
    await supabase
      .from('joint_habits')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', jointHabitId);

    await invalidateCache(SOCIAL_CACHE.jointHabits);
    set((s) => ({ jointHabits: s.jointHabits.filter((h) => h.id !== jointHabitId) }));
  },

  reset: () => set({ friends: [], jointHabits: [], loading: false, error: null }),
}));

// ============================================================
// Pure helper — finds dates where all members completed
// ============================================================

function getJointCompleteDates(
  completions: JointHabitCompletion[],
  memberCount: number
): string[] {
  if (!memberCount) return [];

  const byDate = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!byDate.has(c.completed_at)) byDate.set(c.completed_at, new Set());
    byDate.get(c.completed_at)!.add(c.user_id);
  }

  return [...byDate.entries()]
    .filter(([, users]) => users.size >= memberCount)
    .map(([date]) => date)
    .sort();
}
