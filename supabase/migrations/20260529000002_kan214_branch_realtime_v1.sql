-- KAN-214 Branch Realtime publication v1 — Migration 3 of 3
--
-- Adds public.branches + public.branch_members to the supabase_realtime
-- publication so the FE Ministries sub-tab can subscribe to consent
-- state changes (a leader's 'joined' bumps the InviteCard to a forming/
-- active row) and branch lifecycle transitions in real time.
--
-- public.messages was added to supabase_realtime by KAN-71
-- (kan71_messages_realtime_publication_v1) — branch messages ride that
-- existing publication. No second ADD here would be ignored anyway
-- (the table is already in the publication) but worth noting that
-- branch message broadcast is already wired by virtue of the
-- send-branch-message edge function writing into public.messages.
--
-- Verification queries are at the bottom of the file as comments — run
-- them after apply and capture the output in the SEC stamp comment on
-- KAN-214 alongside the constraint + column readbacks.

BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.branch_members;

COMMIT;

-- ─── Post-apply verification (run separately; capture for SEC stamp) ───
-- SELECT tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
--   AND tablename IN ('branches', 'branch_members', 'messages')
-- ORDER BY tablename;
-- Expected: 3 rows — branch_members, branches, messages.
