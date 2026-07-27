// ─────────────────────────────────────────────
// SlaPill — deliverable 4 (the #1 ratification ask)
//
// Derives one of five SLA bands from days_since_submitted against the locked
// 5/15/25/30 thresholds. Yellow (5–14) and amber (15–24) MUST read as visibly
// distinct — different hue, weight, and urgency.
//
// CD tweak (Founder-final): list rows render `variant="compact"` (day only);
// the band board + detail header render `variant="full"` (with message).
//
// Tokens are in globals.css :root (added for the queue):
//   --sla-neutral / --sla-yellow / --sla-amber / --sla-red  (+ *-bg)
// stalled_pending freezes the clock → neutral treatment + paused glyph.
// Pulse on the past-window band is gated behind prefers-reduced-motion (CSS).
// ─────────────────────────────────────────────

import React from 'react'

const BANDS = {
  neutral: { cls: 'band-neutral', msg: 'contact within day 5' },
  yellow:  { cls: 'band-yellow',  msg: 'decision-or-info by day 15' },
  amber:   { cls: 'band-amber',   msg: 'final by day 25' },
  red:     { cls: 'band-red',     msg: 'final overdue' },
  past:    { cls: 'band-past',    msg: 'past window — auto-reject pending' },
}

export function slaBand(day) {
  if (day >= 30) return 'past'
  if (day >= 25) return 'red'
  if (day >= 15) return 'amber'
  if (day >= 5)  return 'yellow'
  return 'neutral'
}

/**
 * @param {number}  day      days_since_submitted
 * @param {boolean} stalled  stalled_pending — clock paused (leader responsive,
 *                           admin overloaded). Renders neutral + paused glyph,
 *                           ignores the day-count band.
 * @param {'full'|'compact'} variant  full = day + message; compact = day only.
 */
export default function SlaPill({ day, stalled = false, variant = 'compact' }) {
  if (stalled) {
    return (
      <span className="sla-pill band-neutral" title="Clock paused — leader responsive, admin overloaded">
        <span className="dot" style={{ border: '1px solid var(--rp-bg)' }} />
        <span className="dn">Day {day}</span>
        {variant === 'full' && <><span className="sep">·</span><span className="msg">stalled — clock paused</span></>}
      </span>
    )
  }

  const band = BANDS[slaBand(day)]
  return (
    <span className={`sla-pill ${band.cls}`}>
      <span className="dot" />
      <span className="dn">Day {day}</span>
      {variant === 'full' && <><span className="sep">·</span><span className="msg">{band.msg}</span></>}
    </span>
  )
}
