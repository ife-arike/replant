// data.jsx — mock data + tiny icon helpers for the Church tab
// Each church has up to 2 leaders. Leader.anon=true means name hidden;
// only their role is shown.

const RAG_LABELS = {
  g: 'Freely Operating',
  a: 'Operating with Limitations',
  r: 'Not Operating Freely',
};

// helpers ----------------------------------------------------
function leaderLine(leaders, churchName) {
  // returns the contracted display string for a church row / card subtitle
  if (!leaders || leaders.length === 0) return '';
  const parts = leaders.map(l => l.anon ? l.role : `${l.role} ${l.name.split(' ').slice(-1).join(' ')}`);
  return parts.join(' · ');
}

// CAML \u2014 nearby churches around the leader's home church (Loganville, GA)
const OWN_CHURCH = {
  id: 'own',
  rpl: 'RPL-00128',
  name: 'The Church at Loganville',
  type: 'Church (Main Campus)',
  city: 'Loganville',
  country: 'United States',
  rag: 'g',
  x: 50, y: 50,
  language: 'English',
  denom: 'Non-denominational',
  size: '200\u2013500',
  have: 'Worship space on Sunday evenings, two intercessor teams, a youth program ready to host.',
  need: 'Spanish-speaking translators for a partner ministry, a midweek discipleship curriculum.',
  hasPlan: true,
  open: true,
  showContact: true,
  email: 'ife@loganvillechurch.org',
  address: '4250 Oak Grove Ln, Loganville, GA',
  website: 'loganvillechurch.org',
  leaders: [
    { name: 'Pastor Ife Adebayo', role: 'Pastor', anon: false },
    { name: 'Minister Daniel Reyes', role: 'Minister', anon: false },
  ],
};

const NEARBY_CHURCHES = [
  {
    id: 'n1', rpl: 'RPL-00094', name: 'Grace Tabernacle', type: 'House Church',
    city: 'Loganville', country: 'United States', rag: 'g', dist: 0.8, x: 42, y: 38,
    have: 'Two Spanish-speaking intercessors, a quiet living room on Thursday nights.',
    need: 'A second leader to take on Wednesday discipleship \u2014 we are stretched thin.',
    hasPlan: false, open: true, showContact: true,
    email: 'gracetabernacle.lv@gmail.com',
    address: '317 Pine St, Loganville, GA',
    language: 'English', denom: 'Charismatic', size: 'Under 50',
    leaders: [
      { name: 'Elder Marcus Johnson', role: 'Elder', anon: false },
    ],
  },
  {
    id: 'n2', rpl: 'RPL-00211', name: 'New Hope Fellowship', type: 'House Church',
    city: 'Snellville', country: 'United States', rag: 'a', dist: 2.1, x: 62, y: 32,
    have: 'A small recording setup. A van that seats eight.',
    need: 'Mentorship for a young Apostle stepping into leadership for the first time.',
    hasPlan: true, open: true, showContact: false,
    language: 'English', denom: 'Apostolic', size: '50\u2013200',
    leaders: [
      { name: 'Apostle Hidden', role: 'Apostle', anon: true },
      { name: 'Minister Francis Okonkwo', role: 'Minister', anon: false },
    ],
  },
  {
    id: 'n3', rpl: 'RPL-00067', name: 'House of Prayer \u00b7 East', type: 'Ministry',
    city: 'Lawrenceville', country: 'United States', rag: 'g', dist: 3.4, x: 70, y: 56,
    have: 'A weekly 24h prayer chain in three time zones. Children\u2019s ministry materials.',
    need: 'A pastor willing to drive 30 minutes once a month to speak into our women\u2019s circle.',
    hasPlan: true, open: true, showContact: true,
    email: 'clara@hopeast.net',
    address: '88 Mill Creek Pl, Lawrenceville, GA',
    language: 'English \u00b7 Twi', denom: 'Evangelical', size: '50\u2013200',
    leaders: [
      { name: 'Pastor Clara Mensah', role: 'Pastor', anon: false },
      { name: 'Intercessor Joy Adusei', role: 'Intercessor', anon: false },
    ],
  },
  {
    id: 'n4', rpl: 'RPL-00342', name: 'Iglesia R\u00edo Vivo', type: 'Church (Branch)',
    city: 'Lilburn', country: 'United States', rag: 'a', dist: 4.7, x: 30, y: 64,
    have: 'A multilingual congregation \u2014 Spanish, Portuguese, English. Hot meals on Sundays.',
    need: 'Help relocating two families displaced by recent flooding.',
    hasPlan: false, open: true, showContact: true,
    email: 'pastor@riovivo.org',
    address: '210 Lawrenceville Hwy, Lilburn, GA',
    language: 'Spanish', denom: 'Pentecostal', size: '200\u2013500',
    leaders: [
      { name: 'Pastor Rodrigo Salas', role: 'Pastor', anon: false },
    ],
  },
  {
    id: 'n5', rpl: 'RPL-00501', name: 'Walnut Grove Faith House', type: 'House Church',
    city: 'Walnut Grove', country: 'United States', rag: 'r', dist: 6.2, x: 18, y: 24,
    have: 'A pastoral counselor on retainer. Two intercessor teams.',
    need: 'Urgent \u2014 our gathering space has been closed by the landlord with one week\u2019s notice. We are looking for a new home.',
    hasPlan: false, open: true, showContact: true,
    email: 'rev.eze@walnutgrove.faith',
    address: 'Currently displaced \u2014 contact for safe meeting location.',
    language: 'English \u00b7 Igbo', denom: 'Non-denominational', size: '50\u2013200',
    leaders: [
      { name: 'Reverend Adaora Eze', role: 'Reverend', anon: false },
      { name: 'Anonymous Elder', role: 'Elder', anon: true },
    ],
  },
  {
    id: 'n6', rpl: 'RPL-00723', name: 'Conyers Intercessor Network', type: 'Ministry',
    city: 'Conyers', country: 'United States', rag: 'g', dist: 7.5, x: 78, y: 78,
    have: 'Several hours a week of focused intercession.',
    need: 'Names. We pray for those who ask.',
    hasPlan: false, open: false, showContact: false,
    language: 'English', denom: '\u2014', size: 'Under 50',
    leaders: [
      { name: 'Anonymous Intercessor', role: 'Intercessor', anon: true },
    ],
  },
];

// Global churches for CAL \u2014 each with rpl + leaders
const GLOBAL_CHURCHES = [
  { id: 'g1',  rpl: 'RPL-00128', name: 'The Church at Loganville',  city: 'Loganville, USA',           lat:  33.84, lon: -83.90, rag: 'g',
    leaders: [{ name: 'Pastor Ife Adebayo', role: 'Pastor', anon: false }] },
  { id: 'g2',  rpl: 'RPL-00041', name: 'Capital City Fellowship',   city: 'Washington, USA',           lat:  38.90, lon: -77.04, rag: 'g',
    leaders: [{ name: 'Pastor Lorraine Reyes', role: 'Pastor', anon: false }] },
  { id: 'g3',  rpl: 'RPL-00355', name: 'Heart of the Andes',        city: 'Quito, Ecuador',            lat:  -0.18, lon: -78.47, rag: 'g',
    leaders: [{ name: 'Pastor Diego Mora', role: 'Pastor', anon: false }] },
  { id: 'g4',  rpl: 'RPL-00198', name: 'Rio Mission House',         city: 'Rio de Janeiro, Brazil',    lat: -22.91, lon: -43.17, rag: 'a',
    leaders: [{ name: 'Pastor Beatriz Cardoso', role: 'Pastor', anon: false }] },
  { id: 'g5',  rpl: 'RPL-00077', name: 'Mission Port-au-Prince',    city: 'Port-au-Prince, Haiti',     lat:  18.59, lon: -72.31, rag: 'r',
    leaders: [{ name: 'Pastor Jean-Claude Bertrand', role: 'Pastor', anon: false }] },
  { id: 'g6',  rpl: 'RPL-00012', name: 'Lagos Apostolic Centre',    city: 'Lagos, Nigeria',            lat:   6.52, lon:   3.38, rag: 'g',
    leaders: [{ name: 'Apostle Femi Okafor', role: 'Apostle', anon: false }, { name: 'Pastor Chioma Bello', role: 'Pastor', anon: false }] },
  { id: 'g7',  rpl: 'RPL-00029', name: 'Nairobi House of Prayer',   city: 'Nairobi, Kenya',            lat:  -1.29, lon:  36.82, rag: 'g',
    leaders: [{ name: 'Pastor Wangari Mwangi', role: 'Pastor', anon: false }] },
  { id: 'g8',  rpl: 'RPL-00415', name: 'Cairo Living Stones',       city: 'Cairo, Egypt',              lat:  30.04, lon:  31.24, rag: 'a',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
  { id: 'g9',  rpl: 'RPL-00468', name: 'Damascus House Church',     city: 'Damascus, Syria',           lat:  33.51, lon:  36.30, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }, { name: 'Hidden', role: 'Elder', anon: true }] },
  { id: 'g10', rpl: 'RPL-00489', name: 'Tehran Believers',          city: 'Tehran, Iran',              lat:  35.69, lon:  51.39, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
  { id: 'g11', rpl: 'RPL-00263', name: 'Mumbai Praise Ministry',    city: 'Mumbai, India',             lat:  19.08, lon:  72.88, rag: 'a',
    leaders: [{ name: 'Pastor Anand Rao', role: 'Pastor', anon: false }] },
  { id: 'g12', rpl: 'RPL-00280', name: 'Delhi Northern Fellowship', city: 'Delhi, India',              lat:  28.61, lon:  77.21, rag: 'a',
    leaders: [{ name: 'Pastor Priya Joshi', role: 'Pastor', anon: false }, { name: 'Hidden', role: 'Evangelist', anon: true }] },
  { id: 'g13', rpl: 'RPL-00512', name: 'Yangon Persecuted Church',  city: 'Yangon, Myanmar',           lat:  16.87, lon:  96.20, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
  { id: 'g14', rpl: 'RPL-00164', name: 'Manila Light House',        city: 'Manila, Philippines',       lat:  14.60, lon: 120.98, rag: 'g',
    leaders: [{ name: 'Pastor Maria Santos', role: 'Pastor', anon: false }] },
  { id: 'g15', rpl: 'RPL-00055', name: 'Seoul Prayer Mountain',     city: 'Seoul, South Korea',        lat:  37.57, lon: 126.98, rag: 'g',
    leaders: [{ name: 'Pastor Kim Min-jun', role: 'Pastor', anon: false }] },
  { id: 'g16', rpl: 'RPL-00088', name: 'Tokyo Bayside Church',      city: 'Tokyo, Japan',              lat:  35.68, lon: 139.69, rag: 'g',
    leaders: [{ name: 'Pastor Akira Tanaka', role: 'Pastor', anon: false }] },
  { id: 'g17', rpl: 'RPL-00102', name: 'Sydney Hill Fellowship',    city: 'Sydney, Australia',         lat: -33.87, lon: 151.21, rag: 'g',
    leaders: [{ name: 'Pastor Hannah Wright', role: 'Pastor', anon: false }] },
  { id: 'g18', rpl: 'RPL-00316', name: 'Jakarta House',             city: 'Jakarta, Indonesia',        lat:  -6.21, lon: 106.85, rag: 'a',
    leaders: [{ name: 'Pastor Budi Wijaya', role: 'Pastor', anon: false }] },
  { id: 'g19', rpl: 'RPL-00531', name: 'Karachi Faith Centre',      city: 'Karachi, Pakistan',         lat:  24.86, lon:  67.00, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
  { id: 'g20', rpl: 'RPL-00220', name: 'Istanbul Light',            city: 'Istanbul, T\u00fcrkiye',    lat:  41.00, lon:  28.97, rag: 'a',
    leaders: [{ name: 'Pastor Demir Kaya', role: 'Pastor', anon: false }] },
  { id: 'g21', rpl: 'RPL-00134', name: 'Rome River Church',         city: 'Rome, Italy',               lat:  41.90, lon:  12.49, rag: 'g',
    leaders: [{ name: 'Pastor Lucia Romano', role: 'Pastor', anon: false }] },
  { id: 'g22', rpl: 'RPL-00149', name: 'Madrid Streetside',         city: 'Madrid, Spain',             lat:  40.41, lon:  -3.70, rag: 'g',
    leaders: [{ name: 'Pastor Carla Vega', role: 'Pastor', anon: false }] },
  { id: 'g23', rpl: 'RPL-00121', name: 'Berlin Eastside',           city: 'Berlin, Germany',           lat:  52.52, lon:  13.40, rag: 'g',
    leaders: [{ name: 'Pastor Stefan Becker', role: 'Pastor', anon: false }] },
  { id: 'g24', rpl: 'RPL-00109', name: 'London Hope',               city: 'London, UK',                lat:  51.51, lon:  -0.13, rag: 'g',
    leaders: [{ name: 'Pastor Adaeze Nwosu', role: 'Pastor', anon: false }] },
  { id: 'g25', rpl: 'RPL-00444', name: 'Kyiv Refuge',               city: 'Kyiv, Ukraine',             lat:  50.45, lon:  30.52, rag: 'r',
    leaders: [{ name: 'Pastor Olena Koval', role: 'Pastor', anon: false }] },
  { id: 'g26', rpl: 'RPL-00499', name: 'Moscow Underground',        city: 'Moscow, Russia',            lat:  55.75, lon:  37.62, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
  { id: 'g27', rpl: 'RPL-00177', name: 'Mexico City Light',         city: 'Mexico City, Mexico',       lat:  19.43, lon: -99.13, rag: 'g',
    leaders: [{ name: 'Pastor Sof\u00eda Herrera', role: 'Pastor', anon: false }] },
  { id: 'g28', rpl: 'RPL-00038', name: 'Toronto Bayside',           city: 'Toronto, Canada',           lat:  43.65, lon: -79.38, rag: 'g',
    leaders: [{ name: 'Pastor Daniel Park', role: 'Pastor', anon: false }] },
  { id: 'g29', rpl: 'RPL-00044', name: 'Vancouver West',            city: 'Vancouver, Canada',         lat:  49.28, lon: -123.12, rag: 'g',
    leaders: [{ name: 'Pastor Sarah Chen', role: 'Pastor', anon: false }] },
  { id: 'g30', rpl: 'RPL-00206', name: 'Buenos Aires Vine',         city: 'Buenos Aires, Argentina',   lat: -34.60, lon: -58.38, rag: 'g',
    leaders: [{ name: 'Pastor Mateo Russo', role: 'Pastor', anon: false }] },
  { id: 'g31', rpl: 'RPL-00065', name: 'Cape Town Light',           city: 'Cape Town, South Africa',   lat: -33.92, lon:  18.42, rag: 'g',
    leaders: [{ name: 'Pastor Naledi Khumalo', role: 'Pastor', anon: false }] },
  { id: 'g32', rpl: 'RPL-00081', name: 'Addis Ababa House',         city: 'Addis Ababa, Ethiopia',     lat:   9.03, lon:  38.74, rag: 'g',
    leaders: [{ name: 'Pastor Selam Abebe', role: 'Pastor', anon: false }] },
  { id: 'g33', rpl: 'RPL-00308', name: 'Kinshasa Riverside',        city: 'Kinshasa, DR Congo',        lat:  -4.32, lon:  15.32, rag: 'a',
    leaders: [{ name: 'Pastor Joseph Mbeki', role: 'Pastor', anon: false }] },
  { id: 'g34', rpl: 'RPL-00475', name: 'Khartoum Hidden',           city: 'Khartoum, Sudan',           lat:  15.50, lon:  32.56, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
  { id: 'g35', rpl: 'RPL-00482', name: 'Mogadishu Cell',            city: 'Mogadishu, Somalia',        lat:   2.04, lon:  45.34, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
  { id: 'g36', rpl: 'RPL-00387', name: 'Hong Kong Hill',            city: 'Hong Kong',                 lat:  22.32, lon: 114.17, rag: 'a',
    leaders: [{ name: 'Pastor Wei Lam', role: 'Pastor', anon: false }] },
  { id: 'g37', rpl: 'RPL-00113', name: 'Singapore Marina',          city: 'Singapore',                 lat:   1.35, lon: 103.82, rag: 'g',
    leaders: [{ name: 'Pastor Jonathan Tan', role: 'Pastor', anon: false }] },
  { id: 'g38', rpl: 'RPL-00329', name: 'Bangkok Refuge',            city: 'Bangkok, Thailand',         lat:  13.76, lon: 100.50, rag: 'a',
    leaders: [{ name: 'Pastor Apinya Suk', role: 'Pastor', anon: false }] },
  { id: 'g39', rpl: 'RPL-00345', name: 'Dhaka Faith House',         city: 'Dhaka, Bangladesh',         lat:  23.81, lon:  90.41, rag: 'a',
    leaders: [{ name: 'Pastor Rashid Ahmed', role: 'Pastor', anon: false }] },
  { id: 'g40', rpl: 'RPL-00540', name: 'Kabul House Church',        city: 'Kabul, Afghanistan',        lat:  34.53, lon:  69.17, rag: 'r',
    leaders: [{ name: 'Hidden', role: 'Pastor', anon: true }] },
];

// Aggregate counts
const COUNTS = {
  total: 247,              // total verified, visible on map
  urgent: 34,
  underground: 18,         // not pictured anywhere
  underground_regions: ['North Africa', 'Central Asia', 'East Asia', 'Middle East', 'South Asia'],
};

// Global intercessions for the Prayer pull-up
const GLOBAL_INTERCESSIONS = [
  { loc: 'Port-au-Prince \u00b7 Haiti', rpl: 'RPL-00077', rag: 'r', text: 'For our children to get to school this week without harm. For provisions, for protection on the road.', time: '12m', agreed: 47 },
  { loc: 'Kabul \u00b7 Afghanistan', rpl: 'RPL-00540', rag: 'r', text: 'Two sisters were arrested last night. We are asking for their release and for courage for the family that remains.', time: '38m', agreed: 312 },
  { loc: 'Lagos \u00b7 Nigeria', rpl: 'RPL-00012', rag: 'g', text: 'A baptism on Sunday \u2014 fourteen souls. Pray they are kept under the wings.', time: '1h', agreed: 88 },
  { loc: 'Damascus \u00b7 Syria', rpl: 'RPL-00468', rag: 'r', text: 'For wisdom on where to meet this Friday. The gathering keeps growing.', time: '2h', agreed: 156 },
  { loc: 'Yangon \u00b7 Myanmar', rpl: 'RPL-00512', rag: 'r', text: 'Our pastor is being followed. Cover him.', time: '3h', agreed: 421 },
  { loc: 'Nairobi \u00b7 Kenya', rpl: 'RPL-00029', rag: 'g', text: 'A revival is breaking out at the university. We ask for laborers \u2014 we are not enough hands.', time: '5h', agreed: 64 },
  { loc: 'A region we cannot name', rpl: null, rag: 'r', text: 'An underground church writing through the team. Three were baptized in secret. Pray for cover, and for joy.', time: '6h', agreed: 893 },
];

Object.assign(window, {
  RAG_LABELS, OWN_CHURCH, NEARBY_CHURCHES, GLOBAL_CHURCHES,
  GLOBAL_INTERCESSIONS, COUNTS, leaderLine,
});
