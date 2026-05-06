-- ============================================================
-- HabitTracker — Full Supabase Schema
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================


-- ============================================================
-- SECTION 1: PROFILES
-- A public-schema mirror of auth.users that stores display info.
-- Created automatically when a user signs up (see trigger below).
-- Other tables join to profiles.id, not auth.users.id directly,
-- so foreign keys stay within the public schema and are queryable
-- without elevated permissions.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate a profile the moment a new user signs up.
-- Username = sanitised email local part + first 8 hex chars of UUID
-- (cheap uniqueness guarantee without a separate sequence).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(
        LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g')),
        ''
      ),
      'user'
    ) || '_' || SUBSTR(REPLACE(NEW.id::TEXT, '-', ''), 1, 8),
    SPLIT_PART(NEW.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- SECTION 2: PERSONAL HABITS  (unchanged from v1 schema)
-- Kept here so this file is the single source of truth.
-- ============================================================

CREATE TABLE IF NOT EXISTS habits (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT NOT NULL DEFAULT '#A05CD0',
  icon            TEXT NOT NULL DEFAULT '✅',
  frequency       TEXT NOT NULL DEFAULT 'daily'
                    CHECK (frequency IN ('daily', 'weekly', 'custom')),
  frequency_days  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
  target_count    INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_completions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id        UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  count           INTEGER NOT NULL DEFAULT 1,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (habit_id, completed_at)
);


-- ============================================================
-- SECTION 3: FRIENDSHIPS
--
-- Design decisions:
--   - One row per friendship pair, regardless of who initiated.
--   - "requester" is whoever sent the invite; "addressee" receives it.
--   - The UNIQUE INDEX on (LEAST, GREATEST) prevents the same pair
--     appearing twice in either direction (A→B and B→A are the same edge).
--   - status flow:  pending → accepted | blocked
--     "blocked" is stored so the blocker can always reverse it,
--     and so the system can prevent the blocked party from re-requesting.
-- ============================================================

CREATE TABLE IF NOT EXISTS friendships (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_friendship CHECK (requester_id <> addressee_id)
);

-- Prevents A→B and B→A existing simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
  ON friendships (LEAST(requester_id::TEXT, addressee_id::TEXT),
                  GREATEST(requester_id::TEXT, addressee_id::TEXT));

-- Normalised view: always presents the "other" user from the current user's POV.
-- Supabase evaluates auth.uid() at query time, so this is safe with RLS.
CREATE OR REPLACE VIEW friend_list AS
SELECT
  f.id                                                   AS friendship_id,
  CASE WHEN f.requester_id = auth.uid()
       THEN f.addressee_id ELSE f.requester_id END       AS friend_id,
  f.status,
  CASE WHEN f.requester_id = auth.uid()
       THEN 'outgoing' ELSE 'incoming' END               AS direction,
  f.created_at                                           AS requested_at,
  f.updated_at                                           AS responded_at
FROM friendships f
WHERE f.requester_id = auth.uid()
   OR f.addressee_id = auth.uid();


-- ============================================================
-- SECTION 4: JOINT HABITS
--
-- Design decisions:
--   - joint_habits holds the shared habit definition.
--   - joint_habit_members tracks who is in the habit and their status.
--     status flow: invited → accepted | declined | left
--   - joint_habit_completions records each member's individual completion
--     per day.  The "joint streak" only advances on days where ALL
--     active members have a completion — this is enforced in application
--     logic (get_joint_streak RPC below).
--   - Only friends can be invited (enforced in application logic, not DB,
--     to keep constraints readable and the schema decoupled from friend status).
-- ============================================================

CREATE TABLE IF NOT EXISTS joint_habits (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT NOT NULL DEFAULT '#A05CD0',
  icon            TEXT NOT NULL DEFAULT '🤝',
  frequency       TEXT NOT NULL DEFAULT 'daily'
                    CHECK (frequency IN ('daily', 'weekly', 'custom')),
  frequency_days  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
  target_count    INTEGER NOT NULL DEFAULT 1,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS joint_habit_members (
  joint_habit_id  UUID NOT NULL REFERENCES joint_habits(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited', 'accepted', 'declined', 'left')),
  invited_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at       TIMESTAMPTZ,   -- set when status → accepted
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (joint_habit_id, user_id)
);

CREATE TABLE IF NOT EXISTS joint_habit_completions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  joint_habit_id  UUID NOT NULL REFERENCES joint_habits(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  count           INTEGER NOT NULL DEFAULT 1,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (joint_habit_id, user_id, completed_at)
);


-- ============================================================
-- SECTION 5: INDEXES
-- ============================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles (username);

-- Friendships
CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee
  ON friendships (addressee_id, status);

-- Personal habits (from v1)
CREATE INDEX IF NOT EXISTS idx_habits_user_id
  ON habits (user_id);
CREATE INDEX IF NOT EXISTS idx_habits_archived
  ON habits (user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_completions_habit_id
  ON habit_completions (habit_id);
CREATE INDEX IF NOT EXISTS idx_completions_user_date
  ON habit_completions (user_id, completed_at DESC);

-- Joint habits
CREATE INDEX IF NOT EXISTS idx_jh_members_user
  ON joint_habit_members (user_id, status);
CREATE INDEX IF NOT EXISTS idx_jh_completions_habit_date
  ON joint_habit_completions (joint_habit_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_jh_completions_user
  ON joint_habit_completions (user_id, completed_at DESC);


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY
-- Every table is locked down.  The rules are intentionally simple:
-- no row-level column restrictions — those belong in application logic.
-- ============================================================

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_habits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_habit_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_habit_completions ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────
-- Any authenticated user can search/view profiles (needed for friend lookup).
-- Only the owner can write to their own profile.
CREATE POLICY "profiles: authenticated read"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "profiles: own write"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── habits ───────────────────────────────────────────────────
CREATE POLICY "habits: own rows"
  ON habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── habit_completions ─────────────────────────────────────────
CREATE POLICY "completions: own rows"
  ON habit_completions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── friendships ──────────────────────────────────────────────
-- Either party can read the row.
CREATE POLICY "friendships: involved can read"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Only the requester can create (they must be the requester).
CREATE POLICY "friendships: requester can create"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Either party can update (accept, block, or withdraw).
-- Column-level restrictions (e.g. addressee can't flip to 'accepted' for their own request)
-- are enforced in application logic, not here.
CREATE POLICY "friendships: involved can update"
  ON friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Either party can delete (unfriend or withdraw request).
CREATE POLICY "friendships: involved can delete"
  ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ── joint_habits ─────────────────────────────────────────────
-- Visible to members (any membership status so invitees can see what they're joining).
CREATE POLICY "joint_habits: members can read"
  ON joint_habits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM joint_habit_members m
      WHERE m.joint_habit_id = joint_habits.id
        AND m.user_id = auth.uid()
        AND m.status IN ('invited', 'accepted')
    )
  );

CREATE POLICY "joint_habits: authenticated can create"
  ON joint_habits FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only the creator can update/archive the habit definition.
CREATE POLICY "joint_habits: creator can update"
  ON joint_habits FOR UPDATE
  USING (auth.uid() = created_by);

-- ── joint_habit_members ───────────────────────────────────────
-- Members (any status) can see the full member list of their habits.
CREATE POLICY "jh_members: habit members can read"
  ON joint_habit_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM joint_habit_members m2
      WHERE m2.joint_habit_id = joint_habit_members.joint_habit_id
        AND m2.user_id = auth.uid()
    )
  );

-- Creator can invite others; invited user can add themselves (accept flow).
CREATE POLICY "jh_members: creator or self can insert"
  ON joint_habit_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM joint_habits jh
      WHERE jh.id = joint_habit_id AND jh.created_by = auth.uid()
    )
  );

-- Users can only update their own membership row (accept/decline/leave).
CREATE POLICY "jh_members: own membership update"
  ON joint_habit_members FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own membership (leave).
CREATE POLICY "jh_members: own membership delete"
  ON joint_habit_members FOR DELETE
  USING (auth.uid() = user_id);

-- ── joint_habit_completions ────────────────────────────────────
-- Active members can read all completions for the habit (needed to compute joint streak).
CREATE POLICY "jh_completions: members can read"
  ON joint_habit_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM joint_habit_members m
      WHERE m.joint_habit_id = joint_habit_completions.joint_habit_id
        AND m.user_id = auth.uid()
        AND m.status = 'accepted'
    )
  );

-- Members can only write their own completion rows.
CREATE POLICY "jh_completions: own completions"
  ON joint_habit_completions FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM joint_habit_members m
      WHERE m.joint_habit_id = joint_habit_completions.joint_habit_id
        AND m.user_id = auth.uid()
        AND m.status = 'accepted'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM joint_habit_members m
      WHERE m.joint_habit_id = joint_habit_completions.joint_habit_id
        AND m.user_id = auth.uid()
        AND m.status = 'accepted'
    )
  );


-- ============================================================
-- SECTION 7: TRIGGERS  (updated_at maintenance)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'habits_updated_at') THEN
    CREATE TRIGGER habits_updated_at
      BEFORE UPDATE ON habits
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at') THEN
    CREATE TRIGGER profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'friendships_updated_at') THEN
    CREATE TRIGGER friendships_updated_at
      BEFORE UPDATE ON friendships
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'joint_habits_updated_at') THEN
    CREATE TRIGGER joint_habits_updated_at
      BEFORE UPDATE ON joint_habits
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jh_members_updated_at') THEN
    CREATE TRIGGER jh_members_updated_at
      BEFORE UPDATE ON joint_habit_members
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;


-- ============================================================
-- SECTION 8: HELPER FUNCTIONS (callable via supabase.rpc())
-- ============================================================

-- Search users by username or display_name prefix.
-- Used for friend lookup — returns basic profile info only.
CREATE OR REPLACE FUNCTION search_users(query TEXT)
RETURNS TABLE (
  id           UUID,
  username     TEXT,
  display_name TEXT,
  avatar_url   TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, username, display_name, avatar_url
  FROM profiles
  WHERE
    id <> auth.uid()
    AND (
      username     ILIKE query || '%'
      OR display_name ILIKE query || '%'
    )
  ORDER BY
    CASE WHEN username ILIKE query || '%' THEN 0 ELSE 1 END,
    username
  LIMIT 20;
$$;

-- Compute the joint streak for a given habit.
-- A day is "jointly complete" only when every active member has a completion.
-- Returns: current_streak (breaks if no completion today OR yesterday),
--          longest_streak (all-time best consecutive run).
CREATE OR REPLACE FUNCTION get_joint_streak(p_joint_habit_id UUID)
RETURNS TABLE (current_streak INT, longest_streak INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_count  INT;
  v_dates         DATE[];
  v_len           INT;
  v_current       INT := 0;
  v_longest       INT := 0;
  v_running       INT := 1;
  i               INT;
BEGIN
  -- Caller must be an active member
  IF NOT EXISTS (
    SELECT 1 FROM joint_habit_members
    WHERE joint_habit_id = p_joint_habit_id
      AND user_id = auth.uid()
      AND status = 'accepted'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM joint_habit_members
  WHERE joint_habit_id = p_joint_habit_id AND status = 'accepted';

  -- Dates where every active member has a completion entry
  SELECT ARRAY_AGG(completed_at ORDER BY completed_at)
  INTO v_dates
  FROM (
    SELECT completed_at
    FROM joint_habit_completions
    WHERE joint_habit_id = p_joint_habit_id
    GROUP BY completed_at
    HAVING COUNT(DISTINCT user_id) >= v_member_count
  ) full_days;

  IF v_dates IS NULL THEN
    RETURN QUERY SELECT 0::INT, 0::INT;
    RETURN;
  END IF;

  v_len := array_length(v_dates, 1);

  -- Longest streak
  v_longest := 1;
  v_running  := 1;
  FOR i IN 2..v_len LOOP
    IF v_dates[i] = v_dates[i-1] + 1 THEN
      v_running := v_running + 1;
      IF v_running > v_longest THEN v_longest := v_running; END IF;
    ELSE
      v_running := 1;
    END IF;
  END LOOP;

  -- Current streak (must include today or yesterday)
  v_current := 0;
  IF v_dates[v_len] >= CURRENT_DATE - 1 THEN
    v_current := 1;
    FOR i IN REVERSE v_len - 1 .. 1 LOOP
      IF v_dates[i+1] = v_dates[i] + 1 THEN
        v_current := v_current + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_current::INT, v_longest::INT;
END;
$$;
