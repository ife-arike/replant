/* eslint-disable */
// ── Escalated Cases · prototype data + icon set ───────────────────────
// Shapes mirror list-pastoral-queue.js / list-flagged-messages.js row
// payloads + a synthesized EscalatedCase envelope (server creates one on
// the regular's "Escalate this case" submit). Names + content are fixture.

// ---- icon set (lifted from components/Icons.jsx, +a few locals) ----
const I = (p, extra) => (
  <svg viewBox="0 0 24 24" className="ic" style={{ stroke: 'currentColor', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', ...(extra || {}) }}>{p}</svg>
);
const ICONS = {
  pastoral: I(<><path d="M3 13c0-5 4-9 9-9s9 4 9 9" /><circle cx="12" cy="14" r="2.5" /><path d="M9 19h6" /></>),
  flag: I(<><path d="M5 3v18" /><path d="M5 4h12l-2 4 2 4H5" /></>),
  escalate: I(<><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>),
  out: I(<><path d="M14 4H5v16h9" /><path d="M10 12h11M17 8l4 4-4 4" /></>),
  restrict: I(<><circle cx="12" cy="12" r="9" /><path d="M5.5 5.5l13 13" /></>),
  revoke: I(<><path d="M18 6L6 18M6 6l12 12" /></>),
  close: I(<><path d="M5 12l5 5 9-9" /></>),
  chev: I(<path d="M9 6l6 6-6 6" />),
  expand: I(<path d="M6 9l6 6 6-6" />),
  clock: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>),
  info: I(<><circle cx="12" cy="12" r="9" /><path d="M12 8v.5M12 11v6" /></>),
  warn: I(<><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></>),
  lock: I(<><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  shield: I(<><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>),
  x: I(<path d="M18 6L6 18M6 6l12 12" />),
  check: I(<path d="M5 12l5 5 9-9" />),
  refresh: I(<><path d="M3.5 12a8.5 8.5 0 0 1 14.6-6L21 9" /><path d="M21 4v5h-5" /><path d="M20.5 12a8.5 8.5 0 0 1-14.6 6L3 15" /><path d="M3 20v-5h5" /></>),
  calendar: I(<><rect x="3" y="5" width="18" height="16" rx="1" /><path d="M3 9h18M8 3v4M16 3v4" /></>),
  arrowUp: I(<><path d="M12 19V5M5 12l7-7 7 7" /></>),
  users: I(<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2.5 2-4 4-4s2.5 1 2.5 1" /></>),
  note: I(<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z" /><path d="M9 9h6M9 13h4" /></>),
};

// ---- role humanisation (per reference-role-humanisation) ----
const ROLE_LABELS = {
  pastor: 'Pastor',
  house_church_host: 'House-church host',
  lay_leader: 'Lay leader',
  elder: 'Elder',
  regional_coordinator: 'Regional coordinator',
  worship_leader: 'Worship leader',
};
const roleLabel = (r) => ROLE_LABELS[r] || (r ? r.replace(/_/g, ' ') : 'Leader');
// underground rows surface "A fellow [Role]" — never name/church (reference-anon-identity-rules)
const anonName = (r) => `A fellow ${roleLabel(r).toLowerCase()}`;

// ---- tier model (admin-tier.js) ----
const TIER_RANK = { top_tier: 3, super_admin: 2, regular: 1 };
const tierAtLeast = (v, req) => (TIER_RANK[v] || 0) >= (TIER_RANK[req] || 0);
const TIER_LABEL = { top_tier: 'Manager', super_admin: 'Super admin', regular: 'Admin' };
const VIEWER = {
  regular:     { tier: 'regular',     first: 'Amara' },
  super_admin: { tier: 'super_admin', first: 'Daniel' },
  top_tier:    { tier: 'top_tier',    first: 'Ruth'  },
};

// ---- locked taxonomies ----
// Regular's escalate reason categories (Founder seeded 3 + CD round-out to 5)
const ESCALATE_REASONS = [
  { token: 'destructive_needed',  label: 'Destructive action is needed' },
  { token: 'pattern_multi_flag',  label: 'Pattern across multiple flags' },
  { token: 'pastoral_judgment',   label: 'Pastoral judgment required' },
  { token: 'cross_tier',          label: 'Cross-tier coordination needed' },
  { token: 'unsure',              label: 'Unsure how to proceed' },
];
// super_admin / Manager propose actions
const PROPOSE_ACTIONS = [
  { token: 'restrict_temporarily', label: 'Restrict temporarily', destructive: true },
  { token: 'revoke_access',        label: 'Revoke access',        destructive: true },
  { token: 'escalate_to_manager',  label: 'Escalate to Manager',  destructive: false },
];
const PROPOSE_LABEL = Object.fromEntries(PROPOSE_ACTIONS.map(a => [a.token, a.label]));
// Close-case dispositions (LOCKED 8)
const DISPOSITIONS = [
  { token: 'resolved_by_reach_out',      label: 'Resolved — leader replied, situation closed', tone: 'green' },
  { token: 'resolved_no_outreach',       label: 'Resolved — no outreach needed', tone: 'green' },
  { token: 'false_signal',               label: 'False signal — no action warranted', tone: 'neutral' },
  { token: 'routing_misclassification',  label: 'Routing misclassification — belonged on another queue', tone: 'neutral' },
  { token: 'access_revoked',             label: 'Access revoked — case acted on', tone: 'red' },
  { token: 'restriction_applied',        label: 'Restriction applied — case acted on', tone: 'amber' },
  { token: 'escalated_to_higher',        label: 'Escalated to higher tier — out of this register\u2019s scope', tone: 'neutral' },
  { token: 'pending_external',           label: 'Pending external — leader being followed up offline', tone: 'neutral' },
];
const DISP_LABEL = Object.fromEntries(DISPOSITIONS.map(d => [d.token, d.label]));
const DISP_TONE  = Object.fromEntries(DISPOSITIONS.map(d => [d.token, d.tone]));
// flagged taxonomy code labels (taxonomy.js register)
const FLAG_CODE_LABELS = {
  location_probe: 'Location probe',
  identity_probe: 'Identity probe',
  spiritual_coercion: 'Spiritual coercion',
  off_platform_push: 'Off-platform push',
  impersonation: 'Impersonation',
};
// severity tier per flag code (T1 red / T2 amber / T3 blue)
const FLAG_CODE_TIER = {
  identity_probe: 1, spiritual_coercion: 1, impersonation: 1,
  location_probe: 2,
  off_platform_push: 3,
};

// ---- escalated-by admins (first name + tier) ----
const REG = (n) => ({ name: n, tier: 'regular' });
const SA  = (n) => ({ name: n, tier: 'super_admin' });
const MGR = (n) => ({ name: n, tier: 'top_tier' });

// ── FROM PASTORAL (amber lineage) — "how do we care for this leader?" ──
const PASTORAL_CASES = [
  {
    id: 'EC-7K2A9F', axis: 'pastoral', tier1: true, ageDays: 4,
    leader: { role: 'pastor', name: 'Mateus R.', church: 'Igreja Semente Viva', underground: false },
    escalationReason: 'Pastoral judgment required — messages have shifted from grief to talk of not being here next week. Above my read.',
    escalatedBy: REG('Amara'), escalatedWhen: '2d ago',
    state: 'awaiting', reachOut: { by: 'Daniel' },
    thread: [
      { who: 'Mateus R.', ts: '2026-06-26 21:04', body: 'Thank you for the prayers this month. It has been a heavy season for the church.' },
      { who: 'Mateus R.', ts: '2026-06-28 23:51', body: 'I don\u2019t think I can keep carrying this. Maybe everyone would be lighter if I just wasn\u2019t here next week.', anchor: true },
    ],
  },
  {
    id: 'EC-3M8X1B', axis: 'pastoral', tier1: false, ageDays: 6,
    leader: { role: 'house_church_host', name: null, church: null, underground: true },
    escalationReason: 'Unsure how to proceed — leader described surveillance pressure and asked if anyone would notice if they "went quiet".',
    escalatedBy: { name: 'Auto-routed', tier: 'system', auto: true }, escalatedWhen: '5d ago', autoRouted: true,
    state: 'replied', reachOut: { by: 'Daniel' }, repliedWhen: '6h ago',
    thread: [
      { who: 'A fellow house-church host', ts: '2026-06-24 08:12', body: 'They came to the building again. I moved the gathering. I am tired in a way I can\u2019t explain.' },
      { who: 'A fellow house-church host', ts: '2026-06-24 08:15', body: 'Would anyone even notice if I went quiet for a while?', anchor: true },
    ],
  },
  {
    id: 'EC-9QPL4D', axis: 'pastoral', tier1: true, ageDays: 8,
    leader: { role: 'lay_leader', name: 'Grace O.', church: 'Living Word Fellowship', underground: false },
    escalationReason: 'Destructive action is needed — repeated self-harm language; this needs higher-tier care coordination, not moderation.',
    escalatedBy: REG('Tomas'), escalatedWhen: '7d ago',
    state: 'pending_mgr',
    proposal: {
      proposer: SA('Daniel'), action: 'escalate_to_manager', when: '1d ago',
      reasoning: 'This is beyond first-tier care. Routing up for Manager attention and UG-trained eyes — I do not think any restriction is warranted; the leader needs coordinated pastoral follow-up, not a sanction.',
    },
    thread: [
      { who: 'Grace O.', ts: '2026-06-22 02:33', body: 'I keep telling myself it will pass but it hasn\u2019t. I don\u2019t want to be a burden to the others.', anchor: true },
    ],
  },
  {
    id: 'EC-2HF5C0', axis: 'pastoral', tier1: true, ageDays: 16,
    leader: { role: 'pastor', name: 'Ngozi A.', church: 'Grace Chapel Kaduna', underground: false },
    escalationReason: 'Cross-tier coordination needed — persecution panic after a raid; family safety in question, may need the UG team.',
    escalatedBy: REG('Amara'), escalatedWhen: '14d ago',
    state: 'open',
    thread: [
      { who: 'Ngozi A.', ts: '2026-06-14 19:40', body: 'They burned part of the building. We are all accounted for but the families are afraid to return.' },
      { who: 'Ngozi A.', ts: '2026-06-14 19:46', body: 'I don\u2019t know who to trust here anymore. I need to know if we can be moved off the public map.', anchor: true },
    ],
  },
];

// ── FROM FLAGGED (red lineage) — "do we sanction + does the recipient need follow-up?" ──
const FLAGGED_CASES = [
  {
    id: 'EC-5RZ2K7', axis: 'flagged', tier1: false, ageDays: 2,
    sender: { role: 'pastor', name: 'Pinheiro J.', church: 'Igreja Caminho', underground: false },
    receiver: { role: 'lay_leader', name: 'Korir D.', church: 'Nairobi Hope', underground: false },
    codes: ['location_probe'],
    escalationReason: 'Pattern across multiple flags — third location-eliciting message to a different leader this week.',
    escalatedBy: REG('Lukas'), escalatedWhen: '1d ago',
    state: 'open',
    thread: [
      { who: 'Pinheiro J. → Korir D.', ts: '2026-06-28 14:02', body: 'Brother, which neighbourhood is your fellowship in exactly? I want to send someone by this week.', anchor: true },
    ],
  },
  {
    id: 'EC-1WD6N3', axis: 'flagged', tier1: true, ageDays: 9,
    sender: { role: 'elder', name: null, church: null, underground: true },
    receiver: { role: 'pastor', name: 'Adeyemi T.', church: 'Cornerstone Lagos', underground: false },
    codes: ['identity_probe', 'spiritual_coercion'],
    escalationReason: 'Destructive action is needed — sustained attempts to extract another leader\u2019s legal identity under spiritual pressure.',
    escalatedBy: { name: 'Auto-routed', tier: 'system', auto: true }, escalatedWhen: '8d ago', autoRouted: true,
    state: 'pending_mgr',
    proposal: {
      proposer: SA('Daniel'), action: 'revoke_access', when: '2d ago',
      reasoning: 'The probing is deliberate and escalating across three recipients. I recommend revoking network access. The recipient (Adeyemi) should also get a pastoral follow-up — they handled it well but were shaken.',
    },
    thread: [
      { who: 'A fellow elder → Adeyemi T.', ts: '2026-06-20 11:20', body: 'A true brother would have nothing to hide. Send me your full legal name and I\u2019ll vouch for you to the others.', anchor: true },
      { who: 'A fellow elder → Adeyemi T.', ts: '2026-06-21 09:05', body: 'You\u2019re still avoiding the question. That tells me everything.' },
    ],
  },
  {
    id: 'EC-8BJ0M5', axis: 'flagged', tier1: false, ageDays: 5,
    sender: { role: 'worship_leader', name: 'Bako S.', church: 'Open Door Jos', underground: false },
    receiver: { role: 'pastor', name: 'Mensah K.', church: 'Hope Assembly', underground: false },
    codes: ['spiritual_coercion', 'off_platform_push', 'impersonation'],
    escalationReason: 'Pastoral judgment required — coercive "submit or be cut off" messaging aimed at a younger leader.',
    escalatedBy: REG('Amara'), escalatedWhen: '4d ago',
    state: 'open',
    thread: [
      { who: 'Bako S. → Mensah K.', ts: '2026-06-25 16:44', body: 'If you don\u2019t submit to my covering, God will remove His hand from your ministry. Don\u2019t test this.', anchor: true },
    ],
  },
  {
    id: 'EC-6YT3W8', axis: 'flagged', tier1: false, ageDays: 11,
    sender: { role: 'lay_leader', name: 'Okeke V.', church: 'Calvary Enugu', underground: false },
    receiver: { role: 'pastor', name: 'Haddad R.', church: 'Antioch Beirut', underground: false },
    codes: ['off_platform_push'],
    escalationReason: 'Cross-tier coordination needed — repeatedly pushing a leader onto an unencrypted channel off-platform.',
    escalatedBy: REG('Lukas'), escalatedWhen: '10d ago',
    state: 'open',
    thread: [
      { who: 'Okeke V. → Haddad R.', ts: '2026-06-19 20:10', body: 'Stop using this app. Add me on the other number, it\u2019s easier and no one is watching there.', anchor: true },
    ],
  },
];

// ── RESOLVED (last 14 days) ──
const RESOLVED_CASES = [
  { id: 'EC-0PL9X2', axis: 'pastoral', disposition: 'resolved_by_reach_out', by: SA('Daniel'), when: '2d ago', note: 'Reached out; leader replied within the day and we set up a weekly check-in with their regional coordinator.' },
  { id: 'EC-4KM7B1', axis: 'flagged',  disposition: 'access_revoked', by: MGR('Ruth'), when: '5d ago', note: 'Approved Daniel\u2019s revoke proposal after the third confirmed identity-probe. Recipient followed up pastorally.' },
  { id: 'EC-7CN2V9', axis: 'flagged',  disposition: 'false_signal', by: SA('Daniel'), when: '9d ago', note: 'Read in full — the "location" was a publicly listed conference venue. No action warranted.' },
  { id: 'EC-3RD8L4', axis: 'pastoral', disposition: 'routing_misclassification', by: SA('Daniel'), when: '12d ago', note: 'This was a benefits/admin question mis-routed from the pastoral queue. Pointed the leader to accounts@.' },
];

Object.assign(window, {
  ICONS, ROLE_LABELS, roleLabel, anonName,
  TIER_RANK, tierAtLeast, TIER_LABEL, VIEWER,
  ESCALATE_REASONS, PROPOSE_ACTIONS, PROPOSE_LABEL, DISPOSITIONS, DISP_LABEL, DISP_TONE, FLAG_CODE_LABELS, FLAG_CODE_TIER,
  PASTORAL_CASES, FLAGGED_CASES, RESOLVED_CASES,
});
