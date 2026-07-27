# Registration Form — Founder Scope Notes
*Captured 2026-05-21 from founder review of Replant Wireframes v4 (pages 1 & 2)*

Do not dispatch to CC until SPEC + DBA + BA have groomed this. This is a capture document only.

---

## Context

Ife reviewed the wireframe registration flow (Account Setup / Register Your Church screens) and identified several fields and sections that are missing from the current mobile onboarding and the web intake form. Notes below are verbatim from founder.

---

## Missing items by section

### 1. RAG status
- Church should be able to indicate their RAG status at registration.
- Wireframe pages 1 and 2 show this. Page 1 and 2 are "fairly redundant" but **page 2 has the better view** of the redundant displays — use page 2 as the reference for UI.

### 2. Visibility setting
- "Appear anonymous / visible to others" toggle.
- Ife wants this **under leader's account setup** (not buried in the church registration step).
- Already partially present in wireframe Screen 3 (Account Setup step 1 — anonymous toggle), but confirm placement is under the leader section not the church section.

### 3. Wants / Needs section
- Church should be able to indicate what they need and/or what they can offer.
- Referenced alongside the RAG section in wireframe. Exact fields TBD — needs SPEC pass.

### 4. Emergency preparedness questions (page 1 logic, founder wants on page 2)
- **Primary question:** "Do you have an emergency plan in case of sudden danger?"
  - Answer: Yes / No
  - Wording of the follow-up question changes slightly depending on Yes vs No answer.
- **Follow-up question (conditional):** "Would you be willing to strategize / combine with nearby churches?"
  - Appears after the emergency plan answer regardless of Yes/No (wording adjusts).
- Founder lean: this block should live on **page 2** of the registration flow.

### 5. Contact details — dedicated section
- The church's contact details should have their own **dedicated section** on the registration form.
- Purpose: this data comes to Replant admin and is used for **church verification**.
- Currently these fields may be mixed in with other fields; founder wants them clearly separated.
- Exact fields TBD (SPEC pass needed) — likely: primary contact name, contact email, contact phone.

---

## Role routing when grooming opens

| Role | Task |
|---|---|
| SPEC | Define field list for each new section, branching logic for emergency questions, Yes/No wording variants, wants/needs options |
| DBA | Schema changes — new columns or new table for church profile fields; migration plan |
| BA | Write tickets once SPEC + DBA complete; file to Jira backlog |
| UI/UX | Wireframe update or Claude Design pass for the new registration pages before CC dispatch |

---

## Notes

- This is separate from the web intake form at `admin.projectreplant.org/intake` — the mobile registration flow and the web intake form may diverge in field set.
- Do not dispatch CC until: SPEC has ruled on fields, DBA has ruled on schema, UI/UX has a design for the new pages.
- "No screens without wireframe" rule applies.
