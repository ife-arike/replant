-- KAN-293 Task #21 — attribution_display_name on messages
--
-- Nullable column that lets send-team-reply.js (admin BE lane) stamp the admin's
-- first name onto an outbound Replant Team reply. Mobile Connect DM renderer
-- surfaces this above the message bubble as "<First> · Replant Team".
--
-- No CHECK: any short human name goes. Trust the BE to scrubAndCap.
-- No default: NULL means "no attribution — fall back to plain 'Replant Team'".

ALTER TABLE public.messages
  ADD COLUMN attribution_display_name text;
