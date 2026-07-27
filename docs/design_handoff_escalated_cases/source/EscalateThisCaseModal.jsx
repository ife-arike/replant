// EscalateThisCaseModal — KAN-296. Renders on /pastoral + /flagged for
// REGULAR admins. On submit, the server creates the Escalated Cases entry,
// the row disappears from the regular's view (they do not track resolution
// — Founder: "cases are out of their hands and view after escalate"), and
// the cross-tier confirmation modal fires with the LOCKED phrase:
//   "Your escalation has gone up. If further action is needed from you,
//    someone will reach out."
//
// Reason category list (Founder seeded 3 + CD round-out to 5).
import React, { useState } from 'react'
import { escalateCaseFromQueue } from '../lib/api'

const ESCALATE_REASONS = [
  { token: 'destructive_needed', label: 'Destructive action is needed' },
  { token: 'pattern_multi_flag', label: 'Pattern across multiple flags' },
  { token: 'pastoral_judgment',  label: 'Pastoral judgment required' },
  { token: 'cross_tier',         label: 'Cross-tier coordination needed' },
  { token: 'unsure',             label: 'Unsure how to proceed' },
]

// `source` — 'pastoral' | 'flagged'. `sourceRow` — the queue row being
// escalated (message_id / case identifiers threaded to the BE).
export default function EscalateThisCaseModal({ source, sourceRow, onEscalated, onCancel }) {
  const [reason, setReason] = useState('')
  const [context, setContext] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const ctxOk = context.trim().length >= 30
  const canSubmit = reason && ctxOk && !submitting

  async function handleEscalate() {
    if (!canSubmit) return
    setSubmitting(true); setError('')
    try {
      await escalateCaseFromQueue({ source, sourceRow, reason, context: context.trim() })
      onEscalated?.({ rowId: sourceRow?.id })   // parent removes the row + fires the locked confirmation modal
    } catch (e) {
      setError(e?.message || 'Failed to escalate'); setSubmitting(false)
    }
  }

  return (
    <div className="ov open" onMouseDown={e => e.target.classList.contains('ov') && onCancel()}>
      <div className="mdl">
        <div className="mdl-head">
          <span className="mh-glyph sky">
            <svg className="ic" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </span>
          <div className="mh-text">
            <div className="mdl-title">Escalate this case</div>
            <div className="mdl-sub">routes up for super admin or Manager review · audit-logged</div>
          </div>
        </div>

        <div className="mdl-body">
          <p style={{ fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
            Describe why you’re escalating. Once submitted, the case leaves your view — if further action is needed
            from you, someone will reach out.
          </p>
          <div className="fld">
            <span className="fld-label">Reason <span className="req">required</span></span>
            <select className="sel" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="">— select —</option>
              {ESCALATE_REASONS.map(r => <option key={r.token} value={r.token}>{r.label}</option>)}
            </select>
          </div>
          <div className="fld">
            <span className="fld-label">
              Add context <span className="req">required</span>
              <span className={`hint ${ctxOk ? 'ok' : ''}`}>min 30</span>
            </span>
            <textarea className="txt" value={context} onChange={e => setContext(e.target.value)}
              placeholder="What the higher tier needs to know. PII auto-scrubbed at write." />
            <div className={`charcount ${ctxOk ? 'ok' : 'under'}`}>{context.trim().length} / 30 (min)</div>
          </div>
          {error && <div className="rp-error" role="alert">{error}</div>}
        </div>

        <div className="mdl-foot">
          <span className="mf-spacer" />
          <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEscalate} disabled={!canSubmit}>
            {submitting ? 'Escalating…' : 'Escalate'}
          </button>
        </div>
      </div>
    </div>
  )
}
