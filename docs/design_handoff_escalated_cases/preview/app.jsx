/* eslint-disable */
// ── Escalated Cases · app shell + orchestration ───────────────────────
// Sidebar restructure (Founder delta 2026-06-30): Pastoral Signals,
// Flagged Messages, Replant Team Inbox + Escalated Cases merge under ONE
// parent sidebar entry ([Parent Name TBD], CONTENT-lane to ratify) with a
// 4-tab bar. Per-tab eyebrow lineage is preserved (Sensitive / Moderation).
// Escalated Cases is tab 4 — hidden entirely for regular admins.
const { useState: aS, useMemo: aM, useEffect: aE } = React;

const NAV = [
  { label: 'Network', items: [
    { id: 'network', label: 'Network Overview', icon: 'pastoral', inert: true },
    { id: 'church', label: 'Church Management', icon: 'shield', inert: true },
  ]},
  { label: 'Operations', items: [
    { id: 'queue', label: 'Verification Queue', icon: 'shield', inert: true },
    { id: 'under', label: 'Underground Oversight', icon: 'shield', inert: true, requiresTier: 'super_admin' },
    { id: 'cry', label: 'Heartcry Inbox', icon: 'note', inert: true },
    { id: 'triage', label: 'Pastoral Care', icon: 'pastoral', isParent: true },
  ]},
  { label: 'Compliance', items: [
    { id: 'audit', label: 'Audit Log', icon: 'note', inert: true },
    { id: 'team', label: 'Team Management', icon: 'users', inert: true, requiresTier: 'super_admin' },
  ]},
];

// 4 tabs under the parent. Per-tab eyebrow + title (shared chrome = tab bar only).
const TABS = [
  { id: 'pastoral',  label: 'Pastoral Signals',   crumb: 'Operations / Sensitive',  count: 12 },
  { id: 'flagged',   label: 'Flagged Messages',   crumb: 'Operations / Moderation',  count: 7 },
  { id: 'inbox',     label: 'Replant Team Inbox',  crumb: 'Operations / Sensitive',  count: 3 },
  { id: 'escalated', label: 'Escalated Cases',     crumb: 'Operations / Sensitive',  requiresTier: 'super_admin' },
];

function Sidebar({ viewer }) {
  return (
    <div className="rp-side">
      <div className="rp-brand">
        <div className="rp-brand-mark">R</div>
        <div><div className="rp-brand-name">Replant</div><div className="rp-brand-sub">Admin · v2.0</div></div>
      </div>
      {NAV.map(section => {
        const items = section.items.filter(it => !it.requiresTier || tierAtLeast(viewer.tier, it.requiresTier));
        if (!items.length) return null;
        return (
          <div className="rp-nav-section" key={section.label}>
            <div className="rp-nav-label">{section.label}</div>
            <div className="rp-nav">
              {items.map(it => (
                <a key={it.id} className={it.isParent ? 'active' : ''} href="#" onClick={(e) => e.preventDefault()}
                  style={it.inert ? { opacity: 0.55, cursor: 'default' } : undefined}>
                  <span className="rp-nav-icon">{ICONS[it.icon]}</span>
                  <span>{it.label}</span>
                  {it.isParent && <span className="rp-pill rp-pill-sky" style={{ height: 15, fontSize: 8, padding: '0 5px', marginLeft: 6 }}>NEW</span>}
                </a>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rp-side-foot">
        <div className="rp-id">
          <div className="rp-id-avatar">{viewer.first.slice(0, 2).toUpperCase()}</div>
          <div><div className="rp-id-name">{viewer.first}</div><div className="rp-id-badge">{TIER_LABEL[viewer.tier]}</div></div>
        </div>
      </div>
    </div>
  );
}

// ---- SLA aggregate banner (3 / 7 / 14) — gray / neutral ----
function SlaBanner({ cases, bucket, onBucket }) {
  const a3 = cases.filter(c => c.ageDays > 3).length;
  const a7 = cases.filter(c => c.ageDays > 7).length;
  const a14 = cases.filter(c => c.ageDays > 14).length;
  return (
    <div className="sla-agg sla-agg-neutral">
      <span className="agg-ico" style={{ width: 15, height: 15 }}>{ICONS.clock}</span>
      <span className="agg-label">SLA · this register</span>
      <div className="agg-stats">
        <button className={`agg-stat ${bucket === 3 ? 'is-active' : ''}`} onClick={() => onBucket(3)}><b>{a3}</b> open more than 3 days</button>
        <button className={`agg-stat is-amber ${bucket === 7 ? 'is-active' : ''}`} onClick={() => onBucket(7)}><b>{a7}</b> more than 7 days</button>
        <button className={`agg-stat is-red ${bucket === 14 ? 'is-active' : ''}`} onClick={() => onBucket(14)}><b>{a14}</b> more than 14 days</button>
      </div>
      {bucket && <button className="agg-stat agg-foot-link" onClick={() => onBucket(bucket)} style={{ marginLeft: 'auto' }}>Clear filter ✕</button>}
    </div>
  );
}

// ---- Pastoral Signals / Flagged Messages tab content (the regular's "Escalate this case") ----
function TouchpointSurface({ which, viewerTier, onEscalate }) {
  const pastoral = which === 'pastoral';
  const rows = pastoral ? [
    { id: 'p1', name: 'Mateus R.', role: 'pastor', church: 'Igreja Semente Viva', tier1: true, quote: 'Maybe everyone would be lighter if I just wasn\u2019t here next week.' },
    { id: 'p2', name: 'Grace O.', role: 'lay_leader', church: 'Living Word Fellowship', tier1: false, quote: 'I keep telling myself it will pass but it hasn\u2019t.' },
  ] : [
    { id: 'f1', sender: 'Pinheiro J.', receiver: 'Korir D.', code: 'location_probe', quote: 'Which neighbourhood is your fellowship in exactly?' },
    { id: 'f2', sender: 'Bako S.', receiver: 'Mensah K.', code: 'spiritual_coercion', quote: 'Submit to my covering or God removes His hand.' },
  ];
  // escalate verb by tier: regular → "Escalate this case"; super_admin → neutral "Escalate";
  // Manager → "Move to Escalated" (no higher tier to escalate to — they relocate it to the register to action it).
  const escalateLabel = viewerTier === 'regular' ? 'Escalate this case' : viewerTier === 'super_admin' ? 'Escalate' : 'Move to Escalated';
  return (
    <>
      <div className="ec-quiet-note">Keep this surface safe, with all diligence — not a place for hate, gossip, or divulging private thoughts.</div>
      <div className="rp-card rp-card-scroll-x">
        <table className="rp-table">
          <thead><tr>
            <th style={{ width: 42 }}></th>
            {pastoral ? <><th style={{ width: '24%' }}>Leader</th><th>Signal</th></> : <><th style={{ width: '20%' }}>Sender</th><th style={{ width: '18%' }}>Receiver</th><th>Message</th></>}
            <th style={{ width: 230, textAlign: 'right' }}>Action</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td><span className="rp-dot rp-dot-muted" /></td>
                {pastoral ? (
                  <td style={{ fontWeight: 500 }}>{r.name}<div className="ec-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{roleLabel(r.role)} · {r.church} <span className="tlvl"><span className={`lv t${r.tier1 ? 1 : 2}`}>{r.tier1 ? 'T1' : 'T2'}</span></span></div></td>
                ) : (
                  <><td style={{ fontWeight: 500 }}>{r.sender}</td><td style={{ color: '#cfcabd' }}>{r.receiver}</td></>
                )}
                <td style={{ color: '#cfcabd', fontSize: 12.5 }}>
                  <span style={{ fontStyle: 'italic' }}>"{r.quote}"</span>
                  {!pastoral && <span className="tlvl" style={{ marginLeft: 10 }}>{FLAG_CODE_LABELS[r.code]}</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                    {pastoral
                      ? <button className="rp-btn rp-btn-ghost rp-btn-sm">Mark prayed-over</button>
                      : <button className="rp-btn rp-btn-approve rp-btn-sm">Clear flag</button>}
                    {escalateLabel && <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => onEscalate(which)}>{escalateLabel}</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- Replant Team Inbox tab (existing KAN-220 surface — represented) ----
function TeamInboxStub() {
  const rows = [
    { leader: 'Mateus R.', church: 'Igreja Semente Viva', who: 'Mateus R.', body: 'Thank you for reaching out. It helped more than you know.', when: '2h ago', unread: true },
    { leader: 'Grace O.', church: 'Living Word Fellowship', who: 'Replant Team', body: 'We\u2019re here whenever you want to talk — no pressure, no clock.', when: '1d ago', unread: false },
    { leader: 'A fellow elder', church: '—', who: 'Replant Team', body: 'Checking in. Are you somewhere safe to talk this week?', when: '3d ago', unread: false },
  ];
  return (
    <>
      <div className="rp-card rp-card-scroll-x">
        <table className="rp-table">
          <thead><tr><th style={{ width: 28 }}></th><th style={{ width: '22%' }}>Leader</th><th style={{ width: '20%' }}>Church</th><th>Last message</th><th style={{ width: 100, textAlign: 'right' }}>Updated</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.unread && <span className="rp-dot" style={{ background: 'var(--rp-muted-2)', width: 8, height: 8, margin: 0 }} />}</td>
                <td style={{ fontWeight: r.unread ? 600 : 500, color: r.unread ? 'var(--rp-text)' : '#cfcabd' }}>{r.leader}</td>
                <td style={{ color: 'var(--rp-muted-2)' }}>{r.church}</td>
                <td style={{ color: '#cfcabd', fontSize: 12.5 }}><span style={{ font: '500 9px var(--rp-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rp-muted-2)', marginRight: 9 }}>{r.who}</span><span style={{ fontStyle: 'italic' }}>{r.body}</span></td>
                <td className="rp-num" style={{ textAlign: 'right', color: 'var(--rp-muted-2)' }}>{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SkeletonState() {
  return <div className="q-card">{[1,2,3,4].map(i => <div key={i} className="rp-skeleton" style={{ height: 52, margin: 12, borderRadius: 3 }} />)}</div>;
}
function EmptyState() {
  return (
    <div className="rp-empty">
      <div className="rp-empty-eyebrow">No escalated cases</div>
      <div style={{ fontSize: 13, color: 'var(--rp-muted-2)', maxWidth: '46ch', margin: '0 auto', lineHeight: 1.6 }}>
        The admin queue and pastoral queue haven\u2019t produced any escalations needing case-level action.
      </div>
    </div>
  );
}
function ErrorState({ onRetry }) {
  return (
    <>
      <div className="rp-error">Couldn\u2019t load escalated cases. The register did not load — this is not the empty state.</div>
      <div className="rp-empty">
        <div className="rp-empty-eyebrow" style={{ color: 'var(--rp-red)' }}>Couldn\u2019t load escalated cases</div>
        <div style={{ fontSize: 13, color: 'var(--rp-muted-2)', maxWidth: '46ch', margin: '0 auto 18px', lineHeight: 1.6 }}>
          See the error above. The register did NOT load — this is not the empty state.
        </div>
        <button className="rp-btn rp-btn-ghost" onClick={onRetry}>Retry</button>
      </div>
    </>
  );
}
function DowngradeState() {
  return (
    <div className="ec-denied">
      <span className="d-glyph">{ICONS.lock && React.cloneElement(ICONS.lock, { style: { width: 48, height: 48, stroke: 'currentColor', strokeWidth: 1.3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } })}</span>
      <div className="d-title">Your permissions changed</div>
      <div className="d-body">Your access to the Escalated Cases register was removed mid-session. The surface has been cleared and your last action was rejected. Returning you to Network Overview.</div>
    </div>
  );
}

// ---- the Escalated Cases tab content (PAGE VIEW — two stacked sections) ----
function EscalatedPage({ viewer, dataState, setDataState, cases, expanded, onToggle, onAction, bucket, setBucket, filters }) {
  if (dataState === 'loading') return <SkeletonState />;
  if (dataState === 'empty') return <EmptyState />;
  if (dataState === 'error') return <ErrorState onRetry={() => setDataState('normal')} />;
  if (dataState === 'downgrade') return <DowngradeState />;
  return (
    <>
      <SlaBanner cases={cases.open} bucket={bucket} onBucket={(b) => setBucket(x => x === b ? null : b)} />
      <div className="ec-filters">
        <FilterMenu sections={filters.sections} />
        <span className="ec-sortnote">sorted oldest first</span>
      </div>
      <CaseSection axis="pastoral" cases={cases.past} viewer={viewer} expanded={expanded} onToggle={onToggle} onAction={onAction} />
      <CaseSection axis="flagged" cases={cases.flag} viewer={viewer} expanded={expanded} onToggle={onToggle} onAction={onAction} />
    </>
  );
}

// ---- main app ----
function App() {
  const [tier, setTier] = aS('top_tier');
  const [tab, setTab] = aS('escalated');
  const [dataState, setDataState] = aS('normal');
  const [removed, setRemoved] = aS(() => new Set());
  const [overrides, setOverrides] = aS({});
  const [expanded, setExpanded] = aS(() => new Set());
  const [bucket, setBucket] = aS(null);
  const [fState, setFState] = aS(() => new Set());
  const [fTier, setFTier] = aS(() => new Set());
  const [fBy, setFBy] = aS(() => new Set());
  const [modal, setModal] = aS(null);
  const [toast, setToast] = aS(null);
  const [harnessOpen, setHarnessOpen] = aS(true);

  const viewer = VIEWER[tier];
  const visibleTabs = TABS.filter(t => !t.requiresTier || tierAtLeast(viewer.tier, t.requiresTier));
  // regular can't land on the escalated tab — fall back to the first tab.
  aE(() => { if (!visibleTabs.some(t => t.id === tab)) setTab(visibleTabs[0].id); }, [tier]);
  const activeTab = visibleTabs.find(t => t.id === tab) || visibleTabs[0];

  function flash(msg, sub, sky) { setToast({ msg, sub, sky }); clearTimeout(window.__t); window.__t = setTimeout(() => setToast(null), 4200); }

  const allCases = aM(() => {
    const merge = (c) => ({ ...c, ...(overrides[c.id] || {}) });
    const past = PASTORAL_CASES.filter(c => !removed.has(c.id)).map(merge);
    const flag = FLAGGED_CASES.filter(c => !removed.has(c.id)).map(merge);
    return { past, flag, open: [...past, ...flag] };
  }, [removed, overrides]);

  const toggleSet = (setter) => (v) => setter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const sortCases = (arr) => [...arr].sort((a, b) => (b.ageDays - a.ageDays) || (Number(b.tier1) - Number(a.tier1)));
  const applyFilters = (arr, axis) => arr.filter(c => {
    if (bucket && !(c.ageDays > bucket)) return false;
    if (fState.size && !fState.has(c.state)) return false;
    if (fTier.size && !fTier.has(c.tier1 ? 't1' : 't2')) return false;
    if (fBy.size && !fBy.has(c.escalatedBy.name)) return false;
    return true;
  });

  const pastShown = sortCases(applyFilters(allCases.past, 'pastoral'));
  const flagShown = sortCases(applyFilters(allCases.flag, 'flagged'));
  const openCount = allCases.open.length;
  const at7 = allCases.open.filter(c => c.ageDays > 7).length;
  const stateOpts = [{ value: 'open', label: 'Open' }, { value: 'awaiting', label: 'Awaiting reply' }, { value: 'replied', label: 'Leader replied' }, { value: 'pending_mgr', label: 'Proposal pending Manager' }];
  const tierOpts = [{ value: 't1', label: 'T1 · expedited' }, { value: 't2', label: 'T2 · standard' }];
  const byOpts = [...new Set(allCases.open.map(c => c.escalatedBy.name))].map(n => ({ value: n, label: n }));

  function onToggle(id) { setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  // touchpoint escalate verb: regular/SA open the escalate modal; Manager moves it
  // straight into the Escalated register (they're top tier — relocating to action it).
  function moveOrEscalate(w) {
    if (viewer.tier === 'top_tier') { flash('Moved to Escalated Cases.', 'Now in the register for you to action.'); setTab('escalated'); }
    else setModal({ type: 'escalate', source: w });
  }
  function onAction(kind, c) {
    if (kind === 'reach') return setModal({ type: 'reach', c });
    if (kind === 'close') return setModal({ type: 'close', c });
    if (kind === 'review') return setModal({ type: 'review', c });
    if (kind.startsWith('propose:')) return setModal({ type: 'propose', c, preset: kind.split(':')[1] });
  }

  function sendReach() {
    const c = modal.c;
    setOverrides(o => ({ ...o, [c.id]: { ...(o[c.id]||{}), state: 'awaiting', reachOut: { by: viewer.first, day: 1, of: 7 } } }));
    setModal(null); flash('Connect DM opened.', `Sent as “${viewer.first} from Replant Team”. Auto-email fallback in 7 days if no reply.`, true);
  }
  function sendPropose(action, why) {
    const c = modal.c;
    setOverrides(o => ({ ...o, [c.id]: { ...(o[c.id]||{}), state: 'pending_mgr', proposal: { proposer: { name: viewer.first, tier: viewer.tier }, action, reasoning: why, when: 'just now' } } }));
    setModal({ type: 'confirm' });
  }
  function approveProposal(p) {
    const c = modal.c;
    if (p.action === 'escalate_to_manager') {
      setOverrides(o => ({ ...o, [c.id]: { ...(o[c.id]||{}), state: 'open', proposal: null } }));
      setModal(null); flash('Routed for Manager attention.', 'No destructive action executed.');
    } else {
      // execution is stubbed (Suspension Lifecycle ticket) — approving records the
      // decision and moves straight to closing the case with the matching disposition.
      const preset = p.action === 'revoke_access' ? 'access_revoked' : 'restriction_applied';
      setModal({ type: 'close', c, preset });
    }
  }
  function rejectProposal() {
    const c = modal.c;
    setOverrides(o => ({ ...o, [c.id]: { ...(o[c.id]||{}), state: 'open', proposal: null } }));
    setModal(null); flash('Proposal rejected.', 'The case stays in the register for a different action.');
  }
  function closeFromReview() {
    const c = modal.c; const p = c.proposal;
    const preset = p ? (p.action === 'revoke_access' ? 'access_revoked' : p.action === 'restrict_temporarily' ? 'restriction_applied' : 'escalated_to_higher') : undefined;
    setModal({ type: 'close', c, preset });
  }
  function submitClose(disp) {
    const c = modal.c;
    setRemoved(r => new Set(r).add(c.id));
    setExpanded(e => { const n = new Set(e); n.delete(c.id); return n; });
    setModal(null); flash('Case closed.', `Recorded as “${DISP_LABEL[disp]}”. The leader\u2019s account is unaffected.`);
  }

  const showMeta = tab === 'escalated' && dataState === 'normal';

  return (
    <div className="rp">
      <Sidebar viewer={viewer} />
      <div className="rp-main">
        <div className="rp-topbar">
          <div className="rp-topbar-title-wrap">
            <div className="rp-crumb">{activeTab.crumb}</div>
            <h1 className="rp-h1">{activeTab.label}</h1>
          </div>
          <div className="rp-top-meta">
            {showMeta && <span><b>{openCount}</b> open · <b>{at7}</b> at the 7-day mark</span>}
            <span className="ec-viewer"><span className="vt-dot" /><span className="vt-name">{viewer.first}</span><span className="vt-tier">{TIER_LABEL[viewer.tier]}</span></span>
          </div>
        </div>

        <div className="rp-body">
          {/* shared chrome: the 4-tab bar (the ONLY shared chrome; eyebrow/title are per-tab) */}
          <div className="q-tabs ec-tabs">
            {visibleTabs.map(t => (
              <button key={t.id} className={`q-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
                <span className="tcount">{t.id === 'escalated' ? openCount : t.count}</span>
              </button>
            ))}
          </div>

          {tab === 'pastoral' && <TouchpointSurface which="pastoral" viewerTier={viewer.tier} onEscalate={moveOrEscalate} />}
          {tab === 'flagged' && <TouchpointSurface which="flagged" viewerTier={viewer.tier} onEscalate={moveOrEscalate} />}
          {tab === 'inbox' && <TeamInboxStub />}
          {tab === 'escalated' && (
            <EscalatedPage viewer={viewer} dataState={dataState} setDataState={setDataState}
              cases={{ past: pastShown, flag: flagShown, open: allCases.open }}
              expanded={expanded} onToggle={onToggle} onAction={onAction}
              bucket={bucket} setBucket={setBucket}
              filters={{ sections: [
                { key: 'state', label: 'State', options: stateOpts, selected: fState, onToggle: toggleSet(setFState), onClear: () => setFState(new Set()) },
                { key: 'tier', label: 'Tier level', options: tierOpts, selected: fTier, onToggle: toggleSet(setFTier), onClear: () => setFTier(new Set()) },
                { key: 'by', label: 'Escalated by', options: byOpts, selected: fBy, onToggle: toggleSet(setFBy), onClear: () => setFBy(new Set()) },
              ] }} />
          )}
        </div>
      </div>

      {/* modals */}
      {modal?.type === 'reach' && <ReachOutModal viewer={viewer} target={modal.c.axis === 'pastoral' ? modal.c.leader : modal.c.receiver} onClose={() => setModal(null)} onSend={sendReach} />}
      {modal?.type === 'propose' && <ProposeActionModal viewer={viewer} caseObj={modal.c} preset={modal.preset} onClose={() => setModal(null)} onSubmit={sendPropose} />}
      {modal?.type === 'review' && <ApproveProposalModal viewer={viewer} caseObj={modal.c} onClose={() => setModal(null)} onApprove={approveProposal} onReject={rejectProposal} onCloseCase={closeFromReview} />}
      {modal?.type === 'close' && <CloseCaseModal caseObj={modal.c} preset={modal.preset} onClose={() => setModal(null)} onSubmit={submitClose} />}
      {modal?.type === 'escalate' && <EscalateThisCaseModal source={modal.source} onClose={() => setModal(null)} onSubmit={() => setModal({ type: 'confirm' })} />}
      {modal?.type === 'confirm' && <ConfirmationModal onClose={() => setModal(null)} />}
      {modal?.type === 'concurrent' && <ConcurrentProposalModal onRefresh={() => { setModal(null); flash('Refreshed.', 'Pending proposal is now visible on the case.'); }} onClose={() => setModal(null)} />}

      {toast && <div className={`ec-toast ${toast.sky ? 'sky' : ''}`}><span className="t-dot" /><span><b style={{ fontWeight: 600 }}>{toast.msg}</b>{toast.sub && <span className="t-sub"> {toast.sub}</span>}</span></div>}

      {/* prototype harness */}
      <div className={`ec-harness ${harnessOpen ? '' : 'collapsed'}`}>
        <div className="ec-harness-head" onClick={() => setHarnessOpen(o => !o)}>
          <span className="h-t">Prototype controls</span>
          <span className="h-chev">{ICONS.chev}</span>
        </div>
        <div className="ec-harness-body">
          <div className="ec-hfield">
            <span className="ec-hlabel">Viewer tier</span>
            <div className="ec-seg tiers">
              {['regular','super_admin','top_tier'].map(t => (
                <button key={t} className={tier === t ? 'on' : ''} onClick={() => { setTier(t); setExpanded(new Set()); }}>{TIER_LABEL[t]}</button>
              ))}
            </div>
            <span className="ec-hnote">{tier === 'regular' ? <><b>Admin</b> sees 3 tabs — the <b>Escalated Cases</b> tab is hidden (anti-gossip rule).</> : tier === 'super_admin' ? <><b>Super admin</b> sees all 4 tabs; proposes, can\u2019t execute destructive.</> : <><b>Manager</b> sees all 4; reviews proposals + proposes (routes to another Manager).</>}</span>
          </div>
          <div className="ec-hfield">
            <span className="ec-hlabel">Escalated tab · data state</span>
            <div className="ec-seg" style={{ flexWrap: 'wrap' }}>
              {[['normal','Normal'],['loading','Loading'],['empty','Empty'],['error','Error'],['downgrade','Downgrade']].map(([v,l]) => (
                <button key={v} className={dataState === v ? 'on' : ''} onClick={() => { setDataState(v); if (tierAtLeast(tier,'super_admin')) setTab('escalated'); }} style={{ flex: '1 0 30%' }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="ec-hfield">
            <span className="ec-hlabel">Failure UX</span>
            <button className="ec-seg" style={{ cursor: 'pointer', justifyContent: 'center', color: 'var(--rp-muted-2)', font: '500 11px var(--rp-sans)', padding: '7px' }} onClick={() => setModal({ type: 'concurrent' })}>Concurrent proposal →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
