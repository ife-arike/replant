// ReachOutModal — KAN-296 (Reach Out, Option B / KAN-220 Connect DM).
//
// Opens a Connect DM thread to the leader in the admin's own voice. The
// leader sees the thread attributed "<admin first name> from Replant Team"
// (hybrid: not bare "Replant Team", not full name+church). No system text
// is generated. Auto-email fallback fires server-side at 7 days no-reply.
// Per-leader rate limit 1/24h is BE-enforced (send-team-reply.js).
//
// Underground leaders: the compose body is run through the UG identity-leak
// scan before send (reference-anon-identity-rules). Title uses the
// role-humanisation table; underground rows render "A fellow [Role]".
import React, { useState } from 'react'
import { reachOutToLeader } from '../lib/api'
import { roleLabel, anonName } from '../lib/role-humanisation'

export default function ReachOutModal({ caseRow, viewerFirstName, onSent, onCancel }) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // pastoral axis → reach the leader in distress; flagged axis → reach the
  // recipient who may need pastoral follow-up.
  const target = caseRow.axis === 'pastoral' ? caseRow.leader : caseRow.receiver
  const titleName = target.is_underground
    ? anonName(target.role)
    : `${roleLabel(target.role)} ${(target.full_name || '').split(' ')[0]}`

  async function handleSend() {
    if (!body.trim()) return
    setSubmitting(true); setError('')
    try {
      await reachOutToLeader(caseRow.id, body.trim())   // BE: scrubAndCap + UG scan + 24h rate gate
      onSent?.({ caseId: caseRow.id })
    } catch (e) {
      setError(e?.message || 'Failed to open thread')
      setSubmitting(false)
    }
  }

  return (
    <div className="ov open" onMouseDown={e => e.target.classList.contains('ov') && onCancel()}>
      <div className="mdl">
        <div className="mdl-head">
          <span className="mh-glyph sky">
            <svg className="ic" viewBox="0 0 24 24"><path d="M14 4H5v16h9" /><path d="M10 12h11M17 8l4 4-4 4" /></svg>
          </span>
          <div className="mh-text">
            <div className="mdl-title">Reach out to {titleName}</div>
            <div className="mdl-sub">
              opens a Connect DM thread in your name · sender shown to leader:{' '}
              <b style={{ color: 'var(--rp-text)', fontWeight: 500 }}>{viewerFirstName} from Replant Team</b> · audit-logged
            </div>
          </div>
        </div>

        <div className="mdl-body">
          <p style={{ fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
            This opens a direct conversation with the leader in the Connect tab. Write in your own voice — no system
            message is generated. The leader sees the thread as a Connect DM from you, framed as Replant Team. If they
            don’t reply within 7 days, a UG-identity-scrubbed email automatically follows up to bring them back to the app.
          </p>
          <div className="fld">
            <span className="fld-label">Your message <span className="req">required</span></span>
            <textarea className="txt" style={{ minHeight: 120 }} value={body}
              onChange={e => setBody(e.target.value)} placeholder="Write in your own voice…" autoFocus />
          </div>
          {target.is_underground && (
            <div className="ec-cue sky" style={{ marginBottom: 0 }}>
              <svg className="ic" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
              <span><b>Underground leader.</b> Your message is scanned for identity leaks before it sends. Don’t reference
                a name, church, region, or anything that could place them.</span>
            </div>
          )}
          {error && <div className="rp-error" role="alert">{error}</div>}
        </div>

        <div className="mdl-foot">
          <span className="mf-spacer" />
          <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={!body.trim() || submitting}>
            {submitting ? 'Opening…' : 'Open thread'}
          </button>
        </div>
      </div>
    </div>
  )
}
