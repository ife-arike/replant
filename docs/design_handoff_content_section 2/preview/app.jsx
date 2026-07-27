/* eslint-disable */
// ── Content Section · app shell + prototype harness (v2) ────────────
const { useState: aS } = React;

// sidebar nav — the real admin structure; Content section holds the
// three surfaces (Outreach & Missions is NEW per Shell.jsx delta).
const NAV = [
  { label: 'Network', items: [
    { id: 'network', label: 'Network Overview', icon: 'network', inert: true },
    { id: 'church', label: 'Church Management', icon: 'church', inert: true },
  ]},
  { label: 'Content', items: [
    { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
    { id: 'scripture', label: 'Daily Scripture', icon: 'scripture' },
    { id: 'outreach', label: 'Outreach & Missions', icon: 'globe', isNew: true },
  ]},
  { label: 'Operations', items: [
    { id: 'triage', label: 'Pastoral Care', icon: 'pastoral', inert: true },
    { id: 'cry', label: 'Heartcry Inbox', icon: 'cry', inert: true },
  ]},
  { label: 'Compliance', items: [
    { id: 'audit', label: 'Audit Log', icon: 'log', inert: true },
    { id: 'team', label: 'Team Management', icon: 'team', inert: true, requiresTier: 'super_admin' },
  ]},
];
const NAV_ICONS = {
  network: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 6l3 4M17 6l-3 4M7 18l3-4M17 18l-3-4"/></svg>,
  church: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><path d="M12 3v4M10 5h4"/><path d="M5 21V11l7-4 7 4v10"/><path d="M10 21v-5h4v5"/></svg>,
  megaphone: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><path d="M4 10v4l11 5V5L4 10z"/><path d="M15 8c2 0 4 1.5 4 4s-2 4-4 4"/></svg>,
  scripture: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z"/><path d="M9 9h6M9 13h4"/></svg>,
  globe: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>,
  pastoral: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><path d="M3 13c0-5 4-9 9-9s9 4 9 9"/><circle cx="12" cy="14" r="2.5"/><path d="M9 19h6"/></svg>,
  cry: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><path d="M3 7h18v10H7l-4 3V7z"/><path d="M8 11h8M8 14h5"/></svg>,
  log: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>,
  team: <svg className="rp-nav-icon ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2.5 2-4 4-4"/></svg>,
};

// deliverable screens (harness jump targets) — 16-screen scope
const SCREENS = {
  pattern:      { group: 'Pattern',       label: 'Shared pattern reference sheet', nav: null,            crumb: 'Content · Shared pattern', title: 'Content pattern' },
  'ann-home':   { group: 'Announcements', label: 'Home',                            nav: 'announcements', crumb: 'Content', title: 'Announcements', surface: 'ann', init: { topLevel: 'announcements', workflow: 'home' } },
  'ann-drafts': { group: 'Announcements', label: 'Drafts · multi-select + bulk',    nav: 'announcements', crumb: 'Content', title: 'Announcements', surface: 'ann', init: { workflow: 'drafts', selected: ['D1', 'D2', 'D4'] } },
  'ann-posted': { group: 'Announcements', label: 'Posted · lock + correction',      nav: 'announcements', crumb: 'Content', title: 'Announcements', surface: 'ann', init: { workflow: 'posted' } },
  'ann-editor': { group: 'Announcements', label: 'Editor · writing surface',        nav: 'announcements', crumb: 'Content', title: 'Announcements', surface: 'ann', init: { view: 'editor', previewOpen: true } },
  'ann-witness':{ group: 'Announcements', label: 'Witness of the Day · rotation',   nav: 'announcements', crumb: 'Content', title: 'Announcements', surface: 'ann', init: { topLevel: 'witness' } },
  'ann-subs':   { group: 'Announcements', label: 'Submissions review queue',        nav: 'announcements', crumb: 'Content', title: 'Announcements', surface: 'ann', init: { view: 'submissions' } },
  'scr-home':   { group: 'Daily Scripture', label: 'Home',                          nav: 'scripture',     crumb: 'Content', title: 'Daily Scripture', surface: 'scr', init: { workflow: 'home' } },
  'scr-editor': { group: 'Daily Scripture', label: 'Editor · two-column + preview', nav: 'scripture',     crumb: 'Content', title: 'Daily Scripture', surface: 'scr', init: { view: 'editor', previewOpen: true } },
  'scr-filter': { group: 'Daily Scripture', label: 'Filter drawer',                 nav: 'scripture',     crumb: 'Content', title: 'Daily Scripture', surface: 'scr', init: { workflow: 'home', drawer: 'filter' } },
  'out-home':   { group: 'Outreach · Ph.1', label: 'Home (curator)',               nav: 'outreach',      crumb: 'Content', title: 'Outreach & Missions', surface: 'out', init: { workflow: 'home' } },
  'out-editor': { group: 'Outreach · Ph.1', label: 'Editor · mission listing',     nav: 'outreach',      crumb: 'Content', title: 'Outreach & Missions', surface: 'out', init: { view: 'editor', previewOpen: true } },
  'out-leader': { group: 'Outreach · Ph.1', label: 'Leader view (via menu)',       nav: 'outreach',      crumb: 'Content', title: 'Outreach & Missions', surface: 'out', init: { view: 'leaderview' } },
  'out-intake': { group: 'Outreach · Ph.2', label: 'Partner application intake',   nav: 'outreach',      crumb: 'Content · Concept', title: 'Outreach & Missions', surface: 'out', init: { view: 'intake' } },
  'out-profile':{ group: 'Outreach · Ph.2', label: 'Partner org profile',          nav: 'outreach',      crumb: 'Content · Concept', title: 'Outreach & Missions', surface: 'out', init: { view: 'profile' } },
  'out-trips':  { group: 'Outreach · Ph.3', label: 'Trip marketplace',             nav: 'outreach',      crumb: 'Content · Concept', title: 'Outreach & Missions', surface: 'out', init: { view: 'trips' } },
};
const SCREEN_ORDER = Object.keys(SCREENS);

function Sidebar({ activeNav, tier }) {
  return (
    <div className="rp-side">
      <div className="rp-brand">
        <div className="rp-brand-mark">R</div>
        <div><div className="rp-brand-name">Replant</div><div className="rp-brand-sub">Admin · Content v2</div></div>
      </div>
      {NAV.map(section => {
        const items = section.items.filter(it => !it.requiresTier || tierAtLeast(tier, it.requiresTier));
        if (!items.length) return null;
        return (
          <div className="rp-nav-section" key={section.label}>
            <div className="rp-nav-label">{section.label}</div>
            <div className="rp-nav">
              {items.map(it => (
                <a key={it.id} className={it.id === activeNav ? 'active' : ''} href="#" onClick={e => e.preventDefault()}
                  style={it.inert ? { opacity: 0.5, cursor: 'default' } : undefined}>
                  <span className="rp-nav-icon">{NAV_ICONS[it.icon]}</span>
                  <span>{it.label}</span>
                  {it.isNew && <span className="rp-pill rp-pill-sky" style={{ height: 15, fontSize: 8, padding: '0 5px', marginLeft: 'auto' }}>NEW</span>}
                </a>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rp-side-foot">
        <div className="rp-id">
          <div className="rp-id-avatar">{VIEWER[tier].first.slice(0, 2).toUpperCase()}</div>
          <div><div className="rp-id-name">{VIEWER[tier].first}</div><div className="rp-id-badge">{TIER_LABEL[tier]}</div></div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [tier, setTier] = aS('super_admin');
  const [screen, setScreen] = aS('pattern');
  const [harnessOpen, setHarnessOpen] = aS(true);

  const sc = SCREENS[screen];
  const activeNav = sc.nav;
  const viewer = { first: VIEWER[tier].first, tierLabel: TIER_LABEL[tier] };

  let content;
  if (screen === 'pattern') content = <PatternSheet />;
  else if (sc.surface === 'ann') content = <AnnouncementsSurface key={screen} initial={sc.init} viewer={viewer} />;
  else if (sc.surface === 'scr') content = <ScriptureSurface key={screen} initial={sc.init} />;
  else if (sc.surface === 'out') content = <OutreachSurface key={screen} initial={sc.init} />;

  const groups = [];
  SCREEN_ORDER.forEach(id => {
    const g = SCREENS[id].group;
    let grp = groups.find(x => x.name === g);
    if (!grp) { grp = { name: g, items: [] }; groups.push(grp); }
    grp.items.push(id);
  });

  return (
    <div className="rp">
      <Sidebar activeNav={activeNav} tier={tier} />
      <div className="rp-main">
        <div className="rp-topbar">
          <div className="rp-topbar-title-wrap">
            <div className="rp-crumb">{sc.crumb}</div>
            <h1 className="rp-h1">{sc.title}</h1>
          </div>
          <div className="rp-top-meta">
            <span className="cs-viewer"><span className="dot" /><span className="name">{VIEWER[tier].first}</span><span className="tier">{TIER_LABEL[tier]}</span></span>
          </div>
        </div>
        <div className="rp-body">{content}</div>
      </div>

      {/* prototype harness (not shipped) */}
      <div className={`cs-harness ${harnessOpen ? '' : 'collapsed'}`}>
        <div className="cs-harness-head" onClick={() => setHarnessOpen(o => !o)}>
          <span className="h-t">CD deliverables · {SCREEN_ORDER.length} screens</span>
          <span className="h-chev">{I.chevD}</span>
        </div>
        <div className="cs-harness-body">
          <div className="cs-hfield">
            <span className="cs-hlabel">Viewer tier</span>
            <div className="cs-seg">
              {['regular', 'super_admin', 'top_tier'].map(t => (
                <button key={t} className={tier === t ? 'on' : ''} onClick={() => setTier(t)}>{TIER_LABEL[t]}</button>
              ))}
            </div>
            <span className="cs-hnote">Content is curated by <b>any admin tier</b>. All three tiers read the surface; Team Management gates above.</span>
          </div>
          <div className="cs-jump">
            {groups.map(g => (
              <React.Fragment key={g.name}>
                <div className="cs-jump-group">{g.name}</div>
                {g.items.map(id => (
                  <button key={id} className={screen === id ? 'on' : ''} onClick={() => setScreen(id)}>
                    <span className="jn">{String(SCREEN_ORDER.indexOf(id) + 1).padStart(2, '0')}</span>
                    <span>{SCREENS[id].label}</span>
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
