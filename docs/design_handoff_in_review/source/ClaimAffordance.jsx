// ─────────────────────────────────────────────
// ClaimAffordance + In Review StatePill — Ask 1 + Ask 7
//
// Top-right control beside the Day-# SLA pill on UndergroundDetail, and the
// queue-row / inbox State pill. The claim LOCKS proposal initiation to the
// claimer (Founder ruling). Attribution is "In review by Maria S · since Jun 22"
// — "since" + a DATE, never a day-count on the surface.
//
// Staleness (ruling #9) is signalled by RESTRAINT, not color: the pill is a
// neutral monochrome chip, and the flag glyph warms to a single muted accent
// (--rp-amber) as a claim ages (revised 2026-06-23 — the RAG fills read as
// videogamey). All classes resolve to live globals.css tokens (see
// in-review-cd.css; merge those rules into globals.css on wire-up).
import React from 'react'

const FlagGlyph = () => (
  <svg className="flag" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 11, height: 11 }}>
    <path d="M4 2v12M4 3h7l-2 2.5L11 8H4" />
  </svg>
)

// "Jun 22" from an ISO claim timestamp.
function sinceDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function staleClass(claimedAtIso) {
  const days = claimedAtIso ? Math.floor((Date.now() - new Date(claimedAtIso).getTime()) / 86_400_000) : 0
  if (days >= 7) return 'ir-vstale'
  if (days >= 3) return 'ir-stale'
  return 'ir-active'
}

/**
 * In Review state pill. Renders in the queue row, the detail header, and the
 * inbox composite. Same content + flag in every variant — only the hue escalates.
 * @param {{claimed_by_name:string, claimed_at:string, routed_to_founder?:boolean}} claim
 * @param {boolean} withSince  show "· since Jun 22" (header/queue); inbox omits it
 */
export function InReviewPill({ claim, withSince = true }) {
  return (
    <span className={`ir-pill ${staleClass(claim.claimed_at)}`}>
      <FlagGlyph />
      In review by {claim.claimed_by_name}
      {withSince && <span className="since">· since {sinceDate(claim.claimed_at)}</span>}
      {claim.routed_to_founder && (
        <span className="route-seg"><span className="arrow">→</span>Routed to Founder</span>
      )}
    </span>
  )
}

/**
 * Top-right claim control on UndergroundDetail.
 * @param {object|null} claim        null when unclaimed
 * @param {string}      viewerUserId
 * @param {boolean}     isFounder
 */
export default function ClaimAffordance({ claim, viewerUserId, isFounder, onClaim, onRelease, onRequestRelease, onForceUnmark }) {
  // Unclaimed — checkbox-style control + helper tooltip.
  if (!claim) {
    return (
      <div className="claim-wrap">
        <label className="claim-check" onClick={onClaim}>
          <span className="box" />
          Mark as in review
          <span className="claim-tip">Claim this case so other admins know you're actively working it.</span>
        </label>
      </div>
    )
  }

  const isMine = claim.claimed_by === viewerUserId

  return (
    <div className="claim-cluster">
      <InReviewPill claim={claim} />
      {isMine ? (
        <button className="claim-link" onClick={onRelease}>Release claim</button>
      ) : isFounder ? (
        <button className="claim-link danger" onClick={onForceUnmark}>Force unmark</button>
      ) : (
        <button className="claim-link" onClick={onRequestRelease}>Request release</button>
      )}
    </div>
  )
}
