-- Replant Seed — Telemetry Generator
-- Session 2 of 2 — written 2026-06-11
-- Run AFTER prayer_requests + testimony + comments are all landed
-- Generates ~3,290 rows across:
--   prayer_request_prayed_by  (~1,130)
--   testimony_celebrated_by    (~520)
--   intercession_holds         (~1,640)
--
-- Rules baked in:
-- 1. Distribution by content age (older = more holds, newest 3 days have 33% chance of 0)
-- 2. Urgent prayer requests get 1.5x bump
-- 3. Parent-linked testimonies: ~70% of original prayed_by pool also celebrates
-- 4. Excludes author from praying for their own request
-- 5. KEEP churches skipped for intercession_holds (organic from Founder activity)
-- 6. Only active verified leaders can intercede

-- =============================================
-- 1. prayer_request_prayed_by
-- =============================================

INSERT INTO public.prayer_request_prayed_by (prayer_request_id, leader_id, prayed_at, created_at)
SELECT pr.id, u.id,
  pr.created_at + (random() * (LEAST(now(), pr.created_at + INTERVAL '21 days') - pr.created_at)),
  pr.created_at + (random() * (LEAST(now(), pr.created_at + INTERVAL '21 days') - pr.created_at))
FROM public.prayer_requests pr
CROSS JOIN LATERAL (
  SELECT u.id FROM public.users u
  WHERE u.id <> pr.user_id
    AND u.verification_status = 'verified'
    AND u.is_active = true
  ORDER BY random()
  LIMIT (
    CASE
      -- newest 3-day bucket: 33% chance of 0 holds (empty state), else 1-2
      WHEN extract(epoch from (now() - pr.created_at))/86400 < 3 THEN
        CASE WHEN random() < 0.33 THEN 0 ELSE GREATEST(1, floor(1 + random() * 2)::int) END
      -- 4-7 days: 2-7
      WHEN extract(epoch from (now() - pr.created_at))/86400 < 7 THEN
        floor(2 + random() * 6)::int
      -- 8-14 days: 5-12
      WHEN extract(epoch from (now() - pr.created_at))/86400 < 14 THEN
        floor(5 + random() * 8)::int
      -- 15-21 days (oldest): 10-18
      ELSE
        floor(10 + random() * 9)::int
    END
    * CASE WHEN pr.urgent THEN 2 ELSE 1 END  -- urgent bump (simplified 2x, was 1.5x)
  )
) u
WHERE pr.is_active = true;

-- Update prayed_count on prayer_requests (denormalized counter)
UPDATE public.prayer_requests pr
SET prayed_count = (SELECT COUNT(*) FROM public.prayer_request_prayed_by WHERE prayer_request_id = pr.id);

-- =============================================
-- 2. testimony_celebrated_by
-- =============================================
-- For parent-linked testimonies, ~70% of the prayer's prayed_by pool also celebrates;
-- For standalone, sample by age.

INSERT INTO public.testimony_celebrated_by (testimony_id, leader_id, celebrated_at)
SELECT t.id, u.id,
  t.created_at + (random() * (LEAST(now(), t.created_at + INTERVAL '14 days') - t.created_at))
FROM public.testimony t
CROSS JOIN LATERAL (
  SELECT u.id FROM public.users u
  WHERE u.id <> t.user_id
    AND u.verification_status = 'verified'
    AND u.is_active = true
  ORDER BY
    CASE
      WHEN t.original_request_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.prayer_request_prayed_by p
                   WHERE p.prayer_request_id = t.original_request_id
                     AND p.leader_id = u.id)
      THEN 0 ELSE 1 END,  -- prayed-for-parent leaders ranked first
    random()
  LIMIT (
    CASE
      WHEN extract(epoch from (now() - t.created_at))/86400 < 6 THEN floor(3 + random() * 8)::int
      WHEN extract(epoch from (now() - t.created_at))/86400 < 12 THEN floor(12 + random() * 11)::int
      ELSE floor(18 + random() * 13)::int  -- 18-30
    END
  )
) u
WHERE t.is_active = true;

-- Update celebrated_count
UPDATE public.testimony t
SET celebrated_count = (SELECT COUNT(*) FROM public.testimony_celebrated_by WHERE testimony_id = t.id);

-- =============================================
-- 3. intercession_holds (church-level "I'm standing in the gap for")
-- =============================================
-- KEEP churches excluded — Founder generates organically from her test activity

INSERT INTO public.intercession_holds (leader_id, church_id, created_at)
SELECT u.id, c.id,
  GREATEST(c.created_at, u.created_at)
  + (random() * (now() - GREATEST(c.created_at, u.created_at)))
FROM public.churches c
CROSS JOIN LATERAL (
  SELECT u.id, u.created_at FROM public.users u
  WHERE u.church_id IS DISTINCT FROM c.id  -- not interceding for own church
    AND u.verification_status = 'verified'
    AND u.is_active = true
  ORDER BY random()
  LIMIT (
    CASE
      -- KEEP churches: 0 (organic from Founder)
      WHEN c.church_code IN ('RPL-00001', 'RPL-02097', 'RPL-02100', 'RPL-02101', 'RPL-02102', 'RPL-02103') THEN 0
      -- deactivated/rejected: 0
      WHEN c.verification_status IN ('deactivated', 'rejected') THEN 0
      -- pending: 1-5
      WHEN c.verification_status = 'pending' THEN floor(1 + random() * 5)::int
      -- underground: 10-20 (high prayer demand)
      WHEN c.type = 'underground' THEN floor(10 + random() * 11)::int
      -- small (house_church, without_walls, para_ministry): 3-10
      WHEN c.type IN ('house_church', 'without_walls', 'para_ministry') THEN floor(3 + random() * 8)::int
      -- high-visibility (sender base / large main_campus over_500, or 200_to_500): 15-30
      WHEN c.congregation_size_range IN ('over_500', '200_to_500') AND c.type IN ('main_campus', 'ministry') THEN floor(15 + random() * 16)::int
      -- mid-visibility main_campus/ministry/branch: 8-18
      ELSE floor(8 + random() * 11)::int
    END
  )
) u;

-- =============================================
-- VERIFICATION queries to run after the above:
-- =============================================
-- SELECT COUNT(*) FROM public.prayer_request_prayed_by;     -- expect ~1100-1200
-- SELECT COUNT(*) FROM public.testimony_celebrated_by;      -- expect ~480-580
-- SELECT COUNT(*) FROM public.intercession_holds;           -- expect ~1500-1800
--
-- Spot check leader spread (no single leader holding everything):
-- SELECT u.full_name, COUNT(*) AS prayed_count
-- FROM public.prayer_request_prayed_by p JOIN public.users u ON u.id = p.leader_id
-- GROUP BY u.full_name ORDER BY 2 DESC LIMIT 10;
--
-- (Top leaders should be ~30-50; if some are way higher, the random sampling
-- skewed and you can reset and rerun the generator.)
--
-- "Be the first to stand in the gap" empty-state check:
-- SELECT COUNT(*) FROM public.prayer_requests WHERE prayed_count = 0 AND is_active = true;
-- (expect ~15 — these are the newest requests with 0 holds)
