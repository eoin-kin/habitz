-- ============================================================
-- TEST USER SEED FILE
-- For local development and testing
-- 
-- This file provides instructions and SQL for creating a test user
-- in Supabase for the Habit Tracker app.
-- ============================================================


-- ============================================================
-- METHOD 1: CREATE TEST USER VIA SUPABASE DASHBOARD (RECOMMENDED)
-- ============================================================

-- 1. Go to Supabase Dashboard
-- 2. Navigate to: Authentication → Users
-- 3. Click "Add user"
-- 4. Fill in:
--    Email: user@admin.com
--    Password: DevUserPass123
--    Auto confirm user: YES (check this)
-- 5. Click "Create user"

-- The profile will be auto-created by the trigger.


-- ============================================================
-- METHOD 2: MANUAL PROFILE CREATION (If using CLI)
-- ============================================================

-- If you created the auth user via Supabase CLI, the profile
-- trigger should auto-generate. Verify it exists:

SELECT * FROM profiles WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@admin.com'
);

-- If no profile exists, manually create it:
-- (Replace UUID with actual user ID from auth.users)

INSERT INTO profiles (id, username, display_name)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'user@admin.com'),
  'admin_dev',
  'Dev Admin User'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST USER CREDENTIALS
-- ============================================================

-- Email:    user@admin.com
-- Password: DevUserPass123
-- Username: admin_dev
-- Use these in the login screen


-- ============================================================
-- POST-CREATION VERIFICATION
-- ============================================================

-- Run this to verify the test user is set up correctly:

SELECT 
  au.id,
  au.email,
  au.created_at,
  p.username,
  p.display_name
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'user@admin.com';


-- ============================================================
-- CLEANUP (If needed)
-- ============================================================

-- To delete the test user (this cascades to profiles):

DELETE FROM auth.users WHERE email = 'user@admin.com';
