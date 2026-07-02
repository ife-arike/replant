// EscalatedCaseDrawer — KAN-292/293. Row-expand drawer: case detail (left)
// + per-tier action set (right). Listen-first action order is fixed
// (Proverbs 18:13): Reach out → Restrict (propose) → Revoke (propose) →
// Escalate → Close. The visual flow nudges the right disposition.
//
// Per-tier rendering:
//   super_admin — Reach out / Restrict·propose / Revoke·propose /
//                 Escalate to Manager / Close. Cannot execute destructive.
//   Manager     — Reach out / Restrict·propose / Revoke·propose / Close.
//                 No "Escalate" (top tier). Destructive still PROPOSED —
//                 routes to another Manager to review and approve (≥2 Managers).
//   When a proposal is pending: Manager sees the review card (Approve /
//   Reject / Close); SA / the proposer see it read-only.
//
// Post-MVP stubs (Open Q5 + Q6) render disabled so the seat is visible.
import React from 'react'
import { roleLabel, anonName } from '../lib/role-humanisation'

const PROPOSE_LABEL = {
  restrict_temporarily: 'Restrict temporarily',
  revoke_access: 'Revoke access',
  escalate_to_manager: 'Escalate to Manager',
}
const TIER_LABEL = { top_tier: 'Manager', super_admin: 'Super admin', regular: 'Admin' }
const FLAG_CODE_LABELS = {
  location_probe: 'Location probe', identity_probe: 'Identity probe',
  spiritual_coercion: 'Spiritual coercion', off_platform_push: 'Off-platform push', impersonation: 'Impersonation',
}
const FLAG_CODE_TIER = { identity_probe: 1, spiritual_coercion: 1, impersonation: 1, location_probe: 2, off_platform_push: 3 }   // severity → .tlvl color

function TierBadge({ tier }) {
  const cls = tier === 'top_tier' ? 'rp-pill-amber' : tier === 'super_admin' ? 'rp-pill-sky' : 'rp-pill-muted'
  return <span className={`rp-pill ${cls}`} style={{ height: 18, fontSize: 9, padding: '0 7px' }}>{TIER_LABEL[tier]}</span>
}

export default function EscalatedCaseDrawer({ caseRow: c, viewerTier, onAction }) {
  const isMgr = viewerTier === 'top_tier'
  const isSA = viewerTier === 'super_admin'
  const pastoral = c.axis === 'pastoral'
  const Ic = {
    note: <svg className="ic" viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z" /><path d="M9 9h6M9 13h4" /></svg>,
    out: <svg className="ic" viewBox="0 0 24 24"><path d="M14 4H5v16h9" /><path d="M10 12h11M17 8l4 4-4 4" /></svg>,
    restrict: <svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M5.5 5.5l13 13" /></svg>,
    revoke: <svg className="ic" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>,
    up: <svg className="ic" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
    close: <svg className="ic" viewBox="0 0 24 24"><path d="M5 12l5 5 9-9" /></svg>,
    users: <svg className="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2.5 2-4 4-4s2.5 1 2.5 1" /></svg>,
    shield: <svg className="ic" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>,
    clock: <svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>,
    lock: <svg className="ic" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  }
  const churchLine = (p) => p.is_underground ? 'Underground · withheld' : p.church

  return (
    <div className="ec-drawer">
      <div className={`ec-drawer-inner ${pastoral ? 'from-pastoral' : 'from-flagged'}`}>
        <div className="ec-drawer-grid">
          {/* LEFT — case detail + read-logged thread */}
          <div className="ec-drawer-col">
            <div className="ec-dlabel">{Ic.note} Case detail</div>
            <div style={{ marginBottom: 16 }}>
              <div className="ec-pf-row"><span className="ec-pf-k">Case</span><span className="ec-pf-v"><span className="ec-caseid">{c.id}</span></span></div>
              {pastoral ? (
                <>
                  <div className="ec-pf-row"><span className="ec-pf-k">Leader</span><span className="ec-pf-v">{c.leader.is_underground ? <span className="ec-anon">{anonName(c.leader.role)}</span> : <>{c.leader.full_name} · {roleLabel(c.leader.role)}</>}</span></div>
                  <div className="ec-pf-row"><span className="ec-pf-k">Church</span><span className="ec-pf-v">{churchLine(c.leader)}</span></div>
                </>
              ) : (
                <>
                  <div className="ec-pf-row"><span className="ec-pf-k">Sender</span><span className="ec-pf-v">{c.sender.is_underground ? <span className="ec-anon">{anonName(c.sender.role)}</span> : <>{c.sender.full_name} · {roleLabel(c.sender.role)}</>}</span></div>
                  <div className="ec-pf-row"><span className="ec-pf-k">Receiver</span><span className="ec-pf-v">{c.receiver.is_underground ? <span className="ec-anon">{anonName(c.receiver.role)}</span> : <>{c.receiver.full_name} · {roleLabel(c.receiver.role)} · {c.receiver.church}</>}</span></div>
                  <div className="ec-pf-row"><span className="ec-pf-k">Flags</span><span className="ec-pf-v" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{c.codes.map(code => <span key={code} className="tlvl">{FLAG_CODE_LABELS[code] || code}</span>)}</span></div>
                </>
              )}
              <div className="ec-pf-row"><span className="ec-pf-k">Original tier</span><span className="ec-pf-v"><span className="tlvl"><span className={`lv ${c.tier1 ? 't1' : 't2'}`}>{c.tier1 ? 'T1' : 'T2'}</span> {c.tier1 ? '· expedited' : '· standard'}</span></span></div>
              <div className="ec-pf-row"><span className="ec-pf-k">Escalated by</span><span className="ec-pf-v">{c.escalated_by.auto
                ? <><b style={{ color: '#cfcabd' }}>Auto-routed</b> <span className="tlvl">underground</span> · {c.escalated_when}</>
                : <><b style={{ color: '#cfcabd' }}>{c.escalated_by.name}</b> <TierBadge tier={c.escalated_by.tier} /> · {c.escalated_when}</>}</span></div>
              <div className="ec-pf-row"><span className="ec-pf-k">Reason</span><span className="ec-pf-v"><span className="q">"{c.escalation_reason}"</span></span></div>
            </div>

            <div className="ec-dlabel">{Ic.shield} {pastoral ? 'Anchor thread' : 'Flagged exchange'} · read logged</div>
            <div className="ec-thread">
              {c.thread.map((m, i) => (
                <div key={i} className={`ec-msg ${m.anchor ? 'anchor' : ''}`}>
                  <div className="m-meta"><span>{m.who}</span><span>{m.ts}</span>{m.anchor && <span className="m-flag">· anchor</span>}</div>
                  {m.body}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — per-tier action set */}
          <div className="ec-drawer-col">
            <div className="ec-dlabel">{Ic.shield} Disposition</div>

            {c.state === 'awaiting' && (
              <div className="ec-cue sky">{Ic.clock}<span><b>Reach out sent</b> by {c.reach_out.by} · auto-email fallback at 7 days if no reply.</span></div>
            )}
            {c.state === 'replied' && (
              <div className="ec-cue sky">{Ic.out}<span><b>Leader replied</b> {c.replied_when} in the Connect thread. Follow up or close the case.</span></div>
            )}

            {c.state === 'pending_mgr' && (
              <div className="ec-proposal">
                <div className="pr-strip"><span className="pr-dot" /><span className="pr-label">Proposal pending {isMgr ? 'your' : 'Manager'} review</span></div>
                <div className="pr-row"><span className="pr-k">Action</span><span className="pr-v">{PROPOSE_LABEL[c.proposal.action]}{c.proposal.action !== 'escalate_to_manager' && <> · <b>destructive</b></>}</span></div>
                <div className="pr-row"><span className="pr-k">Reasoning</span><span className="pr-v"><span className="quote">"{c.proposal.reasoning}"</span></span></div>
                <div className="pr-row"><span className="pr-k">By</span><span className="pr-v"><span className="by">{c.proposal.proposer_name}</span> · {TIER_LABEL[c.proposal.proposer_tier]} · {c.proposal.proposed_at_label}</span></div>
                {isMgr ? (
                  <div className="pr-actions"><button className="btn btn-approve btn-sm" onClick={() => onAction('review', c)}>Review proposal</button></div>
                ) : (
                  <div className="pr-self">{Ic.lock}<span>A Manager will approve, reject, or close this. You can still reach out to the leader.</span></div>
                )}
              </div>
            )}

            {c.state !== 'pending_mgr' && (
              <>
                <div className="ec-order-hint">Listen first · Proverbs 18:13</div>
                <div className="ec-actions">
                  <button className="btn btn-ghost" onClick={() => onAction('reach', c)}>{Ic.out} Reach out</button>
                  <button className="btn btn-amber" onClick={() => onAction('propose:restrict_temporarily', c)}>{Ic.restrict} Restrict temporarily · propose</button>
                  <button className="btn btn-reject" onClick={() => onAction('propose:revoke_access', c)}>{Ic.revoke} Revoke access · propose</button>
                  {isSA && <button className="btn btn-ghost" onClick={() => onAction('propose:escalate_to_manager', c)}>{Ic.up} Escalate to Manager</button>}
                  <button className="btn btn-ghost" onClick={() => onAction('close', c)}>{Ic.close} Close case</button>
                </div>
              </>
            )}
            {c.state === 'pending_mgr' && isMgr && (
              <div className="ec-actions" style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => onAction('reach', c)}>{Ic.out} Reach out</button>
              </div>
            )}

            {/* post-MVP stubs — Open Q5 (weekly review tag) + Q6 (private note) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rp-faint)' }}>
              <button className="ec-stub" disabled>{Ic.users} Tag for weekly review <span className="stub-tag">Coming Soon</span></button>
              <button className="ec-stub" disabled>{Ic.note} Private admin note <span className="stub-tag">Coming Soon</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
