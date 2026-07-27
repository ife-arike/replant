// BlockingEnrollmentGate — full-screen first-sign-in MFA gate.
//
// CD SCAFFOLD (design_handoff_mfa_login_gate). The implementing engineer
// lifts this structure + tokens and wires the real router/auth. The
// CHILD (<TotpEnrollmentScreen/>) is already built + design-approved —
// this component is ONLY the wrapper chrome around it.
//
// Renders IN PLACE OF <RpFrame> (no left nav, no topbar) whenever an
// admin signs in and has no verified TOTP factor. Two entry cases:
//   - "invitee" — just set a password via /set-password, no factor yet
//   - "reset"   — existing admin whose factor was administratively reset
//                 (break-glass, OPS-03). Router passes case="reset" when
//                 the no-factor state follows an admin_mfa_factor_reset.
//
// It is NOT a route. The post-sign-in guard chooses it over the dashboard:
//
//   const factorId = await resolveTotpFactorId(supabase)   // lib/aal2
//   if (factorId === null) {
//     return (
//       <BlockingEnrollmentGate case={resetContext ? 'reset' : 'invitee'}>
//         <TotpEnrollmentScreen onEnrolled={() => navigate('/network')} />
//       </BlockingEnrollmentGate>
//     )
//   }
//
// On enrollment, TotpEnrollmentScreen's challengeAndVerify auto-issues the
// elevated session; onEnrolled then navigates to the dashboard. The gate
// is the UX layer of the same enforcement the BE applies (every endpoint
// 401s without a verified factor) — there is no skip by design.
//
// Voice: clinical, peer-respecting per [[feedback-replant-admin-copy-voice]].
// Italic reserved for scripture per [[typography-ruling]] — none here.
// No new tokens; every value resolves to src/styles/globals.css rp-*.

import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Icon } from './Icons'

// Welcome framing — the ONLY copy that swaps by entry case. Open Q1:
// invitee headline A vs B is staged for Founder lock. Reset copy is
// separate and not in question.
const GATE_COPY = {
// Universal welcome framing — ONE message for both entry conditions (new
// invitee and break-glass factor-reset). No eyebrow, no case split. The
// `case` prop is still accepted for routing / analytics but no longer
// drives copy. Open Q1: headline A (below) vs B "Finish setting up your
// account." is staged for Founder lock.
const GATE_WELCOME = {
  title: "One more step before you're in.",
  sub: 'Replant admins must sign in with an authenticator code. Set yours up to continue.',
}

export default function BlockingEnrollmentGate({ case: entryCase = 'invitee', children }) {
  const navigate = useNavigate()
  // entryCase is retained for routing / analytics; the welcome copy is universal.

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="gate">
      {/* Login.jsx vignette + grid-mask, so the gate reads as an auth
          surface rather than the dashboard. */}
      <div className="gate-vignette" />
      <div className="gate-grid" />

      {/* Logo-only chrome. Sign out is the only escape hatch — top-right,
          quiet, not a CTA (open Q2: corner vs below-card; CD pick = corner). */}
      <div className="gate-chrome">
        <div className="gate-brand">
          <div className="gate-brand-mark">R</div>
          <div className="gate-brand-name">Replant</div>
        </div>
        <button type="button" className="gate-signout" onClick={handleSignOut}>
          {Icon.out}
          <span>Sign out</span>
        </button>
      </div>

      <div className="gate-scroll">
        <div className="gate-col">
          {/* Universal welcome framing above the card. The card's own h1
              ("Set up two-factor authentication") is the task; this is
              the greeting + the why. Centered, restrained — frames the
              moment without competing with the card heading. */}
          <div className="gate-welcome">
            <h1 className="gate-title">{GATE_WELCOME.title}</h1>
            <p className="gate-sub">{GATE_WELCOME.sub}</p>
          </div>

          {/* The already-built, design-approved enrollment flow, verbatim.
              Parent passes <TotpEnrollmentScreen onEnrolled={navigateToDashboard}/>. */}
          <div className="gate-card">
            {children}
          </div>

          <div className="gate-card-foot">
            {Icon.lock}
            <span>Every admin enrolls before reaching the dashboard. There's no skip.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
