// ApproveProposalModal — KAN-292 (Manager's review of a pending proposal).
//
// Manager's review of a pending proposal (mirrors ConfirmProposalModal on
// /underground). Shows the proposer's reasoning in full (NOT truncated).
//   Approve — fires the (stubbed) destructive endpoint OR the escalate
//             routing. Self-approve is blocked: proposer_id !== viewer.
//   Reject  — closes the proposal but keeps the case in the register for
//             SA to pick a different action.
//   Close   — ends the case (Manager judged no action needed) → opens
//             CloseCaseModal pre-seeded with the matching disposition.
//
// Destructive EXECUTION + leader-side experience land in the Leader
// Suspension Lifecycle ticket — stubbed-disabled here per CD scope.
import React, { useState } from 'react'
import { approveEscalatedProposal, rejectEscalatedProposal } from '../lib/api'

const PROPOSE_LABEL = {
  restrict_temporarily: 'Restrict temporarily',
  revoke_access: 'Revoke access',
  escalate_to_manager: 'Escalate to Manager',
}
const TIER_LABEL = { top_tier: 'Manager', super_admin: 'Super admin', regular: 'Admin' }

export default function ApproveProposalModal({ caseRow, viewerUserId, requireStepUp, onApproved, onRejected, onCloseCase, onCancel }) {
  const p = caseRow.proposal
  const [submitting, setSubmitting] = useState('')
  const [error, setError] = useState('')
  const destructive = p.action !== 'escalate_to_manager'
  const isSelf = viewerUserId && p.proposer_id === viewerUserId

  async function handleApprove() {
    if (isSelf) return
    setSubmitting('approve'); setError('')
    try {
      // TIER 1 destructive → AAL2 step-up + action-bound token (KAN-272 pattern).
      let token
      if (destructive && requireStepUp) token = await requireStepUp()
      const { action_taken } = await approveEscalatedProposal(caseRow.id, p.id, token)
      onApproved?.({ caseId: caseRow.id, action: action_taken || p.action })
    } catch (e) { setError(e?.message || 'Failed to approve'); setSubmitting('') }
  }
  async function handleReject() {
    setSubmitting('reject'); setError('')
    try {
      await rejectEscalatedProposal(caseRow.id, p.id)
      onRejected?.({ caseId: caseRow.id })
    } catch (e) { setError(e?.message || 'Failed to reject'); setSubmitting('') }
  }

  return (
    <div className="ov open" onMouseDown={e => e.target.classList.contains('ov') && onCancel()}>
      <div className="mdl">
        <div className="mdl-head">
          <span className={`mh-glyph ${destructive ? 'red' : 'amber'}`}>
            {destructive
              ? <svg className="ic" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>
              : <svg className="ic" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
          </span>
          <div className="mh-text">
            <div className="mdl-title">Review {PROPOSE_LABEL[p.action].toLowerCase()} on {caseRow.id}</div>
            <div className="mdl-sub">proposed by {p.proposer_name} from Replant Team · awaiting your review</div>
          </div>
        </div>

        <div className="mdl-body">
          <div className="recap">
            <div className="recap-row"><span className="recap-k">Action</span><span className="recap-v">{PROPOSE_LABEL[p.action]}{destructive && <> · <b>destructive</b></>}</span></div>
            <div className="recap-row"><span className="recap-k">Reasoning</span><span className="recap-v"><span className="quote">"{p.reasoning}"</span></span></div>
            <div className="recap-row"><span className="recap-k">Proposed by</span><span className="recap-v"><span className="by">{p.proposer_name}</span> · {TIER_LABEL[p.proposer_tier]} · {p.proposed_at_label}</span></div>
          </div>

          <div className="leader-preview">
            <div className="lp-label">On approve</div>
            <div style={{ fontSize: 12, color: 'var(--rp-muted-2)', lineHeight: 1.6, fontWeight: 300 }}>
              {destructive
                ? <>Fires the <b style={{ color: '#cfcabd' }}>{PROPOSE_LABEL[p.action].toLowerCase()}</b> endpoint. Destructive execution + the
                    leader-side experience land in the Leader Suspension Lifecycle ticket — <b style={{ color: '#cfcabd' }}>stubbed here</b>.
                    Reject keeps the case in the register for a different action.</>
                : 'Routes the case for Manager attention — no destructive action is executed.'}
            </div>
          </div>
          {isSelf && <div className="rp-error" role="alert">You proposed this action; another Manager must approve it.</div>}
          {error && <div className="rp-error" role="alert">{error}</div>}
        </div>

        <div className="mdl-foot">
          <button className="btn btn-ghost btn-sm" onClick={() => onCloseCase(caseRow)} disabled={!!submitting}>Close case</button>
          <span className="mf-spacer" />
          <button className="btn btn-amber" onClick={handleReject} disabled={!!submitting}>
            {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
          </button>
          <button className="btn btn-approve" onClick={handleApprove} disabled={isSelf || !!submitting}>
            {submitting === 'approve' ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
