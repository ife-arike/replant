// ─────────────────────────────────────────────
// ForceUnmarkModal — Ask 5 · Founder-only
//
// Removes another admin's claim. Behind FOUR gates that are AND-ed:
//   1. AAL2 fresh (< 5 min destructive window) — stale blocks + offers re-auth
//   2. typed claimer-name confirmation (exact match)
//   3. structured reason (required)
//   4. freeform supplement ≥ 30 chars (audit log)
//
// Day-25 re-route variant: title changes, reason pre-locked to "Case re-routed",
// supplement pre-filled + editable (already ≥30). AAL2 + typed-name STILL apply
// — no safety shortcut. Writes a force-unmark row to audit_log_underground.
//
// Non-Founders never see this — they get "Request release" (ClaimAffordance).
import React, { useState } from 'react'

const REASONS = ['Admin off > 7 days', 'Admin offboarded', 'Case re-routed', 'Other']

export default function ForceUnmarkModal({ claimerName, aal2FreshAt, isDay25, onReauthenticate, onConfirm, onCancel }) {
  const [name, setName] = useState('')
  const [reason, setReason] = useState(isDay25 ? 'Case re-routed' : '')
  const [supp, setSupp] = useState(isDay25 ? 'Day 25 auto-routing — claim transferred to Founder per protocol.' : '')

  // AAL2 fresh if re-authenticated within 5 minutes.
  const aal2Fresh = aal2FreshAt && (Date.now() - new Date(aal2FreshAt).getTime()) < 5 * 60_000

  const nameOk = name.trim() === claimerName
  const reasonOk = isDay25 || reason !== ''
  const suppOk = supp.trim().length >= 30
  const canSubmit = aal2Fresh && nameOk && reasonOk && suppOk

  return (
    <div className="ov open" onClick={e => e.target.classList.contains('ov') && onCancel()}>
      <div className="mdl" style={{ maxWidth: 470 }}>
        <div className="mdl-head">
          <span className="mh-glyph red"><svg className="ic" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" /></svg></span>
          <div className="mh-text">
            <div className="mdl-title">{isDay25 ? `Day 25 — re-route ${claimerName}'s claim?` : `Force-unmark ${claimerName}?`}</div>
            <div className="mdl-sub">{isDay25 ? 'Auto-routing to Founder · audit-logged' : 'Founder action · audit-logged'}</div>
          </div>
        </div>

        <div className="mdl-body" style={{ gap: 13 }}>
          <p style={{ fontFamily: 'var(--rp-sans)', fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6 }}>
            {isDay25
              ? `This submission reached day 25 and is routing to the Founder per protocol. ${claimerName} will be notified via Slack burst-alert and in-app banner.`
              : `This removes ${claimerName}'s claim. They'll be notified via Slack burst-alert and in-app banner. Reach out to them first when possible — the 24-hour grace protocol is part of how we steward each other's work.`}
          </p>

          {/* Gate 1 — AAL2 freshness */}
          {aal2Fresh ? (
            <div className="gate ok">
              <svg className="ic" viewBox="0 0 16 16"><path d="M3 8.5 6.5 12 13 4" /></svg>
              Re-authenticated within the last 5 minutes
            </div>
          ) : (
            <div className="gate warn">
              <span className="gate-left">
                <svg className="ic" viewBox="0 0 16 16"><path d="M8 1.5 1.5 13.5h13L8 1.5Z" /><path d="M8 6v3.5" /></svg>
                Re-authentication required
              </span>
              <button className="reauth" onClick={onReauthenticate}>Re-authenticate</button>
            </div>
          )}

          {/* Gate 2 — typed name */}
          <div className="fld">
            <span className="fld-label">Type "{claimerName}" to confirm</span>
            <input className="inp ct-typed" value={name} onChange={e => setName(e.target.value)} placeholder={claimerName}
              style={nameOk ? { borderColor: 'var(--rp-red)' } : undefined} autoComplete="off" />
          </div>

          {/* Gate 3 — reason */}
          <div className="fld">
            <span className="fld-label">Reason <span className="req">required</span></span>
            {isDay25 ? (
              <select className="sel" disabled><option>Case re-routed</option></select>
            ) : (
              <select className="sel" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="">— select —</option>
                {REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
            )}
          </div>

          {/* Gate 4 — supplement ≥30 */}
          <div className="fld">
            <span className="fld-label">Audit supplement <span className="req">required</span><span className={`hint ${suppOk ? 'ok' : ''}`}>min 30</span></span>
            <textarea className="txt" value={supp} onChange={e => setSupp(e.target.value)}
              placeholder="Add context for the audit log. Why is this force-unmark necessary?" />
            <div className={`charcount ${suppOk ? 'ok' : 'under'}`}>{supp.trim().length} / 30 (min)</div>
          </div>
        </div>

        <div className="mdl-foot">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <div className="mf-spacer" />
          <button className="btn btn-danger" disabled={!canSubmit}
            onClick={() => onConfirm({ reason, supplement: supp.trim(), day25: isDay25 })}>
            {isDay25 ? 'Re-route claim' : 'Force unmark'}
          </button>
        </div>
      </div>
    </div>
  )
}
