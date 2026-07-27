-- Replant Seed — Comments INSERTs
-- Session 2 of 2 — written 2026-06-11
-- Run AFTER announcements are in DB (Session 1 landed them)
-- 44 rows on new announcements only (existing 5 announcements skipped — aged off wall)
--
-- mask_reason / is_masked / masked_region computed inline per author state
-- (replicating the post_comment RPC's server-side mask logic since this is direct INSERT)

INSERT INTO public.comments (announcement_id, author_id, body, mask_reason, is_masked, masked_region, created_at)
SELECT
  a.id, u.id, v.body,
  CASE
    WHEN c.type = 'underground' THEN 'underground'::mask_reason
    WHEN u.anonymous = true THEN 'anon'::mask_reason
    WHEN u.church_id IS NULL THEN 'no_church'::mask_reason
    ELSE 'none'::mask_reason
  END,
  CASE
    WHEN c.type = 'underground' THEN true
    WHEN u.anonymous = true THEN true
    WHEN u.church_id IS NULL THEN true
    ELSE false
  END,
  CASE WHEN c.type = 'underground' THEN c.country ELSE NULL END,
  v.created_at::timestamptz
FROM (VALUES
('Save the ones you keep returning to', 'François Dubois', 'RPL-30122', 'Yes! Finally. Adding our partner church in Algiers now. Been carrying them since March.', '2026-06-11 16:23'),
('21-day fast for the Church in Eritrea', 'Mary Achol Garang', 'RPL-30017', 'Amen. Eritrea is so close to our hearts here in Juba. We will fast and pray.', '2026-06-12 06:15'),
('21-day fast for the Church in Eritrea', 'Vinod Solomon', 'RPL-30061', 'Our parish will fast and pray with Eritrea this season. So heavy what they are carrying.', '2026-06-12 09:30'),
('21-day fast for the Church in Eritrea', 'Maria Cristina Reyes-Hernandez', 'RPL-30084', 'Lord have mercy on our brothers and sisters in Eritrea. Our family will skip Wednesday dinners and pray.', '2026-06-12 12:30'),
('21-day fast for the Church in Eritrea', 'Emmanuel Tabe', 'RPL-30008', 'Our diocese stands with Eritrea. We will hold one day a week through July 1. Strength to those carrying this.', '2026-06-12 09:45'),
('21-day fast for the Church in Eritrea', 'Wang Liming', 'RPL-30073', 'Bless God for raising this call. We are joining quietly from where we are.', '2026-06-13 02:18'),
('Leading remotely under surveillance', 'Dirk Daniel Van Wyk', 'RPL-30027', 'Wow, this is so needed. Sending it to our diaspora pastors group tonight.', '2026-06-12 17:42'),
('Leading remotely under surveillance', 'Roshanak Daniel Noori', 'RPL-30053', 'This is our daily life. Grateful someone is putting words to it. Sending to a few sisters here.', '2026-06-12 19:15'),
('A new scripture series begins tomorrow', 'Joshua Kamau', 'RPL-30020', 'Amen! Our team has been needing this. Looking forward to walking through it together.', '2026-06-13 19:30'),
('Three Sudanese pastors held without charge', 'Daoud Yousef', 'RPL-30025', 'We see them from here. Their families come to our church on Fridays. We will not stop praying.', '2026-06-14 14:30'),
('Three Sudanese pastors held without charge', 'Samuel Aguer', 'RPL-30017', 'My God, this is heavy. Their families are like ours here. We will hold them daily until they come home.', '2026-06-14 13:15'),
('Three Sudanese pastors held without charge', 'Augustin Pascal Ngakola', 'RPL-30010', 'Lord have mercy on our brothers. Bangui is praying. Send word when they are home.', '2026-06-14 16:45'),
('Three Sudanese pastors held without charge', 'François Dubois', 'RPL-30122', 'Adding their names to our Sahel intercession circle this week. May the Lord cover them and their families.', '2026-06-14 14:55'),
('Welcome to 14 new leaders', 'Kwame Asante', 'RPL-30028', 'Welcome family! So glad you found your way to us. Accra is praying for each one of you.', '2026-06-15 15:20'),
('Welcome to 14 new leaders', 'Vinod Solomon', 'RPL-30061', 'Welcome welcome! May the Lord settle each of you quickly and surround you with people who will walk with you.', '2026-06-15 16:45'),
('Welcome to 14 new leaders', 'Park Sungho', 'RPL-30081', 'Welcome! Seoul has been praying for new leaders to be added. Praise God for each of you.', '2026-06-15 22:30'),
('Mark a prayer answered this week', 'François Dubois', 'RPL-30122', 'Yes! I just marked one this morning. Going to go back and update three others this week. So good to remember what He has done.', '2026-06-15 23:15'),
('When the pastor needs a pastor', 'Dirk Daniel Van Wyk', 'RPL-30027', 'Oh wow, this one hit. Going to call my old supervisor this week. Thank you to whoever wrote this.', '2026-06-17 18:00'),
('When the pastor needs a pastor', 'Marie-Antoinette Mboyo', 'RPL-30007', 'I wish I had read this last year. Sharing with our diocesan pastors. Bless you for naming it.', '2026-06-17 20:30'),
('When the pastor needs a pastor', 'Babak Nikzad', 'RPL-30030', 'Many of us see ourselves in this. Going to read it with my small circle this week.', '2026-06-18 09:30'),
('Heartcry triage runs around the clock', 'Habib Awad', 'RPL-30018', 'Bless God for the watch team! That is faster than I expected. Sharing with our circle.', '2026-06-18 18:45'),
('Stand with the Indian Church on June 23', 'Vinod Solomon', 'RPL-30061', 'Amen! Our pastors here in Lucknow are already fasting that day. May the Lord intervene for our Church in India.', '2026-06-18 22:30'),
('Stand with the Indian Church on June 23', 'Thoiba Khwairakpam', 'RPL-30057', 'Already on our prayer list here in Manipur. Adding the fast. We need the Lord to move.', '2026-06-18 23:45'),
('Stand with the Indian Church on June 23', 'Pervaiz Daniel Masih', 'RPL-30062', 'Pakistani Church stands with our Indian brothers and sisters on June 23. We will fast with you. The body is one.', '2026-06-19 04:30'),
('Stand with the Indian Church on June 23', 'François Dubois', 'RPL-30122', 'Pulling our Alpine network together for the day. We stand with you and pray the Lord moves these bills off the floor.', '2026-06-19 08:15'),
('Three new underground churches added', 'François Dubois', 'RPL-30122', 'Praying for the three of you, even without your names. May the Lord be near you and your people this week.', '2026-06-19 18:30'),
('Three new underground churches added', 'Kwame Asante', 'RPL-30028', 'Hallelujah, more of the body is showing up here. Praying for the three of you as I scrolled past your cards.', '2026-06-19 22:45'),
('How the persecuted Church prays for itself', 'Rakib Hossain', 'RPL-30056', 'This sounds like our mornings here. So thankful someone is putting words to what we live. Sending to my group.', '2026-06-20 19:20'),
('How the persecuted Church prays for itself', 'François Dubois', 'RPL-30122', 'Wow. So much for us to learn from our brothers and sisters. Sending this to our retreat team.', '2026-06-20 17:45'),
('Where the Church stands · 2026 briefing', 'Dirk Daniel Van Wyk', 'RPL-30027', 'Read this with my coffee this morning. Already shifted our prayer focus for the week. Thank you for this.', '2026-06-21 16:20'),
('Where the Church stands · 2026 briefing', 'Michael Thompson', 'RPL-30108', 'Sending this to our missions board this week. We need to be praying with our eyes open.', '2026-06-21 14:30'),
('Where the Church stands · 2026 briefing', 'Park Sungho', 'RPL-30081', 'Going to study this with our intercession team. So important. Thank you for putting it together.', '2026-06-21 22:15'),
('Seven-day network fast: July 1–7', 'Joshua Kamau', 'RPL-30020', 'Taking Sudan. Lord knows we have been holding them. Our parish will lead the fast that day.', '2026-06-23 15:45'),
('Seven-day network fast: July 1–7', 'François Dubois', 'RPL-30122', 'Geneva office will take Iran. We have brothers and sisters there carrying so much. Standing with them and you.', '2026-06-23 16:00'),
('Seven-day network fast: July 1–7', 'Kwame Asante', 'RPL-30028', 'Accra is on Nigeria! Across the gulf for our brothers and sisters. May the Lord intervene in the north especially.', '2026-06-23 18:30'),
('Seven-day network fast: July 1–7', 'Park Sungho', 'RPL-30081', 'Seoul takes North Korea, of course. Our hearts have been there our whole lives. May the Lord break every chain.', '2026-06-23 23:15'),
('Seven-day network fast: July 1–7', 'Pascal Ouédraogo Compaoré', 'RPL-30013', 'Counting in for China day. Our young people will fast with us. So good to be in this together.', '2026-06-24 09:30'),
('Seven-day network fast: July 1–7', 'Park Sunghyun', 'RPL-30070', 'Receiving the cover from here. So grateful for our family across the borders. We feel each prayer.', '2026-06-24 03:20'),
('Six leaders need urgent intercession', 'Emmanuel Tabe', 'RPL-30008', 'Praying for the six tonight. Lord be near each of them in whatever they carry.', '2026-06-23 23:30'),
('Six leaders need urgent intercession', 'Maria Cristina Reyes-Hernandez', 'RPL-30084', 'Lifting all six in prayer tonight. You are not alone with them, family.', '2026-06-24 02:15'),
('Six leaders need urgent intercession', 'Comfort Nformi', 'RPL-30008', 'Standing with the six in prayer. Whatever you are carrying, our Father sees you. He has not forgotten.', '2026-06-24 04:45'),
('Six leaders need urgent intercession', 'Mary Achol Garang', 'RPL-30017', 'Prayed for the six on my walk to service this morning. Juba is with you all.', '2026-06-24 06:30'),
('Reach across the globe this week', 'Vinod Solomon', 'RPL-30061', 'Sent three requests this week and one already came back with a yes! The Lord is moving across borders. So good.', '2026-06-24 15:30'),
('Reach across the globe this week', 'Esther Njoroge', 'RPL-30020', 'Going to reach out to a sister in Belarus this week. Have been thinking about her since the briefing. Lord, use it.', '2026-06-24 18:00')
) v(ann_title, leader_name, church_code, body, created_at)
JOIN public.announcements a ON a.title = v.ann_title
JOIN public.churches c ON c.church_code = v.church_code
JOIN public.users u ON u.church_id = c.id AND u.full_name = v.leader_name;

-- Update comment_count on each announcement (denormalized counter)
UPDATE public.announcements a
SET comment_count = (SELECT COUNT(*) FROM public.comments WHERE announcement_id = a.id);

-- VERIFICATION:
-- SELECT COUNT(*) FROM public.comments;  -- expect 44
-- SELECT mask_reason, COUNT(*) FROM public.comments GROUP BY mask_reason;
--   -- expect: none ~37, underground ~6, anon ~1
