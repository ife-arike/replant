-- Home tab redesign — announcements.card_type enum
--
-- D-65 (2 June 2026): announcements.card_type enum introduced to drive mobile
-- card routing. Founder-approved 2026-06-02. Values:
--   standard        — default AnnouncementCard
--   article         — ArticleCard
--   long_read       — ArticleCard (long-form variant)
--   leader_word     — LeaderWordCard (requires author_type='leader')
--   encouragement   — EncouragementCard (short form)
--   together        — TogetherCard (multi-author)
--   call_to_action  — CallToActionCard
--
-- All existing rows take the 'standard' default; no backfill needed. The CHECK
-- pins the value space so an unknown card_type can never reach mobile routing.

BEGIN;

ALTER TABLE public.announcements
  ADD COLUMN card_type text NOT NULL DEFAULT 'standard'
  CHECK (card_type IN (
    'standard', 'article', 'long_read', 'leader_word',
    'encouragement', 'together', 'call_to_action'
  ));

COMMENT ON COLUMN public.announcements.card_type IS
  'D-65 (2026-06-02): mobile card routing. standard (default AnnouncementCard) | article/long_read (ArticleCard) | leader_word (LeaderWordCard, requires author_type=''leader'') | encouragement (EncouragementCard short form) | together (TogetherCard multi-author) | call_to_action (CallToActionCard). CHECK-pinned. Founder-approved.';

COMMIT;
