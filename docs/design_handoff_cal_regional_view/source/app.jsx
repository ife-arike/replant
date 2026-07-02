// app.jsx — main orchestration for The Church tab

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "markerStyle": "glow",
  "pulseSpeed": 2.4,
  "listDensity": "cozy",
  "emptyTone": "pastoral",
  "sectionHeaderStyle": "eyebrow",
  "demoState": "normal"
}/*EDITMODE-END*/;

// 5-tab bottom bar — Home · The Church · Persecuted · Prayer Wall · Connect
function TabBar({ active = 1 }) {
  const tabs = [
    { name: 'Home', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
    { name: 'The Church', icon: <g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></g> },
    { name: 'Persecuted', icon: <g><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g> },
    { name: 'Prayer', icon: <g><path d="M12 2v8M9 4l3-2 3 2M5 22V11a3 3 0 0 1 6 0v6" /><path d="M19 22V11a3 3 0 0 0-6 0v6" /><path d="M5 22h14" /></g> },
    { name: 'Connect', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  ];
  return (
    <div className="tc-tabbar">
      {tabs.map((t, i) => (
        <div key={t.name} className={'tc-tab' + (i === active ? ' active' : '')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={i === active ? '#6BB5E8' : 'currentColor'} strokeWidth="1.5">{t.icon}</svg>
          <div className="name" style={{ color: i === active ? 'var(--sky)' : 'var(--muted)' }}>{t.name}</div>
          <div className="dot" />
        </div>
      ))}
    </div>
  );
}

function ChurchTabApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [page, setPage] = React.useState(0); // 0 = CAML, 1 = CAL
  const [sheetOpen, setSheetOpen] = React.useState(false);  // CAML pull-up
  const [selected, setSelected] = React.useState(null);     // for profile sheet
  const [selectedIsOwn, setSelectedIsOwn] = React.useState(false);
  const [prayerOpen, setPrayerOpen] = React.useState(false);
  const [regional, setRegional] = React.useState(null);     // {name, churches} or null
  const [regionalOpen, setRegionalOpen] = React.useState(false);
  const [facedRegion, setFacedRegion] = React.useState(null); // region centered on the globe
  const [connectFor, setConnectFor] = React.useState(null);
  const [visibilityModal, setVisibilityModal] = React.useState(null); // {turningOn} or null
  const [prayedFor, setPrayedFor] = React.useState({});     // {churchId: true}
  const [savedFor, setSavedFor] = React.useState({});
  const [toast, setToast] = React.useState(null);
  const [recenterToken, setRecenterToken] = React.useState(0);
  const [ragFilter, setRagFilter] = React.useState({ g: true, a: true, r: true });

  // Profile completion flow state — accessed via demoState
  const [completionStep, setCompletionStep] = React.useState(-1); // -1 = intro
  const [draft, setDraft] = React.useState({
    website: 'loganvillechurch.org',
    language: 'English',
    denom: 'Non-denominational',
    size: '200–500',
    showContact: true,
  });

  const showToast = React.useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const pickChurch = (c) => {
    setSelected(c);
    setSelectedIsOwn(false);
  };
  const pickOwn = () => {
    setSelected(window.OWN_CHURCH);
    setSelectedIsOwn(true);
  };
  const closeSheet = () => setSelected(null);

  const pickCluster = () => {
    setRegional({
      name: 'Lawrenceville, GA',
      churches: window.NEARBY_CHURCHES.slice(2, 6),
    });
    setRegionalOpen(true);
  };

  const onConnect = () => setConnectFor(selected);
  const onConfirmConnect = () => {
    setConnectFor(null);
    showToast('Connection request sent');
  };

  const onPray = () => {
    if (!selected) return;
    setPrayedFor(prev => ({ ...prev, [selected.id]: !prev[selected.id] }));
    if (!prayedFor[selected.id]) showToast('Added to your intercession list');
  };

  const onSave = () => {
    if (!selected) return;
    setSavedFor(prev => ({ ...prev, [selected.id]: !prev[selected.id] }));
    showToast(savedFor[selected.id] ? 'Removed from saved' : 'Saved');
  };

  const onShare = () => showToast('Sharing summary (contact hidden)');
  const onReport = () => showToast('Reported to Replant team');

  const onToggleVisibility = () => {
    setVisibilityModal({ turningOn: !draft.showContact });
  };
  const onConfirmVisibility = () => {
    setDraft(prev => ({ ...prev, showContact: !prev.showContact }));
    showToast(draft.showContact ? 'Contact hidden' : 'Contact visible');
    setVisibilityModal(null);
  };

  const pickGlobalChurch = (c) => {
    // attach city/country normalized for sheet display, plus carry leaders/rpl
    setSelected({
      ...c,
      type: c.type || 'Church',
      country: c.city.split(',').slice(-1)[0].trim(),
      city: c.city.split(',')[0],
      have: c.have || 'A faithful remnant. Times of unhurried intercession.',
      need: c.need || (c.rag === 'r'
        ? 'Cover. Wisdom on when to gather. Names of brothers in safer places.'
        : c.rag === 'a'
          ? 'Mentorship for our younger leaders. Resources for translation.'
          : 'Connection with leaders in similar contexts.'),
      hasPlan: c.rag !== 'g',
      open: true,
      showContact: c.rag === 'g',
      language: c.language || 'Local',
      denom: c.denom || '—',
      size: c.size || 'Not specified',
      email: c.rag === 'g' ? `connect@${c.id}.replant.network` : null,
      address: c.rag === 'g' ? c.city : null,
      leaders: c.leaders || [],
    });
    setSelectedIsOwn(false);
  };

  const pickGlobalRegion = (region) => {
    // Open whichever region is passed (from zoom-in or a tap); fall back to the
    // region currently centered on the globe.
    const r = region || facedRegion;
    if (!r) return;
    setRegional(r);
    setRegionalOpen(true);
  };

  // demo state — drives what fills the page
  const demo = t.demoState || 'normal';
  const isEmpty = demo === 'empty-caml';
  const isLoading = demo === 'loading';
  const isError = demo === 'error';
  const isUnverified = demo === 'unverified';
  const isCompletion = demo === 'completion';
  const isTutorial = demo === 'tutorial';

  // horizon-line math
  const horizonW = 22 + page * 56;     // grows from short → long
  const horizonX = page * (100 - horizonW); // slides right
  const trackTx = page === 0 ? '0%' : '-50%';

  return (
    <div className="tab-root">
      {/* Header */}
      <div className="tc-header">
        <div className="tc-title-row">
          <div>
            <div className="tc-title">
              {page === 0
                ? <>The Church at <em>Loganville</em></>
                : <>The Church <em>at Large</em></>}
            </div>
            <div className="tc-sub" style={{ whiteSpace: 'nowrap' }}>
              {page === 0
                ? 'Your home · 6 leaders within 10 miles'
                : `Global · ${window.COUNTS.total} verified · +${window.COUNTS.underground} hidden`}
            </div>
          </div>
        </div>
        <div className="tc-pager">
          <span className={'label-l' + (page === 0 ? ' active' : '')}>At My Location</span>
          <div
            className="tc-horizon"
            style={{ '--horizon-w': horizonW + '%', '--horizon-x': horizonX + '%' }}
            onClick={() => setPage(page === 0 ? 1 : 0)}
          />
          <span className={'label-r' + (page === 1 ? ' active' : '')}>At Large</span>
        </div>
      </div>

      {/* Pages */}
      {!(isLoading || isError || isUnverified || isCompletion) && (
        <div className="tc-pages">
          <div className="tc-pages-track">

            {page === 0 && (
            <div className="tc-page">
              <div className="caml">
                <CamlMap
                  markerStyle={t.markerStyle}
                  onPickChurch={pickChurch}
                  onPickOwn={pickOwn}
                  onPickCluster={pickCluster}
                  ragFilter={isEmpty ? {} : ragFilter}
                  recenterToken={recenterToken}
                />
                {/* filters with recenter action */}
                <div className="caml-filters">
                  <div className="group">
                    {['g', 'a', 'r'].map(k => (
                      <div
                        key={k}
                        className={'caml-filter' + (ragFilter[k] ? ' active' : '')}
                        onClick={() => setRagFilter(prev => ({ ...prev, [k]: !prev[k] }))}
                      >
                        <span className="d" style={{
                          background: k === 'g' ? 'var(--green)' : k === 'a' ? 'var(--amber)' : 'var(--red)',
                        }} />
                        {k === 'g' ? 'Free' : k === 'a' ? 'Limits' : 'Urgent'}
                      </div>
                    ))}
                  </div>
                  <div
                    className="caml-filter active"
                    onClick={() => setRecenterToken(t => t + 1)}
                    title="Recenter on your church"
                  >
                    <svg width="9" height="9" viewBox="0 0 12 12">
                      <circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--sky)" />
                      <circle cx="6" cy="6" r="1.5" fill="var(--sky)" />
                    </svg>
                  </div>
                </div>

                <CamlSheet
                  open={sheetOpen}
                  onToggle={() => setSheetOpen(o => !o)}
                  onPickChurch={pickChurch}
                  density={t.listDensity}
                  ragFilter={isEmpty ? {} : ragFilter}
                  isEmpty={isEmpty}
                  emptyTone={t.emptyTone}
                />
              </div>
            </div>
            )}

            {page === 1 && (
            <div className="tc-page">
              <div className="cal">
                <CalStars />
                <CalGlobe
                  markerStyle={t.markerStyle}
                  pulseSpeed={Number(t.pulseSpeed)}
                  dimmed={prayerOpen}
                  onPickChurch={pickGlobalChurch}
                  onPickRegion={pickGlobalRegion}
                  onFaceRegion={setFacedRegion}
                />
                {/* tap a region — pill names whatever is centered; tapping it
                    (or the globe body) opens that region's churches. */}
                <div
                  onClick={() => pickGlobalRegion()}
                  style={{
                    position: 'absolute', top: 16, right: 16,
                    background: 'rgba(8,8,8,0.7)',
                    backdropFilter: 'blur(14px)',
                    border: '0.5px solid var(--faint)',
                    borderRadius: 100,
                    padding: '7px 11px',
                    fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: 'var(--muted)',
                    cursor: 'pointer', zIndex: 8,
                    display: 'flex', alignItems: 'center', gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" /></svg>
                  {facedRegion ? facedRegion.name : 'Regions'}
                </div>

                {/* church count chip — top-left of globe area */}
                <div style={{
                  position: 'absolute', top: 16, left: 16,
                  background: 'rgba(8,8,8,0.7)',
                  backdropFilter: 'blur(14px)',
                  border: '0.5px solid var(--faint)',
                  borderRadius: 100,
                  padding: '7px 11px',
                  fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em',
                  textTransform: 'uppercase', color: 'var(--muted)',
                  zIndex: 8,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'var(--sky)' }}>{window.COUNTS.total}</span> verified · <span style={{ color: 'var(--red)' }}>{window.COUNTS.urgent}</span> urgent · <span style={{ color: 'var(--off-white)' }}>+{window.COUNTS.underground}</span> hidden
                </div>

                <RegionalPanel
                  open={regionalOpen}
                  region={regional}
                  onClose={() => setRegionalOpen(false)}
                  onPickChurch={pickGlobalChurch}
                />

                <PrayerPullup
                  open={prayerOpen}
                  onOpen={() => setPrayerOpen(true)}
                  onClose={() => setPrayerOpen(false)}
                />
              </div>
            </div>
            )}

          </div>
        </div>
      )}

      {/* Loading / Error / Unverified — fill the pages area */}
      {(isLoading || isError || isUnverified) && (
        <div className="tc-pages">
          {isLoading && <LoadingState />}
          {isError && <ErrorState onRetry={() => setTweak('demoState', 'normal')} />}
          {isUnverified && <UnverifiedGate />}
        </div>
      )}

      {/* Profile Completion Flow — fills the whole screen */}
      {isCompletion && (
        <CompletionFlow
          step={completionStep}
          draft={draft}
          setDraft={setDraft}
          onAdvance={() => setCompletionStep(s => s + 1)}
          onBack={() => setCompletionStep(s => Math.max(-1, s - 1))}
          onComplete={() => {
            setTweak('demoState', 'normal');
            setCompletionStep(-1);
            showToast('Profile saved · welcome to the Network');
          }}
          onSkip={() => {
            setTweak('demoState', 'normal');
            setCompletionStep(-1);
          }}
        />
      )}

      {/* Tab bar (always visible except in completion flow) */}
      {!isCompletion && <TabBar active={1} />}

      {/* Profile sheet */}
      <ChurchProfileSheet
        open={!!selected}
        church={selected}
        isOwn={selectedIsOwn}
        onClose={closeSheet}
        onConnect={onConnect}
        onPray={onPray}
        onSave={onSave}
        onShare={onShare}
        onReport={onReport}
        onEdit={() => showToast('Opening edit flow…')}
        onToggleVisibility={onToggleVisibility}
        saved={selected ? savedFor[selected.id] : false}
        prayed={selected ? prayedFor[selected.id] : false}
        sectionHeaderStyle={t.sectionHeaderStyle}
      />

      {/* Modals */}
      <ConnectModal
        open={!!connectFor}
        church={connectFor}
        onCancel={() => setConnectFor(null)}
        onConfirm={onConfirmConnect}
      />
      <VisibilityModal
        open={!!visibilityModal}
        turningOn={visibilityModal?.turningOn}
        onCancel={() => setVisibilityModal(null)}
        onConfirm={onConfirmVisibility}
      />

      {/* Toast */}
      <Toast message={toast} show={!!toast} />

      {/* Tutorial overlay */}
      {isTutorial && (
        <TutorialOverlay
          onComplete={() => { setTweak('demoState', 'normal'); showToast('Welcome to the network'); }}
          onSkip={() => setTweak('demoState', 'normal')}
          onStep={(step) => {
            // step 2 (index 2) shows global; step 3 (index 3) shows prayer wall
            if (step <= 1) { setPage(0); setPrayerOpen(false); }
            else if (step === 2) { setPage(1); setPrayerOpen(false); }
            else if (step === 3) { setPage(1); setPrayerOpen(true); }
            else if (step >= 4) { setPage(0); setPrayerOpen(false); }
          }}
        />
      )}

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="State">
          <TweakSelect
            label="View"
            value={t.demoState}
            onChange={v => {
              setTweak('demoState', v);
              if (v === 'completion') setCompletionStep(-1);
            }}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'tutorial', label: 'First-time tutorial' },
              { value: 'empty-caml', label: 'Empty CAML (no nearby)' },
              { value: 'loading', label: 'Loading' },
              { value: 'error', label: 'Error' },
              { value: 'unverified', label: 'Unverified gate' },
              { value: 'completion', label: 'Profile Completion Flow' },
            ]}
          />
        </TweakSection>

        <TweakSection title="Markers">
          <TweakRadio
            label="Marker style"
            value={t.markerStyle}
            onChange={v => setTweak('markerStyle', v)}
            options={[
              { value: 'dot', label: 'Dot' },
              { value: 'ringed', label: 'Ringed' },
              { value: 'glow', label: 'Glow' },
            ]}
          />
          <TweakSlider
            label="Globe pulse speed (s/cycle)"
            value={Number(t.pulseSpeed)}
            min={1}
            max={5}
            step={0.2}
            onChange={v => setTweak('pulseSpeed', v)}
          />
        </TweakSection>

        <TweakSection title="Display">
          <TweakRadio
            label="List density"
            value={t.listDensity}
            onChange={v => setTweak('listDensity', v)}
            options={[
              { value: 'cozy', label: 'Cozy' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
          <TweakSelect
            label="Section header style"
            value={t.sectionHeaderStyle}
            onChange={v => setTweak('sectionHeaderStyle', v)}
            options={[
              { value: 'eyebrow', label: 'Mono eyebrow' },
              { value: 'serif', label: 'Serif italic' },
              { value: 'rule', label: 'Mono · ruled' },
            ]}
          />
        </TweakSection>

        <TweakSection title="Empty state tone">
          <TweakRadio
            label="No churches nearby"
            value={t.emptyTone}
            onChange={v => setTweak('emptyTone', v)}
            options={[
              { value: 'pastoral', label: 'Pastoral' },
              { value: 'scriptural', label: 'Scripture' },
              { value: 'quiet', label: 'Quiet' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ChurchTabApp />);
