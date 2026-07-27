// CloseCaseModal — KAN-295 (disposition + audit supplement).
//
// Lifts the ForceUnmarkModal structured-reason + ≥30-char supplement
// pattern. Disposition taxonomy is LOCKED at 8 tokens. Closing removes
// the case from the register; the leader's account is unaffected.
//
// When opened from the Approve flow, `presetDisposition` pre-selects the
// matching acted-on token (access_revoked / restriction_applied / etc.).
import React, { useState } from 'react'
import { closeEscalatedCase } from '../lib/api'

const DISPOSITIONS = [
  { token: 'resolved_by_reach_out',     label: 'Resolved — leader replied, situation closed' },
  { token: 'resolved_no_outreach',      label: 'Resolved — no outreach needed' },
  { token: 'false_signal',              label: 'False signal — no action warranted' },
  { token: 'routing_misclassification', label: 'Routing misclassification — belonged on another queue' },
  { token: 'access_revoked',            label: 'Access revoked — case acted on' },
  { token: 'restriction_applied',       label: 'Restriction applied — case acted on' },
  { token: 'escalated_to_higher',       label: 'Escalated to higher tier — out of this register’s scope' },
  { token: 'pending_external',          label: 'Pending external — leader being followed up offline' },
]

export default function CloseCaseModal({ caseRow, presetDisposition = '', onClosed, onCancel }) {
  const [disposition, setDisposition] = useState(presetDisposition)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const noteOk = note.trim().length >= 30
  const canSubmit = disposition && noteOk && !submitting

  async function handleClose() {
    if (!canSubmit) return
    setSubmitting(true); setError('')
    try {
      await closeEscalatedCase(caseRow.id, { disposition, note: note.trim() })   // BE: scrubAndCap-bound
      onClosed?.({ caseId: caseRow.id, disposition })
    } catch (e) {
      // optimistic-close failure → parent undoes the optimistic removal,
      // keeps the case in the register, surfaces this error.
      setError(e?.message || 'Failed to close case'); setSubmitting(false)
    }
  }

  return (
    <div className="ov open" onMouseDown={e => e.target.classList.contains('ov') && onCancel()}>
      <div className="mdl">
        <div className="mdl-head">
          <span className="mh-glyph sky">
            <svg className="ic" viewBox="0 0 24 24"><path d="M5 12l5 5 9-9" /></svg>
          </span>
          <div className="mh-text">
            <div className="mdl-title">Close this case</div>
            <div className="mdl-sub">records the disposition · the case leaves the register · the leader’s account is unaffected</div>
          </div>
          <span className="mdl-ttl-badge"><span className="ec-caseid">{caseRow.id}</span></span>
        </div>

        <div className="mdl-body">
          <p style={{ fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
            Closing a case removes it from the escalated register. The disposition you choose is recorded against the
            case in the audit log — pick the option that most honestly reflects how the situation resolved.
          </p>
          <div className="fld">
            <span className="fld-label">Disposition <span className="req">required</span></span>
            <select className="sel" value={disposition} onChange={e => setDisposition(e.target.value)}>
              <option value="">— select —</option>
              {DISPOSITIONS.map(d => <option key={d.token} value={d.token}>{d.label}</option>)}
            </select>
          </div>
          <div className="fld">
            <span className="fld-label">
              Add context for the audit log. Why this disposition? <span className="req">required</span>
              <span className={`hint ${noteOk ? 'ok' : ''}`}>min 30</span>
            </span>
            <textarea className="txt" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Recorded against the case. Be specific enough that a reviewer understands the call." />
            <div className={`charcount ${noteOk ? 'ok' : 'under'}`}>{note.trim().length} / 30 (min)</div>
          </div>
          {error && <div className="rp-error" role="alert">{error}</div>}
        </div>

        <div className="mdl-foot">
          <span className="mf-spacer" />
          <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleClose} disabled={!canSubmit}>
            {submitting ? 'Closing…' : 'Close case'}
          </button>
        </div>
      </div>
    </div>
  )
}
