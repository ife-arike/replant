/* eslint-disable */
// ── Content Section · shared data + icons ───────────────────────────
// Mock data for all three surfaces + Witness / Submissions / Phase 2-3.
// Every visible field carries a `map` note somewhere to the DB column.

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
  pray:   <svg viewBox="0 0 24 24" className="ic"><path d="M12 3c-1 3-3 5-3 8v5a2 2 0 0 0 4 0M12 3c1 3 3 5 3 8v5a2 2 0 0 1-4 0"/></svg>,
  route:  <svg viewBox="0 0 24 24" className="ic"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M6 16V9a4 4 0 0 1 4-4h5"/></svg>,
  bell:   <svg viewBox="0 0 24 24" className="ic"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
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
// ============================================================
const ANNOUNCEMENTS = [
  { id: 'A1', state: 'published', today: true, title: 'Standing with the church in Manipur this week',
    source: 'admin', byline: '', topic: 'prayer', badge: 'urgent', cardType: 'call_to_action',
    body: 'Renewed violence has displaced dozens of house-church families across the hills. Set aside time this week to pray for shelter, for the pastors coordinating relief, and for a swift end to the unrest. We will post specific needs as our partners on the ground confirm them.',
    author: 'Ruth', when: 'Published Jun 30', pushed: true },
  { id: 'A2', state: 'scheduled', next: true, title: 'July prayer calendar — one nation each day',
    source: 'admin', byline: '', topic: 'event', badge: 'new', cardType: 'article',
    body: 'A downloadable calendar pairing each day of July with a specific persecuted-church context and a short intercession. Save it, print it, pray it with your fellowship.',
    author: 'Ruth', when: 'Scheduled · Jul 3 · 9am UTC', pushed: false },
  { id: 'A3', state: 'published', title: 'A word from a bishop in West Africa', source: 'leader',
    byline: 'From a bishop · West Africa', topic: 'word_from_family', badge: 'none', cardType: 'leader_word',
    body: 'Do not measure the harvest by the size of the field you can see. The seed you cannot see is the seed God is keeping.',
    author: 'Ruth', when: 'Published Jun 28', pushed: false },
  { id: 'A4', state: 'published', title: 'Testimony: baptisms continue despite the ban', source: 'leader',
    byline: 'From a house-church network · Central Asia', topic: 'testimony', badge: 'none', cardType: 'encouragement',
    body: 'Eleven believers were baptised at night by the river. The authorities came the next morning and found nothing. God went before us.',
    author: 'Ada', when: 'Published Jun 26', pushed: false },
  { id: 'A5', state: 'published', title: 'Correction to "Regional gathering moved to Saturday"', source: 'admin',
    byline: '', topic: 'correction', badge: 'none', cardType: 'standard', correctionOf: 'A9',
    body: 'The gathering time in the original post was listed in the wrong timezone. The correct time is 14:00 UTC, not 14:00 local.',
    author: 'Ruth', when: 'Published Jun 25', pushed: false },
  { id: 'A6', state: 'published', title: 'New: partner devotionals from Voice of the Persecuted', source: 'partner',
    byline: 'Voice of the Persecuted', topic: 'update', badge: 'none', cardType: 'article',
    body: 'A weekly devotional series written for believers under pressure is now available in the Outreach tab.',
    author: 'Ruth', when: 'Published Jun 22', pushed: false },
];
const ANNOUNCEMENT_DRAFTS = [
  { id: 'D1', state: 'draft', title: 'Ramadan follow-up: sustaining new believers', source: 'admin',
    byline: '', topic: 'update', badge: 'none', cardType: 'long_read',
    body: 'A longer reflection on how fellowships across the region are discipling those who came to faith during the spring…',
    author: 'Ruth', when: 'Created Jun 30' },
  { id: 'D2', state: 'draft', title: 'Prayer partners needed — Horn of Africa', source: 'admin',
    byline: '', topic: 'prayer', badge: 'none', cardType: 'together',
    body: 'We are matching leaders in isolated contexts with intercessors abroad. Sign-up flow to follow.',
    author: 'Ada', when: 'Created Jun 29' },
  { id: 'D3', state: 'draft', title: 'Encouragement for bivocational pastors', source: 'leader',
    byline: 'From a pastor · Southeast Asia', topic: 'word_from_family', badge: 'none', cardType: 'leader_word',
    body: 'You who mend nets by day and shepherd by night — the Lord sees the double labour.',
    author: 'Ruth', when: 'Created Jun 28' },
  { id: 'D4', state: 'draft', title: 'Security reminder: verifying a new contact', source: 'admin',
    byline: '', topic: 'update', badge: 'urgent', cardType: 'call_to_action',
    body: 'Steps every leader should take before adding an unknown contact to a fellowship group.',
    author: 'Ruth', when: 'Created Jun 27' },
  { id: 'D5', state: 'draft', title: 'Draft: mid-year letter from the Replant team', source: 'admin',
    byline: '', topic: 'update', badge: 'none', cardType: 'long_read',
    body: 'Where we have been, where we are going, and how the network has grown this year.',
    author: 'Ada', when: 'Created Jun 24' },
];
const TOPIC_OPTS = ['prayer', 'event', 'update', 'testimony', 'correction', 'word_from_family'];
const SOURCE_OPTS = ['admin', 'leader', 'partner', 'blog'];
const BADGE_OPTS = ['none', 'new', 'urgent'];
const CARDTYPE_OPTS = ['standard', 'article', 'long_read', 'leader_word', 'encouragement', 'together', 'call_to_action'];

// ---- Witness of the Day ----
const WITNESSES = [
  { id: 'W1', today: true, name: 'Perpetua of Carthage', era: 'pre-Constantinian', region: 'North Africa',
    dates: 'c. 182 – 203', scripture: 'Revelation 2:10',
    testimony: 'A young mother imprisoned for her faith, she recorded her own visions before the arena. On the day of her death she guided the executioner\u2019s trembling hand to her throat.',
    source: 'The Passion of Perpetua and Felicity' },
  { id: 'W2', name: 'Lin Xiangao (Samuel Lamb)', era: 'Contemporary', region: 'East Asia',
    dates: '1924 – 2013', scripture: 'Acts 5:29',
    testimony: 'Imprisoned for over twenty years, he returned to pastor a house church that only grew larger. \u201CMore persecution, more growing,\u201D he said.',
    source: 'China for Jesus house-church records' },
  { id: 'W3', name: 'Bishop Haik Hovsepian', era: 'Contemporary', region: 'Middle East',
    dates: '1945 – 1994', scripture: 'John 15:13',
    testimony: 'He refused to sign a document declaring there was no persecution in his country, and campaigned publicly for an imprisoned colleague. He disappeared days later.',
    source: 'Iranian evangelical church archives' },
];

// ============================================================
// DAILY SCRIPTURE
// ============================================================
const SCRIPTURES = [
  { id: 'S1', today: true, ref: 'Romans 8:18', translation: 'ESV', theme: 'Suffering',
    verse: 'For I consider that the sufferings of this present time are not worth comparing with the glory that is to be revealed to us.',
    reflection: 'Paul does not deny the weight of the present. He measures it — and finds it light only against a glory he has already glimpsed. For the believer under pressure, hope is not denial; it is accurate accounting.',
    prompt: 'What present weight are you carrying that God is asking you to weigh against His promise?',
    related: [
      { ref: '2 Corinthians 4:17', txt: 'this light momentary affliction is preparing…' },
      { ref: '1 Peter 5:10', txt: 'after you have suffered a little while…' },
    ],
    author: 'Ruth', when: 'Today · Jun 30' },
  { id: 'S2', next: true, ref: 'Joshua 1:9', translation: 'NIV', theme: 'Boldness',
    verse: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',
    reflection: 'Courage here is commanded, not summoned. It rests not on the size of the threat but on the presence of the One who commands.',
    prompt: 'Where is God commanding courage of you today?',
    related: [{ ref: 'Deuteronomy 31:6', txt: 'he will never leave you nor forsake you' }],
    author: 'Ruth', when: 'Scheduled · Jul 1' },
  { id: 'S3', ref: 'Psalm 27:1', translation: 'KJV', theme: 'Faith',
    verse: 'The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?',
    reflection: '', prompt: '', related: [], author: 'Ada', when: 'Scheduled · Jul 2', state: 'scheduled' },
  { id: 'S4', ref: 'James 1:2-3', translation: 'ESV', theme: 'Endurance',
    verse: 'Count it all joy, my brothers, when you meet trials of various kinds, for you know that the testing of your faith produces steadfastness.',
    reflection: '', prompt: '', related: [], author: 'Ruth', when: 'Scheduled · Jul 3', state: 'scheduled' },
];
const THEME_OPTS = ['Perseverance', 'Suffering', 'Joy', 'Boldness', 'Faith', 'Grace', 'Endurance', 'Hope'];
const TRANSLATION_OPTS = ['KJV', 'ESV', 'NIV', 'NASB', 'NKJV', 'NLT', 'CSB'];

// ============================================================
// OUTREACH & MISSIONS — Phase 1
// ============================================================
const OUTREACH = [
  { id: 'O1', today: true, title: 'Prayer coverage: underground seminary, East Asia', missionType: 'Prayer coverage',
    location: 'Undisclosed · East Asia', source: 'admin', topic: 'prayer', byline: '', cardType: 'call_to_action',
    org: '', dates: 'Ongoing', apply: 'replant://prayer/east-asia-seminary',
    body: 'Twelve students are training in secret to plant churches. Cover them: for the teachers who travel between safe houses, for exams taken in whispers, and for the day they are sent out.',
    author: 'Ruth', when: 'Published Jun 30' },
  { id: 'O2', next: true, title: 'Short-term: medical + discipleship, Sahel', missionType: 'Short-term trip',
    location: 'Sahel region · West Africa', source: 'partner', topic: 'event', byline: 'Frontier Medical Fellowship', cardType: 'article',
    org: 'Frontier Medical Fellowship', dates: 'Sep 12 – Sep 26, 2026', apply: 'https://fmf.example/apply/sahel',
    body: 'A two-week team combining a mobile clinic with quiet discipleship in villages where the church is young. Medical and non-medical roles.',
    author: 'Ruth', when: 'Scheduled · Jul 4' },
  { id: 'O3', title: 'Church plant support — diaspora fellowship, Europe', missionType: 'Church plant',
    location: 'Western Europe', source: 'partner', topic: 'update', byline: 'Diaspora Church Network', cardType: 'standard',
    org: 'Diaspora Church Network', dates: 'Rolling', apply: 'https://dcn.example/plant',
    body: 'A refugee-led fellowship needs partners for rent, translation, and prayer as it becomes a sending church in its own right.',
    author: 'Ada', when: 'Published Jun 27' },
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
// PHASE 3 — missions marketplace trips
// ============================================================
const TRIPS = [
  { id: 'T1', org: 'Frontier Medical Fellowship', name: 'Medical + discipleship, Sahel', loc: 'West Africa · Sep 2026',
    interest: 34, prayer: 212, prayerGoal: 300, feedback: null },
  { id: 'T2', org: 'Diaspora Church Network', name: 'Church plant support', loc: 'Western Europe · Rolling',
    interest: 12, prayer: 88, prayerGoal: 150, feedback: null },
  { id: 'T3', org: 'Living Stones', name: 'Bible distribution, Mekong', loc: 'Southeast Asia · Completed May 2026',
    interest: 41, prayer: 300, prayerGoal: 300, feedback: 'Team of 6 · 1,200 Scriptures placed · 3 new fellowships requesting follow-up' },
];

// ---- field/column mapping data per surface ----
const FIELD_MAPS = {
  announcements: [
    { field: 'Source', col: 'author_type', type: 'enum · admin/leader/partner/blog' },
    { field: 'Byline', col: 'source_label', type: 'text ≤30' },
    { field: 'Topic', col: 'topic', type: 'enum (NEW)' },
    { field: 'Badge', col: 'badge', type: 'enum · was tag_type' },
    { field: 'Card type', col: 'card_type', type: 'enum · rendering router' },
    { field: 'State', col: 'published_at / is_active', type: 'derived' },
    { field: 'Correction link', col: 'correction_of', type: 'FK → announcements.id' },
  ],
  witness: [
    { field: 'Name', col: 'witnesses.name', type: 'text · required' },
    { field: 'Region', col: 'witnesses.regions', type: 'text[] · optional' },
    { field: 'Era', col: 'witnesses.era', type: 'enum' },
    { field: 'Life dates', col: 'witnesses.year_from / year_to', type: 'int' },
    { field: 'Testimony', col: 'witnesses.testimony', type: 'text' },
    { field: 'Primary source', col: 'witnesses.primary_source', type: 'text / url' },
    { field: 'Scripture ref', col: 'witnesses.scripture_ref', type: 'text · optional' },
  ],
  scripture: [
    { field: 'Reference', col: 'daily_scripture.reference', type: 'text' },
    { field: 'Translation', col: 'daily_scripture.translation', type: 'text (exists)' },
    { field: 'Theme', col: 'daily_scripture.theme', type: 'enum (NEW)' },
    { field: 'Verse', col: 'daily_scripture.content', type: 'text' },
    { field: 'Reflection', col: 'daily_scripture.reflection', type: 'text · optional' },
    { field: 'Prompt', col: 'daily_scripture.reflect_prompt', type: 'text ≤200 · optional' },
    { field: 'Related', col: 'scripture_related', type: 'join → 1-N verses' },
    { field: 'Date', col: 'daily_scripture.scripture_date', type: 'date · PK' },
  ],
  outreach: [
    { field: 'Mission type', col: 'outreach.mission_type', type: 'enum' },
    { field: 'Location', col: 'outreach.location', type: 'text / region' },
    { field: 'Duration', col: 'outreach.date_start / date_end', type: 'date · optional' },
    { field: 'Apply URL', col: 'outreach.apply_url', type: 'url' },
    { field: 'Coordinating org', col: 'outreach.org_id', type: 'FK → partner_orgs (Ph.2)' },
    { field: 'Source / Topic / Byline', col: 'author_type / topic / source_label', type: 'shared w/ Announcements' },
  ],
};
