// ─────────────────────────────────────────────
// AccountPage — canonical personal-account home (KAN-271 · /account)
//
// Reached by clicking the whole bottom-left identity block in Shell.jsx
// (wrapped in <Link to="/account">). Single source of truth for personal
// account management across ALL admin tiers — most urgently TOTP, which
// the regular Admin tier can't reach today (Team Management is hidden).
//
// MVP baseline (manifest §3.5): Identity · TOTP · Sign out.
// CD-proposed additions (ratification-gated): Active sessions ·
// Recent activity · Preferences · Deactivation request.
//
// Layout: single column, sectioned cards, ~760px measure. Clinical
// register, dark, live rp-* tokens. No new tokens. No auth-internal
// jargon on any surface (no AAL2 / JWT / RLS).
//
// See preview/index.html for the full hi-fi spec + all three tier
// variants + empty/loading/error states.
import { useEffect, useState } from 'react'
import { RpFrame, SkeletonRows, EmptyState, ErrorBanner } from '../components/Shell'
import { TotpEnrollmentScreen } from '../components/TotpEnrollmentScreen'
import TierChip, { tierLabel } from '../components/admin/TierChip'
import { supabase } from '../supabase'
import { resolveTotpFactorId } from '../lib/aal2'

export default function AccountPage({ user }) {
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin'
  const email    = user?.email || ''
  const tier     = user?.app_metadata?.admin_tier || 'regular'
  const isOverseer = tier === 'top_tier'

  const [factorId, setFactorId]   = useState(undefined)  // undefined = loading, null = not enrolled, string = enrolled
  const [factorErr, setFactorErr] = useState(null)

  async function loadFactor() {
    setFactorErr(null)
    try { setFactorId(await resolveTotpFactorId(supabase)) }   // returns null if none
    catch (e) { setFactorErr(e.message || 'Could not load your two-factor status'); setFactorId(null) }
  }
  useEffect(() => { loadFactor() }, [])

  return (
    <RpFrame crumb="Account" title={fullName} user={user}>
      <div className="acct">

        {/* ── Identity (MVP baseline) ── */}
        <Section label="Identity" tag="baseline">
          <AccountHeader fullName={fullName} email={email} tier={tier} />
        </Section>

        {/* ── Two-factor authentication (MVP baseline · the hero) ── */}
        <Section label="Two-factor authentication" tag="baseline">
          <div className="rp-card" style={{ padding: 18 }}>
            {factorId === undefined ? (
              <div className="totp-loading"><span className="rp-spinner" /> Checking your two-factor status…</div>
            ) : factorId === null ? (
              // reuses the existing 3-step flow verbatim; onEnrolled re-resolves
              <TotpEnrollmentScreen onEnrolled={loadFactor} />
            ) : (
              <TotpStatusCard onReset={loadFactor} />
            )}
          </div>
        </Section>

        {/* ── Active sessions (CD proposed) ── */}
        <Section label="Active sessions" tag="proposed">
          <SessionsSection />
        </Section>

        {/* ── Recent account activity (CD proposed · this admin only) ── */}
        <Section label="Recent account activity" tag="proposed">
          <ActivitySection />
        </Section>

        {/* ── Preferences (CD proposed) ── */}
        <Section label="Preferences" tag="proposed">
          <PreferencesSection isOverseer={isOverseer} />
        </Section>

        {/* ── Account (CD proposed) ── */}
        <Section label="Account" tag="proposed">
          <AccountFooter />
        </Section>

      </div>
    </RpFrame>
  )
}

// ── section shell ──
function Section({ label, tag, children }) {
  return (
    <div className="acct-section">
      <div className="acct-eyebrow">
        <span className="lbl">{label}</span>
        <span className={`acct-tag ${tag}`}>{tag === 'baseline' ? 'MVP baseline' : 'CD proposed'}</span>
      </div>
      {children}
    </div>
  )
}

function AccountHeader({ fullName, email, tier }) {
  const initials = fullName.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className="acct-head">
      <span className="acct-head-avatar">{initials}</span>
      <div className="acct-head-main">
        <div className="acct-head-name">{fullName}</div>
        <div className="acct-head-row">
          <TierChip tier={tier} />
          <span className="acct-head-email">{email}</span>
          <span className="readonly-tag">read-only</span>
        </div>
      </div>
    </div>
  )
}

// ── TOTP enrolled status + guarded reset ──
function TotpStatusCard({ onReset }) {
  // Reset opens a confirm (reuse the existing confirm-modal pattern), then
  // runs unenrollTotpFactor → re-mounts TotpEnrollmentScreen via onReset.
  // Copy is honest: "You'll set up your authenticator again from scratch."
  return (
    <div className="totp-status">{/* …status detail grid + Reset TOTP — see preview */}</div>
  )
}

// ── sessions: list + sign-out-others; graceful states ──
function SessionsSection() {
  const [state, setState] = useState({ loading: true, error: null, rows: [] })
  // load active sessions; render SkeletonRows while loading, EmptyState if
  // none, ErrorBanner on failure. "Sign out other devices" opens a confirm.
  if (state.loading) return <div className="rp-card"><SkeletonRows cols={2} rows={3} /></div>
  if (state.error)   return <ErrorBanner message={state.error} />
  if (!state.rows.length) return <EmptyState label="No other sessions" message="You're only signed in on this device." />
  return <div className="rp-card">{/* session rows — see preview */}</div>
}

// ── recent activity: THIS admin's own account events only ──
function ActivitySection() {
  // Scoped read of this user's own sign-ins / TOTP changes / session events.
  // NEVER leader-identifying. Not the global audit log.
  return <div className="rp-card">{/* activity rows + "Something look wrong?" — see preview */}</div>
}

// ── preferences: timezone / language / notifications (+ overseer cross-notify) ──
function PreferencesSection({ isOverseer }) {
  return (
    <div className="rp-card" style={{ padding: 18 }}>
      {/* timezone select · language select · in-app toggle · email digest select */}
      {isOverseer && (
        <div className="xnotify">{/* Ruth ↔ Replant Ops realtime — always on, shown for visibility */}</div>
      )}
    </div>
  )
}

// ── footer: sign out (mirrors nav) + deactivation request ──
function AccountFooter() {
  async function signOut() { await supabase.auth.signOut() }
  // Deactivation is NOT self-service — opens a request that routes to
  // another admin (see open Q5). Requester behavior TBD at ratification.
  return <div className="acct-footer-card">{/* sign out + request deactivation — see preview */}</div>
}
