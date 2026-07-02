// Prayer Wall Redesign — all data constants

const PILLS = [
  { id: 'feed', label: 'Feed' },
  { id: 'testimonies', label: 'Testimonies' },
  { id: 'my-prayers', label: 'My Prayers' },
  { id: 'revelation', label: 'Revelation' },
  { id: 'locations', label: 'Locations' },
];

const GLOBAL_PREVIEW = [
  { loc: 'Lagos, Nigeria', when: '1h',
    text: 'A baptism on Sunday \u2014 fourteen souls. Pray they are kept under the wings.' },
  { loc: 'Mumbai, India', when: '3h',
    text: 'For our pastor\u2019s clarity in the next teaching series. The room is hungry for the Word.' },
];

const MY_CHURCH_PRAYERS = [
  { id: 'p1', text: 'A wisdom decision before our elders this Sunday \u2014 a difficult call about a partner ministry.',
    posted: '2d ago', praying: 23 },
  { id: 'p2', text: 'Provision for Marisol\u2019s family during her recovery. Three children, no income for weeks.',
    posted: '6d ago', praying: 88 },
  { id: 'p3', text: 'Our youth group meets Wednesday \u2014 pray for hearts softened and for the message to land.',
    posted: '1w ago', praying: 45 },
  { id: 'p4', text: 'Safe travel for the missions team to the regional gathering next month.',
    posted: '2w ago', praying: 134 },
];

const TESTIMONY_FEED_DATA = [
  { id: 't1', leader: 'Pastor Anand Rao', loc: 'Mumbai, India',
    text: 'Our pastor\u2019s wife came through surgery last Tuesday. The surgeons found the tumour smaller than the scans had shown, and removed it cleanly. She is at home now, walking the garden.',
    when: '2d', celebrated: 1289 },
  { id: 't2', leader: 'Pastor Wangari Mwangi', loc: 'Nairobi, Kenya',
    text: 'Sixty-three baptisms at the university this week. They came up out of the water singing. We did not have enough towels.',
    when: '4d', celebrated: 2104 },
  { id: 't3', leader: 'Pastor Diego Mora', loc: 'Quito, Ecuador',
    text: 'The funds for the new gathering space arrived. Every cent came from churches in the network. None of them know each other. He knows.',
    when: '1w', celebrated: 876 },
  { id: 't4', leader: 'Pastor Maria Santos', loc: 'Manila, Philippines',
    text: 'My nephew, who you prayed for in January, walked out of the hospital yesterday on his own feet. He is whole. He is whole.',
    when: '1w', celebrated: 1567 },
  { id: 't5', leader: 'Apostle Femi Okafor', loc: 'Lagos, Nigeria',
    text: 'The fourteen we baptized at Easter are still standing. None have fallen away. We keep watch in prayer.',
    when: '2w', celebrated: 944 },
];

const ARCHETYPES = [
  { id: 'ephesus', condition: 'Loveless', city: 'Ephesus', ref: 'Revelation 2:1\u20137',
    brief: 'Doctrinally sound, laboring hard \u2014 but the first love has grown cold.',
    voices: 8 },
  { id: 'smyrna', condition: 'Persecuted', city: 'Smyrna', ref: 'Revelation 2:8\u201311',
    brief: 'Suffering, poor in the world\u2019s eyes \u2014 yet rich. Faithful unto death.',
    voices: 14, linksTo: 'persecuted' },
  { id: 'pergamon', condition: 'Compromising', city: 'Pergamon', ref: 'Revelation 2:12\u201317',
    brief: 'Holding fast to Christ\u2019s name, yet tolerating teachings that lead astray.',
    voices: 5 },
  { id: 'thyatira', condition: 'Corrupt', city: 'Thyatira', ref: 'Revelation 2:18\u201329',
    brief: 'Love, faith, and endurance abound \u2014 but a false prophet is tolerated within.',
    voices: 3 },
  { id: 'sardis', condition: 'Dead', city: 'Sardis', ref: 'Revelation 3:1\u20136',
    brief: 'A name that says alive, but the works are incomplete before God.',
    voices: 11 },
  { id: 'philadelphia', condition: 'Faithful', city: 'Philadelphia', ref: 'Revelation 3:7\u201313',
    brief: 'Little strength, but the word is kept and the name is not denied.',
    voices: 19, affirming: true },
  { id: 'laodicea', condition: 'Lukewarm', city: 'Laodicea', ref: 'Revelation 3:14\u201322',
    brief: 'Neither hot nor cold \u2014 self-sufficient, unaware of true poverty.',
    voices: 23 },
];

const LUKEWARM_DETAIL = {
  condition: 'Lukewarm',
  city: 'Laodicea',
  ref: 'Revelation 3:14\u201322',
  address: 'To the angel of the church in Laodicea write: \u201CThe Amen, the faithful and true Witness, the Beginning of the creation of God, says this\u2026\u201D',
  conviction: '\u201CI know your deeds, that you are neither cold nor hot. I wish that you were cold or hot. So because you are lukewarm, and neither hot nor cold, I will spit you out of My mouth.\u201D',
  counsel: '\u201CI advise you to buy from Me gold refined by fire so that you may become rich, and white garments so that you may clothe yourself, and eye salve to anoint your eyes so that you may see. Those whom I love, I reprove and discipline; therefore be zealous and repent.\u201D',
  promise: '\u201CTo the one who overcomes, I will grant to sit down with Me on My throne, as I also overcame and sat down with My Father on His throne.\u201D',
  promiseRef: 'Revelation 3:21',
  insights: [
    { leader: 'Pastor Wangari M.', loc: 'Nairobi, Kenya', time: '3d', type: 'warning',
      text: 'This is our season. We had grown comfortable in our programs and our plans. The Lord is burning it down \u2014 and we are grateful.' },
    { leader: 'Pastor Diego M.', loc: 'Quito, Ecuador', time: '1w', type: 'commentary',
      text: 'I read this to our elders last month. Three of us wept. We are buying gold.' },
    { leader: 'A leader', loc: 'Central Asia', time: '2w', type: 'prophecy',
      text: 'We did not know we were poor until He showed us. Pray for us as we repent.' },
    { leader: 'Pastor Maria S.', loc: 'Manila, Philippines', time: '3w', type: 'scripture',
      text: '\u201CSearch me, O God, and know my heart; try me, and know my anxieties.\u201D \u2014 Psalm 139:23' },
  ],
};

Object.assign(window, {
  PILLS, GLOBAL_PREVIEW, MY_CHURCH_PRAYERS, TESTIMONY_FEED_DATA,
  ARCHETYPES, LUKEWARM_DETAIL,
});
