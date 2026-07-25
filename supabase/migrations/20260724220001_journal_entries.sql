-- ─────────────────────────────────────────────────────────────────────
-- Prayer Wall rebuild — Intercession journal free-text entries.
-- NOT YET APPLIED — ships in feat/prayer-wall-new; apply with the FE.
--
-- Founder 2026-07-24: "journal having the free text space makes it
-- feel like a journal." A private page: a name, a burden, a line of
-- prayer. Entries NEVER enter the public wall.
--
-- House pattern (mirrors 20260605000002_intercession_journal.sql):
--   - RLS enabled with NO policies → deny-all at the table.
--   - All access through SECURITY DEFINER RPCs scoped to the caller
--     via auth.uid() → public.users.id.
--   - RPCs RAISE machine-readable codes; the FE maps them to copy.
--
-- FE contract (WallJournalView):
--   create_journal_entry(p_entry_text) → uuid
--   get_journal_entries()              → (id, entry_text, created_at)
--   delete is deliberately absent at MVP (not in the reviewed design).
-- ─────────────────────────────────────────────────────────────────────

-- ─── 1. Table ─────────────────────────────────────────────────────────

CREATE TABLE public.journal_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_text text        NOT NULL CHECK (char_length(entry_text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX journal_entries_leader_created_idx
  ON public.journal_entries (leader_id, created_at DESC);

-- Deny-all: RLS on, no policies. SECURITY DEFINER RPCs are the only door.
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- ─── 2. create_journal_entry(p_entry_text) ────────────────────────────

CREATE OR REPLACE FUNCTION public.create_journal_entry(p_entry_text text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id   uuid;
  v_caller_id uuid;
  v_trimmed   text;
  v_id        uuid;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO v_caller_id FROM public.users WHERE auth_id = v_auth_id;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_trimmed := trim(COALESCE(p_entry_text, ''));
  IF char_length(v_trimmed) = 0 THEN
    RAISE EXCEPTION 'content_required';
  END IF;
  IF char_length(v_trimmed) > 500 THEN
    RAISE EXCEPTION 'content_too_long';
  END IF;

  INSERT INTO public.journal_entries (leader_id, entry_text)
  VALUES (v_caller_id, v_trimmed)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_journal_entry(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(text) TO authenticated;

-- ─── 3. get_journal_entries() ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_journal_entries()
RETURNS TABLE (
  id         uuid,
  entry_text text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id   uuid;
  v_caller_id uuid;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.id INTO v_caller_id FROM public.users u WHERE u.auth_id = v_auth_id;
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT je.id, je.entry_text, je.created_at
  FROM public.journal_entries je
  WHERE je.leader_id = v_caller_id
  ORDER BY je.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.get_journal_entries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_journal_entries() TO authenticated;
