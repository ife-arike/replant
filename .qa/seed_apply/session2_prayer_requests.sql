-- Replant Seed — prayer_requests INSERTs
-- Session 2 of 2 — written 2026-06-11
-- Target: 182 rows total
--
-- This file contains:
--   ✓ SSA region: 46 rows fully drafted (P1-P46)
--   ✓ Spot-check rows: ~25 captured from other regions during scope conversation
--   △ Remaining ~111 rows: SESSION 2 MUST DRAFT inline using texture rules below
--
-- Per Founder rules:
--   - status text: 'open' (78%), 'answered' (~17, sets up testimony parents), 'archived' (~5)
--   - urgent (15%), anonymous (25% — forced for underground + ~5 elective named)
--   - recency skewed last 21 days
--   - 13 answered rows already have matching testimony rows in session2_testimony.sql
--
-- TEXTURE GUIDE for Session 2 to draft remaining rows:
--   - Specific concrete details (named people, named months)
--   - No em dashes, no aesthetic-Christian prose
--   - Vulnerable not performative — leaders carrying real weight
--   - Category from locked 8: Healing, Protection, Provision, Salvation, Unity, Guidance, Endurance, Laborers (EXACT CASING)
--   - Reference: PrayerWallLogic.ts:40-49
--
-- Apply by inserting via VALUES + JOIN pattern (look up church + leader by code/name).

-- =============================================
-- SSA region (46 rows — FULLY DRAFTED)
-- =============================================

INSERT INTO public.prayer_requests (church_id, user_id, content, category, urgent, anonymous, status, created_at, prayed_count, is_active)
SELECT c.id, u.id, v.content, v.category, v.urgent::boolean, v.anon::boolean, v.status, v.created_at::timestamptz, 0, true
FROM (VALUES
-- Nigeria (5 churches → 11 requests)
('RPL-30001', 'Joseph Pam', 'We''re considering planting a second campus across the river in Bukuru. Three potential families have come forward to host the first gatherings. Praying for clarity on whether this is His timing or just our ambition. Confirmation or correction would both be welcome.', 'Laborers', false, false, 'open', '2026-06-08'),
('RPL-30001', 'Mary Akinbobola', 'Two of our children''s church teachers were detained briefly last week at a checkpoint and questioned about our gatherings. They came home safely but shaken. Pray for our weekend security plan and for fear not to take root in the team.', 'Protection', false, false, 'open', '2026-06-03'),
('RPL-30001', 'Joseph Pam', 'Eight months praying that the elder we had to step down last year would reach out. He called this Sunday and asked to meet for coffee. The Lord moved. Will share the rest after we meet.', 'Endurance', false, false, 'answered', '2026-05-22'),
('RPL-30002', 'Bitrus Yusuf', 'Two villages east of us were attacked this past week. Three of our congregants have family members still missing. Pray for safety of the search teams and for the Lord to bring the missing back to us.', 'Protection', true, false, 'open', '2026-06-07'),
('RPL-30002', 'Bitrus Yusuf', 'My wife has been carrying the trauma of the 2022 attack in silence for too long. She''s started having flashbacks again. Pray for her and pray for me to be tender. I''m tired but she''s more tired.', 'Healing', false, true, 'open', '2026-06-04'),
('RPL-30003', 'Samuel Adeoye Adetayo', 'We''ve outgrown our current outreach centre and need to expand into the building next door. Praying for the resources and for the landlord to be willing to negotiate. The Lord knows what we can carry.', 'Provision', false, false, 'open', '2026-06-05'),
('RPL-30003', 'Ibrahim Magaji', 'My older brother has been resistant for fifteen years. He showed up to my mother''s funeral last month and stayed for the prayer. Pray for the door the Lord seems to be opening.', 'Salvation', false, false, 'open', '2026-05-28'),
('RPL-30003', 'Samuel Adeoye Adetayo', 'Three months of asking for the right administrator to come alongside our team. A woman from our home church reached out last week to offer her time. She starts Monday. Praise be.', 'Laborers', false, false, 'answered', '2026-05-20'),
('RPL-30004', 'Habila Bagudu', 'Two years of small gatherings here. Some weeks I wonder if we''re being faithful or just stubborn. Pray for the Lord to confirm whether to keep going or close and rejoin another fellowship. I want His will more than my plans.', 'Endurance', false, false, 'open', '2026-06-01'),
('RPL-30005', 'Yakubu Ahmadu', 'Increased Boko Haram activity in the Damaturu corridor this month. Two of our youth are doing their NYSC service in nearby villages. Pray for their safety and for wisdom about whether to bring them home.', 'Protection', true, false, 'open', '2026-06-09'),
('RPL-30005', 'Hannatu Grace Mohammed', 'Our worship team is fractured. Two senior leaders haven''t spoken in three months and the others are picking sides. Pray for the Lord to humble whoever needs humbling, starting with me if it''s me.', 'Unity', false, false, 'open', '2026-06-02'),
-- DRC (2 churches → 4 requests)
('RPL-30006', 'Jean-Claude Kambale Mumbere', 'Another ADF attack last week, this time on a village two hours from us. Three families from our church have relatives there. Pray for the search and for our church to stay a sanctuary for the displaced who arrive at our door.', 'Protection', true, false, 'open', '2026-06-09'),
('RPL-30006', 'Jean-Claude Kambale Mumbere', 'We''ve been hosting twelve displaced families for three weeks now. Food is stretched. Pray for the body to provide and for the families to find rest in our gathering.', 'Provision', false, false, 'open', '2026-05-30'),
('RPL-30007', 'Joseph Tshilumba', 'Almost two years of weekly gathering with the same fifteen people. The Lord said start. He hasn''t said grow yet. Pray for patience to keep showing up and for the Spirit to make these fifteen ready for whatever comes next.', 'Endurance', false, false, 'open', '2026-05-26'),
('RPL-30007', 'Marie-Antoinette Mboyo', 'Sister Bénédicte''s tuberculosis case from March. She tested clear this week. The Lord answered. Thanksgiving.', 'Healing', false, false, 'answered', '2026-05-23'),
-- Cameroon (2 churches → 3 requests)
('RPL-30008', 'Emmanuel Tabe', 'The Anglophone crisis has hardened lines in our parish. Half our families have lost a relative to violence and the other half haven''t, and the second group doesn''t know how to walk with the first. Pray for the Spirit to give us the language we need.', 'Unity', false, false, 'open', '2026-06-04'),
('RPL-30008', 'Comfort Nformi', 'I''ve been weary for several months. Praying without rest, very few visible answers, slipping into discouragement. Pray for the Lord to refresh me and remind me why I''m doing this.', 'Endurance', false, true, 'open', '2026-06-06'),
('RPL-30009', 'Adamou Ahmadou', 'Boko Haram activity has crept south again. Three church plant leaders we''ve sent out to Fulfulde villages are asking whether to stay or come back to the main church. Pray for clarity that comes only from Him.', 'Protection', true, false, 'open', '2026-06-08'),
-- Sahel + CAR + Chad (7 requests)
('RPL-30010', 'Augustin Pascal Ngakola', 'Operating cost of our outreach to the displaced at the edge of the city has tripled. We need a partner who can stand alongside the work for the next twelve months. Pray for the Lord to put someone on our path.', 'Provision', false, false, 'open', '2026-05-30'),
('RPL-30011', 'David Brahim', 'Newly registered and waiting on verification. Praying for wisdom in how to set our ministry rhythm before the door opens fully. Don''t want to build something quickly that I''ll have to rebuild slowly.', 'Guidance', false, false, 'open', '2026-06-04'),
('RPL-30012', 'Issa Coulibaly', 'Two of our brightest young leaders are sensing a call into formal ministry. Bamako has no seminary suited to them. Praying for the Lord to either open a path to study elsewhere or to send a teacher to us.', 'Laborers', false, false, 'open', '2026-06-05'),
('RPL-30013', 'Pascal Ouédraogo Compaoré', 'Bombings in the north this month have rattled our congregation, especially the families with relatives there. Pray for steady hearts and for the Lord to keep the violence from reaching us. But more, pray for those in the north.', 'Protection', false, false, 'open', '2026-06-07'),
('RPL-30013', 'Awa Sawadogo', 'My mother had a stroke last week. I''m her only child and three hundred kilometres from home. Pray for her recovery and for grace for the cousin who is caring for her until I can travel.', 'Healing', false, true, 'open', '2026-06-02'),
('RPL-30014', 'Boureima Joseph Traoré', 'Sensing the Lord wants us to plant in a Muslim-majority village ninety kilometres west. The risk feels significant. Pray for confirmation, and if it is Him, for the family who would have to move there.', 'Guidance', false, false, 'open', '2026-06-06'),
('RPL-30015', 'Hadjara Hannah Hassane', 'Forty intercessors meet weekly. Of them, five are ready to lead intercession groups in their own neighbourhoods. Pray for me to know when to release them and how to keep covering them once I do.', 'Laborers', false, false, 'open', '2026-05-31'),
-- Mozambique + Sudan/SS (5 requests)
('RPL-30016', 'Mateus Mauricio', 'Insurgent activity flared again near Mocímboa this past week. We''ve evacuated four families to relatives further south. Pray for those who couldn''t leave and for the Lord to disrupt what is being planned next.', 'Protection', true, false, 'open', '2026-06-09'),
('RPL-30016', 'Mateus Mauricio', 'The relocated families need new schools, new gathering rhythms, new everything. Pray for the inland churches that are hosting them to have what they need and for our network to coordinate well.', 'Provision', false, false, 'open', '2026-05-29'),
('RPL-30017', 'Samuel Aguer', 'A local government official has been coming to evening prayer for the past month. He hasn''t said why. Pray for the Lord to be doing what we cannot see and for us to be patient with the slow work.', 'Salvation', false, false, 'open', '2026-05-27'),
('RPL-30017', 'Mary Achol Garang', 'Tribal tensions have entered our women''s ministry. Two of our most steady sisters are barely speaking. Pray for me to know when to mediate and when to let the Spirit do what only He can.', 'Unity', false, false, 'open', '2026-06-01'),
('RPL-30018', 'Habib Awad', 'Our gatherings continue while the city is unstable. Praying for the Lord to keep our people steady through the waiting and for verification to come through soon so we can connect to the wider body.', 'Endurance', false, false, 'open', '2026-06-06'),
-- Sender base (11 requests)
('RPL-30020', 'Joshua Kamau', 'Sending three families on long-term mission to Northern Kenya this October. Praying for the Lord to test their hearts now, before they go, so what gets sent is what He''s actually asking us to send.', 'Laborers', false, false, 'open', '2026-06-05'),
('RPL-30020', 'Esther Njoroge', 'The worship team has grown faster than the structure can hold. Praying for wisdom in how to bring the new members into the rhythms without flattening what made the team alive in the first place.', 'Guidance', false, false, 'open', '2026-05-30'),
('RPL-30020', 'Joshua Kamau', 'Two months praying for our deacon Brian''s recovery from the car accident. He walked into the elders'' meeting this Monday. The Lord did it. Testimony coming soon.', 'Healing', false, false, 'answered', '2026-05-21'),
('RPL-30026', 'Charles Owino', 'Two of the smaller parishes in our diocese have been at odds over a property boundary for over a year. Pray for the Spirit to lift the heaviness off the conversation. We''ve tried wisdom; we need His weight.', 'Unity', false, false, 'open', '2026-06-03'),
('RPL-30026', 'Charles Owino', 'A young man in our cathedral choir has been wrestling. He came to me last week and said he wants to but doesn''t know how. Pray for him to take the step and for the Lord to meet him gently when he does.', 'Salvation', false, false, 'open', '2026-05-31'),
('RPL-30027', 'Dirk Daniel Van Wyk', 'Eight months of declining attendance, mostly the under-thirties drifting. Pray for me to ask the right questions before I assume the answer, and for the Lord to either bring them back or send the next generation we''re meant to walk with.', 'Endurance', false, false, 'open', '2026-05-28'),
('RPL-30027', 'Thandiwe Esther Mbeki', 'Our after-school programme in Khayelitsha needs another four staff to keep the doors open through the winter holidays. Praying for the right people to come from within our own congregation, not hires.', 'Provision', false, false, 'open', '2026-06-02'),
('RPL-30027', 'Dirk Daniel Van Wyk', 'Sent two of our seminary students to plant a fellowship in Stellenbosch eighteen months ago. The fellowship folded last week. Archiving but still asking for grace for everyone involved and for the Lord to redeem what felt like waste.', 'Laborers', false, false, 'archived', '2026-05-25'),
('RPL-30028', 'Kwame Asante', 'A foreign missions organisation has invited us to formalise partnership. The terms feel generous and the doors they could open are real, but something is sitting wrong with me. Pray for clarity that''s not coloured by ambition.', 'Guidance', false, false, 'open', '2026-06-05'),
('RPL-30028', 'Akua Boateng', 'Two women in our discipleship class are walking through cancer at the same time. Different stages, different prognoses. Pray for both of them and for the class to learn to weep with both rather than focus on the more urgent one.', 'Healing', false, false, 'open', '2026-05-29'),
('RPL-30028', 'Kwame Asante', 'Three years of asking the Lord for a youth pastor. Mensah, who grew up in our church and went away for seminary, came back last Sunday and said he wants to apply. The Lord answers slowly sometimes, but He answers.', 'Laborers', false, false, 'answered', '2026-05-22'),
-- Underground SSA (5 requests; 1 short-coded, 4 normal voice)
('RPL-30021', 'Abdi Hassan', 'Cover us this week. Two more checkpoints between gathering homes.', 'Protection', true, true, 'open', '2026-06-09'),
('RPL-30022', 'Mohammedou Ould Aboubacar', 'Three new believers from Muslim families this season. Two are doing well. One is being squeezed hard by her brothers. Pray for her courage and for our discreet support to actually reach her without exposing her.', 'Endurance', false, true, 'open', '2026-06-04'),
('RPL-30023', 'Said Mzimba', 'Two brothers in our fellowship are wanting to gather their own small group on the other side of the island. They''re young, the cost is high here. Pray for clarity on whether to bless them or ask them to wait.', 'Laborers', false, true, 'open', '2026-06-01'),
('RPL-30025', 'Daoud Yousef', 'Three years of believing the Lord for an open door to disciple the new converts properly. We''ve been meeting in fragments because of the city. Pray we either receive what we''ve been asking for, or contentment in fragments while He builds something we can''t see yet.', 'Endurance', false, false, 'open', '2026-05-28'),
('RPL-30025', 'Daoud Yousef', 'My wife has been carrying the weight of years of constant tension. The body keeps the score. Pray for her sleep and for me to know how to lighten what I can. Sharing this without my name because it''s hers as much as mine.', 'Healing', false, true, 'open', '2026-06-05')
) v(church_code, leader_name, content, category, urgent, anon, status, created_at)
JOIN public.churches c ON c.church_code = v.church_code
JOIN public.users u ON u.church_id = c.id AND u.full_name = v.leader_name;

-- =============================================
-- MENA REGION (28 rows) — SESSION 2 MUST DRAFT
-- =============================================
-- Volume target: 28 rows across 21 churches (9 ug anon + 1 brave + 13 named + 3 pending second + skip deactivated/rejected)
-- Texture: Iran convert voice, Coptic family pressure, Mosul rebuilding, Damascus surveillance,
--   Cairo brave admin queue, Aleppo recovery, Lebanon economic, Casablanca interfaith
-- Status mix: 17V open + 2 answered (Cairo brave laborers / Erbil provision) + 1 archived + 4 pending L1 + 2 pending L2 + 1 deactivated + 1 rejected
-- Spot-checks captured during conversation (P50, P56, P64, P68 from MENA chunk):
--   P50 L47 Abdullah Yusuf Al-Mansur · RPL-30032 · Protection urgent=t anon=t open · "Cover us. New questioning at work this week."
--   P56 L53 Yousef Mikhail · RPL-30038 brave · Salvation · "A young Coptic Orthodox priest has been quietly visiting our fellowship for the past few months. He hasn''t asked to convert but he asks deep questions. Pray for him and for me to know whether he''s being sent to learn from us or to learn against us."
--   P58 L53 Yousef Mikhail · RPL-30038 brave · Laborers status=answered · "Four months praying for an assistant pastor who can carry what I cannot. A brother from a sister fellowship in Alexandria has accepted. Starts in three weeks."
--   P64 L59 Mar Yousif Sayegh · RPL-30041 Mosul · Endurance · "Twenty years since the displacement. Our community is half what it was. Pray for those who left to return and for those who stayed to keep tending what remains. The Lord remembers Nineveh."
--   P66 L61 Daniel Saadon · RPL-30042 Erbil · Provision status=answered · "Building the new outreach centre had been over budget by a third. A donor from a partner church in Detroit stepped forward this past month to cover the gap. The Lord answered before we asked the body."
--   P68 L64 Najib Sleiman · RPL-30043 Damascus · Protection urgent=t anon=t · "Inspections of religious gatherings have increased again this past month. We''ve had to change our Sunday rhythm twice. Pray for safety and for our young people not to grow cynical."

-- TODO Session 2: Insert remaining ~22 MENA rows. Use same VALUES + JOIN pattern as SSA above.
-- Leader names available in public.users (query for MENA: SELECT full_name, role FROM users u JOIN churches c ON c.id = u.church_id WHERE c.region_admin_only = 'middle_east_north_africa')

-- =============================================
-- SA REGION (23 rows) — SESSION 2 MUST DRAFT
-- =============================================
-- Volume: 23 rows across 17 churches
-- Spot-checks captured:
--   P78 Kabul ug · Protection urgent=t anon=t SHORT · "Cover our gatherings. Movement on watchlists."
--   P85 Thouhanbi Sapam · Manipur · Protection urgent=t · "Renewed violence in Kuki villages this week. Three of our youth from those villages haven''t sent word in five days. Pray for them to be safe, and for the news when it comes to be news we can carry."
--   P94 Daniel Sialvi · Sindh Karachi · Protection urgent=t · "A blasphemy accusation has been raised against a teenager from a neighbouring parish. The case is being watched by extremist groups locally. Pray for the boy, his family in hiding, and the lawyers willing to take it."
--   P96 Sujatha Perera · Sri Lanka Colombo · Provision status=answered · "Two months praying for our after-school programme to find a sustainable funding line. A diaspora-led foundation reached out last week with a five-year commitment. The Lord answered with surplus where we asked for survival."
--   P99 Wahid Mohammadi · Kandahar ug pending · Protection urgent=t anon=t · "Movement in our area has tightened. Pray for the few of us still gathering and for our verification to come through quietly."
-- TODO Session 2: Insert 18 more SA rows.

-- =============================================
-- ESEA REGION (26 rows) — SESSION 2 MUST DRAFT
-- =============================================
-- Spot-checks:
--   P101 Park Sunghyun · Pyongyang ug · Protection urgent=t anon=t SHORT · "Cover us. Movement in the area."
--   P108 Zhao John Mingxuan · Chengdu brave · Endurance answered · "Eighteen months of asking the Lord to give us steady elders who can carry the weight of being known. Three brothers were affirmed this past Sunday. The Lord brought them in His own timing."
--   P109 Hrang Lal Cung · Hakha Chin · Protection urgent=t · "Military movement near our villages has increased again this week. Several families have fled into the hills. Pray for those hiding and for our church to be able to reach them with food and word."
--   P119 Choi Yuna · Busan · Healing anon=t · "Walking through deep grief privately after losing my older brother last month. Showed up to lead but my soul hasn''t yet. Pray for the Lord to meet me where I actually am."
--   P125 Nawng Lat · Kachin pending · Protection urgent=t · "The conflict has displaced more families this week. Six of our church members are scattered across temporary shelters."
-- TODO Session 2: Insert 21 more ESEA rows.

-- =============================================
-- EE/CA REGION (16 rows) — SESSION 2 MUST DRAFT
-- =============================================
-- Spot-checks:
--   P130 Bobur Khasanov · Tashkent brave · Endurance answered · "Nine months praying for an elder who could shoulder some of what I''ve been carrying alone. A brother from another city moved here for work in March and was affirmed by the fellowship this past Sunday. The Lord knew before I asked."
--   P135 Farrukh Karimov · Dushanbe · Protection anon=t · "Surveillance has tightened in our district this month. Two brothers have been questioned about our gatherings. Nothing has come of it yet. Pray for sober wisdom about location and rhythm."
--   P138 Aleksandr Petrovich Volkov · SPb · Guidance · "Our congregation is wrestling with whether to keep meeting publicly or revert to multi-household gatherings. The wider climate has shifted. Pray for me to lead from courage shaped by wisdom, not fear."
-- TODO Session 2: Insert 13 more EE/CA rows.

-- =============================================
-- LAC REGION (12 rows) — SESSION 2 MUST DRAFT
-- =============================================
-- Spot-checks:
--   P143 Javier Sandoval · Apatzingán · Protection urgent=t · "Cartel activity in our area has spiked this past month. Two of our youth were stopped at an unmarked checkpoint and questioned. Pray for them and for the wider community whose families are being asked to choose sides."
--   P147 Roberto Pérez · Havana · Endurance anon=t · "Ten years of meeting underground in homes. Lately I''ve been wondering whether to ask the Lord for more or to stop asking and just receive what He''s giving. Pray for me to know His heart in this."
--   P154 Jean-Pierre Etienne · Haiti Bible Translation pending · Protection urgent=t · "Gang activity has surrounded the Bible Translation Initiative offices this past week. Our team is working from home. Pray for our safety, our work to continue, and for the wider Haitian Church being squeezed from every side."
-- TODO Session 2: Insert 9 more LAC rows.

-- =============================================
-- NA REGION (15 rows net-new only — KEEP churches NOT seeded) — SESSION 2 MUST DRAFT
-- =============================================
-- Spot-checks:
--   P157 Michael Thompson · Houston · Healing answered · "Two months praying for our worship pastor''s mother through her cancer recovery. She rang the bell this past Thursday. The body has been holding her family with such tenderness. Praise be."
--   P158 James Edward Whitfield · Manhattan · Provision · "Manhattan rent has crushed our budget into a third year of deficit. Pray for the Lord to either provide what we''ve been asking or close the doors clearly so we can grieve and re-plant elsewhere honestly."
--   P164 Jasmine Williams · Charlotte · Healing · "Several long-time members are walking through grief. Three different families lost a parent within the past six weeks. Pray for them, for our care team, and for our community to be the kind of place where weeping doesn''t make people lonelier."
-- TODO Session 2: Insert 12 more NA rows.

-- =============================================
-- WE REGION (10 rows) — SESSION 2 MUST DRAFT
-- =============================================
-- Spot-checks:
--   P171 Priya Khan · London Bankside · Unity anon=t · "Strained relationships with my parents over my faith for years. Recent attempts at reconciliation have stalled. Pray for the Spirit to soften both sides and for me to keep loving without resentment."
--   P176 Dietrich Schmidt · Berlin Bible Translators · Laborers · "Several active translation projects are stalled because translators in the field have had to flee. Pray for their safety and for the Lord to either reopen those doors or to redirect the projects through other hands."
--   P177 François Dubois · Geneva Alpine · Provision answered · "Six months of seeking sustainable backing for our Pacific island work. A Swiss-French foundation has committed to multi-year underwriting. The Lord answered with depth where we asked for breadth."
-- TODO Session 2: Insert 7 more WE rows.

-- =============================================
-- OP REGION (6 rows) — SESSION 2 MUST DRAFT
-- =============================================
-- Spot-checks:
--   P180 Matthew Robinson · Sydney · Laborers · "Sending five staff members on extended mission trips to South Asia and Sub-Saharan Africa this winter. Pray for them, for the partner churches who will receive them, and for our home community while they''re gone."
--   P182 James Tane Williamson · Auckland · Salvation · "Two Maori families have begun attending our gatherings. Their traditional beliefs and the gospel are in real conversation. Pray for me to listen first, to honour what God has been doing among the iwi, and to share Christ with humility."
--   P184 Apenisa Tavola · Suva Pacific Network · Protection · "Climate displacement is real in our region. Two of our partner congregations on smaller islands are now facing relocation."
-- TODO Session 2: Insert 3 more OP rows.

-- =============================================
-- VERIFICATION after all inserts:
-- =============================================
-- SELECT COUNT(*) FROM public.prayer_requests;  -- target ~182
-- SELECT status, COUNT(*) FROM public.prayer_requests GROUP BY status;
--   -- expect: open ~140-150 · answered ~13 · archived ~1-2
-- SELECT category, COUNT(*) FROM public.prayer_requests GROUP BY category ORDER BY 2 DESC;
--   -- expect 8 categories covered, Laborers + Protection biggest
-- SELECT urgent, anonymous, COUNT(*) FROM public.prayer_requests GROUP BY urgent, anonymous;
--   -- urgent: ~15%, anonymous: ~25% (includes all underground forced)
