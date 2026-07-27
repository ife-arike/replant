// Prayer Wall Tab v2 — sky-blue throughout, intercession card primitive.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "demoState": "default",
  "receiveState": "locked"
}/*EDITMODE-END*/;

// open prayer requests from the global body (Make Intercession preview)
const GLOBAL_PREVIEW = [
  { loc: 'Lagos, Nigeria', when: '1h', text: 'A baptism on Sunday \u2014 fourteen souls. Pray they are kept under the wings.' },
  { loc: 'Mumbai, India', when: '3h', text: 'For our pastor\u2019s clarity in the next teaching series. The room is hungry for the Word.' },
];

// open prayer requests from YOUR church (Receive Intercession preview)
const MY_OPEN_REQUESTS = [
  { text: 'A wisdom decision before our elders this Sunday \u2014 a difficult call about a partner ministry.', posted: '2d', praying: 23 },
  { text: 'Provision for Marisol\u2019s family during her recovery. Three children, no income for weeks.', posted: '6d', praying: 88 },
];

// testimony data — leaders sharing answered or active prayers
const TESTIMONIES = [
  { id: 't1', loc: 'Mumbai, India', rpl: 'RPL-00263', leader: 'Pastor Anand Rao',
    text: 'Our pastor\u2019s wife came through surgery last Tuesday. The surgeons found the tumour smaller than the scans had shown, and removed it cleanly. She is at home now, walking the garden.',
    when: '2d', amened: 1289, answered: true },
  { id: 't2', loc: 'Nairobi, Kenya', rpl: 'RPL-00029', leader: 'Pastor Wangari Mwangi',
    text: 'Sixty-three baptisms at the university this week. They came up out of the water singing. We did not have enough towels.',
    when: '4d', amened: 2104, answered: true },
  { id: 't3', loc: 'Quito, Ecuador', rpl: 'RPL-00355', leader: 'Pastor Diego Mora',
    text: 'The funds for the new gathering space arrived. Every cent came from churches in the network. None of them know each other. He knows.',
    when: '1w', amened: 876, answered: true },
  { id: 't4', loc: 'Manila, Philippines', rpl: 'RPL-00164', leader: 'Pastor Maria Santos',
    text: 'My nephew, who you prayed for in January, walked out of the hospital yesterday on his own feet. He is whole. He is whole.',
    when: '1w', amened: 1567, answered: true },
  { id: 't5', loc: 'Lagos, Nigeria', rpl: 'RPL-00012', leader: 'Apostle Femi Okafor',
    text: 'The fourteen we baptized at Easter are still standing. None have fallen away. We keep watch in prayer.',
    when: '2w', amened: 944, answered: true },
];

// ───────── Tab bar ─────────
function TabBar({ active = 3 }) {
  const tabs = [
    { name: 'Home', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
    { name: 'The Church', icon: <g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></g> },
    { name: 'Persecuted', icon: <g><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g> },
    { name: 'Prayer', icon: <g><path d="M12 2v8M9 4l3-2 3 2M5 22V11a3 3 0 0 1 6 0v6" /><path d="M19 22V11a3 3 0 0 0-6 0v6" /><path d="M5 22h14" /></g> },
    { name: 'Connect', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  ];
  return (
    <div className="tc-tabbar">
      {tabs.map((t, i) => {
        const isActive = i === active;
        const stroke = isActive ? '#6BB5E8' : 'currentColor';
        return (
          <div key={t.name} className={'tc-tab' + (isActive ? ' active' : '')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">{t.icon}</svg>
            <div className="name" style={{ color: isActive ? 'var(--sky)' : 'var(--muted)' }}>{t.name}</div>
          </div>
        );
      })}
    </div>
  );
}

function TestimonyCard({ t, onAmen }) {
  return (
    <div className={'testimony' + (t.answered ? ' answered' : '')}>
      <div className="head">
        <span className="d" />
        <span className="loc">{t.loc}</span>
        <span className="rpl">{t.rpl}</span>
      </div>
      <div className="leader">{t.leader}</div>
      <div className="text">"{t.text}"</div>
      <div className="meta">
        <span className="amen" onClick={() => onAmen(t.id)}>+ Amen</span>
        <span className="when">{t.amened.toLocaleString()} amen · {t.when} ago</span>
      </div>
    </div>
  );
}

function PrayerWallApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [activeTestimony, setActiveTestimony] = React.useState(0);
  const scrollerRef = React.useRef(null);
  const isEmpty = t.demoState === 'empty';

  const onScroll = () => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current;
    const cardW = el.children[0]?.getBoundingClientRect().width || 1;
    const gap = 14;
    const idx = Math.round(el.scrollLeft / (cardW + gap));
    setActiveTestimony(Math.min(idx, TESTIMONIES.length - 1));
  };

  return (
    <div className="tab-root prayer-wall">
      <div className="tab-header">
        <div className="eyebrow">Tab 4 · The Body Gathered</div>
        <h1>Prayer Wall</h1>
        <div className="subtitle">1,247 interceding · Updated live</div>
      </div>

      <div className="tc-pages">
        <div className="tab-body">

          {/* hero — the main moment */}
          <div className="hero-prayer">
            <div className="eyebrow">
              <span className="live-dot" />
              Tonight · Live
            </div>
            <div className="hero-title">Make intercession</div>
            <div className="hero-sub">Pray through the wall of requests from churches around the world.</div>

            <div className="preview-list">
              {GLOBAL_PREVIEW.map((p, i) => (
                <div key={i} className="preview-row">
                  <span className="preview-dot g" />
                  <div className="preview-body">
                    <div className="preview-text">{p.text}</div>
                    <div className="preview-meta">{p.loc} · {p.when} ago</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="stats">
              <span><span className="num">1,247</span> interceding now</span>
              <span className="dot">·</span>
              <span><span className="num">12</span> added this hour</span>
            </div>
            <div className="cta">
              <div className="btn btn-primary" style={{ width: '100%' }}>
                Enter the prayer wall
                <svg width="11" height="11" viewBox="0 0 12 12" style={{ marginLeft: 4 }}>
                  <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* receive — locked OR active depending on tweak */}
          {t.receiveState === 'locked' && (
            <div className="receive">
              <div className="lock-glyph">
                <svg width="13" height="13" viewBox="0 0 14 14">
                  <rect x="3" y="6" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M5 6V4a2 2 0 0 1 4 0v2" fill="none" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </div>
              <div className="body">
                <div className="title">Receive intercession</div>
                <div className="sub">Let the body lift your church in prayer.</div>
              </div>
              <div className="badge">Coming soon</div>
            </div>
          )}

          {t.receiveState === 'active' && (
            <div className="receive-active">
              <div className="head">
                <div className="eyebrow">
                  <span className="live-dot" />
                  Your church · Lifted by 47
                </div>
                <div className="hero-title">Receive intercession</div>
                <div className="hero-sub">Let the body stand with you. Share what your church is carrying.</div>
              </div>

              <div className="preview-list" style={{ marginTop: 0 }}>
                {MY_OPEN_REQUESTS.map((r, i) => (
                  <div key={i} className="preview-row">
                    <span className="preview-dot g" />
                    <div className="preview-body">
                      <div className="preview-text">{r.text}</div>
                      <div className="preview-meta">Posted {r.posted} ago · <span className="hl">{r.praying} interceding</span></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="stats">
                <span><span className="num">{MY_OPEN_REQUESTS.length}</span> open</span>
                <span className="dot">·</span>
                <span><span className="num">{MY_OPEN_REQUESTS.reduce((a, r) => a + r.praying, 0)}</span> praying for you</span>
              </div>

              <div className="actions">
                <div className="btn btn-ghost share-btn">
                  <svg width="11" height="11" viewBox="0 0 12 12" style={{ marginRight: 6 }}>
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  </svg>
                  Share a need
                </div>
              </div>
            </div>
          )}

          {t.receiveState === 'active-empty' && (
            <div className="receive-active">
              <div className="head">
                <div className="eyebrow">
                  <span className="live-dot" />
                  Your church
                </div>
                <div className="hero-title">Receive intercession</div>
                <div className="hero-sub">Let the body stand with you in prayer.</div>
              </div>

              <div className="receive-empty">
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(107,181,232,0.3)" strokeWidth="0.6" strokeDasharray="2 3" />
                  <path d="M16 10v8M12 14l4-4 4 4" stroke="rgba(107,181,232,0.6)" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="empty-title">No open requests yet.</div>
                <div className="empty-body">
                  Share what your church is carrying. Others will lift it before God.
                </div>
              </div>

              <div className="actions">
                <div className="btn btn-ghost share-btn">
                  <svg width="11" height="11" viewBox="0 0 12 12" style={{ marginRight: 6 }}>
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  </svg>
                  Share a need
                </div>
              </div>
            </div>
          )}

          {/* journal link */}
          <div className="journal-link">
            <div className="icon">
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path d="M3 3h12v12H3z" fill="none" stroke="currentColor" strokeWidth="1.1" />
                <path d="M6 6h6M6 9h6M6 12h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </div>
            <div className="body">
              <div className="title">Your intercession journal</div>
              <div className="sub">12 holding · 4 returned with answer</div>
            </div>
            <div className="chev">
              <svg width="13" height="13" viewBox="0 0 14 14">
                <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* testimonies */}
          <div className="section-h" style={{ marginTop: 32 }}>
            <span className="label">Testimonies from the wall</span>
            <span className="rule" />
            {!isEmpty && <span className="link">See all</span>}
          </div>

          {!isEmpty && (
            <>
              <div className="testimony-carousel">
                <div
                  className={'testimony-nav prev' + (activeTestimony === 0 ? ' disabled' : '')}
                  onClick={() => {
                    if (!scrollerRef.current) return;
                    const card = scrollerRef.current.children[Math.max(0, activeTestimony - 1)];
                    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14"><path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div
                  className={'testimony-nav next' + (activeTestimony === TESTIMONIES.length - 1 ? ' disabled' : '')}
                  onClick={() => {
                    if (!scrollerRef.current) return;
                    const card = scrollerRef.current.children[Math.min(TESTIMONIES.length - 1, activeTestimony + 1)];
                    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="testimony-scroller" ref={scrollerRef} onScroll={onScroll}>
                  {TESTIMONIES.map(tm => (
                    <TestimonyCard key={tm.id} t={tm} onAmen={() => {}} />
                  ))}
                </div>
              </div>

              <div className="scroll-dots">
                {TESTIMONIES.map((_, i) => (
                  <div key={i} className={'dot' + (i === activeTestimony ? ' active' : '')} />
                ))}
              </div>
            </>
          )}

          {isEmpty && (
            <div className="empty-quiet">
              <svg className="glyph" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(107,181,232,0.3)" strokeWidth="0.8" strokeDasharray="2 3" />
                <path d="M11 22c0-3 7-3 7 0M18 22c0-3 7-3 7 0M14 17l4-3 4 3" stroke="rgba(107,181,232,0.6)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
              <div className="title">No testimonies yet.</div>
              <div className="body">
                The prayers continue. When the Lord answers, the testimonies will be carried here.
              </div>
            </div>
          )}
        </div>

        {/* scripture footer */}
        <div className="scripture-foot">
          <div className="eyebrow">Watching in prayer</div>
          <div className="verse">
            "Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance."
          </div>
          <div className="ref">Ephesians 6:18</div>
        </div>

      </div>

      <TabBar active={3} />

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="State">
          <TweakRadio
            label="View"
            value={t.demoState}
            onChange={(v) => setTweak('demoState', v)}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'empty', label: 'No testimonies' },
            ]}
          />
          <TweakRadio
            label="Receive Intercession"
            value={t.receiveState}
            onChange={(v) => setTweak('receiveState', v)}
            options={[
              { value: 'locked', label: 'Coming soon' },
              { value: 'active', label: 'Built · open requests' },
              { value: 'active-empty', label: 'Built · no requests' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PrayerWallApp />);
