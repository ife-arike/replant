-- ============================================================================
-- Replant — Test Data Cleanup
-- Target project: jiyetphxxvyiicrnwlnx
-- Generated: 2026-06-10
-- ============================================================================
--
-- DO NOT execute without explicit Founder review + sign-off.
-- The plan: hard-delete all non-Founder user/church data while preserving
-- the 10 Founder accounts (Ruth + Account B + zife + Replant Team + t1-t5) and
-- the 6 Founder churches. audit_log is append-only and is NEVER touched.
--
-- Pre-cleanup live counts (2026-06-10):
--   public.users         = 161  → expected after: 10
--   public.churches      =  91  → expected after:  6
--   public.audit_log     = 1104 → expected after: 1104 (UNCHANGED)
--   public.announcements =  14  → expected after:  5  (9 smoke rows deleted)
--   public.daily_scripture = 24 → expected after: 16  (8 test rows deleted)
--   auth.users           = 162  → expected after: 9 (Replant Team system user has synthetic auth_id with no auth.users row — verified live)
--
-- Wrap in BEGIN/COMMIT with savepoints. ROLLBACK on any count drift.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) KEEP set as temp tables (referenced throughout)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE keep_users (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO keep_users(id) VALUES
  ('bb6c6385-236a-402a-9a6c-66ca3468fdf5'),  -- Ruth James / ruth@projectreplant.org
  ('19bf5467-8972-4532-b510-75b1c6b68537'),  -- UAT Tester / accounts@projectreplant.org
  ('b8f4657c-5c95-4cb2-aa10-061d4c2bf63e'),  -- Ruth James / ruthjames08@gmail.com (Account B)
  ('de16af6e-c7c8-46b2-8f04-ab9ead816e09'),  -- Ifeoluwa James / zife2027@gmail.com
  ('028be745-8014-4314-a7cf-36b0a4d52b46'),  -- Replant Team (KAN-217 system user)
  ('71f6d51e-bd78-422e-8205-a9ea767b2edd'),  -- Ifeoluwa Arike / ruthjames08+t1@gmail.com
  ('f00725cd-ee88-4067-9d40-2a6d75f456b0'),  -- Oluwapemi James / ruthjames08+t2@gmail.com
  ('48207f0b-5312-4bfc-8a90-3700e9e46432'),  -- Ruth James / ruthjames08+t3@gmail.com
  ('b20adbb9-537e-4d1f-8f80-2ebfadd66fbf'),  -- Ruthie Jamie / ruthjames08+t4@gmail.com
  ('2e28389e-6691-4620-bf69-46fccefbf49c');  -- Ifeoluwa Jamesarike / ruthjames08+t5@gmail.com

CREATE TEMP TABLE keep_churches (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO keep_churches(id) VALUES
  ('e54903a3-b013-4399-8ff3-786c61091636'),  -- Maranatha Ministries
  ('236719c3-43af-4057-a012-c49f81aecabe'),  -- What A God Ministries
  ('5bd02ea2-648e-4e57-8f8c-2ad62c146c82'),  -- Blessings Abound Church
  ('f5616b9e-d4e7-43ed-b883-343eb090e808'),  -- He's Able Embassy
  ('ecc033c7-0c7f-413b-b94d-0cc7385b3349'),  -- We Are One Ministries
  ('2cc9cb85-d6a7-4ad2-8903-1fdb0de11813');  -- Regent Kingdom Church

-- ----------------------------------------------------------------------------
-- 1) Delete test rows from announcements (9 smoke-test rows)
--    All 14 announcements are authored by Founder Account A — no FK issue.
--    Only the obvious smoke rows are removed; the 5 real Replant Team posts stay.
-- ----------------------------------------------------------------------------
SAVEPOINT sp_announcements;

DELETE FROM public.announcements WHERE id IN (
  'f1288d9d-7295-49a3-b8d1-332f6ec403db',  -- "fsgrg" / grgsrg
  'a40fd4d0-e941-4907-bb85-266c34dae3da',  -- "klhgjhhjgchc"
  'aa4a883f-3dad-4da7-9338-7874c1b33a12',  -- "Test" / Test on mobile
  'f89f9159-b2fa-4853-aa42-ed5b13847e15',  -- "Test on tablet"
  '509e77de-c8ed-4c9f-9580-203a53032ab3',  -- "Na na na na na nana"
  '9c168861-332f-4f91-a921-e768fd65243e',  -- "Woot Wooooot"
  'b2178311-d35a-4a0b-873c-8ca3f5e5e237',  -- "Hello World!" / Love you all. -Replant Team (Founder confirmed delete 2026-06-10)
  '04d812ad-65d7-415b-843d-6b1a29d415ea',  -- "Test announcement with tag"
  '97d719ed-bf89-442d-9ee3-6a7a041353bb'   -- "Test Announcement"
);
-- Expected delete: 9. After: 5 announcements remain.

-- ----------------------------------------------------------------------------
-- 2) Delete test rows from daily_scripture (8 test rows)
--    All 24 have created_by_admin_id = NULL — no FK issue.
--    The 16 real KJV/NIV/NKJV rows stay; only test/dummy + [TEST]-prefixed seed rows go.
-- ----------------------------------------------------------------------------
SAVEPOINT sp_daily_scripture;

DELETE FROM public.daily_scripture WHERE id IN (
  '2cc225f6-bec8-4209-a41f-2344a81aed0f',  -- "test duplicate"
  'cfaeea58-7260-4ac1-9a22-d25060d92c17',  -- "ABC's 1:23" / Test
  'c2a1926a-889a-4c02-9dc4-c301299b9898',  -- "Genesis 12:21" / Testing this verse
  '7071217e-67fc-4e38-a57b-7b430d51fe6e',  -- "Colossians 3:5" / testing testing
  '9d00abdc-c914-4734-9a85-0b07f51ee542',  -- "Ephesians 5:14" / I want to know the Lord (dummy)
  '9c457599-2d88-4278-9669-41ee4cf63e5d',  -- [TEST] John 3:16 (scripture_date 2099-01-01)
  '451f465d-f799-4f56-90cb-5d0167d274e5',  -- [TEST] Romans 8:28 (scripture_date 2099-01-02)
  'ac9ad5df-942a-45ea-a630-f9484961ca0b'   -- [TEST] Philippians 4:13 (scripture_date 2099-01-03)
);
-- Expected delete: 8. After: 16 daily_scripture rows remain.

-- ----------------------------------------------------------------------------
-- 3) Hard-delete leaf content (order matters to avoid NO ACTION FK rejects)
--    moderation_state, comments, testimony, prayer_request_prayed_by, intercession_holds,
--    heartcry_holds, testimony_celebrated_by all attach to either messages or content
--    rows that are themselves being deleted. Order chosen to preserve dependencies.
-- ----------------------------------------------------------------------------
SAVEPOINT sp_leaf_content;

-- 3a) moderation_state — all 16 rows attach to delete-bound messages (verified)
DELETE FROM public.moderation_state ms USING public.messages m
WHERE ms.message_id = m.id
  AND m.sender_id NOT IN (SELECT id FROM keep_users)
  AND (m.receiver_id IS NULL OR m.receiver_id NOT IN (SELECT id FROM keep_users));

-- 3b) prayer_request_prayed_by (cascade-safe, do explicit first)
DELETE FROM public.prayer_request_prayed_by
WHERE leader_id NOT IN (SELECT id FROM keep_users)
   OR prayer_request_id IN (SELECT id FROM public.prayer_requests WHERE user_id NOT IN (SELECT id FROM keep_users));

-- 3c) testimony_celebrated_by (currently empty — defensive)
DELETE FROM public.testimony_celebrated_by
WHERE leader_id NOT IN (SELECT id FROM keep_users);

-- 3d) intercession_holds (CASCADEs on user/church delete; do explicit first)
DELETE FROM public.intercession_holds
WHERE leader_id NOT IN (SELECT id FROM keep_users)
   OR church_id NOT IN (SELECT id FROM keep_churches);

-- 3e) heartcry_holds (CASCADEs; do explicit first)
DELETE FROM public.heartcry_holds
WHERE user_id NOT IN (SELECT id FROM keep_users);

-- 3f) comments — 0 KEEP, 4 delete (all are non-Founder)
DELETE FROM public.comments WHERE author_id NOT IN (SELECT id FROM keep_users);

-- 3g) testimony — 0 KEEP, 6 delete (all are non-Founder)
DELETE FROM public.testimony WHERE user_id NOT IN (SELECT id FROM keep_users);

-- 3h) prayer_requests — 1 KEEP, 32 delete
DELETE FROM public.prayer_requests WHERE user_id NOT IN (SELECT id FROM keep_users);

-- 3i) heartcries — 4 KEEP, 20 delete
DELETE FROM public.heartcries WHERE user_id NOT IN (SELECT id FROM keep_users);

-- 3j) messages — 107 KEEP-involved kept; 180 delete (no KEEP sender AND no KEEP receiver)
DELETE FROM public.messages
WHERE sender_id NOT IN (SELECT id FROM keep_users)
  AND (receiver_id IS NULL OR receiver_id NOT IN (SELECT id FROM keep_users));

-- 3k) conversations — 18 KEEP-involved kept; 30 delete
DELETE FROM public.conversations
WHERE participant_a NOT IN (SELECT id FROM keep_users)
  AND participant_b NOT IN (SELECT id FROM keep_users);

-- 3l) connection_requests — all 4 involve a Founder, none delete. Defensive query.
DELETE FROM public.connection_requests
WHERE sender_id NOT IN (SELECT id FROM keep_users)
  AND recipient_id NOT IN (SELECT id FROM keep_users);

-- 3m) branch_members + branches — all currently KEEP. Defensive query.
DELETE FROM public.branch_members
WHERE user_id NOT IN (SELECT id FROM keep_users)
   OR branch_id IN (SELECT id FROM public.branches WHERE created_by NOT IN (SELECT id FROM keep_users));

DELETE FROM public.branches WHERE created_by NOT IN (SELECT id FROM keep_users);

-- 3n) email_log — all currently KEEP. Defensive query.
DELETE FROM public.email_log WHERE user_id NOT IN (SELECT id FROM keep_users);

-- ----------------------------------------------------------------------------
-- 4) Hard-delete non-Founder users (151 rows)
-- ----------------------------------------------------------------------------
SAVEPOINT sp_users;
DELETE FROM public.users WHERE id NOT IN (SELECT id FROM keep_users);

-- ----------------------------------------------------------------------------
-- 5) Hard-delete non-Founder churches (85 rows)
-- ----------------------------------------------------------------------------
SAVEPOINT sp_churches;
DELETE FROM public.churches WHERE id NOT IN (SELECT id FROM keep_churches);

-- ----------------------------------------------------------------------------
-- 6) Hard-delete non-Founder auth.users (~152 rows)
-- ----------------------------------------------------------------------------
SAVEPOINT sp_auth_users;

DELETE FROM auth.users
WHERE id NOT IN (
  SELECT auth_id FROM public.users WHERE auth_id IS NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7) Orphan sweep (per Founder ruling — no leftovers)
-- ----------------------------------------------------------------------------
SAVEPOINT sp_orphan_sweep;

-- Any KEEP user pointing at a non-existent church? Should be zero.
DO $$
DECLARE orphan_user_cnt int;
DECLARE orphan_church_cnt int;
BEGIN
  SELECT COUNT(*) INTO orphan_user_cnt
  FROM public.users
  WHERE church_id IS NOT NULL
    AND church_id NOT IN (SELECT id FROM public.churches);

  SELECT COUNT(*) INTO orphan_church_cnt
  FROM public.churches
  WHERE id NOT IN (SELECT church_id FROM public.users WHERE church_id IS NOT NULL);

  RAISE NOTICE 'Orphan users (church_id pointing nowhere): %', orphan_user_cnt;
  RAISE NOTICE 'Orphan churches (no remaining leader): %', orphan_church_cnt;

  IF orphan_user_cnt > 0 OR orphan_church_cnt > 0 THEN
    RAISE EXCEPTION 'Orphan sweep found rows — investigate before commit';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8) Final count check — fail loudly if anything drifted
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_users        int := (SELECT COUNT(*) FROM public.users);
  v_churches     int := (SELECT COUNT(*) FROM public.churches);
  v_audit        int := (SELECT COUNT(*) FROM public.audit_log);
  v_announce     int := (SELECT COUNT(*) FROM public.announcements);
  v_scripture    int := (SELECT COUNT(*) FROM public.daily_scripture);
  v_auth         int := (SELECT COUNT(*) FROM auth.users);
BEGIN
  RAISE NOTICE 'public.users           = % (expected 10)', v_users;
  RAISE NOTICE 'public.churches        = % (expected 6)', v_churches;
  RAISE NOTICE 'public.audit_log       = % (expected 1104 — UNCHANGED)', v_audit;
  RAISE NOTICE 'public.announcements   = % (expected 5)', v_announce;
  RAISE NOTICE 'public.daily_scripture = % (expected 16)', v_scripture;
  RAISE NOTICE 'auth.users             = % (expected 9 — Replant Team has no auth.users row)', v_auth;

  IF v_users <> 10 OR v_churches <> 6 OR v_audit <> 1104
     OR v_announce <> 5 OR v_scripture <> 16 OR v_auth <> 9
  THEN
    RAISE EXCEPTION 'Count check failed — rolling back';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Founder approved 2026-06-10 — committing to prod
-- ----------------------------------------------------------------------------
COMMIT;
-- ROLLBACK;
