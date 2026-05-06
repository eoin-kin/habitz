// ============================================================
// Personal habits
// ============================================================

export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  frequency: HabitFrequency;
  frequency_days: number[]; // 1=Mon … 7=Sun
  target_count: number;
  created_at: string;
  archived_at: string | null;
  updated_at: string;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string; // YYYY-MM-DD
  count: number;
  note: string | null;
  created_at: string;
};

export type HabitStreak = {
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  last_completed_at: string | null;
};

export type HabitWithStats = Habit & {
  current_streak: number;
  longest_streak: number;
  completed_today: boolean;
  last_completed_at: string | null;
};

export type CreateHabitInput = {
  name: string;
  description?: string;
  color: string;
  icon: string;
  frequency: HabitFrequency;
  frequency_days: number[];
  target_count: number;
};

// ============================================================
// Profiles
// ============================================================

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = {
  username?: string;
  display_name?: string;
  avatar_url?: string;
};

// ============================================================
// Friendships
// ============================================================

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type FriendshipDirection = 'incoming' | 'outgoing';

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

/** What the friend_list view returns — always from the current user's POV. */
export type FriendListEntry = {
  friendship_id: string;
  friend_id: string;
  status: FriendshipStatus;
  direction: FriendshipDirection;
  requested_at: string;
  responded_at: string;
};

/** friend_list entry enriched with the friend's profile data. */
export type FriendWithProfile = FriendListEntry & {
  profile: Profile;
};

// ============================================================
// Joint habits
// ============================================================

export type MemberStatus = 'invited' | 'accepted' | 'declined' | 'left';

export type JointHabit = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  frequency: HabitFrequency;
  frequency_days: number[];
  target_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type JointHabitMember = {
  joint_habit_id: string;
  user_id: string;
  status: MemberStatus;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JointHabitCompletion = {
  id: string;
  joint_habit_id: string;
  user_id: string;
  completed_at: string; // YYYY-MM-DD
  count: number;
  note: string | null;
  created_at: string;
};

/** A joint habit enriched with member profiles, completions, and streak data. */
export type JointHabitWithStats = JointHabit & {
  members: (JointHabitMember & { profile: Profile })[];
  current_streak: number;
  longest_streak: number;
  completed_today: boolean;       // current user has a completion today
  all_completed_today: boolean;   // ALL active members have completed today
  my_status: MemberStatus;
};

export type CreateJointHabitInput = {
  name: string;
  description?: string;
  color: string;
  icon: string;
  frequency: HabitFrequency;
  frequency_days: number[];
  target_count: number;
  invite_user_ids: string[];      // friend profile IDs to invite immediately
};
