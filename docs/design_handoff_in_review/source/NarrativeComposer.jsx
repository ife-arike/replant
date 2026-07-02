// ─────────────────────────────────────────────
// NarrativeComposer — Ask 3 · claimer-only
//
// Inline composer at the TOP of the Admin Notes panel. Required contact channel
// + free note body + sky "Add note". New notes prepend to the thread (newest
// first) with name + timestamp + channel chip. Each note row carries
// "+ Attach evidence" → opens EvidenceUpload pre-linked to that note (ruling #5).
//
// Renders ONLY when the viewer is the claimer. Non-claimers get the read-only
// thread + a lock note. Append-only: no edit/delete on notes.
import React, { useState } from 'react'

const CHANNELS = ['Signal', 'Wire', 'Email', 'Phone (rare)', 'In-person', 'Other']

function ChannelChip({ channel }) {
  const isPhone = channel === 'Phone (rare)'
  return <span className={`chan-chip ${isPhone ? 'phone' : ''}`}>{channel}</span>
}

export function AdminNotesThread({ notes, isClaimer, onAttachEvidence }) {
  return (
    <div className="thread">
      {notes.map(n => (
        <div key={n.source_id} className="note">
          <div className="note-meta">
            <span className="who">{n.author_name}</span>
            <span>·</span>
            <span>{(n.created_at || '').slice(0, 16).replace('T', ' ')}</span>
            {n.contact_channel && <ChannelChip channel={n.contact_channel} />}
          </div>
          <div className="note-body">{n.body}</div>
          {isClaimer && (
            <button className="note-attach" onClick={() => onAttachEvidence(n.source_id)}>
              <svg className="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 11, height: 11 }}>
                <path d="M8 3v10M3 8h10" />
              </svg>
              Attach evidence
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default function NarrativeComposer({ isClaimer, claimerName, notes, onAddNote, onAttachEvidence }) {
  const [channel, setChannel] = useState(CHANNELS[0])
  const [body, setBody] = useState('')
  const canSubmit = body.trim().length > 0

  if (!isClaimer) {
    return (
      <>
        <div className="nc-readonly">
          <svg className="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3.5" y="7" width="9" height="6" rx="1.2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
          </svg>
          <span><b>{claimerName} is reviewing this submission.</b> Only the claimer can log narrative notes.</span>
        </div>
        <AdminNotesThread notes={notes} isClaimer={false} />
      </>
    )
  }

  function submit() {
    if (!canSubmit) return
    onAddNote({ contact_channel: channel, body: body.trim() })
    setBody('')
  }

  return (
    <>
      <div className="nc">
        <div className="nc-strip"><span className="pt-dot" /><span className="lbl">Log a note</span><span className="who">{claimerName}</span></div>
        <div className="nc-body">
          <div className="nc-row">
            <select className="sel nc-channel" value={channel} onChange={e => setChannel(e.target.value)}>
              {CHANNELS.map(c => <option key={c}>{c}</option>)}
            </select>
            <textarea
              className="txt" style={{ minHeight: 54 }}
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="What happened? Who did you reach? What did they say? Next step?"
            />
          </div>
          <div className="nc-actions">
            <button className="btn btn-primary btn-sm" disabled={!canSubmit} onClick={submit}>Add note</button>
            <span className="hint">Appends to the audit log · cannot be edited after</span>
          </div>
        </div>
      </div>
      <AdminNotesThread notes={notes} isClaimer onAttachEvidence={onAttachEvidence} />
    </>
  )
}
