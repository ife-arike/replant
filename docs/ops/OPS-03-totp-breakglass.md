# OPS-03 — Founder TOTP Self-Lockout · Break-Glass Procedure

**Status:** Live procedure (KAN-162, locked 2026-05-14)
**Scope:** Founder self-recovery when TOTP access to the Replant admin app is lost.
**Audience:** The founder, reading this under stress, possibly at 3am. Every step is a single concrete action.

---

## Before this is needed (read once now — it's the cheapest insurance)

The founder maintains **TOTP enrollment on two physical devices** (primary + backup), per KAN-97 AC-11. Most lockouts are not lockouts at all: if the primary authenticator is lost / stolen / wiped, **the backup device authenticates normally** and recovery is automatic — no procedure required, just sign in with the backup.

**This break-glass procedure is the last resort.** Use it only when **both** devices are simultaneously unavailable, compromised, or lost. If one device still works, stop here and authenticate with it.

If you are about to use this procedure, also: re-establish the two-device discipline as part of recovery (Step 4 below). You will need it the next time.

---

## What this procedure does (in plain language)

Three things must happen, in order:

1. **Remove the broken TOTP factor** from your Supabase auth user record (so the admin app stops trying to challenge against a factor you can't satisfy).
2. **Enrol TOTP again on a fresh, working physical device.**
3. **Write one row to `public.audit_log`** so the bypass is permanently visible to anyone reviewing admin security history. No silent recoveries.

Steps 1 + 3 happen as a single Postgres transaction so neither lands without the other.

The procedure is **app-independent** — it bypasses the Replant admin app entirely. You only need:
- Your Supabase project-owner credentials (login email + password, not TOTP)
- A web browser
- A fresh physical device with an authenticator app

---

## The Procedure — 5 Steps

### Step 1 — Access Supabase directly

Open <https://supabase.com> in a browser and sign in as **project owner** of project `jiyetphxxvyiicrnwlnx`.

This is project-owner login (email + password), not the founder's admin-app login. Project-owner access uses Supabase's own auth surface, which is independent of the TOTP factor you're trying to remove. Do **not** open the Replant admin app at any point in this procedure — it will continue to challenge you for the broken factor and you will get nowhere.

### Step 2 — Locate the founder account

In the Supabase dashboard sidebar: **Authentication → Users**.

Find the founder account by the canonical anchor:

```
auth.users.id = ded45949-438e-422e-9dbf-9dadb2ee4f84
```

Click that user row to open the user detail panel.

### Step 3 — Identify the locked TOTP factor

Inside the user detail panel, scroll to the **MFA factors** section. You will see one or more entries, each with its own UUID.

**Copy the UUID of the factor that is locked or compromised.** Paste it somewhere safe (text editor, Notes, anywhere you can read it back). You will need this exact UUID in Step 5 — **twice**, in both Step A and Step B of the transaction. Both must reference the same UUID for the bypass to be coherent.

> Pause here. Do not delete the factor from the dashboard UI. Step 5 deletes it transactionally alongside the audit row so the two writes can't end up in inconsistent states.

### Step 4 — Re-enrol TOTP on a fresh device

**Before you write anything to the database**, prepare a fresh physical device (different from the one whose factor you're about to revoke) with an authenticator app (1Password, Authy, Google Authenticator, etc.).

You will enrol the new factor through the normal Replant admin app flow **after** Step 5 completes. The reason this step appears here, before the database write, is to make sure you have a working alternative device in hand before you remove the last factor. If you remove the locked factor without a fresh device ready to enrol, you'll leave the account with zero TOTP factors and you will hit this procedure again.

**Confirm the fresh device is functional and the authenticator app is installed and ready** before proceeding to Step 5. Do not access the admin app until enrolment on the fresh device is verified working (you'll do that enrolment in the same session as Step 5 — through the admin-app login flow after the broken factor is gone).

### Step 5 — Execute the recovery transaction in the Supabase SQL editor

In the Supabase dashboard sidebar: **SQL Editor → New query**.

Paste the template below into the editor. **Fill in four values before executing.** All four are required; the transaction will roll back if `<REASON_ENUM>` doesn't match one of the allowed strings.

```sql
BEGIN;

-- Step A: Revoke the locked TOTP factor from Supabase auth.
-- Replace <FACTOR_ID_TO_REVOKE> with the UUID copied in Step 3.
-- Both the id AND the user_id must match so a typo in the factor UUID
-- doesn't accidentally revoke a different user's factor.
DELETE FROM auth.mfa_factors
WHERE id = '<FACTOR_ID_TO_REVOKE>'
  AND user_id = 'ded45949-438e-422e-9dbf-9dadb2ee4f84';

-- Step B: Write the audit_log row documenting the break-glass bypass.
-- accessed_by is the founder's public.users.id (NOT the auth.users.id
-- on line above — the audit_log FKs the public users table).
INSERT INTO public.audit_log (action, accessed_by, meta, created_at)
VALUES (
  'admin_mfa_factor_reset',
  'bb6c6385-236a-402a-9a6c-66ca3468fdf5',
  jsonb_build_object(
    'sub_type',              'break_glass_self_recovery',
    'reason',                '<REASON_ENUM>',
    'factor_id_revoked',     '<FACTOR_ID_TO_REVOKE>',
    'ip',                    '<YOUR_IP>',
    'user_agent',            '<BROWSER_UA>',
    'recovery_initiated_at', NOW()::text
  ),
  NOW()
);

COMMIT;
```

**Fill in these four values:**

| Placeholder | What to put | Notes |
|---|---|---|
| `<FACTOR_ID_TO_REVOKE>` | UUID copied in Step 3 | Same value in both Step A and Step B. Format: `'uuid-here'` (single-quoted). |
| `<REASON_ENUM>` | One of three exact strings | `'self_lockout_authenticator_lost'` · `'self_lockout_backup_codes_lost'` · `'self_lockout_both_lost'` |
| `<YOUR_IP>` | Your current public IP | Format: `'203.0.113.42'` (single-quoted). Find it at <https://ifconfig.me> or similar. |
| `<BROWSER_UA>` | Your browser user-agent string | Cap to 500 chars. Find at <https://www.whatismybrowser.com/detect/what-is-my-user-agent>. Single-quoted; escape any embedded single quotes by doubling them. |

Click **Run** in the SQL editor. The transaction is atomic via `BEGIN` / `COMMIT` (KAN-117 application-layer atomicity pattern): if either Step A or Step B fails, both roll back. There is no path that revokes the factor without writing the audit row, and no path that writes the audit row without revoking the factor.

### Post-recovery verification (mandatory — do not skip)

Run this SELECT in the same SQL editor:

```sql
SELECT id, action, accessed_by, meta, created_at
FROM public.audit_log
WHERE action = 'admin_mfa_factor_reset'
  AND accessed_by = 'bb6c6385-236a-402a-9a6c-66ca3468fdf5'
ORDER BY created_at DESC
LIMIT 1;
```

**Confirm all four of these on the returned row:**

- `action` = `admin_mfa_factor_reset`
- `meta->>'sub_type'` = `break_glass_self_recovery`
- `meta->>'factor_id_revoked'` matches the UUID you put into Step A
- `created_at` is within the last 5 minutes

**If the row is absent or any field is wrong:** the audit `INSERT` silently failed (or rolled back). The factor revocation may also have rolled back — verify by re-checking the MFA factors list in Authentication → Users. **Do not declare recovery complete and do not re-enrol TOTP until the audit row is confirmed present and correctly shaped.** If you cannot get the audit row to land, stop and escalate to SEC before proceeding.

### After verification — finish the recovery

1. Open the Replant admin app and sign in with email + password.
2. The app will prompt for TOTP enrolment (no factor is on file). Enrol the fresh device prepared in Step 4.
3. **Enrol a second physical device immediately** — this re-establishes the two-device discipline so the next lockout is not a lockout.
4. Confirm both devices generate valid codes against the admin app.

You're back in.

---

## Cross-references

- **[KAN-97](https://projectreplant.atlassian.net/browse/KAN-97)** — TOTP enrolment + AAL2 enforcement implementation. The upstream change that makes the lockout scenario possible. AC-11 of KAN-97 is the source of the two-device discipline in the prep note above.
- **[D-52](https://projectreplant.atlassian.net/browse/D-52)** — Governing decision (locked 2026-05-13, founder ratification via COO). Clause 4(c) requires this procedure to be documented in OPS-03 before TOTP enforcement goes live. Clause 4 also prohibits automated recovery paths and email-based factor recovery — direct SQL via the Supabase SQL editor is the deliberately-narrow shape.
- **[KAN-162](https://projectreplant.atlassian.net/browse/KAN-162)** — This ticket. SEC sign-off on the SQL template + `meta` shape locked at c.12477 (2026-05-14).

### Self-reset vs founder-resets-another-admin (important distinction)

Both paths use the same canonical audit action: `admin_mfa_factor_reset`. They are distinguished by `meta->>'sub_type'`:

| Scenario | Caller | Path | `meta.sub_type` |
|---|---|---|---|
| **Founder resets own locked factor (this procedure)** | Founder | Supabase SQL editor (direct) | `break_glass_self_recovery` |
| Founder resets another admin's locked factor | Founder | Replant admin app (standard flow) | (set by the admin-app handler, NOT `break_glass_self_recovery`) |

The standard path runs through the admin app with full step-up auth, audit context, and request-scoped logging. The break-glass path bypasses all of that because the founder cannot authenticate to the admin app in the first place. The `meta.sub_type` field is the discriminator a reviewer uses to know which path was taken.

**The `break_glass_self_recovery` sub-type tag exists precisely so a reviewer can grep for these events.** Every row with that sub-type warrants a post-incident review — not because it's necessarily suspicious, but because it bypassed the normal admin-app controls and the reviewer should confirm the recovery was legitimate.

---

## Audit query — find all break-glass events

For periodic security review (recommended quarterly, more often if anything looks off):

```sql
SELECT id, accessed_by, meta, created_at
FROM public.audit_log
WHERE action = 'admin_mfa_factor_reset'
  AND meta->>'sub_type' = 'break_glass_self_recovery'
ORDER BY created_at DESC;
```

Every row returned should match a known recovery event with a remembered reason. An unexplained row = potential indicator of compromise — escalate to SEC.
