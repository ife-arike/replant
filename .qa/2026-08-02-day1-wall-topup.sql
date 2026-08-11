-- ═══════════════════════════════════════════════════════════════════
-- Day-1 wall TOP-UP (Founder GO 2026-08-02) — 5 new posts + 11 comments.
--
-- Why: the 2026-07-28 reseed staggered published_at back to 07-21; by
-- 08-02 the leader-voice registers (leader_word ×2, encouragement,
-- together, call_to_action) had aged out of the 7-day feed window.
-- Founder ruled: do NOT re-pin the old rows ("i'd rather a few new
-- ones"); seed fresh posts instead. Aged rows stay as archive
-- provenance. 7-day window CONFIRMED single/global same message.
--
-- Registers restored on camera:
--   P13 leader_word NAMED  · verse PULL (text+ref) · source_initial 'D'
--        · 7-comment thread (fold: 5 shown + "show 2 earlier")
--   P14 leader_word MASKED · sealed (initial NULL)   · 1 comment
--   P15 encouragement      · ref-only verse · no thread (pastoral rule)
--   P16 together · NEW     · 3 comments
--   P17 call_to_action+link· 0 comments = the live empty-state fixture
--        (successor to aged P10; same August week-of-prayer arc, day 2)
--
-- Conventions mirrored from .qa/2026-07-28-day1-wall-reseed.sql:
--   source_label varchar(30); leader-voice author 028be745 / 'leader';
--   pull-quote refs carry '· KJV', ref-only anchors do not;
--   source_initial = leader NAME initial, server-side value (SEC F1:
--   NULL = sealed); comments.is_masked GENERATED (omitted); masking
--   snapshots at-write only, display stays server-composed.
--
-- comment_count is trigger-maintained — posts inserted without counts.
--
-- CLEANUP (whole demo wall incl. 07-28 set):
--   DELETE FROM comments WHERE announcement_id::text LIKE 'da1000%';
--   DELETE FROM announcements WHERE id::text LIKE 'da1000%';
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO public.announcements
  (id, title, body, author_id, author_type, topic, badge, card_type,
   source_label, source_sublabel, link_url, verse_text, verse_reference,
   published_at, is_active)
VALUES
-- NOTE (as-run delta): source_initial is not in this column list (list
-- mirrors the 07-28 register, which predates the column) — P13's 'D'
-- was stamped by the follow-up UPDATE at the bottom of this file.
-- P13 · leader_word · named + verse pull + initial · 7 comments · ~8h
('da100013-0802-4da1-8001-202608020013',
 'Keep sowing in the dry season',
 'Our second year we buried more than we planted, and I nearly resigned in the rainy month. An elder twice my age told me the field is not finished with you, it is just not harvest yet. We kept sowing: the visits, the bread, the prayers nobody saw. This year I baptized the man who once chased us off his land. Do not read the season as the verdict.',
 '028be745-8014-4314-a7cf-36b0a4d52b46', 'leader', 'word_for_today', 'none', 'leader_word',
 'Pastor Daniel Mensah', 'Lighthouse Chapel, Accra', NULL,
 'Let us not be weary in well doing: for in due season we shall reap, if we faint not.',
 'Galatians 6:9 · KJV',
 now() - interval '8 hours', true),

-- P14 · leader_word · masked byline · ~1d4h
('da100014-0802-4da1-8001-202608020014',
 'The bread still multiplies',
 'Rice ran out on the second week of the floods. We shared what was left and kept the evening prayer. Every day since, someone has come to the door with a little: a neighbor, a stranger, once a man we had never seen who left a sack and would not give his name. The Lord still sets tables in the wilderness. If your stores are low this week, hold the evening prayer anyway.',
 '028be745-8014-4314-a7cf-36b0a4d52b46', 'leader', 'word_for_today', 'none', 'leader_word',
 'From an elder · Southeast Asia', NULL, NULL, NULL, NULL,
 now() - interval '28 hours', true),

-- P15 · encouragement · ref-only anchor · no thread by pastoral rule · ~2d
('da100015-0802-4da1-8001-202608020015',
 'The Shepherd does not lose count of the flock in the dark.',
 'The Shepherd does not lose count of the flock in the dark.',
 '028be745-8014-4314-a7cf-36b0a4d52b46', 'leader', 'word_for_today', 'none', 'encouragement',
 'From a deacon · Horn of Africa', NULL, NULL, NULL, 'John 10:28',
 now() - interval '47 hours', true),

-- P16 · together · NEW · 3 comments · ~2d12h
('da100016-0802-4da1-8001-202608020016',
 'Two churches, one harvest truck',
 'A congregation on the coast had a truck and no harvest. A fellowship inland had a harvest and no truck. A leader here connected them over one phone call, and last week the truck came back with grain for both storehouses and a third church neither had met. If your church has surplus standing idle, tell us. Someone inland is praying for exactly that.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'update', 'new', 'together',
 NULL, NULL, NULL, NULL, NULL,
 now() - interval '60 hours', true),

-- P17 · call_to_action + link · 0 comments (empty-state fixture) · ~5h
('da100017-0802-4da1-8001-202608020017',
 'Week of prayer, day two: Acts 2',
 'The whole network is reading one chapter of Acts each morning through the 7th. Today is Acts 2: the Spirit falls, the church is born, the table is set daily. If you missed day one, begin where we are; the plan keeps no ledger.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'event', 'none', 'call_to_action',
 'Get the reading plan', NULL, 'https://projectreplant.org', NULL, NULL,
 now() - interval '5 hours', true);

-- ── Comments (11; identity server-composed at read) ───────────────
INSERT INTO public.comments
  (announcement_id, author_id, body, created_at,
   mask_reason, author_anon_at_write, church_hidden_at_write)
VALUES
-- P13 sowing (7 — restores the fold demo: 5 shown + "show 2 earlier")
('da100013-0802-4da1-8001-202608020013', (SELECT id FROM public.users WHERE full_name = 'Élie Antoine Khoury' LIMIT 1),
 'The dry season sermon I did not know I needed.', now() - interval '7 hours', 'none', false, false),
('da100013-0802-4da1-8001-202608020013', '48207f0b-5312-4bfc-8a90-3700e9e46432',
 'We buried more than we planted this year too. Thank you for saying it out loud.', now() - interval '6 hours', 'anon', true, false),
('da100013-0802-4da1-8001-202608020013', (SELECT id FROM public.users WHERE full_name = 'Naomi Wakili' LIMIT 1),
 'Amen. The visits nobody sees are seen.', now() - interval '5 hours', 'none', false, false),
('da100013-0802-4da1-8001-202608020013', 'f47a46d7-76df-4a5b-8302-93d1ecece853',
 'Three winters of sowing here. The first shoots came this spring.', now() - interval '4 hours', 'anon', true, true),
('da100013-0802-4da1-8001-202608020013', (SELECT id FROM public.users WHERE full_name = 'Kwame Asante' LIMIT 1),
 'Reading this to our planting team tonight.', now() - interval '3 hours', 'none', false, false),
('da100013-0802-4da1-8001-202608020013', '469c9212-b553-4dca-b942-2810b8fb39e2',
 'From a room with no name yet: we will not faint.', now() - interval '90 minutes', 'no_church', true, true),
('da100013-0802-4da1-8001-202608020013', (SELECT id FROM public.users WHERE full_name = 'Akua Boateng' LIMIT 1),
 'Galatians 6:9 is on our wall this month. Confirmed word.', now() - interval '30 minutes', 'none', false, false),

-- P14 bread (1)
('da100014-0802-4da1-8001-202608020014', 'f47a46d7-76df-4a5b-8302-93d1ecece853',
 'The evening prayer kept us through our own floods.', now() - interval '20 hours', 'anon', true, true),

-- P16 truck (3)
('da100016-0802-4da1-8001-202608020016', (SELECT id FROM public.users WHERE full_name = 'Pieter Johannes van der Berg' LIMIT 1),
 'This is the network doing what it was planted for.', now() - interval '55 hours', 'none', false, false),
('da100016-0802-4da1-8001-202608020016', '48207f0b-5312-4bfc-8a90-3700e9e46432',
 'We are the inland church in this story more weeks than not. Grateful.', now() - interval '40 hours', 'anon', true, false),
('da100016-0802-4da1-8001-202608020016', (SELECT id FROM public.users WHERE full_name = 'Choi Yuna' LIMIT 1),
 'Praying a truck and a harvest find each other again this week.', now() - interval '22 hours', 'none', false, false);

-- P13 named-leader avatar initial (NAME initial, never role; NULL = sealed)
UPDATE public.announcements SET source_initial = 'D'
 WHERE id = 'da100013-0802-4da1-8001-202608020013';

COMMIT;
