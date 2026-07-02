// Persecuted Tab v2 — reverent, sky-blue with restrained red.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "demoState": "populated",
  "regionFilter": "all"
}/*EDITMODE-END*/;

// anonymized heartcries — region only, never a country
const HEARTCRIES = [
  { id: 'h1', region: 'North Africa', time: '12m',
    text: 'They came to the home twice this week. We have moved. Pray that the children sleep tonight.',
    interceding: 1284, held: false },
  { id: 'h2', region: 'Central Asia', time: '38m',
    text: 'I am on trial in two days. Pray for my words and for the judge\u2019s heart.',
    interceding: 3417, held: true },
  { id: 'h3', region: 'Middle East', time: '2h',
    text: 'Three new believers. We baptized them in a basement at 2 AM. Pray they are not betrayed.',
    interceding: 892, held: false },
  { id: 'h4', region: 'East Asia', time: '4h',
    text: 'I write this knowing I may not see another sunrise as a free man. The peace is real. The peace is real.',
    interceding: 5621, held: false },
  { id: 'h5', region: 'South Asia', time: '6h',
    text: 'My husband is held. Our daughter asks where he is. Pray for her faith and for his release.',
    interceding: 2103, held: false },
  { id: 'h6', region: 'Southeast Asia', time: '14h',
    text: 'They forbade us from gathering. We will gather. Cover us.',
    interceding: 1466, held: false },
];

const REGIONS = [
  { id: 'all',  label: 'All', count: 47 },
  { id: 'ME',   label: 'Middle East', count: 14 },
  { id: 'CA',   label: 'Central Asia', count: 9 },
  { id: 'NA',   label: 'North Africa', count: 8 },
  { id: 'EA',   label: 'East Asia', count: 7 },
  { id: 'SA',   label: 'South Asia', count: 5 },
  { id: 'SEA',  label: 'Southeast Asia', count: 4 },
];

// ───────── Tab bar ─────────
function TabBar({ active = 2 }) {
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
        const stroke = isActive ? (i === 2 ? '#D9594F' : '#6BB5E8') : 'currentColor';
        return (
          <div key={t.name} className={'tc-tab' + (isActive ? ' active' : '')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">{t.icon}</svg>
            <div className="name" style={{ color: isActive ? (i === 2 ? '#D9594F' : 'var(--sky)') : 'var(--muted)' }}>{t.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// ───────── action card (default) ─────────
function ActionCard({ onShare, onIntercede }) {
  return (
    <div className="action-card">
      <div className="prompt">Are you currently under persecution for the name of Jesus?</div>
      <div className="sub">Your account is verified and your identity is held.<br />This is a held space for your voice.</div>
      <div className="row">
        <div className="btn btn-ghost" style={{ borderColor: 'var(--red-mid)', color: 'var(--red)' }} onClick={onShare}>Share my heartcry</div>
      </div>
    </div>
  );
}

// ───────── share form (inline) ─────────
function ShareForm({ onCancel, onSubmit }) {
  const [text, setText] = React.useState('');
  const [region, setRegion] = React.useState('ME');
  const [include, setInclude] = React.useState({
    region: true,
    interceders: true,
  });
  return (
    <div className="share-form">
      <div className="label">Your heartcry</div>
      <textarea
        placeholder="Say what is on your heart. The body is listening."
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="opts">
        <div
          className={'opt' + (include.region ? ' on' : '')}
          onClick={() => setInclude({ ...include, region: !include.region })}
        >Show region only</div>
        <div
          className={'opt' + (include.interceders ? ' on' : '')}
          onClick={() => setInclude({ ...include, interceders: !include.interceders })}
        >Show interceder count</div>
      </div>
      <div className="actions">
        <div className="btn btn-quiet" onClick={onCancel}>Cancel</div>
        <div
          className="btn btn-primary"
          style={{ background: 'var(--red)', flex: 2 }}
          onClick={() => onSubmit({ text, region, include })}
        >Send into the body</div>
      </div>
    </div>
  );
}

// ───────── thanks state ─────────
function SharedThanks({ onUndo }) {
  return (
    <div className="shared-thanks">
      <div className="eyebrow">Held</div>
      <div className="title">Your heartcry is with the body.</div>
      <div className="body">
        Verified leaders across the network are interceding. You will not be identified.
        Your church will not be identified. We are praying with you.
      </div>
      <div className="meta">Encrypted · Region only · No location stored</div>
    </div>
  );
}

// ───────── heartcry card ─────────
function formatCount(n) {
  if (n < 1000) return n.toString();
  if (n < 10000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n / 1000) + 'k';
}

function HeartcryCard({ h, onHold }) {
  return (
    <div className={'heartcry' + (h.held ? ' held' : '')}>
      <div className="loc">
        <span className="d" />
        A voice · <span className="region">{h.region}</span>
        <span className="time">{h.time}</span>
      </div>
      <div className="text">{h.text}</div>
      <div className="meta">
        <span className="hold" onClick={() => onHold(h.id)}>
          {h.held ? (
            <>
              <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
              Keep holding
            </>
          ) : (
            <>+ Hold in prayer</>
          )}
        </span>
        <span className="interceding">{formatCount(h.interceding)} praying</span>
      </div>
    </div>
  );
}

// ───────── empty state ─────────
function HeartcryEmpty() {
  return (
    <div className="empty-quiet">
      <svg className="glyph" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(217,89,79,0.3)" strokeWidth="0.8" strokeDasharray="2 3" />
        <path d="M18 11v8M18 23v.5" stroke="rgba(217,89,79,0.6)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <div className="title">Quiet here, for now.</div>
      <div className="body">
        This space is held in prayer until someone speaks.
        If you are persecuted tonight, you can share here.
      </div>
    </div>
  );
}

// ───────── the app ─────────
function PersecutedTabApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [held, setHeld] = React.useState(() =>
    Object.fromEntries(HEARTCRIES.map(h => [h.id, h.held]))
  );
  const [composing, setComposing] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [activeRegion, setActiveRegion] = React.useState('all');

  const onHold = (id) => setHeld(prev => ({ ...prev, [id]: !prev[id] }));
  const onShare = () => setComposing(true);
  const onSubmit = () => { setComposing(false); setSubmitted(true); };
  const onCancel = () => setComposing(false);

  const demo = t.demoState;
  const isEmpty = demo === 'empty';
  const showPopulated = demo !== 'empty';

  const visibleHeartcries = HEARTCRIES.filter(h => {
    if (activeRegion === 'all') return true;
    return h.region === REGIONS.find(r => r.id === activeRegion)?.label;
  });

  return (
    <div className="tab-root persecuted">
      <div className="tab-header">
        <div className="eyebrow">Tab 3 · Set Apart</div>
        <h1>The Persecuted Church</h1>
        <div className="subtitle">Encrypted · Anonymous · Within the network</div>
      </div>

      <div className="tc-pages">

        {/* threshold note — quiet preamble */}
        <div className="threshold">
          <div className="eyebrow">A held space</div>
          <div className="body">
            For churches under imprisonment, prohibition of fellowship, violence,
            and active hunting for the faith. Handle with prayer and sobriety.
          </div>
          <div className="meta">
            <span className="lock">
              <svg width="9" height="11" viewBox="0 0 10 12" style={{ marginRight: 4, verticalAlign: -1 }}>
                <rect x="1.5" y="5" width="7" height="6" rx="1" fill="none" stroke="currentColor" />
                <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" />
              </svg>
              Encrypted
            </span>
            <span className="dot">·</span>
            <span>No location stored</span>
            <span className="dot">·</span>
            <span>Region only</span>
          </div>
        </div>

        <div className="tab-body">
          {/* action area */}
          {!composing && !submitted && <ActionCard onShare={onShare} />}
          {composing && <ShareForm onCancel={onCancel} onSubmit={onSubmit} />}
          {submitted && <SharedThanks />}

          {/* heartcries section */}
          <div className="section-h" style={{ marginTop: composing || submitted ? 28 : 14 }}>
            <span className="label">Heartcries from the body</span>
            <span className="rule" />
          </div>

          {!isEmpty && (
            <>
              {/* region filter */}
              <div className="region-bar">
                {REGIONS.map(r => (
                  <div
                    key={r.id}
                    className={'region-chip' + (activeRegion === r.id ? ' on' : '')}
                    onClick={() => setActiveRegion(r.id)}
                  >
                    {r.label}<span className="count">{r.count}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 14 }} />

              <div className="heartcry-list">
                {visibleHeartcries.map(h => (
                  <HeartcryCard key={h.id} h={{ ...h, held: held[h.id] }} onHold={onHold} />
                ))}
              </div>

              <div style={{ height: 8 }} />
            </>
          )}

          {isEmpty && <HeartcryEmpty />}
        </div>

        {/* scripture footer */}
        <div className="scripture-foot">
          <div className="eyebrow">Pray with us</div>
          <div className="verse">
            "Remember those who are in prison, as though in prison with them, and those who
            are mistreated, since you also are in the body."
          </div>
          <div className="ref">Hebrews 13:3</div>
        </div>

      </div>

      <TabBar active={2} />

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="State">
          <TweakRadio
            label="View"
            value={demo}
            onChange={(v) => setTweak('demoState', v)}
            options={[
              { value: 'populated', label: 'Populated' },
              { value: 'empty', label: 'Quiet' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PersecutedTabApp />);
