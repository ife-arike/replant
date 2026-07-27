/* eslint-disable */
// ── Content Section · shared data + icons (v2) ──────────────────────
// Mock data for all three surfaces + Witness / Submissions / Phase 2-3.
// v2: witnesses remapped to the REAL migration schema; badge labels
// corrected; field/column mapping tables MOVED to the README (no dev
// scaffolding rendered in screens).

// ---- inline icons (mirrors the admin Icons.jsx vocabulary) ----
const I = {
  chev:   <svg viewBox="0 0 24 24" className="ic"><path d="M9 6l6 6-6 6"/></svg>,
  chevD:  <svg viewBox="0 0 24 24" className="ic"><path d="M6 9l6 6 6-6"/></svg>,
  check:  <svg viewBox="0 0 24 24" className="ic"><path d="M5 12l5 5 9-9"/></svg>,
  x:      <svg viewBox="0 0 24 24" className="ic"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  eye:    <svg viewBox="0 0 24 24" className="ic"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  send:   <svg viewBox="0 0 24 24" className="ic"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  copy:   <svg viewBox="0 0 24 24" className="ic"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>,
  clock:  <svg viewBox="0 0 24 24" className="ic"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  history:<svg viewBox="0 0 24 24" className="ic"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/></svg>,
  lock:   <svg viewBox="0 0 24 24" className="ic"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>,
  filter: <svg viewBox="0 0 24 24" className="ic"><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></svg>,
  plus:   <svg viewBox="0 0 24 24" className="ic"><path d="M12 5v14M5 12h14"/></svg>,
  trash:  <svg viewBox="0 0 24 24" className="ic"><path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M5.5 6l1 13.5A1.5 1.5 0 0 0 8 21h8a1.5 1.5 0 0 0 1.5-1.5L18.5 6"/></svg>,
  archive:<svg viewBox="0 0 24 24" className="ic"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>,
  edit:   <svg viewBox="0 0 24 24" className="ic"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  link:   <svg viewBox="0 0 24 24" className="ic"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>,
  route:  <svg viewBox="0 0 24 24" className="ic"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M6 16V9a4 4 0 0 1 4-4h5"/></svg>,
  dots:   <svg viewBox="0 0 24 24" className="ic"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>,
  menu:   <svg viewBox="0 0 24 24" className="ic"><path d="M4 7h16M4 12h16M4 17h16"/></svg>,
  megaphone: <svg viewBox="0 0 24 24" className="ic"><path d="M4 10v4l11 5V5L4 10z"/><path d="M15 8c2 0 4 1.5 4 4s-2 4-4 4"/></svg>,
  scripture: <svg viewBox="0 0 24 24" className="ic"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z"/><path d="M9 9h6M9 13h4"/></svg>,
  globe:  <svg viewBox="0 0 24 24" className="ic"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>,
  users:  <svg viewBox="0 0 24 24" className="ic"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2.5 2-4 4-4"/></svg>,
};

const TIER_LABEL = { regular: 'Admin', super_admin: 'Super admin', top_tier: 'Manager' };
const VIEWER = {
  regular:     { first: 'Ada',  tier: 'regular' },
  super_admin: { first: 'Ruth', tier: 'super_admin' },
  top_tier:    { first: 'Ruth', tier: 'top_tier' },
};
function tierAtLeast(t, min) {
  const order = { regular: 0, super_admin: 1, top_tier: 2 };
  return order[t] >= order[min];
}

// ============================================================
// ANNOUNCEMENTS
//   state: draft | scheduled | published (mirrors real screen:
//   published_at NULL → draft, > now → scheduled, ≤ now → posted)
// ============================================================
const ANNOUNCEMENTS = [
  { id: 'A1', state: 'published', today: true, title: 'Standing with the church in Manipur this week',
    source: 'admin', byline: '', topic: 'prayer', badge: 'urgent', cardType: 'call_to_action',
    body: 'Renewed violence has displaced dozens of house-church families across the hills. Set aside time this week to pray for shelter, for the pastors coordinating relief, and for a swift end to the unrest. We will post specific needs as our partners on the ground confirm them.',
    author: 'Ruth', when: 'Jun 30', pushed: true },
  { id: 'A2', state: 'scheduled', next: true, title: 'July prayer calendar — one nation each day',
    source: 'admin', byline: '', topic: 'event', badge: 'new', cardType: 'article',
    body: 'A downloadable calendar pairing each day of July with a specific persecuted-church context and a short intercession. Save it, print it, pray it with your fellowship.',
    author: 'Ruth', when: 'Jul 3 · 09:00 UTC', pushed: false },
  { id: 'A3', state: 'published', title: 'Where the church stands — a 2026 field briefing', source: 'admin',
    byline: '', topic: 'update', badge: 'none', cardType: 'standard',   /* LinkCard routes on link_url presence — no 'link' card_type exists */
    resource: 'Where the Church Stands — 2026', linkSource: 'briefing · external link', url: 'https://replant.example/briefing-2026',
    body: 'A short briefing on the state of the persecuted church this year, with regional summaries and specific ways to pray.',
    author: 'Ruth', when: 'Jun 28', pushed: false },
  { id: 'A4', state: 'published', title: 'Testimony: baptisms continue despite the ban', source: 'leader',
    byline: 'From a house-church network · Central Asia', topic: 'testimony', badge: 'none', cardType: 'encouragement',
    body: 'Eleven believers were baptised at night by the river. The authorities came the next morning and found nothing. God went before us.',
    author: 'Ada', when: 'Jun 26', pushed: false },
  { id: 'A5', state: 'published', title: 'Correction to "Regional gathering moved to Saturday"', source: 'admin',
    byline: '', topic: 'update', badge: 'none', cardType: 'standard', correctionOf: 'Regional gathering moved to Saturday',
    body: 'The gathering time in the original post was listed in the wrong timezone. The correct time is 14:00 UTC, not 14:00 local.',
    author: 'Ruth', when: 'Jun 25', pushed: false },
  { id: 'A6', state: 'published', title: 'Five ways the global church can stand with Nigeria', source: 'blog',
    byline: 'The Persecuted Church Today', topic: 'update', badge: 'none', cardType: 'article',
    body: 'Reports from Plateau State continue to describe attacks on farming communities. Here is how fellowships abroad can respond — in prayer, in giving, and in advocacy.',
    author: 'Ruth', when: 'Jun 22', pushed: false },
];
const ANNOUNCEMENT_DRAFTS = [
  { id: 'D1', state: 'draft', title: 'Ramadan follow-up: sustaining new believers', source: 'admin',
    byline: '', topic: 'update', badge: 'none', cardType: 'long_read',
    body: 'A longer reflection on how fellowships across the region are discipling those who came to faith during the spring…',
    author: 'Ruth', when: 'Jun 30' },
  { id: 'D2', state: 'draft', title: 'Prayer partners needed — Horn of Africa', source: 'admin',
    byline: '', topic: 'prayer', badge: 'none', cardType: 'standard',
    body: 'We are matching leaders in isolated contexts with intercessors abroad. Sign-up flow to follow.',
    author: 'Ada', when: 'Jun 29' },
  { id: 'D3', state: 'draft', title: 'Encouragement for bivocational pastors', source: 'leader',
    byline: 'From a pastor · Southeast Asia', topic: 'testimony', badge: 'none', cardType: 'encouragement',
    body: 'You who mend nets by day and shepherd by night — the Lord sees the double labour.',
    author: 'Ruth', when: 'Jun 28' },
  { id: 'D4', state: 'draft', title: 'Security reminder: verifying a new contact', source: 'admin',
    byline: '', topic: 'update', badge: 'urgent', cardType: 'call_to_action',
    body: 'Steps every leader should take before adding an unknown contact to a fellowship group.',
    author: 'Ruth', when: 'Jun 27' },
  { id: 'D5', state: 'draft', title: 'Mid-year letter from the Replant team', source: 'admin',
    byline: '', topic: 'update', badge: 'none', cardType: 'long_read',
    body: 'Where we have been, where we are going, and how the network has grown this year.',
    author: 'Ada', when: 'Jun 24' },
];
// NOTE (corrected post-panel, 2026-07-22): TWO separate features —
//   "A word from your family" = Persecuted-tab pager. NOT Content. Stays out.
//   "A Word for Today" = leader-authored ANNOUNCEMENT topic (word_for_today),
//   restored per Founder; renders via the live leader_word card. SEC gate:
//   UG-origin words publish under the Replant Team seal with a frozen
//   role+region byline — never author_type='leader' live-resolution.
// CARDTYPE mirrors the LIVE CHECK: there is NO 'link' card_type — the app
// routes to LinkCard on link_url PRESENCE (NetworkFeed.tsx:285), not a value.
const TOPIC_OPTS = ['prayer', 'event', 'update', 'testimony', 'word_for_today'];
const SOURCE_OPTS = ['admin', 'leader', 'partner', 'blog'];
const BADGE_OPTS = ['none', 'new', 'urgent'];
const CARDTYPE_OPTS = ['standard', 'article', 'long_read', 'leader_word', 'encouragement', 'together', 'call_to_action'];

// Leader-card eyebrow (label + dot color), matching the real app's
// AnnouncementCard eyebrow. Functional correction #4:
//   new  → "NEW"  (amber; v1 rendered "NOTICE" — retired)
//   none → topic-derived label (sky; v1's "NETWORK UPDATE" collided w/ update)
function leaderBadgeMeta(item) {
  if (item.badge === 'urgent') return { label: 'URGENT', color: 'var(--rp-red)' };
  if (item.badge === 'new') return { label: 'NEW', color: 'var(--rp-amber)' };
  const t = { prayer: 'PRAYER', event: 'EVENT', testimony: 'TESTIMONY', update: 'FROM REPLANT' };
  return { label: t[item.topic] || 'FROM REPLANT', color: 'var(--rp-sky)' };
}

// Byline auto-populates from the author (template), and stays editable.
// admin posts carry no byline (they post as the Replant Team seal).
function bylineTemplate(source, info) {
  if (source === 'leader') return info || 'From a verified leader';
  if (source === 'partner') return info || 'Partner org';
  if (source === 'blog') return info || 'Syndicated blog';
  return '';
}

// ============================================================
// WITNESS OF THE DAY — REAL schema (migration
// 20260607000001_persecuted_multipage_tables.sql)
//   era · yearsLabel · name · region · category (5 enum) · martyr
//   · quote (required, serif-italic centerpiece) · scriptureRef
//   · scriptureText · description (roman body) · sourceAttribution
//   · publishedAt · rotationDay
// Workflow is ROTATION-aware: Today (derived) / Roster / Drafts.
// ============================================================
const WITNESS_CATEGORIES = ['Martyr', 'Father of the Faith', 'Mother of the Faith', "God's General", 'From Scripture'];
const WITNESSES = [
  { id: 'W1', today: true, published: true, rotationDay: 202,
    name: 'Perpetua of Carthage', era: 'Pre-Constantinian', yearsLabel: 'c. 182 – 203',
    region: 'Carthage, Roman Africa', category: 'Martyr', martyr: true,
    quote: 'It will all happen in the prisoner\u2019s dock as God wills; for you may be sure that we are not left to ourselves, but are all in His power.',
    scriptureRef: 'Revelation 2:10', scriptureText: 'Be faithful unto death, and I will give thee a crown of life.',
    description: 'A young mother imprisoned during the persecution under Septimius Severus. She kept a diary in her own hand until the eve of her death in the arena — one of the earliest surviving texts written by a Christian woman.',
    sourceAttribution: 'The Passion of Perpetua and Felicity' },
  { id: 'W2', published: true, rotationDay: 44,
    name: 'Polycarp of Smyrna', era: 'Apostolic Fathers', yearsLabel: 'c. 69 – 155',
    region: 'Smyrna, Asia Minor', category: 'Martyr', martyr: true,
    quote: 'Eighty and six years have I served Him, and He has done me no wrong. How then can I blaspheme my King who saved me?',
    scriptureRef: '2 Timothy 4:7', scriptureText: 'I have fought the good fight, I have finished the race, I have kept the faith.',
    description: 'A disciple of the apostle John and bishop of Smyrna. Given the chance to recant at the stake, he refused, and was burned before the crowd. His martyrdom is the earliest recorded outside the New Testament.',
    sourceAttribution: 'The Martyrdom of Polycarp' },
  { id: 'W3', published: true, rotationDay: 118,
    name: 'Monica of Hippo', era: 'Nicene', yearsLabel: 'c. 331 – 387',
    region: 'Thagaste, Roman Africa', category: 'Mother of the Faith', martyr: false,
    quote: 'Nothing is far from God; and I need not fear that He will not know at the end of the world from what place He is to raise me up.',
    scriptureRef: 'Luke 18:1', scriptureText: 'Men ought always to pray, and not to faint.',
    description: 'Mother of Augustine, she prayed for her son\u2019s conversion for the better part of two decades and did not stop until she saw it. Her persistence became a byword for the intercession of mothers.',
    sourceAttribution: 'Augustine, Confessions, Book IX' },
  { id: 'W4', published: true, rotationDay: 300,
    name: 'Lin Xiangao (Samuel Lamb)', era: 'Contemporary', yearsLabel: '1924 – 2013',
    region: 'Guangzhou, China', category: "God's General", martyr: false,
    quote: 'More persecution, more growing. The Lord has been very good to us.',
    scriptureRef: 'Acts 5:29', scriptureText: 'We ought to obey God rather than men.',
    description: 'Imprisoned for more than twenty years for refusing to register his congregation with the state. On release he returned to pastor a house church that only grew larger under pressure.',
    sourceAttribution: 'House-church records, Guangzhou' },
];
const WITNESS_DRAFTS = [
  { id: 'WD1', published: false,
    name: 'Blandina of Lyon', era: 'Pre-Constantinian', yearsLabel: 'd. 177',
    region: 'Lyon, Roman Gaul', category: 'Martyr', martyr: true,
    quote: 'I am a Christian, and there is nothing vile done among us.',
    scriptureRef: 'Romans 8:37', scriptureText: '',
    description: 'A slave girl tortured through a long day in the amphitheatre at Lyon. Draft — awaiting a check of the primary source before it joins the rotation.',
    sourceAttribution: 'Eusebius, Ecclesiastical History V' },
  { id: 'WD2', published: false,
    name: 'Stephen', era: 'Apostolic', yearsLabel: 'first century',
    region: 'Jerusalem', category: 'From Scripture', martyr: true,
    quote: 'Lord, do not hold this sin against them.',
    scriptureRef: 'Acts 7:60', scriptureText: '',
    description: 'The first martyr of the church, stoned outside Jerusalem while praying for those who killed him. Draft — scripture_text still to be set.',
    sourceAttribution: 'Acts 6 – 7' },
];

// ============================================================
// DAILY SCRIPTURE — UNIQUE (scripture_date): one per date, one
// translation (multi-translation CUT, functional correction #2)
// ============================================================
const SCRIPTURES = [
  { id: 'S1', today: true, state: 'published', ref: 'Romans 8:18', translation: 'ESV', theme: 'Suffering',
    verse: 'For I consider that the sufferings of this present time are not worth comparing with the glory that is to be revealed to us.',
    reflection: 'Paul does not deny the weight of the present. He measures it — and finds it light only against a glory he has already glimpsed. For the believer under pressure, hope is not denial; it is accurate accounting.',
    prompt: 'What present weight are you carrying that God is asking you to weigh against His promise?',
    related: [
      { ref: '2 Corinthians 4:17', txt: 'this light momentary affliction is preparing…' },
      { ref: '1 Peter 5:10', txt: 'after you have suffered a little while…' },
    ],
    author: 'Ruth', when: 'Jun 30' },
  { id: 'S2', next: true, state: 'scheduled', ref: 'Joshua 1:9', translation: 'NIV', theme: 'Boldness',
    verse: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',
    reflection: 'Courage here is commanded, not summoned. It rests not on the size of the threat but on the presence of the One who commands.',
    prompt: 'Where is God commanding courage of you today?',
    related: [{ ref: 'Deuteronomy 31:6', txt: 'he will never leave you nor forsake you' }],
    author: 'Ruth', when: 'Jul 1' },
  { id: 'S3', state: 'scheduled', ref: 'Psalm 27:1', translation: 'KJV', theme: 'Faith',
    verse: 'The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?',
    reflection: '', prompt: '', related: [], author: 'Ada', when: 'Jul 2' },
  { id: 'S4', state: 'scheduled', ref: 'James 1:2-3', translation: 'ESV', theme: 'Endurance',
    verse: 'Count it all joy, my brothers, when you meet trials of various kinds, for you know that the testing of your faith produces steadfastness.',
    reflection: '', prompt: '', related: [], author: 'Ruth', when: 'Jul 3' },
];
const THEME_OPTS = ['Perseverance', 'Suffering', 'Endurance', 'Hope', 'Faith', 'Boldness', 'Courage', 'Comfort', 'Grace', 'Mercy', 'Joy', 'Peace', 'Prayer', 'Provision', 'Deliverance', 'Identity', 'Obedience', 'The Cross', 'Resurrection', 'The Church'];
// Canonical book list for the structured reference builder (no free-typing
// a misspelled book or an out-of-range chapter). Chapter counts drive the
// chapter dropdown; abbreviated here for the sample set.
const BIBLE_BOOKS = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','Psalms','Proverbs','Isaiah','Jeremiah','Habakkuk','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Hebrews','James','1 Peter','2 Peter','1 John','Jude','Revelation'];
const BOOK_CHAPTERS = { Genesis: 50, Psalms: 150, Isaiah: 66, Habakkuk: 3, Romans: 16, John: 21, Joshua: 24, James: 5, Jude: 1, Revelation: 22 };
const TRANSLATION_OPTS = ['KJV', 'ESV', 'NIV', 'NASB', 'NKJV', 'NLT', 'CSB'];

// ============================================================
// OUTREACH & MISSIONS — Phase 1
// ============================================================
const OUTREACH = [
  { id: 'O1', today: true, state: 'published', title: 'Prayer coverage: underground seminary, East Asia', missionType: 'Prayer coverage',
    location: 'Undisclosed · East Asia', source: 'admin', topic: 'prayer', byline: '',
    org: '', dates: 'Ongoing', apply: 'replant://prayer/east-asia-seminary',
    body: 'Twelve students are training in secret to plant churches. Cover them: for the teachers who travel between safe houses, for exams taken in whispers, and for the day they are sent out.',
    author: 'Ruth', when: 'Jun 30' },
  { id: 'O2', next: true, state: 'scheduled', title: 'Short-term: medical + discipleship, Sahel', missionType: 'Short-term trip',
    location: 'Sahel region · West Africa', source: 'partner', topic: 'event', byline: 'Frontier Medical Fellowship',
    org: 'Frontier Medical Fellowship', dates: 'Sep 12 – Sep 26, 2026', apply: 'https://fmf.example/apply/sahel',
    body: 'A two-week team combining a mobile clinic with quiet discipleship in villages where the church is young. Medical and non-medical roles.',
    author: 'Ruth', when: 'Jul 4' },
  { id: 'O3', state: 'published', title: 'Church plant support — diaspora fellowship, Europe', missionType: 'Church plant',
    location: 'Western Europe', source: 'partner', topic: 'update', byline: 'Diaspora Church Network',
    org: 'Diaspora Church Network', dates: 'Rolling', apply: 'https://dcn.example/plant',
    body: 'A refugee-led fellowship needs partners for rent, translation, and prayer as it becomes a sending church in its own right.',
    author: 'Ada', when: 'Jun 27' },
];
const MISSIONTYPE_OPTS = ['Short-term trip', 'Long-term mission', 'Church plant', 'Support opportunity', 'Prayer coverage', 'Testimony'];

// ============================================================
// SUBMISSIONS REVIEW QUEUE (Leader / Partner / Blog)
// ============================================================
const SUBMISSIONS = [
  { id: 'SUB1', src: 'leader', author: 'Pastor M.', org: 'House-church network · Central Asia',
    title: 'How our fellowship survived the winter raids', firstLine: 'When they took our meeting house, we thought it was the end. Instead the church scattered into forty homes and doubled…',
    when: '2h ago' },
  { id: 'SUB2', src: 'partner', author: 'Voice of the Persecuted', org: 'Partner org · verified',
    title: 'Weekly devotional — "The God who hides His seed"', firstLine: 'This week\u2019s reflection for believers who cannot yet see the fruit of their labour. Drawn from the parable of the growing…',
    when: '5h ago' },
  { id: 'SUB3', src: 'blog', author: 'The Persecuted Church Today', org: 'Syndicated blog · cross-post',
    title: 'Five ways the global church can stand with Nigeria', firstLine: 'Reports from Plateau State continue to describe attacks on farming communities. Here is how fellowships abroad can respond…',
    when: '1d ago' },
  { id: 'SUB4', src: 'leader', author: 'Sister R.', org: 'Lay leader · Middle East',
    title: 'A request for prayer partners', firstLine: 'I lead a small women\u2019s group that meets before dawn. We would be strengthened to know someone, somewhere, prays with us…',
    when: '1d ago' },
];

// ============================================================
// PHASE 2 — partner org application intake
// ============================================================
const PARTNER_APPS = [
  { id: 'PA1', org: 'Frontier Medical Fellowship', profile: 'Medical missions in the Sahel + Horn of Africa since 2004',
    fit: 'Short-term trips + long-term clinical placements in access-restricted contexts', contact: 'ops@fmf.example',
    evidence: 'IRS 501(c)(3) · 3 partner-org references · field safety protocol on file', when: '3h ago' },
  { id: 'PA2', org: 'Diaspora Church Network', profile: 'Refugee-led church planting across Western Europe',
    fit: 'Church plant support opportunities + prayer coverage listings', contact: 'partners@dcn.example',
    evidence: 'UK charity no. on file · 2 references · financial statement pending', when: '2d ago' },
];

// ============================================================
// PHASE 3 — missions marketplace trips (de-gamified: plain counts,
// no coverage bars / goals — intercession is not a meter to fill)
// ============================================================
const TRIPS = [
  { id: 'T1', org: 'Frontier Medical Fellowship', name: 'Medical + discipleship, Sahel', loc: 'West Africa · Sep 2026',
    interest: 34, praying: 212, status: 'Open', feedback: null },
  { id: 'T2', org: 'Diaspora Church Network', name: 'Church plant support', loc: 'Western Europe · Rolling',
    interest: 12, praying: 88, status: 'Open', feedback: null },
  { id: 'T3', org: 'Living Stones', name: 'Bible distribution, Mekong', loc: 'Southeast Asia · Completed May 2026',
    interest: 41, praying: 300, status: 'Completed', feedback: 'Team of 6 · 1,200 Scriptures placed · 3 new fellowships requesting follow-up' },
];

function human(s) { return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

Object.assign(window, {
  I, TIER_LABEL, VIEWER, tierAtLeast, human,
  ANNOUNCEMENTS, ANNOUNCEMENT_DRAFTS, TOPIC_OPTS, SOURCE_OPTS, BADGE_OPTS, CARDTYPE_OPTS, leaderBadgeMeta, bylineTemplate,
  WITNESS_CATEGORIES, WITNESSES, WITNESS_DRAFTS,
  SCRIPTURES, THEME_OPTS, TRANSLATION_OPTS, BIBLE_BOOKS, BOOK_CHAPTERS,
  OUTREACH, MISSIONTYPE_OPTS, SUBMISSIONS, PARTNER_APPS, TRIPS,
});
