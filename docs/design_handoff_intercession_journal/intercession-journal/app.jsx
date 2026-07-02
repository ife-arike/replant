// Intercession Journal — nested surface inside the Prayer Wall tab.
// Two tabs: Churches (up to 10) · Standing in Gap (chronological).
// Sky-blue only. No red, no amber, no green. Sanctuary tone.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "frameOverride": "off"
}/*EDITMODE-END*/;

// ───────── data ─────────

// initials helper for the small RPL glyph
const initials = (name) => {
  const words = name.replace(/^(The|Iglesia|Eglise|Igreja|Gereja)\s+/i, '').split(/\s+/);
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const CHURCHES_FULL = [
  { id: 'c1', name: 'Grace Chapel Lagos',          rpl: 'RPL-00012', loc: 'Lagos, Nigeria',         added: 'Today',     leader: 'Apostle Femi Okafor' },
  { id: 'c2', name: 'Living Stones Mumbai',        rpl: 'RPL-00263', loc: 'Mumbai, India',          added: '2d ago',    leader: 'Pastor Anand Rao' },
  { id: 'c3', name: 'Casa de Oración Quito',       rpl: 'RPL-00355', loc: 'Quito, Ecuador',         added: '3d ago',    leader: 'Pastor Diego Mora' },
  { id: 'c4', name: 'Hill of the Lord Nairobi',    rpl: 'RPL-00029', loc: 'Nairobi, Kenya',         added: '5d ago',    leader: 'Pastor Wangari Mwangi' },
  { id: 'c5', name: 'Beacon Manila',               rpl: 'RPL-00164', loc: 'Manila, Philippines',    added: '1w ago',    leader: 'Pastor Maria Santos' },
  { id: 'c6', name: 'Damascus Refuge',             rpl: 'RPL-00481', loc: 'Damascus, Syria',        added: '1w ago',    leader: 'Pastor Y.' },
  { id: 'c7', name: 'Tabernacle of the Hills',     rpl: 'RPL-00077', loc: 'Asunción, Paraguay',     added: '2w ago',    leader: 'Pastor Ramón Velázquez' },
  { id: 'c8', name: 'New Wine Belfast',            rpl: 'RPL-00198', loc: 'Belfast, N. Ireland',    added: '3w ago',    leader: 'Pastor Cathal McKenna' },
];

const CHURCHES_FULL_TEN = [
  ...CHURCHES_FULL,
  { id: 'c9',  name: 'House of Joseph Addis',       rpl: 'RPL-00220', loc: 'Addis Ababa, Ethiopia', added: '4w ago',    leader: 'Pastor Tesfaye G.' },
  { id: 'c10', name: 'Cornerstone Auckland',        rpl: 'RPL-00091', loc: 'Auckland, Aotearoa',    added: '6w ago',    leader: 'Pastor Hemi Walker' },
];

const STANDING_FULL = [
  { id: 's1', text: 'A baptism on Sunday \u2014 fourteen souls. Pray they are kept under the wings.',
    church: 'Grace Chapel Lagos', loc: 'Lagos, Nigeria', when: 'Today',  others: 247, mine: true },
  { id: 's2', text: 'For our pastor\u2019s clarity in the next teaching series. The room is hungry for the Word.',
    church: 'Living Stones Mumbai', loc: 'Mumbai, India', when: 'Today',  others: 89,  mine: true },
  { id: 's3', text: 'Provision for Marisol\u2019s family during her recovery. Three children, no income for weeks.',
    church: 'Casa de Oración Quito', loc: 'Quito, Ecuador', when: '2d ago', others: 432, mine: true },
  { id: 's4', text: 'Sixty-three baptisms at the university this week. Wisdom for the discipleship that follows.',
    church: 'Hill of the Lord Nairobi', loc: 'Nairobi, Kenya', when: '3d ago', others: 1204, mine: true },
  { id: 's5', text: 'A wisdom decision before our elders this Sunday \u2014 a difficult call about a partner ministry.',
    church: 'Beacon Manila', loc: 'Manila, Philippines', when: '5d ago', others: 67, mine: true },
  { id: 's6', text: 'Standing for Pastor Y. and his family through the relocation. The way is narrow.',
    church: 'Damascus Refuge', loc: 'Damascus, Syria', when: '1w ago', others: 2891, mine: true },
  { id: 's7', text: 'Funds for the new gathering space. We are short by a quarter of the need.',
    church: 'Tabernacle of the Hills', loc: 'Asunción, Paraguay', when: '1w ago', others: 156, mine: true },
];

// ───────── small atoms ─────────

function BackChev() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14">
      <path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChurchRow({ c, swiped }) {
  return (
    <div className={'ij-church' + (swiped ? ' swiped' : '')}>
      <div className="rpl-glyph"><span className="ini">{initials(c.name)}</span></div>
      <div className="body">
        <div className="name">
          {c.name}
          <span className="rpl">{c.rpl}</span>
        </div>
        <div className="meta">
          <span>{c.loc}</span>
          <span className="sep">·</span>
          <span>Added {c.added}</span>
        </div>
      </div>
      <div className="status">
        <span className="d" />
        Praying
      </div>
    </div>
  );
}

function StandingRow({ s }) {
  return (
    <div className="ij-gap">
      <div className="row1">
        <span className="dot" />
        <div className="text">"{s.text}"</div>
      </div>
      <div className="row2">
        <div className="who">
          <span>{s.church}</span>
          <span className="sep">·</span>
          <span>{s.loc}</span>
          <span className="sep">·</span>
          <span>{s.when}</span>
        </div>
        <div className="standing">You + <span className="num">{s.others.toLocaleString()}</span> standing</div>
      </div>
    </div>
  );
}

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

// ───────── empty-state glyphs ─────────
function ChurchesEmptyGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(107,181,232,0.3)" strokeWidth="0.6" strokeDasharray="2 3" />
      {/* a simple steeple */}
      <path d="M22 11v6" stroke="rgba(107,181,232,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14 30V22l8-6 8 6v8" stroke="rgba(107,181,232,0.7)" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <path d="M19 30v-4h6v4" stroke="rgba(107,181,232,0.7)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
function StandingEmptyGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(107,181,232,0.3)" strokeWidth="0.6" strokeDasharray="2 3" />
      {/* hands lifted */}
      <path d="M14 28c0-4 3-4 3-7v-4M30 28c0-4-3-4-3-7v-4" stroke="rgba(107,181,232,0.7)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M19 14v4M25 14v4" stroke="rgba(107,181,232,0.5)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ───────── screen ─────────

function IntercessionJournal({ frame }) {
  // frame === { tab: 'churches' | 'standing', view: 'list' | 'full' | 'empty' }
  const [tabState, setTabState] = React.useState(frame?.tab || 'churches');
  const tab = frame?.tab ?? tabState;
  const view = frame?.view ?? 'list';

  const isChurches = tab === 'churches';
  const churches = view === 'full' ? CHURCHES_FULL_TEN : CHURCHES_FULL;
  const standings = STANDING_FULL;

  const churchCount = isChurches
    ? (view === 'empty' ? 0 : (view === 'full' ? 10 : churches.length))
    : null;
  const standingCount = !isChurches
    ? (view === 'empty' ? 0 : standings.length)
    : null;

  return (
    <div className="tab-root ij">
      <div className="ij-head">
        <div className="back-row">
          <BackChev />
          <span>Prayer Wall</span>
        </div>
        <div className="eyebrow">Tab 4 · Body Gathered</div>
        <h1>Intercession Journal</h1>
        <div className="subtitle">
          {isChurches
            ? `${view === 'empty' ? 0 : (view === 'full' ? 10 : CHURCHES_FULL.length)} holding · 4 returned with answer`
            : `${view === 'empty' ? 0 : standings.length} prayers stood in · 5,086 amen`}
        </div>
      </div>

      <div className="tc-pages">

        {/* segmented pill */}
        <div className="ij-seg">
          <div className={'thumb ' + (isChurches ? 'left' : 'right')} />
          <div
            className={'opt' + (isChurches ? ' active' : '')}
            onClick={() => !frame && setTabState('churches')}
          >
            Churches
            <span className="count">{view === 'empty' && isChurches ? '0' : (isChurches && view === 'full' ? '10/10' : (isChurches ? `${CHURCHES_FULL.length}/10` : '8/10'))}</span>
          </div>
          <div
            className={'opt' + (!isChurches ? ' active' : '')}
            onClick={() => !frame && setTabState('standing')}
          >
            Standing in Gap
            <span className="count">{!isChurches && view === 'empty' ? '0' : (isChurches ? '7' : standings.length)}</span>
          </div>
        </div>

        {/* CHURCHES TAB */}
        {isChurches && view !== 'empty' && (
          <>
            <div className="ij-counter">
              <span>Currently holding before God</span>
              <span className={'cap' + (view === 'full' ? ' near' : '')}>
                {view === 'full' ? '10 / 10 · Full' : `${CHURCHES_FULL.length} / 10`}
              </span>
            </div>

            {view === 'full' && (
              <div className="ij-full-notice">
                <div className="glyph">
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
                    <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="body">
                  <div className="head">Your intercession list is full.</div>
                  <div className="sub">
                    Remove a church to add another. <span className="pending">Cornerstone Auckland</span> is waiting to be added.
                  </div>
                </div>
              </div>
            )}

            <div className="ij-list">
              {churches.map((c, i) => (
                <ChurchRow key={c.id} c={c} swiped={view !== 'full' && i === 1} />
              ))}
            </div>
          </>
        )}

        {isChurches && view === 'empty' && (
          <div className="ij-empty">
            <ChurchesEmptyGlyph />
            <div className="title">Your intercession list is empty.</div>
            <div className="body">
              From a church profile, tap <em>Pray</em> to begin holding them before the Lord. Up to ten at a time.
            </div>
            <div className="cta">
              Find a church to pray for
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {/* STANDING IN GAP TAB */}
        {!isChurches && view !== 'empty' && (
          <>
            <div className="ij-counter">
              <span>Prayers you have stood in for</span>
              <span className="cap">Chronological</span>
            </div>
            <div className="ij-list">
              {standings.map(s => <StandingRow key={s.id} s={s} />)}
            </div>
          </>
        )}

        {!isChurches && view === 'empty' && (
          <div className="ij-empty">
            <StandingEmptyGlyph />
            <div className="title">No prayers stood in yet.</div>
            <div className="body">
              When you tap <em>+ I will stand</em> on a prayer in the wall, it is kept here{'\u2014'}a quiet record of what you carried.
            </div>
            <div className="cta">
              Enter the prayer wall
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {/* scripture foot — small, contextual */}
        {view !== 'empty' && (
          <div className="ij-foot">
            <div className="eyebrow">Carried before the throne</div>
            <div className="verse">
              "Bear ye one another{'\u2019'}s burdens, and so fulfil the law of Christ."
            </div>
            <div className="ref">Galatians 6:2</div>
          </div>
        )}
      </div>

      <TabBar active={3} />
    </div>
  );
}

// ───────── handoff page (multi-frame) ─────────

const FRAMES = [
  { id: 'cl', tab: 'churches', view: 'list',  label: 'Churches · holding 8 of 10' },
  { id: 'cf', tab: 'churches', view: 'full',  label: 'Churches · full · adding 11th' },
  { id: 'ce', tab: 'churches', view: 'empty', label: 'Churches · empty' },
  { id: 'sl', tab: 'standing', view: 'list',  label: 'Standing in Gap · 7 prayers' },
  { id: 'se', tab: 'standing', view: 'empty', label: 'Standing in Gap · empty' },
];

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
          '0 50px 120px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(240,237,230,0.05), inset 0 0 0 6px #0a0a0a, inset 0 0 0 8px rgba(240,237,230,0.05)',
        overflow: 'hidden',
      }}>
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          width: 122, height: 36, background: '#000', borderRadius: 22, zIndex: 100,
        }} />
        <div style={{
          position: 'absolute', top: 22, left: 30,
          fontFamily: '-apple-system, system-ui, sans-serif', fontWeight: 590,
          fontSize: 16, color: '#F0EDE6', zIndex: 99,
        }}>9:41</div>
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
            <rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.6" />
            <rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor" />
            <path d="M22.5 4v4c0.7-0.2 1.3-1 1.3-2c0-1-0.6-1.8-1.3-2z" fill="currentColor" fillOpacity="0.6" />
          </svg>
        </div>
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          width: 134, height: 5, borderRadius: 100, background: 'rgba(240,237,230,0.4)',
          zIndex: 100, pointerEvents: 'none',
        }} />
        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      </div>
      <div className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span className="state-badge">{label}</span>
      </div>
    </div>
  );
}

function HandoffPage() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Tweak: optionally render just one focused frame
  const single = t.frameOverride !== 'off';
  const chosen = FRAMES.find(f => f.id === t.frameOverride);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Replant · Prayer Wall · Intercession Journal</div>
        <h1>A quiet ledger of who you are carrying.</h1>
        <p>
          Nested inside the Prayer Wall tab. Two segmented lists: <em>Churches</em> the leader is holding before God
          (up to ten), and <em>Standing in Gap</em> — the chronological record of individual prayers they stood in for.
          Sky-only. Same sanctuary vocabulary as the parent tab.
        </p>
      </div>

      <div className="frames-row">
        {(single && chosen ? [chosen] : FRAMES).map(f => (
          <PhoneShell key={f.id} label={f.label}>
            <IntercessionJournal frame={{ tab: f.tab, view: f.view }} />
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
              { value: 'off', label: 'All five frames' },
              { value: 'cl', label: 'Churches · list' },
              { value: 'cf', label: 'Churches · full' },
              { value: 'ce', label: 'Churches · empty' },
              { value: 'sl', label: 'Standing · list' },
              { value: 'se', label: 'Standing · empty' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<HandoffPage />);
