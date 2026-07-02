// ProposeActionModal — KAN-292 (propose/approve gate; mirrors KAN-272
// ProposeVerifyPanel + ConfirmProposalModal ceremony from /underground).
//
// super_admin proposes restriction / revoke / further-escalation. Manager
// also proposes: a Manager-initiated destructive action routes to another
// Manager to review and approve (≥2 Managers; Founder 2026-06-30). No tier
// approves its own proposal.
//
// Manager has no "Escalate to Manager" option (top tier). On submit the
// confirmation modal fires with the cross-tier locked phrase.
import React, { useState } from 'react'
import { proposeEscalatedAction } from '../lib/api'

const PROPOSE_ACTIONS = [
  { token: 'restrict_temporarily', label: 'Restrict temporarily', destructive: true },
  { token: 'revoke_access',        label: 'Revoke access',        destructive: true },
  { token: 'escalate_to_manager',  label: 'Escalate to Manager',  destructive: false },
]

export default function ProposeActionModal({ caseRow, viewerTier, presetAction = '', onProposed, onCancel }) {
  const isManager = viewerTier === 'top_tier'
  const opts = PROPOSE_ACTIONS.filter(a => !(isManager && a.token === 'escalate_to_manager'))
  const [action, setAction] = useState(opts.some(o => o.token === presetAction) ? presetAction : '')
  const [reasoning, setReasoning] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reasonOk = reasoning.trim().length >= 30
  const canSubmit = action && reasonOk && !submitting
  const pastoralDestructive = caseRow.axis === 'pastoral' && (action === 'restrict_temporarily' || action === 'revoke_access')

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true); setError('')
    try {
      await proposeEscalatedAction(caseRow.id, { action, reasoning: reasoning.trim() })
      onProposed?.({ caseId: caseRow.id, action })   // parent fires the locked confirmation modal
    } catch (e) {
      // BE 409 when a proposal already exists (concurrent SA) → parent shows
      // the "pending proposal — refresh to review" modal.
      if (e?.code === 'PROPOSAL_EXISTS') return onProposed?.({ caseId: caseRow.id, conflict: true })
      setError(e?.message || 'Failed to send proposal'); setSubmitting(false)
    }
  }

  return (
    <div className="ov open" onMouseDown={e => e.target.classList.contains('ov') && onCancel()}>
      <div className="mdl">
        <div className="mdl-head">
          <span className="mh-glyph amber">
            <svg className="ic" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </span>
          <div className="mh-text">
            <div className="mdl-title">Propose action</div>
            <div className="mdl-sub">
              {isManager
                ? 'you can propose; another Manager reviews — approve, reject, or close · audit-logged'
                : 'super admin can propose; a Manager will approve, reject, or close · audit-logged'}
            </div>
          </div>
          <span className="mdl-ttl-badge"><span className="ec-caseid">{caseRow.id}</span></span>
        </div>

        <div className="mdl-body">
          <div className="fld">
            <span className="fld-label">Action <span className="req">required</span></span>
            <select className="sel" value={action} onChange={e => setAction(e.target.value)}>
              <option value="">— select —</option>
              {opts.map(a => <option key={a.token} value={a.token}>{a.label}{a.destructive ? ' · destructive' : ''}</option>)}
            </select>
          </div>

          {pastoralDestructive && (
            <div className="ec-cue amber" style={{ marginBottom: 0 }}>
              <svg className="ic" viewBox="0 0 24 24"><path d="M3 13c0-5 4-9 9-9s9 4 9 9" /><circle cx="12" cy="14" r="2.5" /><path d="M9 19h6" /></svg>
              <span>This case came up <b>from Pastoral</b> — the sender is a leader in distress. A destructive proposal
                here silences someone who signalled they need care. {isManager ? 'Reach out — or hold — before you sanction.' : 'Reach out or escalate before you sanction.'}</span>
            </div>
          )}

          <div className="fld">
            <span className="fld-label">
              Why is this action needed? <span className="req">required</span>
              <span className={`hint ${reasonOk ? 'ok' : ''}`}>min 30</span>
            </span>
            <textarea className="txt" value={reasoning} onChange={e => setReasoning(e.target.value)}
              placeholder="The Manager reviewing this sees your reasoning in full. Be specific." />
            <div className={`charcount ${reasonOk ? 'ok' : 'under'}`}>{reasoning.trim().length} / 30 (min)</div>
          </div>
          {error && <div className="rp-error" role="alert">{error}</div>}
        </div>

        <div className="mdl-foot">
          <span className="mf-spacer" />
          <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="btn btn-amber" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Sending…' : 'Send proposal'}
          </button>
        </div>
      </div>
    </div>
  )
}
