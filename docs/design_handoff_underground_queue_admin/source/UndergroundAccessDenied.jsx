// ─────────────────────────────────────────────
// UndergroundAccessDenied — deliverable 15
//
// Rendered inside RpFrame when the AAL2 gate has cleared but the admin lacks
// is_underground_admin. The data fetch NEVER fires (defense-in-depth — the
// server also returns 401). Renders in place of the queue.
//
// Terminology (Founder note 2026-06-22): NO "steward" / "underground steward".
// The role is SUPER ADMIN; the flag is is_underground_admin.
// ─────────────────────────────────────────────

import React from 'react'

export default function UndergroundAccessDenied() {
  return (
    <div className="denial">
      <span className="dn-mark">
        <svg className="ic" viewBox="0 0 16 16" width="24" height="24">
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
      </span>
      <span className="dn-eyebrow">Access restricted</span>
      <span className="dn-title">Super admin access required</span>
      <span className="dn-body">
        This area is limited to <b>super admins with underground access</b>{' '}
        (<code className="tok">is_underground_admin</code>). Contact ops if you believe this is an error.
      </span>
    </div>
  )
}

/*
Usage in Underground.jsx (after the AAL2 stage-3 gate clears):

    if (!session?.user?.app_metadata?.is_underground_admin) {
      return (
        <RpFrame crumb="Operations / Sensitive" title="Underground Church Oversight" user={user}>
          <UndergroundAccessDenied />
        </RpFrame>
      )
    }
    // …only now fetch the queue.
*/
