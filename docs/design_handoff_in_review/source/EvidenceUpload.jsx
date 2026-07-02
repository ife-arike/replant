// ─────────────────────────────────────────────
// EvidenceUpload — Ask 4 · claimer-only
//
// Drag-or-pick widget below the T1/T2 cards. Required channel + summary,
// optional link-to-note (sets linked_audit_id, ruling #5; unlinked files get a
// soft "unlinked" chip). Per-church storage cap bar warns amber at 200MB/250MB.
// Files are client-side envelope-encrypted (ruling #13) — lock icon + quiet
// footer. View opens a signed URL; Delete (claimer, soft-confirm) is the only
// mutation and writes an evidence_deleted audit row.
import React, { useState, useRef } from 'react'

const CHANNELS = ['Signal', 'Wire', 'Email', 'Phone (rare)', 'In-person', 'Other']
const MIME_HINT = 'Images (jpg/png/heic/webp), PDF, audio (mp3/m4a), DOCX. Max 25MB per file.'
const CAP_MB = 250
const WARN_MB = 200

function extClass(name = '') {
  const e = name.split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(e)) return 'jpg'
  if (e === 'pdf') return 'pdf'
  if (['mp3', 'm4a'].includes(e)) return 'm4a'
  if (e === 'docx') return 'docx'
  return ''
}
const fmtMB = mb => mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(mb * 1024)} KB`

function CapBar({ usedMb }) {
  const pct = Math.min(100, Math.round((usedMb / CAP_MB) * 100))
  const warn = usedMb >= WARN_MB
  return (
    <div className={`cap ${warn ? 'warn' : ''}`}>
      <div className="cap-meta"><span>Storage used</span><span className="pct">{usedMb} MB of {CAP_MB} MB</span></div>
      <div className="cap-track"><div className="cap-fill" style={{ width: `${pct}%` }} /></div>
      {warn && <div className="cap-warn-note">Approaching the {CAP_MB}MB cap. Consider summarizing older evidence in narrative notes.</div>}
    </div>
  )
}

const Lock = () => (
  <svg className="lock" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="3.5" y="7" width="9" height="6" rx="1.2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </svg>
)

function FileRow({ f, onView, onDelete }) {
  return (
    <div className="evf-row">
      <span className={`evf-ico ${extClass(f.name)}`}>{(f.name.split('.').pop() || '').toUpperCase()}</span>
      <div className="evf-main">
        <div className="evf-name">{f.name}{f.encrypting ? <span className="spinner" /> : <Lock />}</div>
        <div className="evf-sub">
          <span className="sz">{fmtMB(f.sizeMb)}</span>
          <span>· {f.encrypting ? 'Encrypting…' : f.summary}</span>
          {!f.encrypting && (f.linked_audit_id
            ? <span className="link-chip linked">linked · {f.linked_label}</span>
            : <span className="link-chip unlinked">unlinked</span>)}
        </div>
      </div>
      <div className="evf-actions">
        <button className="evf-mini" disabled={f.encrypting} onClick={() => onView(f)}>View</button>
        {!f.encrypting && <button className="evf-mini del" onClick={() => onDelete(f)}>Delete</button>}
      </div>
    </div>
  )
}

/**
 * @param {boolean} isClaimer    widget renders only for the claimer
 * @param {Array}   files        existing evidence rows
 * @param {Array}   notes        claimer's narrative notes (for link-to-note)
 * @param {number}  usedMb       per-church storage used
 * @param {string}  prelinkAuditId  when opened from a note's "+ Attach evidence"
 */
export default function EvidenceUpload({ isClaimer, files, notes, usedMb, prelinkAuditId, onUpload, onView, onDelete }) {
  const [dragging, setDragging] = useState(false)
  const [channel, setChannel] = useState(CHANNELS[0])
  const [summary, setSummary] = useState('')
  const [linkId, setLinkId] = useState(prelinkAuditId || '')
  const [staged, setStaged] = useState(null)
  const inputRef = useRef(null)
  const canUpload = staged && summary.trim().length > 0

  if (!isClaimer) {
    // Non-claimers see the existing file list read-only (no widget).
    return (
      <div className="ev-up">
        <CapBar usedMb={usedMb} />
        <div className="evf">{files.map(f => <FileRow key={f.id} f={f} onView={onView} onDelete={() => {}} />)}</div>
        <div className="ev-enc-foot"><Lock />Files are encrypted client-side with per-church envelope keys.</div>
      </div>
    )
  }

  return (
    <div className="ev-up">
      <div
        className={`dropzone ${dragging ? 'active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); setStaged(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
      >
        <svg className="dz-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M8 11V3M5 6l3-3 3 3" /><path d="M3 11v2h10v-2" /></svg>
        <span className="dz-main">{staged ? staged.name : 'Drop file or click to choose'}</span>
        <span className="dz-hint">{MIME_HINT}</span>
        <input ref={inputRef} type="file" hidden onChange={e => setStaged(e.target.files[0])} />
      </div>

      <div className="ev-up-form">
        <div className="fld"><span className="fld-label">Channel <span className="req">required</span></span>
          <select className="sel" value={channel} onChange={e => setChannel(e.target.value)}>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="fld"><span className="fld-label">Summary <span className="req">required</span></span>
          <input className="inp" value={summary} onChange={e => setSummary(e.target.value)} placeholder="What does this file show? (e.g., 'Signal screenshot — leader confirms baptism count')." />
        </div>
        <div className="fld"><span className="fld-label">Link to note <span style={{ fontFamily: 'var(--rp-sans)', fontSize: 10, color: 'var(--rp-muted)', textTransform: 'none', letterSpacing: '0.01em' }}>optional</span></span>
          <select className="sel" value={linkId} onChange={e => setLinkId(e.target.value)}>
            <option value="">— unlinked —</option>
            {notes.map(n => <option key={n.source_id} value={n.source_id}>{(n.created_at || '').slice(5, 10)} · {n.body.slice(0, 40)}…</option>)}
          </select>
        </div>
        <div className="propose-actions">
          <button className="btn btn-primary btn-sm" disabled={!canUpload}
            onClick={() => { onUpload({ file: staged, channel, summary: summary.trim(), linked_audit_id: linkId || null }); setStaged(null); setSummary(''); setLinkId('') }}>
            Upload
          </button>
        </div>
      </div>

      <CapBar usedMb={usedMb} />
      <div className="evf">{files.map(f => <FileRow key={f.id} f={f} onView={onView} onDelete={onDelete} />)}</div>
      <div className="ev-enc-foot"><Lock />Files are encrypted client-side with per-church envelope keys.</div>
    </div>
  )
}
