-- ═══════════════════════════════════════════════════════════════════
-- Day-1 wall reseed (Founder GO 2026-07-28) — 10 live posts + 1
-- scheduled + 1 draft, ~28 comments. Voice: the June register. Every
-- card type, both badges, links, masked + named bylines, verse anchors.
--
-- Wipe scope: in-window posts + queue (snapshot first →
-- .qa/2026-07-28-day1-wall-wipe-snapshot.json). June archive untouched.
--
-- Masking snapshots mirror the verified live combos (KAN-338 register):
--   named            → none / false / false / false
--   anonymous leader → anon / true / true / false
--   underground safe → anon / true / true / true
--   underground brave→ anon / true / true / false  (church name shows)
--   no church        → no_church / true / true / true
-- Identity display stays server-composed (get_comments v3) — these are
-- at-write snapshots only.
--
-- comment_count is trigger-maintained on comment INSERT/DELETE — the
-- announcements are inserted without counts on purpose.
--
-- CLEANUP: DELETE FROM announcements WHERE id::text LIKE 'da1000%';
-- (comments cascade via the explicit delete below if ever re-run)
-- ═══════════════════════════════════════════════════════════════════

-- EXECUTED live 2026-07-28 (three deltas from the draft, folded in below):
--   1. content_submissions.published_announcement_id cleared for the wiped
--      set first (submission 24708ec3 kept, pointer NULLed — FK guard).
--   2. source_label is varchar(30): byline shortened to
--      'Bishop Yerlan Abdrakhmanov' (26).
--   3. comments.is_masked is a GENERATED column — omitted from the INSERT.
-- Post-run: KAN-338 identity pins ALL GREEN.

BEGIN;

-- ── FK guard + wipe (snapshotted first) ───────────────────────────
UPDATE public.content_submissions SET published_announcement_id = NULL
 WHERE published_announcement_id IN (
   SELECT id FROM public.announcements
   WHERE published_at IS NULL OR published_at >= now() - interval '7 days');

DELETE FROM public.comments WHERE announcement_id IN (
  SELECT id FROM public.announcements
  WHERE published_at IS NULL OR published_at >= now() - interval '7 days');
DELETE FROM public.announcements
  WHERE published_at IS NULL OR published_at >= now() - interval '7 days';

-- ── Posts ─────────────────────────────────────────────────────────
INSERT INTO public.announcements
  (id, title, body, author_id, author_type, topic, badge, card_type,
   source_label, source_sublabel, link_url, verse_text, verse_reference,
   published_at, is_active)
VALUES
-- P1 · standard · URGENT · verse pull-quote · ~4h
('da100001-0728-4da1-8001-202607280001',
 'Six leaders detained after a raid in Sudan',
 'Believers in Omdurman are asking the network to pray by name for six leaders taken during Friday''s raid on a house fellowship. Their families are safe and in hiding with relatives. Local brothers tell us the men were moved twice in the first two days, which usually means a decision has not been made about charges. Pray for steadiness under questioning, for favor with at least one officer, and for their congregations meeting in smaller rooms this week.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'prayer', 'urgent', 'standard',
 NULL, NULL, NULL,
 'When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee.',
 'Isaiah 43:2 · KJV',
 now() - interval '4 hours', true),

-- P2 · standard · short body (no fold — proves cue gating) · ~9h
('da100002-0728-4da1-8001-202607280002',
 'Twelve churches joined the network this week',
 'From four continents, including two that came in as branches of mother churches already here. See who is near you in the Church tab.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'update', 'none', 'standard',
 NULL, NULL, NULL, NULL, NULL,
 now() - interval '9 hours', true),

-- P3 · standard + link → renders as LinkCard · ~1d2h
('da100003-0728-4da1-8001-202607280003',
 'Where the Church stands: a mid-2026 reading',
 'A short field briefing drawn from what leaders across the network reported between January and June. Ten minutes, worth every one of them.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'update', 'none', 'standard',
 'Mid-2026 field briefing', NULL, 'https://projectreplant.org/blog', NULL, NULL,
 now() - interval '26 hours', true),

-- P4 · article + link · NEW (breathing dot) · ~1d6h
('da100004-0728-4da1-8001-202607280004',
 'Shepherding when the money runs out',
 'What do you tell a congregation the week the factory closes? Leaders in three countries sent us the same question this spring, in almost the same words. This piece gathers what six of them have learned about naming the fear out loud, about the difference between faith and pretending, and about the strange arithmetic of a church that has less and gives more. None of them call it easy. All of them call it holy ground. There is a section near the end written directly to the leader whose own household is the one running short.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'update', 'new', 'article',
 NULL, NULL, 'https://projectreplant.org/blog', NULL, NULL,
 now() - interval '30 hours', true),

-- P5 · long_read (legacy enum → renders "Article") + link · ~2d1h
('da100005-0728-4da1-8001-202607280005',
 'The quiet growth of the house church',
 'Nobody planted a movement. Somebody opened a living room. Across the network''s hardest regions, the pattern repeats: a family, a meal, a psalm sung quietly, and five years later a web of rooms no map has ever held. We traced one thread of it, with names and places changed, from a single kitchen table to eleven fellowships. What struck us was not the courage, though it is everywhere. It was the patience.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'testimony', 'none', 'long_read',
 NULL, NULL, 'https://projectreplant.org/blog', NULL, NULL,
 now() - interval '49 hours', true),

-- P6 · leader_word · named byline + anchor-only verse · 9 comments · ~2d8h
('da100006-0728-4da1-8001-202607280006',
 'Do not despise the small room',
 'Zechariah asked who dares despise the day of small things. I have pastored a congregation of thousands and I have pastored nine people in a borrowed room, and I tell you the nine were not the lesser assignment. The Lord counts differently than we do. Whatever size room He has given you this season, fill it faithfully.',
 '028be745-8014-4314-a7cf-36b0a4d52b46', 'leader', 'word_for_today', 'none', 'leader_word',
 'Bishop Yerlan Abdrakhmanov', 'Astana Evangelical Christian Mission', NULL,
 NULL, 'Zechariah 4:10',
 now() - interval '56 hours', true),

-- P7 · leader_word · masked byline · ~3d3h
('da100007-0728-4da1-8001-202607280007',
 'The Lord knows the way through the desert',
 'We have no building this year. We have no sign on a road. And still every week the bread and the cup are on the table and the Lord meets us. If you lead where you cannot be seen, you are not unseen.',
 '028be745-8014-4314-a7cf-36b0a4d52b46', 'leader', 'word_for_today', 'none', 'leader_word',
 'From a pastor · North Africa', NULL, NULL, NULL, NULL,
 now() - interval '75 hours', true),

-- P8 · encouragement (reworked voice, breathing dot, no thread) · ~4d5h
('da100008-0728-4da1-8001-202607280008',
 'You have not been forgotten in the waiting. The One who began the work knows where you stand.',
 'You have not been forgotten in the waiting. The One who began the work knows where you stand.',
 '028be745-8014-4314-a7cf-36b0a4d52b46', 'leader', 'word_for_today', 'none', 'encouragement',
 'From a shepherd · Central Asia', NULL, NULL, NULL, 'Philippians 1:6',
 now() - interval '101 hours', true),

-- P9 · together · NEW · ~5d2h
('da100009-0728-4da1-8001-202607280009',
 'Three fellowships, one table',
 'This week a congregation in Busan, a house church in the Sahel, and a fellowship meeting online across four time zones each set one chair empty at their gathering, for the leader somewhere who cannot gather at all. They asked us to pass the practice on. If your church keeps the empty chair this Sunday, tell us, and we will tell the next church.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'prayer', 'new', 'together',
 NULL, NULL, NULL, NULL, NULL,
 now() - interval '122 hours', true),

-- P10 · call_to_action + link · ~6d4h
('da100010-0728-4da1-8001-202607280010',
 'August week of prayer: the 1st to the 7th',
 'Seven days, one chapter of Acts each morning, the whole network on the same page. The reading plan is short on purpose; the praying is the point. It begins Friday.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'event', 'none', 'call_to_action',
 'Get the reading plan', NULL, 'https://projectreplant.org', NULL, NULL,
 now() - interval '148 hours', true),

-- P11 · SCHEDULED (admin queue texture)
('da100011-0728-4da1-8001-202607280011',
 'August prayer calendar: thirty-one nations',
 'One nation each day through August, paired with a short intercession you can pray with your fellowship. Not headlines; requests, gathered from leaders who live there. It posts here on the first.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'update', 'new', 'standard',
 NULL, NULL, NULL, NULL, NULL,
 '2026-08-01 09:00:00+00', true),

-- P12 · DRAFT (admin queue texture)
('da100012-0728-4da1-8001-202607280012',
 'Prayer for the gathering in Jos',
 'Leaders from three states meet quietly this weekend to pray over the harvest season. Set aside a moment for them today: for safe travel there and home again, for wisdom in what they plan together, and for joy, because these gatherings are rare. They have asked for no details beyond this.',
 'bb6c6385-236a-402a-9a6c-66ca3468fdf5', 'admin', 'prayer', 'none', 'standard',
 NULL, NULL, NULL, NULL, NULL,
 NULL, true);

-- ── Comments (~28; identity server-composed at read) ──────────────
INSERT INTO public.comments
  (announcement_id, author_id, body, created_at,
   mask_reason, author_anon_at_write, church_hidden_at_write)
VALUES
-- P1 Sudan (5)
('da100001-0728-4da1-8001-202607280001', (SELECT id FROM public.users WHERE full_name = 'Élie Antoine Khoury' LIMIT 1),
 'Amen, we are standing with you.', now() - interval '230 minutes', 'none', false, false),
('da100001-0728-4da1-8001-202607280001', (SELECT id FROM public.users WHERE full_name = 'Kwame Asante' LIMIT 1),
 'Praying by name through the night watch here.', now() - interval '190 minutes', 'none', false, false),
('da100001-0728-4da1-8001-202607280001', '48207f0b-5312-4bfc-8a90-3700e9e46432',
 'Isaiah 43 over them and their families.', now() - interval '140 minutes', 'anon', true, false),
('da100001-0728-4da1-8001-202607280001', 'f47a46d7-76df-4a5b-8302-93d1ecece853',
 'We know this road. The Lord kept us; He will keep them.', now() - interval '75 minutes', 'anon', true, true),
('da100001-0728-4da1-8001-202607280001', (SELECT id FROM public.users WHERE full_name = 'Naomi Wakili' LIMIT 1),
 'Our fellowship fasted for them this morning.', now() - interval '25 minutes', 'none', false, false),

-- P2 welcomes (2)
('da100002-0728-4da1-8001-202607280002', (SELECT id FROM public.users WHERE full_name = 'Pieter Johannes van der Berg' LIMIT 1),
 'Welcome, brothers and sisters. You are among family.', now() - interval '7 hours', 'none', false, false),
('da100002-0728-4da1-8001-202607280002', (SELECT id FROM public.users WHERE full_name = 'Lee Joseph Donghyun' LIMIT 1),
 'Glad you are here. The body is bigger than they told us.', now() - interval '5 hours', 'none', false, false),

-- P4 article (3)
('da100004-0728-4da1-8001-202607280004', (SELECT id FROM public.users WHERE full_name = 'Thandiwe Esther Mbeki' LIMIT 1),
 'This found us in exactly that week. Thank you.', now() - interval '27 hours', 'none', false, false),
('da100004-0728-4da1-8001-202607280004', '48207f0b-5312-4bfc-8a90-3700e9e46432',
 'The section written to the leader was hard to read and good to read.', now() - interval '22 hours', 'anon', true, false),
('da100004-0728-4da1-8001-202607280004', (SELECT id FROM public.users WHERE full_name = 'Khalid El-Mansouri' LIMIT 1),
 'Sharing with two young pastors I mentor.', now() - interval '11 hours', 'none', false, false),

-- P5 house church (2)
('da100005-0728-4da1-8001-202607280005', (SELECT id FROM public.users WHERE full_name = 'Khalil Mansour' LIMIT 1),
 'this was a really good read, thanks for sharing.', now() - interval '40 hours', 'none', false, false),
('da100005-0728-4da1-8001-202607280005', 'f47a46d7-76df-4a5b-8302-93d1ecece853',
 'A living room is how we began too.', now() - interval '31 hours', 'anon', true, true),

-- P6 small room (9 — the "show 4 earlier comments" fold demo, paced ~2 days)
('da100006-0728-4da1-8001-202607280006', '71f6d51e-bd78-422e-8205-a9ea767b2edd',
 'Amen. The small room is where He met us.', now() - interval '52 hours', 'none', false, false),
('da100006-0728-4da1-8001-202607280006', (SELECT id FROM public.users WHERE full_name = 'Boubacar Issa' LIMIT 1),
 'Reading this to our nine on Sunday.', now() - interval '49 hours', 'none', false, false),
('da100006-0728-4da1-8001-202607280006', (SELECT id FROM public.users WHERE full_name = 'Akua Boateng' LIMIT 1),
 'Sixty harvests. Grateful for fathers in the faith.', now() - interval '44 hours', 'none', false, false),
('da100006-0728-4da1-8001-202607280006', (SELECT id FROM public.users WHERE full_name = 'Yousef Mikhail' LIMIT 1),
 'We are seven this season. This word holds us.', now() - interval '38 hours', 'anon', true, false),
('da100006-0728-4da1-8001-202607280006', (SELECT id FROM public.users WHERE full_name = 'Priya Khan' LIMIT 1),
 'Thank you. I needed permission to stay small faithfully.', now() - interval '32 hours', 'anon', true, false),
('da100006-0728-4da1-8001-202607280006', (SELECT id FROM public.users WHERE full_name = 'Lala Aliyeva' LIMIT 1),
 'The Lord counts differently. Writing that on our wall.', now() - interval '26 hours', 'none', false, false),
('da100006-0728-4da1-8001-202607280006', '469c9212-b553-4dca-b942-2810b8fb39e2',
 'From one borrowed room to another: amen.', now() - interval '18 hours', 'no_church', true, true),
('da100006-0728-4da1-8001-202607280006', (SELECT id FROM public.users WHERE full_name = 'Bakytbek Nurlanov' LIMIT 1),
 'Zechariah has carried our plant through two winters.', now() - interval '9 hours', 'none', false, false),
('da100006-0728-4da1-8001-202607280006', (SELECT id FROM public.users WHERE full_name = 'Mariam Antoun Halabi' LIMIT 1),
 'Holding this close today.', now() - interval '3 hours', 'anon', true, false),

-- P7 desert (2)
('da100007-0728-4da1-8001-202607280007', 'f47a46d7-76df-4a5b-8302-93d1ecece853',
 'He has been our way in the wilderness for three years.', now() - interval '70 hours', 'anon', true, true),
('da100007-0728-4da1-8001-202607280007', (SELECT id FROM public.users WHERE full_name = 'Bauyrzhan Akhmetov' LIMIT 1),
 'You are seen by the One who counts sparrows.', now() - interval '58 hours', 'none', false, false),

-- P9 together (4)
('da100009-0728-4da1-8001-202607280009', (SELECT id FROM public.users WHERE full_name = 'Choi Yuna' LIMIT 1),
 'The empty chair will be set this Sunday.', now() - interval '118 hours', 'none', false, false),
('da100009-0728-4da1-8001-202607280009', '48207f0b-5312-4bfc-8a90-3700e9e46432',
 'We joined without knowing others were doing the same.', now() - interval '99 hours', 'anon', true, false),
('da100009-0728-4da1-8001-202607280009', (SELECT id FROM public.users WHERE full_name = 'Antoun Faragalla' LIMIT 1),
 'One body. One table. Amen.', now() - interval '80 hours', 'none', false, false),
('da100009-0728-4da1-8001-202607280009', (SELECT id FROM public.users WHERE full_name = 'François Dubois' LIMIT 1),
 'Passing the practice to our sister fellowships in the valleys.', now() - interval '51 hours', 'none', false, false),

-- P10 CTA (1)
('da100010-0728-4da1-8001-202607280010', (SELECT id FROM public.users WHERE full_name = 'Aigerim Bekturova' LIMIT 1),
 'Our whole team is in. Acts each morning.', now() - interval '140 hours', 'none', false, false);

COMMIT;

-- POST-SEED ADJUSTMENT (2026-07-28, same day): P10's single comment
-- (Aigerim Bekturova) DELETED so the wall carries one commentable card at
-- 0 comments — the living fixture for the thread empty state ("No
-- comments yet. Be the first."), Founder walk feedback. comment_count
-- trigger handled the decrement. Comment total is now 27.
