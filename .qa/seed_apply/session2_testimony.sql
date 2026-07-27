-- Replant Seed — Testimony INSERTs
-- Session 2 of 2 — written 2026-06-11
-- Run AFTER prayer_requests are landed (13 of 30 reference original_request_id)
-- 30 rows: 13 parent-linked + 17 standalone
-- Conventions: celebrated_count=0 (telemetry populates), is_active=true

-- Helper function to find parent prayer_request id by church + content match
-- (used for 13 parent-linked testimonies)

-- =============================================
-- PARENT-LINKED TESTIMONIES (13 rows)
-- Each references a specific answered prayer_request via subquery match on
-- (church_code + a unique content fragment + status='answered')
-- =============================================

INSERT INTO public.testimony (church_id, user_id, content, original_request_id, anonymous, celebrated_count, is_active, created_at)
SELECT
  c.id, u.id, v.content,
  (SELECT pr.id FROM public.prayer_requests pr
   WHERE pr.church_id = c.id
     AND pr.status = 'answered'
     AND pr.content ILIKE '%' || v.parent_fragment || '%'
   ORDER BY pr.created_at DESC LIMIT 1),
  v.anon::boolean, 0, true, v.created_at::timestamptz
FROM (VALUES
('RPL-30001', 'Joseph Pam', 'Twenty months ago we had to release one of our elders, Pastor Iliya. Both of us walked away grieved. After eight months of asking the Lord to soften what hardened in him, he called this past Sunday and asked to meet for coffee. We talked for three hours. He didn''t ask for his role back. He just wanted to make sure I knew he forgave me, and asked if I had forgiven him. The Lord did this. We''re not whole yet, but we''re walking again.',
 'elder we had to step down', false, '2026-06-04'),
('RPL-30003', 'Samuel Adeoye Adetayo', 'Three months of praying for an administrator who could carry the operational weight of our outreach so I could pastor. Mama Adesola Kareem, a woman from our home church who had taken a sabbatical from corporate work, reached out last week and asked if her time off could become time given. She started Monday. The ministry breathed for the first time in a year.',
 'administrator who could come alongside our team', false, '2026-06-02'),
('RPL-30007', 'Marie-Antoinette Mboyo', 'Sister Bénédicte was diagnosed with tuberculosis in March. The whole intercession circle stood with her family for three months. Last week she tested clear. She came to gathering on Sunday and wept through the worship. The Lord healed her body. She is healing our faith.',
 'Sister Bénédicte', false, '2026-06-01'),
('RPL-30020', 'Joshua Kamau', 'Deacon Brian''s car accident in late February left him in the ICU for eleven days. Doctors prepared us for a long recovery, possibly permanent disability. Two months of network-wide intercession. He walked into the elders'' meeting this past Monday under his own strength. He led us in prayer with tears we all share. The Lord answered.',
 'Brian', false, '2026-06-03'),
('RPL-30028', 'Kwame Asante', 'Three years of asking the Lord for a youth pastor who would carry our young people with discernment and joy. Mensah grew up in our church. He went to seminary in Lagos and we expected him to plant somewhere else. He came back to our 9am service this past Sunday and said the Lord told him he was home. He starts officially next month. Sometimes the answer is someone the Lord was always sending back.',
 'youth pastor', false, '2026-06-02'),
('RPL-30038', 'Yousef Mikhail', 'Four months praying for an assistant pastor who could carry what I cannot carry alone in this brave-naming season. A brother from a sister fellowship in Alexandria, Anton, accepted last week. He''s been counting the cost for two years. He starts in three weeks. The Lord knew Anton before I knew to ask.',
 'assistant pastor', false, '2026-05-30'),
('RPL-30042', 'Daniel Saadon', 'Our new outreach centre was over budget by a third when we asked the body to stand with us. We hadn''t yet asked anyone for money. A pastor in Detroit who has visited Erbil twice in the past five years reached out unprompted and said the Lord had been pressing him to send the difference. He sent the exact amount we were short. The Lord answered before we asked the body, and through someone we hadn''t asked at all.',
 'over budget by a third', false, '2026-05-30'),
('RPL-30064', 'Anton Joseph Fernando', 'Our after-school programme in Maradana serves over two hundred children weekly. Funding has been precarious for over a year. A diaspora-led foundation we had never approached reached out and committed five years of underwriting. The Lord answered with surplus where we asked for survival. Now we plan instead of scramble.',
 'after-school programme', false, '2026-05-29'),
('RPL-30076', 'Zhao John Mingxuan', 'Eighteen months of asking the Lord for steady elders who could carry the weight of being a publicly-named house church in our city. Three brothers were affirmed this past Sunday. Each came forward without prompting in the past two months. We didn''t recruit. The Lord brought them in His own time.',
 'steady elders', false, '2026-05-28'),
('RPL-30081', 'Park Sungho', 'Three months of seeking a long-term partner for our North Korea defector ministry. A foundation in Geneva committed for the next five years. The grant covers what we hadn''t dared to ask the Lord for. He answered with depth where we asked for breadth. Glory to His name.',
 'North Korea defector ministry', false, '2026-05-30'),
('RPL-30090', 'Bobur Khasanov', 'Nine months of asking the Lord to give us an elder who could shoulder some of what I had been carrying alone. A brother from another city moved to Tashkent for work in March. He was affirmed by the fellowship this past Sunday. He had been praying to be sent before I knew to ask. The Lord matched our prayers without us knowing we were on the same ground.',
 'elder who could shoulder', false, '2026-05-29'),
('RPL-30108', 'Michael Thompson', 'Pastor Eze''s mother walked through her final round of chemotherapy in April. Two months of network intercession. Doctors confirmed remission this past Thursday. The family rang the bell together. The body of believers at Houston Bible has carried Eze and his mother with such tenderness through these months. The Lord did what we asked, and through the kindness of His people, He did something else we hadn''t asked for too.',
 'worship pastor', false, '2026-05-28'),
('RPL-30122', 'François Dubois', 'Six months of seeking sustainable backing for our Pacific island work after our previous grant cycle ended. A Swiss-French foundation has committed to multi-year underwriting. Beyond what we had projected. The Lord answered with depth where we had only asked for breadth. The islands will see steady visits for the next four years.',
 'Pacific island work', false, '2026-05-29')
) v(church_code, leader_name, content, parent_fragment, anon, created_at)
JOIN public.churches c ON c.church_code = v.church_code
JOIN public.users u ON u.church_id = c.id AND u.full_name = v.leader_name;

-- =============================================
-- STANDALONE TESTIMONIES (17 rows — original_request_id is NULL)
-- =============================================

INSERT INTO public.testimony (church_id, user_id, content, original_request_id, anonymous, celebrated_count, is_active, created_at)
SELECT
  c.id, u.id, v.content, NULL, v.anon::boolean, 0, true, v.created_at::timestamptz
FROM (VALUES
('RPL-30002', 'Bitrus Yusuf', 'Three young men who came to us last year after a Boko Haram attack on their village stayed with our families through the recovery. Two have stayed in Maiduguri. The third returned to his village and rebuilt with his uncle. He sent word this week that he is leading prayer at his uncle''s home with the family. The Lord made a small flame where there was only ash.',
 false, '2026-06-01'),
('RPL-30008', 'Emmanuel Tabe', 'Two of our families lost a son and a brother to the conflict this year. They came to evening Eucharist together last Sunday for the first time in eleven months. They sat on the same row. They did not speak. They wept through the prayers. The Spirit was holding what we could not yet name. The Lord is doing something.',
 false, '2026-05-28'),
('RPL-30016', 'Mateus Mauricio', 'Four families we evacuated to the inland last month sent word back this week. The host congregations in Pemba and Nampula have not only fed them; they have absorbed them into the choirs, the prayer groups, the daily life. One of our mothers wrote that she did not know the body of Christ could carry her this way. We did not know either. The Lord is teaching us through the displacement.',
 false, '2026-05-25'),
('RPL-30020', 'Esther Njoroge', 'Our worship team retreat last weekend ended differently than I planned. I had a teaching outline. The Lord had a different rhythm. The team led each other in confession for two hours on Saturday night. By Sunday morning what had been brittle was tender. The Lord broke what I would have only re-organised.',
 false, '2026-05-27'),
('RPL-30027', 'Thandiwe Esther Mbeki', 'Our after-school programme in Khayelitsha received an unexpected gift this week. A grandmother from our congregation, who has cleaned offices for thirty years, brought us her tithe in cash from a small inheritance and asked us to use it for the children''s books. The amount was modest. The way she gave it broke us open. The widow''s two mites is not a parable. It is a Sunday morning in our parish.',
 false, '2026-06-02'),
('RPL-30039', 'Anba Boutros Mikhail', 'A Muslim teenage boy who walked into our morning prayer two weeks ago came back this past week. He sat through the entire liturgy and did not speak. He left a small handwritten note in our offering basket that simply said thank you. I do not know his name. The Lord does. We pray for him in our anonymity and his.',
 false, '2026-05-30'),
('RPL-30041', 'Anton Sako', 'My uncle who fled Mosul in 2014 has been asking spiritual questions for several months through video calls. This week he asked to read the Gospel of John with me, one chapter a week. We began on Wednesday. He is sixty-eight years old. The Lord is doing what I had thought was impossible.',
 false, '2026-06-04'),
('RPL-30044', 'Issa Boutros Karam', 'Our youth choir resumed practice this past Monday for the first time since the November shelling damaged our church space. They practiced in the only intact room on the first floor. They sang quietly. They sang. The Lord has not given up on what He started in Aleppo.',
 false, '2026-05-31'),
('RPL-30057', 'Thoiba Khwairakpam', 'A Kuki family our church had been ministering to before the conflict reached out two weeks ago through a relief network. They asked if our prayers had continued. They are still alive. Their oldest son was baptised at a relief camp last month. We did not stop praying. They did not stop trusting. The Lord held the line.',
 false, '2026-05-28'),
('RPL-30056', 'Rakib Hossain', 'A Muslim woman from a respected family in our city attended our gathering for the third time last week. She asked at the end if she could be prayed for. She asked specifically for her husband''s heart. We prayed for him by name. She returned this week and said something has shifted at home. We do not know what. The Lord knows. We continue.',
 false, '2026-06-03'),
('RPL-30075', 'Chen Jianhua', 'Two business owners in our network who had lost the most from this year of pressure met for a meal last week. They had been at odds over a debt unrelated to our fellowship. They came to gathering on Sunday and forgave each other before the bread was broken. The body broke what business could not heal.',
 true, '2026-05-29'),
('RPL-30084', 'Maria Cristina Reyes-Hernandez', 'My cousin''s husband, the long-time skeptic I had been praying for, asked to come to my house for coffee last Saturday. He said he had been reading the New Testament I gave him three Christmases ago. He wanted to know what to do next. We sat for two hours. He did not pray yet. He is closer than he has ever been. The Lord is preparing him.',
 false, '2026-06-04'),
('RPL-30095', 'Aleksandr Petrovich Volkov', 'An older brother in our congregation who has been silent in worship for nearly a decade after his son died led a prayer at our prayer meeting this past Wednesday. He had not asked. He stood up at the end and asked if he could pray. He thanked the Lord by name for the first time in many years. We did not move. We did not breathe. The Lord raised something we had stopped expecting.',
 false, '2026-05-30'),
('RPL-30101', 'Lupita Cruz', 'One of the young women who came through our shelter two years ago returned this past week as a volunteer. She asked to mentor the women currently in residence. She told me she had been clean for eighteen months and had been in a stable church for the past year. She asked if she could give back. The Lord redeemed what was stolen and is using it to redeem others.',
 false, '2026-06-01'),
('RPL-30112', 'Robert Lee Bryant', 'Our community development arm hosted a small gathering for grieving families this past Saturday. Three of the families who had been most resistant to coming sat together at one table. They cried. They told stories about their lost loved ones. They prayed for each other before they left. We had set up tables and food. The Holy Spirit had set up something we could not have planned.',
 false, '2026-06-03'),
('RPL-30111', 'Edward Henderson', 'A team of translators in West Africa who had been displaced last year resumed work this past month from a safer site. They sent us the first complete draft of the New Testament in their target language. We had thought the project was on indefinite pause. The Lord is faithful to His own word.',
 false, '2026-05-26'),
('RPL-30121', 'Dietrich Schmidt', 'A translator who had to flee her assignment area in February quietly resumed work from a safer location this past month. The first draft of the Gospel of Mark in her target language arrived in our office on Tuesday. She wrote in the cover letter that the work itself has been her own discipleship. The Lord is honoring her faithfulness even when the conditions are not.',
 false, '2026-06-02')
) v(church_code, leader_name, content, anon, created_at)
JOIN public.churches c ON c.church_code = v.church_code
JOIN public.users u ON u.church_id = c.id AND u.full_name = v.leader_name;

-- VERIFICATION (run after both INSERTs above):
-- SELECT COUNT(*) FROM public.testimony;  -- expect 30
-- SELECT COUNT(*) FROM public.testimony WHERE original_request_id IS NOT NULL;  -- expect 13
