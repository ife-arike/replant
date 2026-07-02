// data.jsx — content for all surfaces. Anonymized, region-only, never country.
// Exported on window for cross-script access.

// ─────────── Article body (in-app reader) ───────────
const ARTICLE_BODY = {
  source: 'Replant Editorial',
  author: 'Replant Team',
  title: 'Three families, one basement.',
  read: '6 min read',
  paragraphs: [
    'When the prohibition came down, the families thought it would last a fortnight. The gathering was small — fourteen adults and twenty children across three households — and the elders had agreed at the outset that whatever happened, the children would not be made to feel the weight of it. They would gather differently. They would gather at the same hour. They would not stop.',
    'It has been nine months.',
    'The basement is in the home of the oldest family. The wife asked us not to share the story of how they came to faith because, she said, the story is not finished and the parts that are finished she would like to keep. We respected that. What we can share is this: the gathering meets on Sunday mornings, the children sing the same songs they sang upstairs, the bread is unleavened because the wife learned to bake it when she was a girl, and the Word is read aloud in two languages so that the older saints and the younger families both hear it the way it first came to them.',
  ],
  pullQuote: 'The body does not need permission to gather. It needs only courage and one room.',
  paragraphsAfter: [
    'We asked the husband what they had learned about the church in nine months of forbidden gathering. He thought for a long time. Then he said: we have learned that the church is the people, and the people are the room, and the room can be small.',
    'When the prohibition is lifted — and they all believe it will be, eventually — the families plan to keep meeting in the basement. They have come to love it there.',
  ],
  scripture: {
    verse: 'For where two or three are gathered in my name, there am I among them.',
    ref: 'Matthew 18:20',
  },
};

// ─────────── Guidance body (in-app reader) ───────────
const GUIDANCE_BODY = {
  eyebrow: 'For Leaders',
  title: 'If your fellowship is raided.',
  sub: 'A brief, practical guide. Read once, return when needed. Held entirely in-app — nothing on this page is logged or sent anywhere.',
  steps: [
    { n: '01', label: 'Protect the gathered first.',
      body: 'Names before things. Get the most vulnerable — children, the elderly, recent converts, anyone not yet known to authorities — out first. Have a pre-agreed exit and a pre-agreed assembly point at least two streets removed.',
      scripture: { text: 'He will tend his flock like a shepherd; he will gather the lambs in his arms.', ref: 'Isaiah 40:11' } },
    { n: '02', label: 'Destroy nothing that could not be replaced.',
      body: 'Do not burn records in the moment. Do not flush anything. Have a pre-prepared sanitized phone or device that contains nothing connecting to other fellowships. The truth is not the enemy. Documentation that endangers others is.',
      scripture: { text: 'Be wise as serpents and innocent as doves.', ref: 'Matthew 10:16' } },
    { n: '03', label: 'Do not lie. Do not volunteer.',
      body: 'Answer what is asked, truthfully and minimally. Names other than your own are not yours to give. Locations of other gatherings are not yours to give. “I do not wish to answer that question” is a complete sentence.',
      scripture: { text: 'Let what you say be simply “Yes” or “No.” Anything more than this comes from evil.', ref: 'Matthew 5:37' } },
    { n: '04', label: 'Pray aloud where you can.',
      body: 'If you are detained, pray aloud. Not for performance — for the comfort of the saints near you and for the witness of those who hold you. Many have come to faith hearing the prayers of their prisoners.',
      scripture: { text: 'About midnight Paul and Silas were praying and singing hymns to God, and the prisoners were listening to them.', ref: 'Acts 16:25' } },
    { n: '05', label: 'Reach Replant when you can.',
      body: 'When you are clear and safe, share a heartcry. Do not include details that name others. We will pray, we will respond, and the body will be told only what it needs to know to stand with you.',
      scripture: { text: 'Bear one another’s burdens, and so fulfill the law of Christ.', ref: 'Galatians 6:2' } },
  ],
  scripture: {
    verse: 'Behold, I am sending you out as sheep in the midst of wolves; so be wise as serpents and innocent as doves.',
    ref: 'Matthew 10:16',
  },
};

// ─────────── Front-page feed ───────────
const HEARTCRIES = [
  { id: 'h1', region: 'North America', time: '2h',
    text: 'Struggling with a few things right now. Our church looks healthy on the outside but there are actually significant threats coming to our doorstep daily. Would love for intercession specifically around blackmail. God bless.',
    interceding: 1284, held: false, severity: 'serious' },
  { id: 'h2', region: 'Central Asia', time: '38m',
    text: 'I am on trial in two days. Pray for my words and for the judge’s heart.',
    interceding: 3417, held: true, severity: 'urgent' },
  { id: 'h3', region: 'Middle East', time: '4h',
    text: 'Three new believers. We baptized them in a basement at 2 AM. Pray they are not betrayed.',
    interceding: 892, held: false, severity: 'urgent' },
  { id: 'h4', region: 'East Asia', time: '6h',
    text: 'I write this knowing I may not see another sunrise as a free man. The peace is real. The peace is real.',
    interceding: 5621, held: false, severity: 'active_persecution' },
  { id: 'h5', region: 'South Asia', time: '11h',
    text: 'My husband is held. Our daughter asks where he is. Pray for her faith and for his release.',
    interceding: 2103, held: false, severity: 'urgent' },
  { id: 'h6', region: 'Southeast Asia', time: '1d',
    text: 'They forbade us from gathering. We will gather. Cover us.',
    interceding: 1466, held: false, severity: 'ongoing' },
  { id: 'h7', region: 'North Africa', time: '1d',
    text: 'For the seven still missing. Six weeks now. Pray that they are alive and that their captors meet Christ.',
    interceding: 4118, held: false, severity: 'urgent' },
  { id: 'h8', region: 'Europe', time: '2d',
    text: 'A long heartcry, forgive me. Our small fellowship has been under coordinated pressure for nine months. It began with permits being revoked, then our pastor lost his employment, then two families were doxxed and forced to relocate. Last week our gathering space was vandalized for the third time and the local authorities decline to investigate. We are not in physical danger yet but the wear is real — the children are afraid, the older saints are confused, the young men are angry. I am writing because the body needs to know this is happening in places it has stopped expecting it, and because I want to be reminded that the church has weathered far worse. Pray for our endurance, for wisdom in our leadership, and for the conversion of those who oppose us. We do not ask for safety. We ask for faithfulness.',
    interceding: 2841, held: false, severity: 'serious' },
  { id: 'h9', region: 'Sub-Saharan Africa', time: '3d',
    text: 'Two pastors arrested at the border returning from a leaders’ meeting. No charges yet. Pray for their families and for the elders standing in their stead.',
    interceding: 1789, held: false, severity: 'urgent' },
  { id: 'h10', region: 'South America', time: '3d',
    text: 'Praise. The young woman who recanted last year under pressure has come home. Pray her faith would be deeper than before.',
    interceding: 956, held: false, severity: 'ongoing' },
  { id: 'h11', region: 'Oceania', time: '5d',
    text: 'Quiet prayer request. A leader in our network has been silent for two months and we do not know why.',
    interceding: 412, held: false, severity: 'info' },
  { id: 'h12', region: 'East Asia', time: '6d',
    text: 'We had to move again. The fifth time this year. Pray for the children’s schooling.',
    interceding: 1623, held: false, severity: 'serious' },
];

const REGIONS = [
  { id: 'all',           label: 'All' },
  { id: 'Africa',        label: 'Africa' },
  { id: 'North America', label: 'North America' },
  { id: 'South America', label: 'South America' },
  { id: 'Asia',          label: 'Asia' },
  { id: 'Europe',        label: 'Europe' },
  { id: 'Oceania',       label: 'Oceania' },
];

// ─────────── My Heartcries (viewer's own submissions) ───────────
const MY_HEARTCRIES = [
  { id: 'm1',
    severity: 'serious',
    submittedAt: 'Today · 1:14 PM',
    relative: '2h ago',
    excerpt: 'Struggling with a few things right now. Our church looks healthy on the outside but there are actually significant threats coming to our doorstep',
    status: 'responded' },
  { id: 'm2',
    severity: 'urgent',
    submittedAt: 'May 28 · 9:22 PM',
    relative: '6 days ago',
    excerpt: 'We have been forced to move our gathering for the third time this month. Pray that the body would not lose heart',
    status: 'seen' },
  { id: 'm3',
    severity: 'ongoing',
    submittedAt: 'May 16 · 7:05 AM',
    relative: '18 days ago',
    excerpt: 'Surveillance has increased. Our brother who was detained is now released but watched. Pray for endurance and for',
    status: 'received' },
  { id: 'm4',
    severity: 'info',
    submittedAt: 'Apr 30 · 11:48 AM',
    relative: '1 month ago',
    excerpt: 'A small praise. The young man who was beaten last winter is walking again and was at our gathering on Sunday',
    status: 'responded' },
];

const SEVERITY_LABELS = {
  active_persecution: 'Active',
  urgent: 'Urgent',
  serious: 'Serious',
  ongoing: 'Ongoing',
  info: 'Informational',
};

// ─────────── The Memorial / Stories ───────────
const MEMORIAL_STATS = [
  { num: '8,412', desc: 'leaders standing in prayer across forty-three regions this week' },
  { num: '1,206', desc: 'heartcries held by the body this month, each one named before the Father' },
  { num: '63',    desc: 'churches currently under active persecution, region only — never named' },
];

const STORIES = [
  { source: 'Replant Editorial', author: 'Replant Team', title: 'Three families, one basement.',
    excerpt: 'What we have learned from leaders sheltering in place: the body does not need permission to gather. It needs only courage and one room.',
    read: '6 min read' },
  { source: 'Voice of the Martyrs', author: 'Partner feed', title: 'A letter from inside.',
    excerpt: 'Translated and shared with permission. A pastor writes to his congregation from prison — not asking for release, but for the church to remain.',
    read: '4 min read' },
  { source: 'Replant Editorial', author: 'Replant Team', title: 'When the gathering is forbidden.',
    excerpt: 'A pastoral note on the threshold: how the early church gathered when Rome forbade it, and what they wrote to each other when they could not.',
    read: '9 min read' },
];

const WITNESSES = [
  { era: 'AD 156', name: 'Polycarp of Smyrna', region: 'Asia Minor',
    account: 'Eighty-six years I have served Him, and He has done me no wrong. How can I blaspheme my King who saved me?',
    verse: 'Revelation 2:10' },
  { era: 'AD 203', name: 'Perpetua & Felicity', region: 'Carthage',
    account: 'Two young mothers, jailed for refusing to deny Christ. Perpetua’s diary survives — the earliest known writing by a Christian woman.',
    verse: 'Romans 8:18' },
  { era: '1555', name: 'Latimer & Ridley', region: 'England',
    account: 'Be of good comfort, Master Ridley, and play the man; we shall this day light such a candle, by God’s grace, in England, as I trust shall never be put out.',
    verse: '2 Timothy 4:7' },
  { era: '1956', name: 'Jim Elliot & companions', region: 'Ecuador',
    account: 'Five young missionaries killed by the people they came to reach. Their wives returned, and a generation followed.',
    verse: 'John 12:24' },
];

// ─────────── Witness of the day ───────────
// FOUNDER NOTE: The canonical list of witnesses needs editorial review.
// Plan with founder (Claude Code, plan-mode) before publish. Categories below;
// every name MUST be a bonafide Christian who confessed Christ alone.
//
// MARTYRS (confirmed died for the faith) — badge: "Martyr":
//   Stephen (c. AD 36), James son of Zebedee (c. AD 44), Polycarp (~156),
//   Perpetua & Felicity (203), John Hus (1415), William Tyndale (1536),
//   Latimer & Ridley (1555), Jim Elliot & companions (1956),
//   Dietrich Bonhoeffer (1945), Richard Wurmbrand survived (no badge),
//   modern unnamed martyrs by region (anonymized).
//
// FATHERS / MOTHERS OF THE FAITH (no martyr badge):
//   Augustine of Hippo (354–430), Athanasius (296–373), John Wycliffe (~1320–1384),
//   John Bunyan (1628–1688, imprisoned), George Müller (1805–1898),
//   Charles Spurgeon (1834–1892), Andrew Murray (1828–1917),
//   Hudson Taylor (1832–1905), Amy Carmichael (1867–1951),
//   David Brainerd (1718–1747), Brother Andrew (1928–2022),
//   Eric Liddell (1902–1945).
//
// GOD'S GENERALS (revivalists, no martyr badge):
//   John G. Lake (1870–1935), Sadhu Sundar Singh (1889–1929),
//   William J. Seymour (1870–1922), Kathryn Kuhlman (1907–1976),
//   Smith Wigglesworth (1859–1947), A.W. Tozer (1897–1963),
//   C.S. Lewis (1898–1963).
//
// FROM SCRIPTURE (can be groups):
//   Stephen (Acts 7), Daniel (Daniel 6), the three Hebrews (Daniel 3),
//   John the Baptist (Matthew 14, martyr), Paul the Apostle (martyr by tradition),
//   Esther, Jeremiah, Elijah, Mary mother of Jesus, the early apostles.
//
// DATES policy: use confirmed year if known. If a birth/death year is uncertain,
// use "c." prefix. Bible figures use approximate biblical-era markers.
// Never publish a witness whose Christian confession is in dispute.

const WITNESS_OF_DAY = {
  id: 'wod-polycarp',
  era: 'AD 156',
  yearsLabel: 'c. AD 69 – 156',
  name: 'Polycarp of Smyrna',
  region: 'Asia Minor (modern Izmir, Turkey)',
  category: 'Father of the Faith',
  martyr: true,
  martyrLabel: 'Martyr',
  quote: 'Eighty-six years I have served Him, and He has done me no wrong. How can I blaspheme my King who saved me?',
  scriptureRef: 'Revelation 2:10',
};

// ─────────── Encouragement / Resources ───────────
const ENCOURAGEMENT_VERSES = [
  { text: 'When you pass through the waters, I will be with you; and through the rivers, they shall not overwhelm you.',
    ref: 'Isaiah 43:2' },
  { text: 'Blessed are those who are persecuted for righteousness’ sake, for theirs is the kingdom of heaven.',
    ref: 'Matthew 5:10' },
  { text: 'Who shall separate us from the love of Christ? Shall tribulation, or distress, or persecution, or famine, or nakedness, or danger, or sword?',
    ref: 'Romans 8:35' },
  { text: 'We are afflicted in every way, but not crushed; perplexed, but not driven to despair.',
    ref: '2 Corinthians 4:8' },
  { text: 'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you.',
    ref: 'Isaiah 41:10' },
];

const GUIDANCE_CARDS = [
  { icon: 'lock', title: 'Digital security, brief.',
    sub: 'Six habits that protect you and the body. Read once, return when needed.' },
  { icon: 'door', title: 'If your fellowship is raided.',
    sub: 'Steps to protect the gathered, the records, and those who came new.' },
  { icon: 'shield', title: 'If you are arrested.',
    sub: 'What to say, what not to say, and how the body will continue without you.' },
  { icon: 'book', title: 'Continuing under prohibition.',
    sub: 'How the early church gathered when forbidden, and what they wrote to each other.' },
];

// ─────────── Stand Together ───────────
const REGION_PRAYER = [
  { name: 'Middle East',     count: '2,847', sub: 'standing now',  heat: 0.92 },
  { name: 'East Asia',       count: '2,103', sub: 'standing now',  heat: 0.78 },
  { name: 'North Africa',    count: '1,562', sub: 'standing now',  heat: 0.65 },
  { name: 'South Asia',      count: '1,118', sub: 'standing now',  heat: 0.48 },
  { name: 'Central Asia',    count: '847',   sub: 'standing now',  heat: 0.36 },
  { name: 'Southeast Asia',  count: '612',   sub: 'standing now',  heat: 0.26 },
];

const STAND_AGGR = [
  { label: 'Heartcries actively held in prayer', value: '347', unit: 'tonight' },
  { label: 'Verified leaders standing this hour', value: '9,089', unit: 'global' },
  { label: 'Regions with active intercession',    value: '43',    unit: 'of 47' },
];

// ─────────── Story archive (“All stories” screen) ───────────
const STORY_ARCHIVE = [
  { source: 'Replant Editorial', author: 'Replant Team', title: 'Three families, one basement.', date: 'Today' },
  { source: 'Voice of the Martyrs', author: 'Partner feed', title: 'A letter from inside.', date: 'Yesterday' },
  { source: 'Replant Editorial', author: 'Replant Team', title: 'When the gathering is forbidden.', date: '3 days ago' },
  { source: 'Open Doors', author: 'Partner feed', title: 'The watchlist, rethought.', date: '1 week ago' },
  { source: 'Replant Editorial', author: 'Replant Team', title: 'How a pastor prepares his successor.', date: '2 weeks ago' },
  { source: 'Voice of the Martyrs', author: 'Partner feed', title: 'Children of the underground.', date: '3 weeks ago' },
  { source: 'Replant Editorial', author: 'Replant Team', title: 'On not asking for safety.', date: '1 month ago' },
  { source: 'Replant Editorial', author: 'Replant Team', title: 'The threshold is held.', date: '1 month ago' },
  { source: 'Open Doors', author: 'Partner feed', title: 'A report from the South.', date: '6 weeks ago' },
  { source: 'Replant Editorial', author: 'Replant Team', title: 'On what the children remember.', date: '2 months ago' },
];

// ─────────── Witness archive (“Witness archive” screen) ───────────
// Featured = today's WITNESS_OF_DAY. Past = rotation history (placeholder).
// Categories: Martyr / Father of the Faith / Mother of the Faith /
//             God’s General / From Scripture.
const WITNESS_ARCHIVE = [
  { era: 'AD 36',  name: 'Stephen',                category: 'From Scripture',     martyr: true,  desc: 'The first martyr of the church, stoned for preaching Christ. Acts 7.',                                            verse: 'Acts 7:55' },
  { era: 'AD 156', name: 'Polycarp of Smyrna',     category: 'Father of the Faith', martyr: true,  desc: 'Burned alive in the arena. Eighty-six years served his King.',                                                    verse: 'Revelation 2:10' },
  { era: 'AD 203', name: 'Perpetua & Felicity',    category: 'Mother of the Faith', martyr: true,  desc: 'Two young mothers, jailed in Carthage. Perpetua’s diary survives.',                                              verse: 'Romans 8:18' },
  { era: '1415',   name: 'John Hus',               category: 'Father of the Faith', martyr: true,  desc: 'Bohemian reformer, burned at Constance for preaching scripture in the vernacular.',                                verse: 'John 8:32' },
  { era: '1536',   name: 'William Tyndale',        category: 'Father of the Faith', martyr: true,  desc: 'Translated the Bible into English. Strangled and burned. “Open the King of England’s eyes.”',                       verse: '1 Peter 1:23' },
  { era: '1555',   name: 'Latimer & Ridley',       category: 'Father of the Faith', martyr: true,  desc: 'Burned at Oxford. “Play the man, Master Ridley; we shall this day light such a candle.”',                          verse: '2 Timothy 4:7' },
  { era: '1628–1688', name: 'John Bunyan',        category: 'Father of the Faith', martyr: false, desc: 'Twelve years in prison for preaching without license. Wrote Pilgrim’s Progress there.',                             verse: 'Hebrews 11:13' },
  { era: '1834–1892', name: 'Charles Spurgeon',   category: 'Father of the Faith', martyr: false, desc: 'The Prince of Preachers — the simple gospel, the held flock, the steady pulpit.',                                   verse: '1 Corinthians 1:23' },
  { era: '1832–1905', name: 'Hudson Taylor',      category: 'Father of the Faith', martyr: false, desc: 'Founded the China Inland Mission. Trusted the Lord for daily provision and for sons.',                             verse: 'Mark 11:24' },
  { era: '1859–1947', name: 'Smith Wigglesworth', category: 'God’s General',     martyr: false, desc: 'Plumber turned evangelist; boldness and faith. “I am not moved by what I see.”',                                   verse: 'Hebrews 11:1' },
  { era: '1867–1951', name: 'Amy Carmichael',     category: 'Mother of the Faith', martyr: false, desc: 'Fifty-five years in India without furlough, rescuing children from temple slavery.',                                 verse: 'Matthew 18:5' },
  { era: '1870–1922', name: 'William Seymour',    category: 'God’s General',     martyr: false, desc: 'Azusa Street — the revival where the body became one across every line.',                                          verse: 'Acts 2:17' },
  { era: '1889–1929', name: 'Sadhu Sundar Singh', category: 'God’s General',     martyr: false, desc: 'Walked India and Tibet in saffron robes preaching Christ. Disappeared into the Himalayas.',                       verse: 'Matthew 5:11' },
  { era: '1898–1963', name: 'C.S. Lewis',         category: 'Father of the Faith', martyr: false, desc: 'Oxford don, atheist turned apologist. “Mere Christianity” held a generation.',                                      verse: '1 Peter 3:15' },
  { era: '1902–1945', name: 'Eric Liddell',       category: 'Father of the Faith', martyr: false, desc: 'Olympic gold, missionary to China, died in a Japanese internment camp. “It’s complete surrender.”',                 verse: 'Isaiah 40:31' },
  { era: '1906–1945', name: 'Dietrich Bonhoeffer',category: 'Father of the Faith', martyr: true,  desc: 'Hanged at Flossenbürg by the Nazi regime. “When Christ calls a man, he bids him come and die.”',                   verse: 'Philippians 1:21' },
  { era: '1928–2022', name: 'Brother Andrew',     category: 'Father of the Faith', martyr: false, desc: 'God’s Smuggler. Carried scripture into closed countries for seventy years.',                                        verse: 'Joshua 1:9' },
  { era: '1956',   name: 'Jim Elliot & companions',category: 'Father of the Faith', martyr: true,  desc: 'Five missionaries killed by the Waorani in Ecuador. “He is no fool who gives what he cannot keep.”',                 verse: 'John 12:24' },
];

Object.assign(window, {
  HEARTCRIES, REGIONS, MY_HEARTCRIES, SEVERITY_LABELS,
  MEMORIAL_STATS, STORIES, WITNESSES, WITNESS_OF_DAY,
  ENCOURAGEMENT_VERSES, GUIDANCE_CARDS,
  REGION_PRAYER, STAND_AGGR,
  ARTICLE_BODY, GUIDANCE_BODY,
  STORY_ARCHIVE, WITNESS_ARCHIVE,
});
