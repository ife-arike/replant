// app.jsx — main entry. Tweaks switch nav option / page / state.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "navOption": "B",
  "page": "front",
  "notif": true,
  "populated": true,
  "reader": "none"
}/*EDITMODE-END*/;

function PhoneFrame({ children }) {
  return (
    <div className="frame-stack">
      <div style={{
        position: 'relative',
        width: 430, height: 932,
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
        }} />
        {/* Status bar */}
        <div style={{
          position: 'absolute', top: 22, left: 30,
          fontFamily: '-apple-system, system-ui, sans-serif', fontWeight: 590, fontSize: 16,
          color: '#F0EDE6', zIndex: 99,
        }}>9:41</div>
        <div style={{
          position: 'absolute', top: 22, right: 26, zIndex: 99,
          display: 'flex', gap: 6, alignItems: 'center', color: '#F0EDE6',
        }}>
          <svg width="17" height="11" viewBox="0 0 17 11">
            <rect x="0"    y="7"   width="3" height="4"   rx="0.6" fill="currentColor" />
            <rect x="4.5"  y="5"   width="3" height="6"   rx="0.6" fill="currentColor" />
            <rect x="9"    y="2.5" width="3" height="8.5" rx="0.6" fill="currentColor" />
            <rect x="13.5" y="0"   width="3" height="11"  rx="0.6" fill="currentColor" />
          </svg>
          <svg width="24" height="12" viewBox="0 0 24 12">
            <rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.6" />
            <rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor" />
            <path d="M22.5 4v4c0.7-0.2 1.3-1 1.3-2c0-1-0.6-1.8-1.3-2z" fill="currentColor" fillOpacity="0.6" />
          </svg>
        </div>
        {/* Home indicator */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          width: 134, height: 5, borderRadius: 100,
          background: 'rgba(240,237,230,0.4)', zIndex: 100, pointerEvents: 'none',
        }} />
        {/* Status bar headroom */}
        <div style={{ position: 'absolute', inset: 0, paddingTop: 54, borderRadius: 'inherit' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Shared state across nav options + surfaces
  const [page, setPage] = React.useState(t.page);
  const [showNotif, setShowNotif] = React.useState(t.notif);
  const [activeRegion, setActiveRegion] = React.useState('all');
  const [heldMap, setHeldMap] = React.useState(() =>
    Object.fromEntries(HEARTCRIES.map(h => [h.id, !!h.held]))
  );
  const [verseIndex, setVerseIndex] = React.useState(0);

  // Sync page tweak \u2194 internal page state
  React.useEffect(() => { setPage(t.page); }, [t.page]);
  React.useEffect(() => { setShowNotif(t.notif); }, [t.notif]);
  // Reader tweak — jump to a reader screen for handoff inspection
  React.useEffect(() => {
    if (t.reader === 'article') setPage('article');
    else if (t.reader === 'guidance') setPage('guidance');
    else if (t.reader === 'story-archive') setPage('story-archive');
    else if (t.reader === 'witness-archive') setPage('witness-archive');
    else if (['article', 'guidance', 'story-archive', 'witness-archive'].includes(page)) setPage('memorial');
  }, [t.reader]);

  const handleNavigate = (p) => {
    setPage(p);
    setTweak('page', p);
  };
  const handleDismissNotif = () => {
    setShowNotif(false);
    setTweak('notif', false);
  };
  const handleHold = (id) => {
    setHeldMap(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const cycleVerse = () => setVerseIndex(i => (i + 1) % ENCOURAGEMENT_VERSES.length);

  const sharedProps = {
    populated: t.populated,
    heldMap,
    onHold: handleHold,
    activeRegion,
    onRegion: setActiveRegion,
    showNotif,
    onDismissNotif: handleDismissNotif,
    verseIndex,
    onCycleVerse: cycleVerse,
  };

  let frame;
  if (t.navOption === 'A')      frame = <StackNav page={page} onNavigate={handleNavigate} sharedProps={sharedProps} />;
  else if (t.navOption === 'B') frame = <PillNav page={page} onNavigate={handleNavigate} sharedProps={sharedProps} />;
  else                          frame = <SwipeNav page={page} onNavigate={handleNavigate} sharedProps={sharedProps} />;

  const pageLabel =
    page === 'article' ? 'Article reader' :
    page === 'guidance' ? 'Guidance reader' :
    page === 'story-archive' ? 'Stories archive' :
    page === 'witness-archive' ? 'Witness archive' :
    PAGES.find(p => p.id === page)?.label || page;
  const navLabel = t.navOption === 'A' ? 'Stack push'
                 : t.navOption === 'B' ? 'Pill tabs'
                 : 'Swipe pages';

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Replant · The Persecuted · Multi-Page</div>
        <h1>A held space, <em>expanded</em>.</h1>
        <p>
          The current front page intact — same threshold, same heartcry primitive. Four further surfaces beneath:
          My Heartcries, The Memorial, Encouragement, Standing With. Tweaks (bottom-right) compare three navigation
          patterns and switch between surfaces and states.
        </p>
      </div>

      <div className="frames-row">
        <PhoneFrame>{frame}</PhoneFrame>
      </div>

      <div className="frame-stack">
        <div className="label">
          iPhone 16 Pro Max
          <span className="pill">{navLabel}</span>
          <span className="pill">{pageLabel}</span>
          {showNotif && t.page === 'front' && <span className="pill">Notification</span>}
          {!t.populated && <span className="pill">Empty</span>}
        </div>
      </div>

      <RnSpecPanel navOption={t.navOption} page={page} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Navigation">
          <TweakRadio
            label="Pattern"
            value={t.navOption}
            onChange={(v) => setTweak('navOption', v)}
            options={[
              { value: 'A', label: 'Stack' },
              { value: 'B', label: 'Pills' },
              { value: 'C', label: 'Swipe' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Surface">
          <TweakSelect
            label="Page"
            value={page}
            onChange={(v) => { setTweak('page', v); setTweak('reader', 'none'); }}
            options={[
              { value: 'front',         label: 'Front Page' },
              { value: 'my-heartcries', label: 'My Heartcries' },
              { value: 'memorial',      label: 'Bear Witness' },
              { value: 'encouragement', label: 'Take Heart' },
              { value: 'stand',         label: 'Together (post-MVP)' },
            ]}
          />
          <TweakSelect
            label="Reader overlay"
            value={t.reader}
            onChange={(v) => setTweak('reader', v)}
            options={[
              { value: 'none',             label: 'None' },
              { value: 'article',          label: 'Article reader' },
              { value: 'guidance',         label: 'Guidance reader' },
              { value: 'story-archive',    label: 'All stories archive' },
              { value: 'witness-archive',  label: 'Witness archive' },
            ]}
          />
        </TweakSection>
        <TweakSection title="State">
          <TweakToggle
            label="Populated"
            value={t.populated}
            onChange={(v) => setTweak('populated', v)}
          />
          <TweakToggle
            label="Status notification"
            value={t.notif}
            onChange={(v) => setTweak('notif', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
