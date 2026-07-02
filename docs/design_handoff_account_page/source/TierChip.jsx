// ─────────────────────────────────────────────
// TierChip — user-facing admin-tier label (KAN-271)
//
// Maps the internal app_metadata.admin_tier claim to the user-facing
// label + a quiet chip. NEVER surfaces the raw claim value
// (top_tier / super_admin / regular) to the UI.
//
//   top_tier    → "Overseer"     · restrained gold (top-tier accent)
//   super_admin → "Super admin"  · sky
//   regular     → "Admin"        · neutral
//
// Chips are quiet by design (carries the founder restraint rulings) —
// a small dot carries the only color. All classes resolve to live
// globals.css tokens; see account-cd.css for the .tier-chip rules to
// merge into globals.css on wire-up.
import React from 'react'

const TIER_MAP = {
  top_tier:    { label: 'Overseer',    cls: 'tier-overseer' },
  super_admin: { label: 'Super admin', cls: 'tier-super' },
  regular:     { label: 'Admin',       cls: 'tier-admin' },
}

export function tierLabel(adminTier) {
  return (TIER_MAP[adminTier] || TIER_MAP.regular).label
}

/**
 * @param {{ tier: 'top_tier'|'super_admin'|'regular', size?: 'sm'|'md' }} props
 */
export default function TierChip({ tier, size = 'md' }) {
  const t = TIER_MAP[tier] || TIER_MAP.regular
  return (
    <span className={`tier-chip ${t.cls} ${size === 'sm' ? 'tier-chip-sm' : ''}`}>
      <span className="tc-dot" />
      {t.label}
    </span>
  )
}
