// ─────────────────────────────────────────────
// VisibilityOverrideModal — deliverable 11
//
// Two-eyes proposal to flip a church between Visible / Hidden. Gated by a
// 4-DIGIT RELAY TOKEN — the code the leader spoke during the T2 verification
// call. The admin types what they heard; a mismatch blocks the proposal.
// Anti-social-engineering: proves the admin reached the real leader.
//
// LOCKED:
//   - Visibility labels are Visible / Hidden (never Brave/Safe). DB column stays
//     show_church_name boolean.
//   - T2 channels: Signal / Wire / In-person / Letter / Referring-leader-relay.
//   - notes ≥40 char; per-direction acknowledgment checkbox.
//   - This is itself a proposal (awaits Admin B). Token validated SERVER-SIDE.
//
// CD tweak relayStyle (Founder-final): '4 cells'.
// ─────────────────────────────────────────────

import React, { useState, useRef } from 'react'

const CHANNELS = ['Signal', 'Wire', 'In-person', 'Letter', 'Referring-leader-relay']

function RelayCells({ value, onChange }) {
  // 4 numeric cells, autofocus-advance. Backing input is a single hidden field.
  const ref = useRef(null)
  const focus = () => ref.current?.focus()
  return (
    <div className="relay-cells" onClick={focus}>
      {[0, 1, 2, 3].map(i => {
        const ch = value[i]
        const cursor = i === value.length
        return (
          <div key={i} className={`relay-cell ${ch ? 'filled' : 'empty'} ${cursor ? 'cursor' : ''}`}>
            {ch || '•'}
          </div>
        )
      })}
      <input
        ref={ref}
        value={value}
        inputMode="numeric"
        maxLength={4}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        aria-label="4-digit relay token"
      />
    </div>
  )
}

export default function VisibilityOverrideModal({ church, onPropose, onCancel }) {
  const [direction, setDirection] = useState('h2v')   // 'h2v' | 'v2h'
  const [channel, setChannel] = useState(CHANNELS[0])
  const [token, setToken] = useState('')
  const [notes, setNotes] = useState('')
  const [ack, setAck] = useState(false)

  const dirLabel = direction === 'h2v' ? 'Hidden → Visible' : 'Visible → Hidden'
  const canSubmit = token.length === 4 && notes.trim().length >= 40 && ack

  return (
    <div className="ov open" onClick={e => e.target.classList.contains('ov') && onCancel()}>
      <div className="mdl" style={{ maxWidth: 520 }}>
        <div className="mdl-head">
          <span className="mh-glyph sky">
            <svg className="ic" viewBox="0 0 16 16"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" /><circle cx="8" cy="8" r="2" /></svg>
          </span>
          <div className="mh-text">
            <div className="mdl-title">Visibility override</div>
            <div className="mdl-sub">Two-eyes · requires relay token</div>
          </div>
        </div>

        <div className="mdl-body">
          <div className="fld">
            <span className="fld-label">Direction <span className="req">required</span></span>
            <div className="dir-seg">
              <label className={`dir-opt ${direction === 'h2v' ? 'on' : ''}`} onClick={() => setDirection('h2v')}>
                <span className="do-dir">Hidden <span className="dir-arrow">→</span> Visible</span>
                <span className="do-sub">Name becomes listed; location stays hidden.</span>
              </label>
              <label className={`dir-opt ${direction === 'v2h' ? 'on' : ''}`} onClick={() => setDirection('v2h')}>
                <span className="do-dir">Visible <span className="dir-arrow">→</span> Hidden</span>
                <span className="do-sub">Region only; name withheld.</span>
              </label>
            </div>
          </div>

          <div className="fld">
            <span className="fld-label">Contact channel <span className="req">required</span></span>
            <select className="sel" value={channel} onChange={e => setChannel(e.target.value)}>
              {CHANNELS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="relay">
            <span className="fld-label">4-digit relay token <span className="req">required</span></span>
            <p className="relay-note">
              Type the <b>4-digit code the leader spoke during the verification call.</b> This proves you
              reached the real leader, not an impersonator.
            </p>
            <RelayCells value={token} onChange={setToken} />
          </div>

          <div className="fld">
            <span className="fld-label">Notes <span className="req">required</span><span className="hint">≥40 char</span></span>
            <textarea className="txt" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <label className={`ack ${ack ? 'on' : ''}`} onClick={() => setAck(a => !a)}>
            <span className="ackbox" />
            <span className="ack-text">
              I confirm the leader requested <b>{dirLabel}</b> directly, and the relay token matched what
              they spoke on the call.
            </span>
          </label>
        </div>

        <div className="mdl-foot">
          <div className="mf-spacer" />
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() => onPropose({ action: 'visibility_override', direction, channel, token, notes })}
          >
            Propose override
          </button>
        </div>
      </div>
    </div>
  )
}
