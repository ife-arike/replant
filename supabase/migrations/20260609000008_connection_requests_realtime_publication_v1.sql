-- 20260609000008_connection_requests_realtime_publication_v1.sql
--
-- Connect tab — publish public.connection_requests to supabase_realtime.
--
-- Why: LeadersList subscribes to connection_requests changes so the PENDING
-- row appears immediately on the sender side (INSERT) and clears on the
-- recipient side (UPDATE: accept/decline) without a tab switch. Without
-- membership in the supabase_realtime publication the subscription wires up
-- but never receives events (the silent-no-events failure mode documented in
-- LeadersList's messages-subscription comment).
--
-- Safety: connection_requests has RLS enabled with sender/recipient SELECT
-- policies (connection_requests_sender_select / _recipient_select). Realtime
-- enforces RLS on broadcast, so each leader only receives change events for
-- rows they can already read — no cross-leader social-graph leakage.
--
-- Idempotent: guarded so a re-run (or a fresh DB rebuild where the table was
-- added to the publication elsewhere) does not error on duplicate membership.
--
-- Covering prayer offered before authoring. Replant is a secure communication
-- platform for Christian leaders globally; let this keep the consent layer
-- responsive without ever revealing one leader's requests to another.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'connection_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_requests;
  END IF;
END $$;
