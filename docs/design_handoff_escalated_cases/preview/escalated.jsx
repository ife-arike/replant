/* eslint-disable */
// ── Escalated Cases · page + sections + rows + drawer ─────────────────
const { useState: uS, useMemo: uM } = React;

// ---------- small primitives ----------
function StatePill({ c }) {
  if (c.state === 'open') return <span className="state state-open"><span className="sd" />Open</span>;
  if (c.state === 'awaiting') return (
    <span className="state state-awaiting"><span className="sd" />Awaiting reply</span>
  );
  if (c.state === 'replied') return <span className="state state-replied"><span className="sd" />Leader replied</span>;
  if (c.state === 'pending_mgr') return <span className="state state-pending-mgr"><span className="sd" />Proposal pending Manager</span>;
  return null;
}
function TierChip({ tier1 }) {
  return tier1
    ? <span className="tlvl"><span className="lv t1">T1</span> · expedited</span>
    : <span className="tlvl"><span className="lv t2">T2</span> · standard</span>;
}
function TierBadge({ admin }) {
  const lbl = TIER_LABEL[admin.tier];
  const cls = admin.tier === 'top_tier' ? 'rp-pill-amber' : admin.tier === 'super_admin' ? 'rp-pill-sky' : 'rp-pill-muted';
  return <span className={`rp-pill ${cls}`} style={{ height: 18, fontSize: 9, padding: '0 7px' }}>{lbl}</span>;
}
function AgeCell({ days }) {
  const hot = days > 3;
  return <span className={`ec-age ${hot ? 'hot' : ''}`}>{hot && <span className={`age-dot ${days > 14 ? 'late' : ''}`} />}{days}d</span>;
}

// ---------- lightweight filter dropdown ----------
function FilterDrop({ label, options, selected, onToggle, onClear }) {
  const [open, setOpen] = uS(false);
  const active = selected.size > 0;
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', borderRadius: 2,
          font: '500 12px var(--rp-sans)', cursor: 'pointer',
          background: active ? 'var(--rp-text)' : 'transparent', color: active ? '#1a1a1a' : 'var(--rp-text)',
          border: active ? '1px solid var(--rp-text)' : '1px solid var(--rp-border-strong)',
        }}>
        <span>{label}</span>
        {active && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#fff', color: '#1a1a1a', font: '500 11px var(--rp-mono)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{selected.size}</span>}
        <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{ICONS.expand}</span>
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 230, background: 'var(--rp-surface)', border: '1px solid var(--rp-border-strong)', borderRadius: 4, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 50, padding: 6 }}>
          {options.map(o => {
            const on = selected.has(o.value);
            return (
              <button key={o.value} type="button" onClick={() => onToggle(o.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 32, padding: '7px 4px', background: 'transparent', border: 'none', borderRadius: 2, color: 'var(--rp-text)', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--rp-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ width: 14, height: 14, color: 'var(--rp-sky)', visibility: on ? 'visible' : 'hidden', display: 'inline-flex' }}>{ICONS.check}</span>
                <span style={{ flex: 1, fontSize: 12.5 }}>{o.label}</span>
              </button>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px 2px', borderTop: '1px solid var(--rp-border)', marginTop: 4 }}>
            <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--rp-muted-2)', cursor: 'pointer', font: '500 11.5px var(--rp-sans)' }}>Clear</button>
            <span style={{ font: '400 10.5px var(--rp-mono)', color: 'var(--rp-muted-2)' }}>{selected.size} selected</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- single combined filter dropdown (State · Tier · Escalated by) ----------
function FilterMenu({ sections }) {
  const [open, setOpen] = uS(false);
  const total = sections.reduce((n, s) => n + s.selected.size, 0);
  const active = total > 0;
  const clearAll = () => sections.forEach(s => s.onClear());
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', borderRadius: 2,
          font: '500 12px var(--rp-sans)', cursor: 'pointer',
          background: active ? 'var(--rp-text)' : 'transparent', color: active ? '#1a1a1a' : 'var(--rp-text)',
          border: active ? '1px solid var(--rp-text)' : '1px solid var(--rp-border-strong)',
        }}>
        <span>Filters</span>
        {active && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#fff', color: '#1a1a1a', font: '500 11px var(--rp-mono)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{total}</span>}
        <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{ICONS.expand}</span>
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 248, background: 'var(--rp-surface)', border: '1px solid var(--rp-border-strong)', borderRadius: 4, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 50, padding: '8px 6px' }}>
          {sections.map((s, si) => (
            <div key={s.key} style={{ paddingTop: si ? 8 : 0, marginTop: si ? 6 : 0, borderTop: si ? '1px solid var(--rp-border)' : 'none' }}>
              <div style={{ font: '500 9px var(--rp-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--rp-muted)', padding: '2px 6px 6px' }}>{s.label}</div>
              {s.options.map(o => {
                const on = s.selected.has(o.value);
                return (
                  <button key={o.value} type="button" onClick={() => s.onToggle(o.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 30, padding: '6px 6px', background: 'transparent', border: 'none', borderRadius: 2, color: 'var(--rp-text)', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--rp-surface-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 14, height: 14, color: 'var(--rp-sky)', visibility: on ? 'visible' : 'hidden', display: 'inline-flex' }}>{ICONS.check}</span>
                    <span style={{ flex: 1, fontSize: 12.5 }}>{o.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px 2px', borderTop: '1px solid var(--rp-border)', marginTop: 6 }}>
            <button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--rp-muted-2)', cursor: 'pointer', font: '500 11.5px var(--rp-sans)' }}>Clear all</button>
            <span style={{ font: '400 10.5px var(--rp-mono)', color: 'var(--rp-muted-2)' }}>{total} selected</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- drawer ----------
function CaseDrawer({ c, viewer, onAction }) {
  const isMgr = viewer.tier === 'top_tier';
  const isSA = viewer.tier === 'super_admin';
  const pastoral = c.axis === 'pastoral';
  // who reach-out targets: pastoral → the leader in distress; flagged → the recipient who may need follow-up
  const reachTarget = pastoral ? c.leader : c.receiver;
  const subject = pastoral ? c.leader : c.sender;

  const senderLine = (p) => p.underground ? anonName(p.role) : `${roleLabel(p.role)} ${p.name}`;
  const churchLine = (p) => p.underground ? 'Underground · withheld' : p.church;

  return (
    <div className="ec-drawer">
      <div className="ec-drawer-inner">
        <div className="ec-drawer-grid">
          {/* LEFT — case detail */}
          <div className="ec-drawer-col">
            <div className="ec-dlabel">{ICONS.note} Case detail</div>
            <div style={{ marginBottom: 16 }}>
              <div className="ec-pf-row"><span className="ec-pf-k">Case</span><span className="ec-pf-v"><span className="ec-caseid">{c.id}</span></span></div>
              {pastoral ? (
                <>
                  <div className="ec-pf-row"><span className="ec-pf-k">Leader</span><span className="ec-pf-v">{c.leader.underground ? <span className="ec-anon">{anonName(c.leader.role)}</span> : <>{c.leader.name} · {roleLabel(c.leader.role)}</>}</span></div>
                  <div className="ec-pf-row"><span className="ec-pf-k">Church</span><span className="ec-pf-v">{churchLine(c.leader)}</span></div>
                </>
              ) : (
                <>
                  <div className="ec-pf-row"><span className="ec-pf-k">Sender</span><span className="ec-pf-v">{c.sender.underground ? <span className="ec-anon">{anonName(c.sender.role)}</span> : <>{c.sender.name} · {roleLabel(c.sender.role)}</>}</span></div>
                  <div className="ec-pf-row"><span className="ec-pf-k">Receiver</span><span className="ec-pf-v">{c.receiver.underground ? <span className="ec-anon">{anonName(c.receiver.role)}</span> : <>{c.receiver.name} · {roleLabel(c.receiver.role)} · {c.receiver.church}</>}</span></div>
                  <div className="ec-pf-row"><span className="ec-pf-k">Flags</span><span className="ec-pf-v" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{c.codes.map(code => <span key={code} className="tlvl">{FLAG_CODE_LABELS[code] || code}</span>)}</span></div>
                </>
              )}
              <div className="ec-pf-row"><span className="ec-pf-k">Original tier</span><span className="ec-pf-v"><TierChip tier1={c.tier1} /></span></div>
              <div className="ec-pf-row"><span className="ec-pf-k">Escalated by</span><span className="ec-pf-v">{c.escalatedBy.auto
                ? <><b style={{ color: '#cfcabd' }}>Auto-routed</b> <span className="tlvl">underground</span> · {c.escalatedWhen}</>
                : <><b style={{ color: '#cfcabd' }}>{c.escalatedBy.name}</b> <TierBadge admin={c.escalatedBy} /> · {c.escalatedWhen}</>}</span></div>
              <div className="ec-pf-row"><span className="ec-pf-k">Reason</span><span className="ec-pf-v"><span className="q">"{c.escalationReason}"</span></span></div>
            </div>

            <div className="ec-dlabel">{pastoral ? ICONS.pastoral : ICONS.flag} {pastoral ? 'Anchor thread' : 'Flagged exchange'} · read logged</div>
            <div className="ec-thread">
              {c.thread.map((m, i) => (
                <div key={i} className={`ec-msg ${m.anchor ? 'anchor' : ''}`}>
                  <div className="m-meta"><span>{m.who}</span><span>{m.ts}</span>{m.anchor && <span className="m-flag">· anchor</span>}</div>
                  {m.body}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — action set (per tier) */}
          <div className="ec-drawer-col">
            <div className="ec-dlabel">{ICONS.shield} Disposition</div>

            {/* state cues */}
            {c.state === 'awaiting' && (
              <div className="ec-cue sky">{ICONS.clock}<span><b>Reach out sent</b> by {c.reachOut.by} · auto-email fallback at 7 days if no reply.</span></div>
            )}
            {c.state === 'replied' && (
              <div className="ec-cue sky">{ICONS.out}<span><b>Leader replied</b> {c.repliedWhen} in the Connect thread. Follow up or close the case.</span></div>
            )}

            {/* pending proposal — Manager reviews; SA/own sees read-only */}
            {c.state === 'pending_mgr' && (
              <div className="ec-proposal">
                <div className="pr-strip"><span className="pr-dot" /><span className="pr-label">Proposal pending {isMgr ? 'your' : 'Manager'} review</span></div>
                <div className="pr-row"><span className="pr-k">Action</span><span className="pr-v">{PROPOSE_LABEL[c.proposal.action]}{c.proposal.action !== 'escalate_to_manager' && <> · <b>destructive</b></>}</span></div>
                <div className="pr-row"><span className="pr-k">Reasoning</span><span className="pr-v"><span className="quote">"{c.proposal.reasoning}"</span></span></div>
                <div className="pr-row"><span className="pr-k">By</span><span className="pr-v"><span className="by">{c.proposal.proposer.name}</span> · {TIER_LABEL[c.proposal.proposer.tier]} · {c.proposal.when}</span></div>
                {isMgr ? (
                  <div className="pr-actions">
                    <button className="btn btn-approve btn-sm" onClick={() => onAction('review', c)}>Review proposal</button>
                  </div>
                ) : (
                  <div className="pr-self">{ICONS.lock}<span>A Manager will approve, reject, or close this. You can still reach out to the leader.</span></div>
                )}
              </div>
            )}

            {/* action stack — hidden while another's proposal is pending (non-Manager) */}
            {!(c.state === 'pending_mgr') && (
              <>
                <div className="ec-order-hint">Listen first · Proverbs 18:13</div>
                <div className="ec-actions">
                  <button className="btn btn-ghost" onClick={() => onAction('reach', c)}>{ICONS.out} Reach out</button>
                  <button className="btn btn-amber" onClick={() => onAction('propose:restrict_temporarily', c)}>{ICONS.restrict} Restrict temporarily · propose</button>
                  <button className="btn btn-reject" onClick={() => onAction('propose:revoke_access', c)}>{ICONS.revoke} Revoke access · propose</button>
                  {isSA && <button className="btn btn-ghost" onClick={() => onAction('propose:escalate_to_manager', c)}>{ICONS.arrowUp} Escalate to Manager</button>}
                  <button className="btn btn-ghost" onClick={() => onAction('close', c)}>{ICONS.close} Close case</button>
                </div>
              </>
            )}
            {c.state === 'pending_mgr' && isMgr && (
              <div className="ec-actions" style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => onAction('reach', c)}>{ICONS.out} Reach out</button>
              </div>
            )}

            {/* post-MVP stubs (Open Q5 + Q6 — rendered disabled so the seat is visible) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rp-faint)' }}>
              <button className="ec-stub" disabled>{ICONS.users} Tag for weekly review <span className="stub-tag">Coming Soon</span></button>
              <button className="ec-stub" disabled>{ICONS.note} Private admin note <span className="stub-tag">Coming Soon</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- section ----------
function CaseSection({ axis, cases, viewer, expanded, onToggle, onAction }) {
  const pastoral = axis === 'pastoral';
  return (
    <div className={`ec-section ${pastoral ? 'from-pastoral' : 'from-flagged'}`}>
      <div className="ec-section-head">
        <span className="ec-section-eyebrow">{`From ${pastoral ? 'Pastoral' : 'Flagged'}`}</span>
        <span className="ec-section-count">{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span>
      </div>
      {cases.length === 0 ? (
        <div className="q-card" style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--rp-muted-2)', fontSize: 12.5 }}>
          No {pastoral ? 'pastoral-escalated' : 'flagged-escalated'} cases match the current filters.
        </div>
      ) : (
        <div className="q-card">
          <table className="ec-table">
            <thead>
              <tr>
                <th style={{ width: 96 }}>Case</th>
                <th style={{ width: '24%' }}>{pastoral ? 'Leader' : 'Sender → Receiver'}</th>
                <th>Escalation reason</th>
                <th style={{ width: 150 }}>Escalated by</th>
                <th style={{ width: 180 }}>State</th>
                <th style={{ width: 64 }}>Age</th>
                <th style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => {
                const open = expanded.has(c.id);
                const subj = pastoral ? c.leader : c.sender;
                return (
                  <React.Fragment key={c.id}>
                    <tr className={`ec-row ${open ? 'open' : ''}`} onClick={() => onToggle(c.id)}>
                      <td><span className="ec-caseid">{c.id}</span></td>
                      <td>
                        {pastoral ? (
                          <>
                            <div className="ec-leader">{c.leader.underground ? <span className="ec-anon">{anonName(c.leader.role)}</span> : c.leader.name}</div>
                            <div className="ec-sub">{c.leader.underground ? 'Underground' : `${roleLabel(c.leader.role)} · ${c.leader.church}`} &nbsp;·&nbsp; <TierChip tier1={c.tier1} /></div>
                          </>
                        ) : (
                          <>
                            <div className="ec-leader">{c.sender.underground ? <span className="ec-anon">{anonName(c.sender.role)}</span> : c.sender.name}<span className="arr">→</span><span className="recv">{c.receiver.underground ? anonName(c.receiver.role) : c.receiver.name}</span></div>
                            <div className="ec-sub" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}><span className="tlvl">{FLAG_CODE_LABELS[c.codes[0]]}</span>{c.codes.length > 1 && <span className="tlvl ec-more">+{c.codes.length - 1}</span>}</div>
                          </>
                        )}
                      </td>
                      <td><div className="ec-reason">{c.escalationReason}</div></td>
                      <td><div className="ec-by">{c.escalatedBy.auto
                        ? <><b>Auto-routed</b><br /><span className="ec-when">underground · {c.escalatedWhen}</span></>
                        : <><b>{c.escalatedBy.name}</b><br /><span className="ec-when">{c.escalatedWhen}</span></>}</div></td>
                      <td><StatePill c={c} /></td>
                      <td><AgeCell days={c.ageDays} /></td>
                      <td><span className="ec-chev">{ICONS.expand}</span></td>
                    </tr>
                    {open && (
                      <tr><td className="ec-drawer-cell" colSpan={7}><CaseDrawer c={c} viewer={viewer} onAction={onAction} /></td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- resolved (collapsible, last 14 days) ----------
function ResolvedSection({ cases }) {
  const [open, setOpen] = uS(false);
  return (
    <div className={`ec-resolved ${open ? 'open' : 'collapsed'}`} style={{ marginTop: 28 }}>
      <button className="ec-resolved-head" onClick={() => setOpen(o => !o)}>
        <span className="rh-chev">{ICONS.chev}</span>
        <span className="rh-label">Resolved</span>
        <span className="rh-count">{cases.length}</span>
        <span className="rh-window">last 14 days · older in /audit</span>
      </button>
      <div className="ec-resolved-body">
        <div className="q-card" style={{ marginTop: 8 }}>
          {cases.map(c => (
            <div key={c.id} className="ec-resolved-row">
              <span className="ec-caseid">{c.id}</span>
              <span className="rp-dot" style={{ background: 'var(--rp-muted-2)', margin: 0 }} />
              <span className={`ec-disp-pill ${DISP_TONE[c.disposition]}`}>{DISP_LABEL[c.disposition]}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--rp-muted-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.note}</span>
              <span style={{ fontSize: 11.5, color: '#cfcabd' }}>{c.by.name} <TierBadge admin={c.by} /></span>
              <span style={{ font: '400 10.5px var(--rp-mono)', color: 'var(--rp-muted)', minWidth: 56, textAlign: 'right' }}>{c.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StatePill, TierChip, TierBadge, AgeCell, FilterDrop, FilterMenu, CaseDrawer, CaseSection, ResolvedSection });
