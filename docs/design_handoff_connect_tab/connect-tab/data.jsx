// ─────────────────────────────────────────────────────────────────────────
// data.jsx — mock data for the Connect tab prototype.
// In production these shapes are served by the API; the display-name rules
// (formatDisplayName / monogram) are load-bearing and must port verbatim.
// ─────────────────────────────────────────────────────────────────────────

// the signed-in leader
const ME = { id: 'me', name: 'Pastor Daniel Osei' };

// ── Display name rules (c.13246 — Founder copy lock) ──────────────────────
// Not anonymous:  "FirstName LastName · ChurchName"
// Anonymous:      "RoleLabel · ChurchName"  (e.g. "Pastor · Maranatha Ministries")
// Underground church names ALWAYS render as "Underground Church" regardless
// of the leader's anonymous setting.
function churchLabel(leader) {
  return leader.underground ? 'Underground Church' : leader.church;
}
function leaderName(leader) {
  // the NAME portion only (church is rendered separately in rows/headers)
  return leader.anonymous ? leader.role : leader.fullName;
}
function formatDisplayName(leader) {
  return `${leaderName(leader)} · ${churchLabel(leader)}`;
}
// monogram glyph: initial of the display name's leading token. For anonymous
// leaders this is the role's initial (still safety-filtered — never the real
// name). Underground leaders render a generic mark, not initials.
function monogramInitial(leader) {
  const base = leaderName(leader);
  return base.trim().charAt(0).toUpperCase();
}

// ── Leaders in the network (search corpus) ────────────────────────────────
// `underground` rows carry no location and surface only as "Underground Church".
// The real church name on an underground row is NEVER searchable server-side;
// included here only to prove the row data is already safety-filtered.
const LEADERS = [
  { id: 'l1', fullName: 'Pastor Anand Rao',      role: 'Pastor',   church: 'Grace Community Church', anonymous: false, underground: false, active: true },
  { id: 'l2', fullName: 'Pastor Wangari Mwangi', role: 'Pastor',   church: 'Living Word Nairobi',    anonymous: false, underground: false, active: true },
  { id: 'l3', fullName: 'Apostle Femi Okafor',   role: 'Apostle',  church: 'Cornerstone Lagos',      anonymous: false, underground: false, active: true },
  { id: 'l4', fullName: 'Pastor Maria Santos',   role: 'Pastor',   church: 'Iglesia Manila',         anonymous: false, underground: false, active: true },
  { id: 'l5', fullName: 'Pastor Diego Mora',     role: 'Pastor',   church: 'Quito Vineyard',         anonymous: false, underground: false, active: true },
  // anonymous leader — role label shown instead of name
  { id: 'l6', fullName: 'Withheld',              role: 'Pastor',   church: 'Maranatha Ministries',   anonymous: true,  underground: false, active: true },
  { id: 'l7', fullName: 'Withheld',              role: 'Elder',    church: 'House of Prayer',         anonymous: true,  underground: false, active: true },
  // underground leaders — church always "Underground Church", no location
  { id: 'l8', fullName: 'Withheld',              role: 'Pastor',   church: '[redacted]',              anonymous: true,  underground: true,  active: true },
  { id: 'l9', fullName: 'Brother Stephen',       role: 'Brother',  church: '[redacted]',              anonymous: false, underground: true,  active: true },
  // a leader who has since left the network — tapping yields an error
  { id: 'l10', fullName: 'Pastor John Mensah',   role: 'Pastor',   church: 'Accra Chapel',            anonymous: false, underground: false, active: false },
  { id: 'l11', fullName: 'Pastor Sarah Kim',     role: 'Pastor',   church: 'Seoul Light Fellowship',  anonymous: false, underground: false, active: true },
  { id: 'l12', fullName: 'Pastor Mateo Rossi',   role: 'Pastor',   church: 'Roma Grace',              anonymous: false, underground: false, active: true },
];
const leaderById = (id) => LEADERS.find(l => l.id === id);

// ── Conversations ─────────────────────────────────────────────────────────
// The Replant secure thread is system-managed (system: true) and pinned above
// the last_message_at sort. The leader cannot create it.
const THREADS = [
  {
    id: 't-secure', system: true, leaderId: null,
    name: 'Replant Team', preview: 'We have read your heartcry and we are standing with you. A word for you below.',
    lastAt: '2h', unread: 1,
  },
  {
    id: 't1', leaderId: 'l2',
    preview: 'Brother, the baptism is confirmed for Sunday. Will you pray for the fourteen with us?',
    lastAt: '14m', unread: 2,
  },
  {
    id: 't2', leaderId: 'l3',
    preview: 'Thank you for the wisdom on the elders\u2019 decision. It carried us through.',
    lastAt: '1h', unread: 0,
  },
  {
    id: 't3', leaderId: 'l8',  // underground
    preview: 'We gathered again last night. Twelve of us. The Lord kept us. Keep watching with us.',
    lastAt: 'Yesterday', unread: 1,
  },
  {
    id: 't4', leaderId: 'l6',  // anonymous
    preview: 'Sending the outline for the teaching series. Let me know what the Spirit shows you.',
    lastAt: '2d', unread: 0,
  },
  {
    id: 't5', leaderId: 'l4',
    preview: 'My nephew walked out of the hospital. He is whole. I had to tell you first.',
    lastAt: '3d', unread: 0,
  },
  {
    id: 't6', leaderId: 'l5',
    preview: 'The funds for the gathering space arrived in full. Every cent. He knows.',
    lastAt: '5d', unread: 0,
  },
];

// ── Messages, keyed by thread id. `mine` = sent by ME. ────────────────────
// `at` is a display timestamp; grouping into 5-minute windows is done by the
// view from the underlying timestamps (mocked here as group breaks).
const MESSAGES = {
  't-secure': [
    { id: 'm1', mine: true,  text: 'I shared a heartcry three days ago. I do not need anything. I only wanted to say it where it was safe.', at: 'Mon 9:02 AM', group: 'Monday' },
    { id: 'm2', mine: false, text: 'Brother Daniel — we read every word. You are not carrying this unseen.', at: 'Mon 9:14 AM', group: null },
    { id: 'm3', mine: false, text: 'We have asked three leaders in your region to hold you in prayer this week. You will not be named to them. Only the need.', at: 'Mon 9:15 AM', group: null },
    { id: 'm4', mine: true,  text: 'Thank you. That is more than I expected.', at: '2:31 PM', group: 'Today' },
    { id: 'm5', mine: false, text: 'It is the least the body can do. Write us any hour. Someone is always here.', at: '2:34 PM', group: null },
  ],
  't1': [
    { id: 'a1', mine: false, text: 'Daniel — peace to you. The baptism is confirmed for Sunday at dawn.', at: 'Yesterday 6:40 PM', group: 'Yesterday' },
    { id: 'a2', mine: false, text: 'Fourteen souls. Some of them walked three days to be here.', at: 'Yesterday 6:41 PM', group: null },
    { id: 'a3', mine: true,  text: 'Glory to God. We will fast with you Saturday and pray them through.', at: 'Yesterday 7:05 PM', group: null },
    { id: 'a4', mine: false, text: 'Brother, the baptism is confirmed for Sunday. Will you pray for the fourteen with us?', at: '2:18 PM', group: 'Today' },
    { id: 'a5', mine: false, text: 'The gathering details are at projectreplant.org/east-africa \u2014 links open in your browser only if you choose; we never preview them here.', at: '2:20 PM', group: null },
  ],
  't2': [
    { id: 'b1', mine: true,  text: 'How did the elders\u2019 meeting land?', at: 'Apr 28 10:00 AM', group: 'Apr 28' },
    { id: 'b2', mine: false, text: 'Thank you for the wisdom on the elders\u2019 decision. It carried us through.', at: 'Apr 28 4:12 PM', group: null },
  ],
  't3': [
    { id: 'c1', mine: false, text: 'We gathered again last night. Twelve of us. The Lord kept us. Keep watching with us.', at: 'Yesterday 11:50 PM', group: 'Yesterday' },
    { id: 'c2', mine: true,  text: 'We are watching. Every night at this hour we lift you by name before Him.', at: 'Yesterday 11:58 PM', group: null },
  ],
  't4': [
    { id: 'd1', mine: false, text: 'Sending the outline for the teaching series. Let me know what the Spirit shows you.', at: 'Mon 8:00 AM', group: 'Monday' },
  ],
  't5': [
    { id: 'e1', mine: false, text: 'My nephew walked out of the hospital. He is whole. I had to tell you first.', at: 'Apr 26 9:30 AM', group: 'Apr 26' },
  ],
  't6': [
    { id: 'f1', mine: false, text: 'The funds for the gathering space arrived in full. Every cent. He knows.', at: 'Apr 24 2:00 PM', group: 'Apr 24' },
  ],
};

// helper: enrich a thread with its leader + resolved display fields
function resolveThread(thread) {
  if (thread.system) {
    return { ...thread, displayName: 'Replant Team', church: null, leader: null };
  }
  const leader = leaderById(thread.leaderId);
  return {
    ...thread,
    leader,
    displayName: leaderName(leader),
    church: churchLabel(leader),
    monogram: monogramInitial(leader),
    anonymous: leader.anonymous,
    underground: leader.underground,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// MINISTRIES + BRANCHES (the "Ministries" sub-tab — group coordination)
// A "branch" is a group chat connecting up to 7 ministries (vine & branches,
// John 15:5). Selecting a ministry brings ALL of its leaders (1–2) in; every
// leader of every ministry must consent before the branch opens — no one is
// dragged in. The leader's own ministry is `mine: true`.
// ══════════════════════════════════════════════════════════════════════════

const MAX_MINISTRIES_PER_BRANCH = 7;

const MINISTRIES = [
  { id: 'mn1', name: 'Grace Network',          location: 'Lagos, Nigeria',     underground: false, leaders: ['Apostle Femi Okafor', 'Pastor Grace Adeyemi'] },
  { id: 'mn2', name: 'Living Word',            location: 'Nairobi, Kenya',     underground: false, leaders: ['Pastor Wangari Mwangi'] },
  { id: 'mn3', name: 'Kingdom Mandate',        location: 'Seoul, South Korea', underground: false, leaders: ['Pastor Sarah Kim', 'Pastor Joon Park'] },
  { id: 'mn4', name: 'Cornerstone Fellowship', location: 'Accra, Ghana',       underground: false, leaders: ['Pastor Daniel Osei'], mine: true },
  { id: 'mn5', name: 'Maranatha Ministries',   location: 'Atlanta, USA',       underground: false, leaders: ['Pastor · Maranatha Ministries'] },
  { id: 'mn6', name: 'Underground Church',     location: null,                 underground: true,  leaders: ['Brother (withheld)'] },
  { id: 'mn7', name: 'Quito Vineyard',         location: 'Quito, Ecuador',     underground: false, leaders: ['Pastor Diego Mora'] },
];
const ministryById = (id) => MINISTRIES.find(m => m.id === id);
const ministryLabel = (m) => m.underground ? 'Underground Church' : `${m.name} · ${m.location}`;
const ministryInitials = (m) => m.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

// status: 'active' (formed) | 'forming' (awaiting consent, creator's view) | 'invited' (you've been asked to join)
const BRANCHES = [
  { id: 'br1', name: 'East Africa Outreach',         status: 'active',  ministryIds: ['mn4', 'mn1', 'mn2'],
    preview: 'Wangari · Living Word: We can host the team for the first week.', lastAt: '18m', unread: 3 },
  { id: 'br2', name: 'Prison Outreach Coalition',    status: 'active',  ministryIds: ['mn4', 'mn1', 'mn3', 'mn7'],
    preview: 'You: Sending the visitation schedule tonight.', lastAt: '2h', unread: 0 },
  { id: 'br4', name: 'Global Prayer Summit',         status: 'invited', invitedBy: 'mn3', ministryIds: ['mn3', 'mn1', 'mn7', 'mn4'],
    preview: 'Kingdom Mandate invited your ministry to join.', lastAt: '5m', unread: 0 },
  { id: 'br3', name: 'Scripture Translation Partners', status: 'forming', ministryIds: ['mn4', 'mn2', 'mn3', 'mn5'], joined: 2,
    preview: 'Waiting for leaders to join the branch.', lastAt: '1d', unread: 0 },
];
const branchById = (id) => BRANCHES.find(b => b.id === id);

function resolveBranch(branch) {
  const ministries = branch.ministryIds.map(ministryById);
  const leaderCount = ministries.reduce((n, m) => n + m.leaders.length, 0);
  return {
    ...branch,
    ministries,
    ministryCount: ministries.length,
    leaderCount,
    invitedByName: branch.invitedBy ? ministryById(branch.invitedBy).name : null,
  };
}

// group messages — received bubbles carry sender + ministry; `system` events
// narrate the branch's life (started / joined / invited).
const BRANCH_MESSAGES = {
  br1: [
    { id: 'g1', system: true, text: 'You started this branch.', group: 'Monday' },
    { id: 'g2', system: true, text: 'Grace Network and Living Word joined.', group: null },
    { id: 'g3', mine: false, sender: 'Femi Okafor', ministry: 'Grace Network', text: 'Brothers, glory to God for this. Our team of six is ready to travel.', at: 'Mon 8:10 AM', group: null },
    { id: 'g4', mine: false, sender: 'Wangari Mwangi', ministry: 'Living Word', text: 'We can host the team for the first week of the campaign.', at: '2:02 PM', group: 'Today' },
    { id: 'g5', mine: true, text: 'Then it is settled. We will send the visitation plan tonight.', at: '2:09 PM', group: null },
    { id: 'g6', mine: false, sender: 'Femi Okafor', ministry: 'Grace Network', text: 'Amen. He is faithful.', at: '2:10 PM', group: null },
  ],
  br2: [
    { id: 'p1', system: true, text: 'You started this branch.', group: 'Apr 27' },
    { id: 'p2', mine: false, sender: 'Sarah Kim', ministry: 'Kingdom Mandate', text: 'Our team has visited the facility twice. The chaplain is open to us.', at: 'Apr 27 10:00 AM', group: null },
    { id: 'p3', mine: true, text: 'Sending the visitation schedule tonight.', at: 'Apr 27 6:30 PM', group: null },
  ],
  br3: [
    { id: 'h1', system: true, text: 'You started this branch.', group: 'Yesterday' },
    { id: 'h2', system: true, text: 'Invitations sent to Living Word, Kingdom Mandate, and Maranatha Ministries.', group: null },
    { id: 'h3', system: true, text: 'Pastor Wangari Mwangi joined.', group: null },
  ],
};

Object.assign(window, {
  ME, LEADERS, THREADS, MESSAGES,
  leaderById, churchLabel, leaderName, formatDisplayName, monogramInitial,
  resolveThread,
  MAX_MINISTRIES_PER_BRANCH, MINISTRIES, BRANCHES, BRANCH_MESSAGES,
  ministryById, ministryLabel, ministryInitials, branchById, resolveBranch,
});
