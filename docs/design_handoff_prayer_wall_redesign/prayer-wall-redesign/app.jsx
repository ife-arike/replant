// Prayer Wall Redesign — main app shell, phone frames, handoff page

const PW_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "frameOverride": "off"
}/*EDITMODE-END*/;

const FRAMES = [
  { id: 'feed',          pill: 'feed',        label: 'Feed (default landing)',       screenLabel: '01 · Feed' },
  { id: 'my-prayers',    pill: 'my-prayers',  label: 'My Prayers',                  screenLabel: '02 · My Prayers' },
  { id: 'revelation',    pill: 'revelation',  label: 'Revelation · Archetype List',  screenLabel: '03 · Revelation List' },
  { id: 'rev-detail',    pill: 'revelation',  detail: true, label: 'Revelation · Lukewarm Detail', screenLabel: '04 · Lukewarm Detail' },
  { id: 'testimonies',   pill: 'testimonies', label: 'Testimonies',                 screenLabel: '05 · Testimonies' },
  { id: 'locations',     pill: 'locations',   label: 'Locations · Coming Soon',     screenLabel: '06 · Locations' },
];

// ───────── Prayer Wall Screen ─────────

function PrayerWallScreen({ frame }) {
  const [activePill, setActivePill] = React.useState(frame?.pill || 'feed');
  const [showDetail, setShowDetail] = React.useState(!!frame?.detail);
  const [detailId, setDetailId] = React.useState(frame?.detail ? 'laodicea' : null);
  const pagesRef = React.useRef(null);

  const scrollTop = () => {
    if (pagesRef.current) pagesRef.current.scrollTop = 0;
  };

  const handlePillChange = (id) => {
    setActivePill(id);
    setShowDetail(false);
    setDetailId(null);
    scrollTop();
  };

  const handleBack = () => {
    setShowDetail(false);
    setDetailId(null);
    scrollTop();
  };

  const handleSelectArchetype = (id) => {
    setDetailId(id);
    setShowDetail(true);
    scrollTop();
  };

  const pill = activePill;
  const isDetail = showDetail;

  return (
    <div className="tab-root prayer-wall" data-screen-label={frame?.screenLabel}>
      {/* Standard header + pills for tab screens */}
      {!isDetail && (
        <>
          <div className="tab-header">
            <div className="eyebrow">Tab 4 · The Body Gathered</div>
            <h1>Prayer Wall</h1>
            <div className="subtitle">1,247 interceding · Updated live</div>
          </div>
          <div className="pill-bar">
            <PillNav active={pill} onChange={handlePillChange} />
          </div>
        </>
      )}

      {/* Detail header with back nav */}
      {isDetail && (
        <div className="rev-detail-header">
          <div className="back-row" onClick={handleBack}>
            <svg width="13" height="13" viewBox="0 0 14 14">
              <path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="1.4"
                fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Revelation</span>
          </div>
        </div>
      )}

      <div className="tc-pages" ref={pagesRef}>
        {pill === 'feed' && !isDetail && <FeedScreen />}
        {pill === 'my-prayers' && !isDetail && <MyPrayersScreen />}
        {pill === 'revelation' && !isDetail && <RevelationList onSelect={handleSelectArchetype} />}
        {pill === 'revelation' && isDetail && <RevelationDetail onBack={handleBack} />}
        {pill === 'testimonies' && !isDetail && <TestimoniesScreen />}
        {pill === 'locations' && !isDetail && <LocationsScreen />}
      </div>

      <PWTabBar active={3} />
    </div>
  );
}

// ───────── iPhone Pro Max Shell ─────────

function PhoneShell({ children, label }) {
  return (
    <div className="frame-stack">
      <div style={{
        position: 'relative',
        width: 402,
        height: 874,
        borderRadius: 56,
        background: '#050505',
        boxShadow:
          '0 50px 120px rgba(0,0,0,0.55),' +
          '0 0 0 1.5px rgba(240,237,230,0.05),' +
          'inset 0 0 0 6px #0a0a0a,' +
          'inset 0 0 0 8px rgba(240,237,230,0.05)',
        overflow: 'hidden',
      }}>
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          width: 122, height: 36, background: '#000', borderRadius: 22, zIndex: 100,
        }}></div>

        {/* Time */}
        <div style={{
          position: 'absolute', top: 22, left: 30,
          fontFamily: '-apple-system, system-ui, sans-serif',
          fontWeight: 590, fontSize: 16, color: '#F0EDE6', zIndex: 99,
        }}>9:41</div>

        {/* Status bar icons */}
        <div style={{
          position: 'absolute', top: 22, right: 26, zIndex: 99,
          display: 'flex', gap: 6, alignItems: 'center', color: '#F0EDE6',
        }}>
          <svg width="17" height="11" viewBox="0 0 17 11">
            <rect x="0" y="7" width="3" height="4" rx="0.6" fill="currentColor" />
            <rect x="4.5" y="5" width="3" height="6" rx="0.6" fill="currentColor" />
            <rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill="currentColor" />
            <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="currentColor" />
          </svg>
          <svg width="24" height="12" viewBox="0 0 24 12">
            <rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none"
              stroke="currentColor" strokeOpacity="0.6" />
            <rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor" />
            <path d="M22.5 4v4c0.7-0.2 1.3-1 1.3-2c0-1-0.6-1.8-1.3-2z"
              fill="currentColor" fillOpacity="0.6" />
          </svg>
        </div>

        {/* Home indicator */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          width: 134, height: 5, borderRadius: 100,
          background: 'rgba(240,237,230,0.4)', zIndex: 100, pointerEvents: 'none',
        }}></div>

        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      </div>

      <div className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span className="state-badge">{label}</span>
      </div>
    </div>
  );
}

// ───────── Handoff Page ─────────

function HandoffPage() {
  const [t, setTweak] = useTweaks(PW_TWEAK_DEFAULTS);
  const single = t.frameOverride !== 'off';
  const chosen = FRAMES.find(f => f.id === t.frameOverride);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Replant · Prayer Wall · Redesign v1</div>
        <h1>The body gathers, pill by pill.</h1>
        <p>
          Redesigned Prayer Wall tab with pill-based navigation. Six surfaces: Feed (default),
          My Prayers, Revelation (new — 7 churches of Revelation 2–3), Testimonies, and Locations.
          Use the Tweaks panel to isolate individual frames.
        </p>
      </div>

      <div className="frames-row">
        {(single && chosen ? [chosen] : FRAMES).map(f => (
          <PhoneShell key={f.id} label={f.label}>
            <PrayerWallScreen frame={f} />
          </PhoneShell>
        ))}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Frames">
          <TweakSelect
            label="Show only"
            value={t.frameOverride}
            onChange={(v) => setTweak('frameOverride', v)}
            options={[
              { value: 'off', label: 'All six frames' },
              ...FRAMES.map(f => ({ value: f.id, label: f.label })),
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<HandoffPage />);
