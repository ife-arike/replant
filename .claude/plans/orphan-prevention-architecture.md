# Replant — Orphan-Prevention Architecture (atomic create-account)

**Status:** Draft for SME review (SEC + DBA + BA + BE)
**Author:** CC (Claude Code) — session 2026-06-14
**Founder ruling source:** "no orphans, period. churches must be registered with a leader period."
**Ticket:** TBD — Jira to be filed post-ship via MCP

---

## 1 · Context

Replant pre-launch is in UAT. A leader can today reach a state where they have registered a church to the network but abandoned signup before completing their leader account. The church row exists in `public.churches` with `verification_status = 'pending'` and zero attached leaders. Founder hit this tonight (`ruthjames08+t6@gmail.com` orphan; deleted directly).

This is structural, not a bug. The orphan window opens because `register-church` writes the church BEFORE `create-account` writes the leader. Two HTTP round-trips with FE state in between.

Founder ruling: **no orphans, ever.** Churches must be born with a leader, atomically. This proposal honors that invariant by collapsing the two writes into one.

## 2 · Current state (the orphan window)

```
FE                                BE / DB
──                                ───────
ASP1 (account info)          ───  OnboardingContext (in-memory)
ASP2 search / select         ───  read-only
ASP2 → "Register yours"      ───  nav → RegCP1
RegCP1 + RegCP2 → "Register
   Church"                   ──►  register-church v5
                                  ✗ ORPHAN CREATED:
                                  INSERT INTO churches (...)
                                  RETURNING id
                             ◄──  newChurchId
ASP2 bypass card             ───  loopback render
ASP2 → "Enter Replant"       ──►  create-account v3
                                  auth.admin.createUser(...)
                                  INSERT INTO public.users
                                    (church_id = newChurchId)
                                  on failure: compensating
                                    delete auth.user only
                                    (church row stays orphan)
                             ◄──  200 / 500
```

**Orphan windows** (any one of these leaves an orphan):

- User taps Register Church, kills the app before tapping Enter Replant.
- User taps Register Church, kills app, returns to a fresh `OnboardingContext` (in-memory; not persisted), can't reach bypass card again. Tries to re-register → `contact_email_taken` 409 on register-church.
- User taps Enter Replant, `create-account` fails mid-flight at `insertPublicUser` step (the bug we shipped a fix for tonight) → auth user comp-deleted, church row remains.

User-visible result: blocked retries, needs Replant team intervention to delete the church row.

## 3 · Target architecture

**Single write boundary.** Church + leader are inserted in one atomic transaction at the moment the leader confirms ("Enter Replant"). Register-church becomes pre-flight validation only — no DB write.

```
FE                                BE / DB
──                                ───────
ASP1                         ───  OnboardingContext
ASP2 search / select         ───  read-only
ASP2 → "Register yours"      ───  nav → RegCP1
RegCP1 + RegCP2 → "Register
   Church"                   ──►  register-church v6 (VALIDATION-ONLY)
                                  parsePayload(...)  ← reuse existing
                                  ✓ NO DB WRITE
                             ◄──  200 OK { valid: true }
                                  -- OR --
                             ◄──  400 / 409 with error code

ASP2 bypass card             ───  reads from OnboardingContext
                                  copy: "✓ Church details saved"
                                  (was: "✓ CHURCH REGISTERED")

ASP2 → "Enter Replant"       ──►  create-account v4
                                  call PL/pgSQL function
                                  rpc('create_account_atomic', {
                                    leader: {...},
                                    new_church: {...} | null,
                                    existing_church_id: uuid | null,
                                  })

PL/pgSQL function in DB:
                                  BEGIN
                                    -- validate
                                    -- if new_church: INSERT churches RETURNING id
                                    -- if existing_church_id: SELECT churches
                                       FOR UPDATE, check cap
                                    -- INSERT users with church_id
                                    -- email-side-effects queued via
                                       pg_notify, processed async
                                  COMMIT
                                  -- failure anywhere: full rollback,
                                  -- no orphan possible

                             ◄──  200 { user_id } / 4xx / 500
```

## 4 · Atomicity strategy (Path A — PL/pgSQL function)

Sequential `supabase-js` calls in an edge function are **not** atomic. If `auth.admin.createUser` succeeds and the subsequent church INSERT fails, you orphan an auth user (and vice versa). True atomicity requires a single transaction.

**Strategy:**

1. **`public.create_account_atomic(payload jsonb)` PL/pgSQL function**, `SECURITY DEFINER` (runs as the function owner, can write to `auth.users` via direct SQL into `auth.users` — but **better**: take only the public-side as atomic; `auth.users` insertion stays in the edge function as the FIRST step, and is comp-deleted on failure of the atomic step).

   **Two sub-options for the auth-side:**

   - **(A1) Auth-in-edge-function, public-side-in-RPC.** Edge function calls `auth.admin.createUser`, then calls `rpc('create_account_atomic', { auth_id, payload })`. RPC does the church + public.users INSERTs in one txn. On RPC failure, edge function comp-deletes the auth user. Auth-side has a tiny window (the RPC call), but the **church row never exists without an attached leader.** Honors Founder ruling: no church-orphans. Auth-orphan window is small (~200ms) and gets comp-deleted.

   - **(A2) Full atomicity via direct `auth.users` INSERT in PL/pgSQL.** RPC does everything including auth INSERT + hashed password. Requires the function to handle password hashing, email confirm, identity records, recovery tokens, etc. — replicates Supabase Auth internals. **Too brittle.** Supabase Auth migrations would silently break us.

   **Recommend A1.** True orphan-prevention for the visible target (churches with no leaders), pragmatic on auth side.

2. **`public.create_account_atomic`** function shape (PL/pgSQL):

   ```sql
   CREATE OR REPLACE FUNCTION public.create_account_atomic(
     p_auth_id uuid,
     p_leader jsonb,       -- first_name, middle_name, last_name, email,
                           --   phone, role, anonymous, include_middle_name
     p_new_church jsonb,   -- nullable; if present, insert church first
     p_existing_church_id uuid  -- nullable; mutually exclusive with p_new_church
   ) RETURNS TABLE(user_id uuid, church_id uuid)
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, pg_temp
   AS $$
   DECLARE
     v_church_id uuid;
     v_user_id uuid;
     v_active_count int;
   BEGIN
     -- 1. Resolve church_id
     IF p_new_church IS NOT NULL THEN
       INSERT INTO public.churches (...)
       VALUES (...from p_new_church...)
       RETURNING id INTO v_church_id;
     ELSIF p_existing_church_id IS NOT NULL THEN
       -- Lock the row to prevent cap-race
       SELECT id INTO v_church_id
       FROM public.churches
       WHERE id = p_existing_church_id
       FOR UPDATE;
       IF NOT FOUND THEN
         RAISE EXCEPTION 'church_not_found' USING ERRCODE = 'P0002';
       END IF;
       SELECT COUNT(*) INTO v_active_count
       FROM public.users
       WHERE church_id = v_church_id AND is_active = true;
       IF v_active_count >= 2 THEN
         RAISE EXCEPTION 'LEADER_CAP_EXCEEDED' USING ERRCODE = 'P0001';
       END IF;
     ELSE
       v_church_id := NULL;  -- skip-for-now path
     END IF;

     -- 2. Insert leader, attached to church (or null for skip)
     INSERT INTO public.users (
       auth_id, full_name, first_name, middle_name, last_name,
       phone, include_middle_name, email, role, church_id,
       anonymous, declaration_affirmed, declaration_date,
       verification_status, verification_deadline
     )
     VALUES (...from p_leader, v_church_id...)
     RETURNING id INTO v_user_id;

     RETURN QUERY SELECT v_user_id, v_church_id;
   END;
   $$;

   REVOKE EXECUTE ON FUNCTION public.create_account_atomic(uuid, jsonb, jsonb, uuid) FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.create_account_atomic(uuid, jsonb, jsonb, uuid) TO service_role;
   ```

3. **Email side-effects** (welcome email, new-church email) stay in the edge function as `void deps.send(...).catch(...)` fire-and-forget post-RPC-success. They are NOT inside the txn. Failure to send does not roll back the account.

4. **Validation reuse**: the existing `parsePayload` in `register-church/logic.ts` for church fields, and `create-account/logic.ts` for leader fields, are reused in the edge function before the RPC call. The PL/pgSQL function trusts the edge function's validation but enforces hard constraints (NOT NULL, unique, enum, capacity) as a final guard.

## 5 · Edge cases

- **Race: two leaders register the same church name at the same time.** Both pass register-church v6 validation. Both reach create-account v4. The PL/pgSQL function's INSERT into churches hits `churches_contact_email_unique_excl_campus` or name unique constraint. Whichever loses gets a 409 with retry copy. No orphan because the txn rolls back.

- **Race: two leaders join the same existing church when only one slot remains.** `SELECT ... FOR UPDATE` lock on the church row serializes the cap check. Second leader gets `LEADER_CAP_EXCEEDED`.

- **`register-church-delete` edge function** becomes dead code. The bypass card's "Switch" / "Delete and search again" flow no longer needs a BE call — it just clears `OnboardingContext.loopbackChurch`. Recommend removing `register-church-delete` in a follow-up PR after a one-cycle observation period.

- **Bypass card Edit flow.** Today, Edit navigates to RegCP1 with `editChurch` params loaded from the existing DB row. Under the new model, Edit loads from `OnboardingContext.loopbackChurch`. The data shape is identical.

- **App killed between RegCP2 confirm and Enter Replant.** No DB write occurred, so no orphan. User restarts, refills the form. Acceptable — Founder explicitly said "the app will refresh and their stopping point will be lost" is an acceptable trade for guaranteed atomicity.

- **Skip-for-now path.** Unchanged — `existing_church_id = null, new_church = null` → user is inserted with `church_id = NULL`. 7-day countdown starts.

- **Underground churches.** `register-church`'s parsePayload strips city/lat/lng for type=underground. That strip must move WITH the validation, so it also lives in the new validation-only register-church v6 AND inside the PL/pgSQL function (or in the edge function's pre-RPC sanitization). Recommend: keep the strip in shared validation logic that both edge functions import.

## 6 · Deploy order

Replant has no production users (pre-launch UAT). Backward compatibility is not required.

1. **DB migration**: add `public.create_account_atomic(uuid, jsonb, jsonb, uuid)`. Grant `service_role`.
2. **BE: `create-account` v4** — accepts `newChurch` payload (optional), calls the RPC after `auth.admin.createUser`, comp-deletes auth user on RPC failure.
3. **BE: `register-church` v6** — validation-only mode, returns 200 with `{ valid: true }` and no DB write. Keeps existing parsePayload.
4. **FE refactor:**
   - `RegCP2.handleRegisterChurch` no longer expects a `church_id` back; it sets `OnboardingContext.loopbackChurch` from the locally-known church payload and navs back to ASP2.
   - ASP2 `handleSubmit` (when `isNewChurchFromLoopback`) sends `newChurch` payload to create-account v4 alongside the leader payload.
   - ASP2 bypass card eyebrow softens: "✓ CHURCH REGISTERED" → "✓ Church details saved" (or similar — BA to confirm copy).
   - ASP2 `handleBypassDelete` → clears `OnboardingContext.loopbackChurch` only; remove the `register-church-delete` fetch call.
5. **Cleanup pass (follow-up PR):** remove `register-church-delete` edge function and its FE constants once observation confirms zero calls.

## 7 · Open questions per lane

### SEC
- The PL/pgSQL function is `SECURITY DEFINER`. Confirm `search_path` lockdown (`SET search_path = public, pg_temp`) is sufficient against function-resolution attacks.
- Payload validation happens in two places (edge function pre-flight + DB hard constraints). Is that the right defense-in-depth posture, or should the function do its own JSON-schema validation against `p_leader` / `p_new_church`?
- `register-church` v6 is still `verify_jwt: false` (pre-auth surface). With no DB write, the attack surface shrinks — an attacker can probe validation but cannot create rows. Confirm this posture is still acceptable.
- Rate limiting today is per-IP-per-email on create-account. With the new payload size, recommend tightening the rate-limit budget or adding per-IP-without-email throttle.

### DBA
- Should the PL/pgSQL function handle the cap check, or stay in the edge function? Recommendation: in-function with `FOR UPDATE` lock to eliminate races. Confirm.
- `churches.verification_deadline` is set to `now() + 90 days` in register-church v5. With church creation moving into create-account v4 → the deadline still gets set at the same wall-clock moment, but the source of `now()` shifts to PL/pgSQL. Confirm `timezone('utc', now())` semantics align.
- The two-FK constraint between `users.church_id` and `churches.id` does NOT enforce "every church has at least one user." Should we add a deferrable constraint or a check trigger? Per Founder ruling, the invariant is enforced by the application path (no other way to insert into churches). Recommend NOT adding a DB-level check — the path is gated by REVOKE on the function from public.
- Any RLS policies on `churches` that would block the function's INSERT? SECURITY DEFINER should bypass RLS, but confirm no row-level triggers or `region_admin_only` (per memory `project_replant_schema_facts`) interferes.
- Migration shape: pure `CREATE OR REPLACE FUNCTION` + `REVOKE` + `GRANT`. No data backfill needed. Safe under load.

### BA
- The bypass card eyebrow change ("✓ CHURCH REGISTERED" → "✓ Church details saved"). Is "saved" the right word for a leader who's just spent 5 minutes on RegCP1+RegCP2? Or do we want something more affirming ("✓ Ready to register", "✓ Church reviewed")?
- The Founder ruling locks "leaders must find a way to attach to a church within 7 days, period. no exceptions." Confirm the 7-day deactivation timer for skip-for-now leaders is untouched by this change (it lives in `computeVerificationDeadline` and `users.verification_deadline`).
- For genuine `contact_email_taken` cases (after the new architecture — someone other than this user genuinely owns that contact_email): RegCP2 modal copy + nav-to-ASP1. Confirm the destination (ASP1, not RegCP1) makes business sense for the user — Founder ruled yes earlier.
- Removing `register-church-delete` from the bypass card "Switch" flow — confirm UX is identical from the user's perspective (modal → confirm → back to search). Yes, because there's no DB row to delete; just clear context.

### BE
- Shared validation: should `register-church/logic.ts` and `create-account/logic.ts` be merged into a shared module so the validation rules can't drift? Or is the parsePayload duplication acceptable?
- Error code shape from the PL/pgSQL function: PostgREST surfaces `RAISE EXCEPTION ... USING ERRCODE = '...'` as `code` in the error object. The edge function maps these to user-facing error codes (`user_already_exists`, `LEADER_CAP_EXCEEDED`, `church_name_taken`, `contact_email_taken`). Confirm the mapping.
- Should the new payload to create-account v4 wrap leader and church under a single `account` envelope, or stay flat? Recommend flat with optional `newChurch` key — minimal FE churn.
- Telemetry: a single `account_created` log event in the success path with `{ church_created: boolean, church_id, user_id, was_skip: boolean }`. Replaces two log events from the current architecture.

## 8 · Rollback strategy

If the new flow breaks in UAT:

1. Revert `create-account` to v3 (one MCP deploy call — keep v3 source archived alongside this doc).
2. Revert `register-church` to v5 (same).
3. Revert FE commits.
4. PL/pgSQL function stays in DB but goes unused — no harm.

Manual orphan cleanup remains available via direct SQL (as done tonight for `+t6`).

## 9 · Non-goals

- Persisted `OnboardingContext` (Save-and-resume across app kills). Out of scope; Founder accepted the trade.
- Admin-side dashboard changes to handle the new flow. Admin reads `public.users` and `public.churches`; no change to admin queries.
- Removal of the legacy `users.full_name` column. Out of scope; KAN-229 tracks.
- Email template changes for the welcome email. Out of scope.

---

**SME panel: please review only your lane.** Return your verdict in the agreed format:

> **Verdict:** approve / approve-with-changes / block
> **Findings:** specific issues with file:line refs where applicable
> **Required changes (if any):** ordered list
> **Out of lane (skipped):** what you deliberately did not look at

In Jesus' name, Amen.
