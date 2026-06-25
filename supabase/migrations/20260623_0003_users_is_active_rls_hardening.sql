-- 20260623_0003_users_is_active_rls_hardening.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 3 of 8
--
-- Locked Founder ruling (2026-06-22, Q1 — DBA F1 blocking):
--   Every WRITE policy + write-RPC must guard `is_active = true` (or
--   equivalently `soft_deleted_at IS NULL`) so soft-deleted leaders can READ
--   their own state but cannot WRITE. SELECT policies stay OPEN — leader
--   needs to render gated-shell Home.
--
-- Strategy: where a WRITE policy already exists, drop+recreate with the new
-- predicate. Where the table is RPC-mediated (no WRITE policy today), add
-- a defense-in-depth blocking policy so any future direct write path also
-- enforces the invariant. RPC-side hardening still happens in 0006/0008.
--
-- Tables targeted (manifest §1):
--   users (UPDATE own), prayer_requests (INSERT), comments (INSERT — RPC-only),
--   connection_requests (INSERT — RPC-only), intercession_holds (INSERT — RPC-only),
--   heartcries (INSERT), heartcry_holds (INSERT), messages (INSERT).
--
-- Note: `testimonies` table does not exist (verified via to_regclass) — no
-- action required for that target. If/when it lands, fold the predicate in.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- users.users_update_own — add is_active=true predicate
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (
    auth.uid() = auth_id
    AND is_active = true
    AND soft_deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = auth_id
    AND is_active = true
    AND soft_deleted_at IS NULL
  );

-- ----------------------------------------------------------------------------
-- prayer_requests.prayer_requests_insert — add is_active=true predicate
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prayer_requests_insert ON public.prayer_requests;
CREATE POLICY prayer_requests_insert ON public.prayer_requests
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- heartcries.heartcry_insert — add is_active=true to the user check
-- (church_id arm already checks verification_status; we add is_active there too)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS heartcry_insert ON public.heartcries;
CREATE POLICY heartcry_insert ON public.heartcries
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
    )
    AND church_id IN (
      SELECT u.church_id FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
        AND u.verification_status = 'verified'::verification_status_enum
    )
  );

-- ----------------------------------------------------------------------------
-- heartcry_holds.verified_insert_own_holds — add is_active=true predicate
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS verified_insert_own_holds ON public.heartcry_holds;
CREATE POLICY verified_insert_own_holds ON public.heartcry_holds
  FOR INSERT
  WITH CHECK (
    user_id = (
      SELECT u.id FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
        AND u.verification_status = 'verified'::verification_status_enum
    )
  );

-- ----------------------------------------------------------------------------
-- messages.messages_insert — add is_active=true predicate
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id IN (
      SELECT u.id FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- comments — RPC-mediated today (no INSERT policy). Add a defense-in-depth
-- INSERT policy that BLOCKS soft-deleted users from any future direct path.
-- The post_comment RPC must still enforce is_active in its body (handled by
-- 0006 RPC hardening pass during BE follow-on).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comments_block_soft_deleted_insert ON public.comments;
CREATE POLICY comments_block_soft_deleted_insert ON public.comments
  FOR INSERT
  WITH CHECK (
    author_id IN (
      SELECT u.id FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- connection_requests — RPC-mediated today. Defense-in-depth INSERT policy.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS connection_requests_block_soft_deleted_insert ON public.connection_requests;
CREATE POLICY connection_requests_block_soft_deleted_insert ON public.connection_requests
  FOR INSERT
  WITH CHECK (
    sender_id IN (
      SELECT u.id FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- intercession_holds — keeps the existing `no_direct_insert` policy
-- (with_check=false) so direct insert remains impossible; RPCs must enforce
-- is_active. Nothing to alter at the policy layer.
-- ----------------------------------------------------------------------------
