// Shell.jsx + App.jsx patch — sidebar MERGE (KAN-293 + Founder delta 2026-06-30).
//
// Pastoral Signals, Flagged Messages, Replant Team Inbox, and the new
// Escalated Cases collapse into ONE parent sidebar entry with a 4-tab bar.
// Rationale: three siblings under Operations crowded the sidebar +
// muddied "where do I look first". The parent owns the route; the tabs
// hang off it as sub-routes. Parent name: "Pastoral Care" (Founder-liked
// 2026-06-30, with the pastoral-signals icon) — CONTENT lane may still
// ratify an alternative.
//
// --- Shell.jsx NAV_SECTIONS · Operations ----------------------------
//   REMOVE the two existing siblings:
//     { id: 'pastoral', path: '/pastoral', label: 'Pastoral Signals', ... }
//     { id: 'flagged',  path: '/flagged',  label: 'Flagged Messages', ... }
//   (Pastoral Signals already owned the Replant Team Inbox as its 2nd tab.)
//
//   ADD one parent entry (between Heartcry Inbox and the Content section):
//     { id: 'triage', path: '/triage', label: 'Pastoral Care', icon: 'pastoral', countKey: 'triageCount' },
//
//   The parent is visible to ALL admins (regular included) — the tab-level
//   gate hides Escalated Cases from regulars, not the whole entry. Keep the
//   /pastoral + /flagged paths as redirects to /triage/<tab> for bookmark
//   continuity (mirrors the /tier → /team redirect precedent).
//
// --- App.jsx — parent surface + tab routing -------------------------
//   <Route path="/triage" element={<TriageSurface session={session} />}>
//     <Route index element={<Navigate to="pastoral" replace />} />
//     <Route path="pastoral"   element={<PastoralQueue session={session} />} />
//     <Route path="flagged"    element={<Flagged session={session} />} />
//     <Route path="team-inbox" element={<TeamInbox session={session} />} />
//     <Route path="escalated"  element={
//       <RequireTier session={session} min="super_admin"><EscalatedCases session={session} /></RequireTier>
//     } />
//   </Route>
//
// TriageSurface renders the shared chrome — ONLY the 4-tab bar
// (.q-tabs.ec-tabs) — then an <Outlet/> for the active tab. Each tab's
// page supplies its OWN eyebrow + title (the eyebrow lineage is NOT
// unified): Pastoral=SENSITIVE, Flagged=MODERATION, Team Inbox=SENSITIVE,
// Escalated=SENSITIVE. The Escalated Cases tab is omitted from the bar for
// regular admins (anti-gossip rule — Founder-locked).
//
// Add the escalate icon to components/Icons.jsx:
//   escalate: (<svg className="rp-nav-icon ic" viewBox="0 0 24 24"><path d="M12 20V8M6 14l6-6 6 6" /><path d="M5 4h14" /></svg>),

export const TRIAGE_PARENT_NAV_ITEM = {
  id: 'triage', path: '/triage', label: 'Pastoral Care',
  icon: 'pastoral', countKey: 'triageCount',
}

// Tab definitions for TriageSurface. requiresTier gates the tab in the bar
// (tierAtLeast(viewerTier, 'super_admin') admits Manager too).
export const TRIAGE_TABS = [
  { id: 'pastoral',  to: '/triage/pastoral',   label: 'Pastoral Signals',  crumb: 'Operations / Sensitive' },
  { id: 'flagged',   to: '/triage/flagged',    label: 'Flagged Messages',  crumb: 'Operations / Moderation' },
  { id: 'inbox',     to: '/triage/team-inbox', label: 'Replant Team Inbox', crumb: 'Operations / Sensitive' },
  { id: 'escalated', to: '/triage/escalated',  label: 'Escalated Cases',   crumb: 'Operations / Sensitive', requiresTier: 'super_admin' },
]
