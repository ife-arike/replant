// Prayer Wall Redesign — shared screen components

// ───────── Pill Navigation ─────────
function PillNav({ active, pills, onChange }) {
  return (
    <div className="pill-nav">
      {(pills || PILLS).map(p => (
        <div
          key={p.id}
          className={'pill' + (active === p.id ? ' active' : '')}
          onClick={() => onChange && onChange(p.id)}
        >
          {p.label}
        </div>
      ))}
    </div>
  );
}

// ───────── Tab Bar (5 tabs, Prayer active) ─────────
function PWTabBar({ active = 3 }) {
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
        return (
          <div key={t.name} className={'tc-tab' + (isActive ? ' active' : '')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={isActive ? '#6BB5E8' : 'currentColor'} strokeWidth="1.5">
              {t.icon}
            </svg>
            <div className="name" style={{ color: isActive ? 'var(--sky)' : 'var(--muted)' }}>
              {t.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════
// FEED SCREEN — existing Prayer Wall landing
// ═══════════════════════════════════════════════

function FeedScreen() {
  return (
    <div className="tab-body">
      {/* Make Intercession hero */}
      <div className="hero-prayer">
        <div className="eyebrow">
          <span className="live-dot" />
          Tonight · Live
        </div>
        <div className="hero-title">Make intercession</div>
        <div className="hero-sub">
          Pray through the wall of requests from churches around the world.
        </div>
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
              <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.4"
                fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Receive Intercession (locked) */}
      <div className="receive">
        <div className="lock-glyph">
          <svg width="13" height="13" viewBox="0 0 14 14">
            <rect x="3" y="6" width="8" height="6" rx="1" fill="none"
              stroke="currentColor" strokeWidth="1.1" />
            <path d="M5 6V4a2 2 0 0 1 4 0v2" fill="none"
              stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </div>
        <div className="body">
          <div className="title">Receive intercession</div>
          <div className="sub">Let the body lift your church in prayer.</div>
        </div>
        <div className="badge">Coming soon</div>
      </div>

      {/* Testimony carousel */}
      <div className="section-h" style={{ marginTop: 32 }}>
        <span className="label">Testimonies from the wall</span>
        <span className="rule" />
        <span className="link">See all</span>
      </div>

      <div className="testimony-carousel">
        <div className="testimony-scroller">
          {TESTIMONY_FEED_DATA.slice(0, 3).map(tm => (
            <div key={tm.id} className="testimony">
              <div className="head">
                <span className="d" />
                <span className="loc">{tm.loc}</span>
              </div>
              <div className="leader">{tm.leader}</div>
              <div className="text">"{tm.text}"</div>
              <div className="meta">
                <span className="amen">+ Amen</span>
                <span className="when">
                  {tm.celebrated.toLocaleString()} amen · {tm.when} ago
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="scroll-dots">
        <div className="dot active" /><div className="dot" /><div className="dot" />
      </div>

      {/* Scripture footer */}
      <div className="scripture-foot" style={{ margin: '32px 0 28px' }}>
        <div className="eyebrow">Watching in prayer</div>
        <div className="verse">
          "Praying always with all prayer and supplication in the Spirit,
          and watching thereunto with all perseverance."
        </div>
        <div className="ref">Ephesians 6:18</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MY PRAYERS SCREEN
// ═══════════════════════════════════════════════

function MyPrayersScreen() {
  const [menuOpen, setMenuOpen] = React.useState(null);

  return (
    <div className="tab-body">
      <div className="my-prayers-head">
        <div className="my-prayers-title">Your Church's Open Prayers</div>
        <div className="my-prayers-sub">
          {MY_CHURCH_PRAYERS.length} open requests ·{' '}
          {MY_CHURCH_PRAYERS.reduce((a, p) => a + p.praying, 0)} interceding
        </div>
      </div>

      <div className="my-prayers-list">
        {MY_CHURCH_PRAYERS.map(p => (
          <div key={p.id} className="my-prayer-card">
            <div className="my-prayer-row1">
              <span className="my-prayer-dot" />
              <div className="my-prayer-text">{p.text}</div>
              <div
                className="my-prayer-overflow"
                onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <circle cx="8" cy="3" r="1.2" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="8" cy="13" r="1.2" fill="currentColor" />
                </svg>
              </div>
            </div>
            <div className="my-prayer-meta">
              <span>Posted {p.posted}</span>
              <span className="sep">·</span>
              <span className="hl">{p.praying} interceding</span>
            </div>
            {menuOpen === p.id && (
              <div className="my-prayer-menu">
                <div className="my-prayer-menu-item praise">
                  <svg width="12" height="12" viewBox="0 0 14 14">
                    <path d="M7 1l2 4h4l-3.2 2.5 1.2 4.5L7 9.5 3 12l1.2-4.5L1 5h4z"
                      fill="none" stroke="currentColor" strokeWidth="1.1" />
                  </svg>
                  Mark as Praise
                </div>
                <div className="my-prayer-menu-item delete">
                  <svg width="12" height="12" viewBox="0 0 14 14">
                    <path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M4 4l.7 8a1 1 0 0 0 1 .9h2.6a1 1 0 0 0 1-.9L10 4"
                      fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                  Delete
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="my-prayers-add">
        <div className="btn btn-ghost" style={{ width: '100%' }}>
          <svg width="11" height="11" viewBox="0 0 12 12" style={{ marginRight: 6 }}>
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4"
              fill="none" strokeLinecap="round" />
          </svg>
          Post a prayer request
        </div>
      </div>

      <div className="scripture-foot" style={{ margin: '32px 0 28px' }}>
        <div className="eyebrow">Cast your burden</div>
        <div className="verse">
          "Cast your burden on the Lord, and He shall sustain you;
          He shall never permit the righteous to be moved."
        </div>
        <div className="ref">Psalm 55:22</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TESTIMONIES SCREEN (green variant)
// ═══════════════════════════════════════════════

function TestimoniesScreen() {
  return (
    <div className="tab-body">
      <div className="test-banner-bare">
        <div className="test-banner-eyebrow">Revelation 12:11</div>
        <div className="test-banner-verse">
          "And they overcame him by the blood of the Lamb,
          and by the word of their testimony."
        </div>
      </div>

      <div className="test-list">
        {TESTIMONY_FEED_DATA.map(t => (
          <div key={t.id} className="test-card">
            <div className="test-card-head">
              <span className="test-card-dot" />
              <span className="test-card-loc">{t.loc}</span>
              <span className="test-card-when">{t.when} ago</span>
            </div>
            <div className="test-card-leader">{t.leader}</div>
            <div className="test-card-text">"{t.text}"</div>
            <div className="test-card-foot">
              <div className="test-celebrate">
                <img src="prayer-wall-redesign/rejoice-icon.png" width="28" height="28"
                  style={{ display: 'block', margin: '-4px -1px -4px 0' }} alt="" />
                Rejoice
              </div>
              <span className="test-count">{t.celebrated.toLocaleString()} rejoicing</span>
            </div>
          </div>
        ))}
      </div>

      <div className="test-pagination">
        <span className="test-page active">1</span>
        <span className="test-page">2</span>
        <span className="test-page">3</span>
        <span className="test-page-next">
          <svg width="10" height="10" viewBox="0 0 12 12">
            <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.4"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// LOCATIONS SCREEN (Coming Soon)
// ═══════════════════════════════════════════════

function LocationsScreen() {
  return (
    <div className="tab-body">
      <div className="loc-coming-soon">
        <svg className="loc-glyph" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="none"
            stroke="rgba(107,181,232,0.2)" strokeWidth="0.6" strokeDasharray="2 3" />
          <path d="M24 12c-4.4 0-8 3.6-8 8 0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z"
            fill="none" stroke="rgba(107,181,232,0.5)" strokeWidth="1.2" />
          <circle cx="24" cy="20" r="3" fill="none"
            stroke="rgba(107,181,232,0.5)" strokeWidth="1.2" />
        </svg>
        <div className="loc-title">Locations</div>
        <div className="loc-sub">Coming soon</div>
        <div className="loc-body">
          Cluster prayer requests to discern strongholds in an area.
          Where the body prays, the map exposes the enemy's devices — so that we can disappoint them.
        </div>
        <div className="loc-scripture">
          "He disappointeth the devices of the crafty, so that their hands cannot perform their enterprise."
        </div>
        <div className="loc-ref">Job 5:12</div>
      </div>
    </div>
  );
}

Object.assign(window, {
  PillNav, PWTabBar, FeedScreen, MyPrayersScreen,
  TestimoniesScreen, LocationsScreen,
});
