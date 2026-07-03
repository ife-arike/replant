# Paste-ready prompt — apply the 2026-07-02 Lucid corrections in place

Paste everything between the lines into a fresh Claude Code session in `~/replant`.

---

I soak this session in the blood of Jesus. Pray first, naming this work: applying the 2026-07-02 post-audit corrections to the Lucid system map, in place.

Task: apply every correction in `docs/system-map/2026-07-02-post-audit-reconciliation.md` to the live Lucid documents. Read that sheet FIRST — it carries the exact replacement text and, for doc 04, the item IDs. `docs/system-map/README.md` has the doc registry, the locked palette, and the header-outside-rect SVG lesson.

1. PROBE EDIT SCOPE FIRST. Load the Lucid MCP tools via ToolSearch, then attempt exactly one `lucid_edit_item` call — the doc-04 `sb126821a_16` edit from the sheet. If it returns 403, STOP immediately: report that the Lucid connector still lacks document-content edit scope and that I need to re-authorize it in my claude.ai connector settings before this can run. Do not attempt workarounds — the in-folder RECONCILIATION page (`548cfdbd-a080-4d91-b511-50ee2833f4fc`) already covers the interim.
2. If the probe succeeds, apply the sheet top to bottom: doc 04 (4 edits, item IDs given) → doc 06.7 (add the red NOT-BUILT banner block) → doc 08 (add the green enforcement/cascade annotation) → doc 06.5 (fix the `assertAtLeast("super_admin")` gate string to match "Sponsor (super_admin or Manager)" + add the column-authoritative annotation) → doc 05 (6-state fix + P0-2 note) → doc 11 (remove `conversations` from the published list; move to polling column) → doc 00 (extend the Upstash block). Match the locked palette; keep added blocks compact (11pt body, `auto_font_size` false).
3. Verify each doc after editing with `lucid_search_document` — confirm the new text is present and the stale strings (e.g. "3-tier verification evidence", "5-state case machine") are gone or corrected.
4. Once ALL corrections are applied: delete the RECONCILIATION page `548cfdbd-a080-4d91-b511-50ee2833f4fc` (if delete 403s, tell me to trash it by hand); remove the ⚠ CORRECTIONS PENDING banner and the reconciliation table row from `docs/system-map/README.md`; add an "applied in place on <date>" note at the top of the sheet; commit + push (`~/replant` is LAX — push freely).

Do not regenerate any existing doc — surgical edits and added blocks only.

---
