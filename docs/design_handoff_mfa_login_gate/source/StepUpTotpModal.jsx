// StepUpTotpModal — TOTP-code step-up re-challenge.
//
// CD SCAFFOLD (design_handoff_mfa_login_gate). Refresh of StepUpModal.jsx.
// SEC ruled the current PASSWORD re-prompt architecturally wrong: re-entering
// the password only re-proves what the session already proved by existing —
// it establishes no second-factor possession. This variant re-challenges
// with a 6-digit TOTP code (Stripe / GitHub sudo / Okta / Atlassian pattern).
//
// WHAT'S REUSED (unchanged from StepUpModal):
//   - useStepUp() host architecture: _registerOpener / _resolvePending /
//     _rejectPending, single global mount at app root inside <BrowserRouter>.
//   - z-index 2000 (clears .ov=300 + rp-toast=1000). Backdrop-click + ESC
//     cancel when not verifying / not locked.
//   - Card shell. Width 380 -> 440 (only structural change — seats 6 cells).
//
// WHAT CHANGED (from StepUpModal):
//   - <input type="password"> + <form>  ->  6x .otp-cell input (mono, sky
//     focus ring, error tint) with advance / backspace / paste handlers
//     lifted from TotpChallengeModal.jsx.
//   - request body {password, action} -> challengeAndVerify(factorId, code)
//     then mint the action-bound token (no password in the body).
//   - adds error (attempt counter) + locked (5-attempt / 15-min, persisted
//     per factorId) state machine from TotpChallengeModal.jsx.
//   - copy: "Confirm your password" -> "Verify your identity"; the
//     destructive action is surfaced BY NAME + ref.
//
// The opener now receives an ACTION DESCRIPTOR (not a bare name string):
//   ACTIONS.REJECT_UNDERGROUND = {
//     key: 'reject_underground',
//     verb: 'reject', context: 'underground verification',
//   }
// and the caller passes the live target ref (e.g. 'UG-A540') at open time:
//   const token = await requireStepUp(ACTIONS.REJECT_UNDERGROUND, { target: 'UG-A540' })
//
// Voice: clinical, no auth-internal vocabulary (no "AAL2" / "step-up" /
// "elevation" / "freshness"). Italic = scripture only — none here.
// No new tokens; .otp-cell + .su-* resolve to globals.css rp-*.

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { resolveTotpFactorId, challengeAndVerify } from '../lib/aal2'
import { Icon } from './Icons'
import { _registerOpener, _resolvePending, _rejectPending } from '../hooks/useStepUp'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

// Per-factor lockout persistence — survives reload so closing the tab
// mid-lockout doesn't reset the cooldown. The real gate is server-side
// (Supabase rate limits + BE AAL2 check); this is the UX brake. Mirrors
// TotpChallengeModal.jsx exactly.
function lockoutKey(factorId) { return `rp-totp-lockout:${factorId}` }
function readPersistedLockout(factorId) {
  try {
    const raw = localStorage.getItem(lockoutKey(factorId))
    if (!raw) return null
    const ts = Number.parseInt(raw, 10)
    if (!Number.isFinite(ts) || ts <= Date.now()) { localStorage.removeItem(lockoutKey(factorId)); return null }
    return new Date(ts)
  } catch { return null }
}
function writePersistedLockout(factorId, until) {
  try { localStorage.setItem(lockoutKey(factorId), String(until.getTime())) } catch {}
}

export default function StepUpTotpModalHost() {
  // null = closed. Otherwise the action descriptor + target the opener passed.
  const [action, setAction] = useState(null)      // { key, verb, context, target }
  const [factorId, setFactorId] = useState(null)
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [attemptCount, setAttemptCount] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(null)
  const [status, setStatus] = useState('idle')    // idle | verifying | error | locked
  const inputRefs = useRef([])

  const isOpen = action !== null
  const isLocked = !!lockedUntil && Date.now() < lockedUntil.getTime()
  const effectiveStatus = isLocked ? 'locked' : status
  const remaining = MAX_ATTEMPTS - attemptCount

  // Host registration — useStepUp.requireStepUp(action, { target }) dispatches here.
  useEffect(() => {
    _registerOpener(async (openAction) => {
      setAction(openAction)
      setDigits(['', '', '', '', '', ''])
      setAttemptCount(0)
      setStatus('idle')
      // Resolve the caller's factor once per open; seed any persisted lockout.
      const fid = await resolveTotpFactorId(supabase).catch(() => null)
      setFactorId(fid)
      setLockedUntil(readPersistedLockout(fid))
    })
    return () => _registerOpener(null)
  }, [])

  // Focus first empty cell on open + after an error reset.
  useEffect(() => {
    if (!isOpen || effectiveStatus === 'locked') return
    const firstEmpty = digits.findIndex(d => d === '')
    const idx = firstEmpty === -1 ? digits.length - 1 : firstEmpty
    inputRefs.current[idx]?.focus()
  }, [isOpen, effectiveStatus, digits])

  // ESC cancels when not in flight / not locked.
  useEffect(() => {
    if (!isOpen) return undefined
    function onKey(e) { if (e.key === 'Escape' && status !== 'verifying' && !isLocked) cancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, status, isLocked])

  function handleDigitChange(i, raw) {
    const ch = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]; next[i] = ch; setDigits(next)
    if (status === 'error') setStatus('idle')
    if (ch && i < 5) inputRefs.current[i + 1]?.focus()
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }
  function handlePaste(e) {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    e.preventDefault()
    const next = Array.from({ length: 6 }, (_, i) => text[i] ?? '')
    setDigits(next)
    if (status === 'error') setStatus('idle')
    inputRefs.current[Math.min(text.length, 6) - 1]?.focus()
  }

  function cancel() {
    if (status === 'verifying') return
    // Cancel returns the admin to the triggering screen WITHOUT firing the
    // destructive action — the caller's awaiter rejects, action never runs.
    setAction(null)
    _rejectPending(new Error('Step-up cancelled by user'))
  }

  async function handleSubmit() {
    if (isLocked || status === 'verifying') return
    const code = digits.join('')
    if (code.length !== 6 || !factorId) return
    setStatus('verifying')
    try {
      // 1) Prove second-factor possession right now.
      await challengeAndVerify(supabase, factorId, code)

      // 2) Mint the action-bound step-up token. BE CONTRACT (no password):
      //    POST /.netlify/functions/request-step-up
      //    body: { action: action.key, target: action.target }
      //    -> { token }  // bound to (user_id, action) pair, 5-min TTL,
      //                   //  single-use against this one action (anti-replay)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/request-step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: action.key, target: action.target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.token) throw new Error(data?.error || 'verify_failed')

      setAction(null)
      setStatus('idle')
      _resolvePending(data.token)            // hand the token back to the caller
    } catch {
      const newCount = attemptCount + 1
      setAttemptCount(newCount)
      setDigits(['', '', '', '', '', ''])
      if (newCount >= MAX_ATTEMPTS) {
        const until = new Date(Date.now() + LOCKOUT_MS)
        writePersistedLockout(factorId, until)
        setLockedUntil(until)
        setStatus('locked')
      } else {
        setStatus('error')
      }
    }
  }

  // Auto-submit on the 6th digit (one-handed authenticator UX, matches
  // TotpChallengeModal).
  useEffect(() => {
    if (isOpen && digits.every(d => d !== '') && status === 'idle' && !isLocked) handleSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  if (!isOpen) return null

  return (
    <div
      className="su-ov"
      onClick={(e) => { if (e.target === e.currentTarget && !isLocked && status !== 'verifying') cancel() }}
    >
      <div className="su-card" role="dialog" aria-modal="true" aria-labelledby="su-title">
        <div className="su-eyebrow">{Icon.lock}<span>Two-factor · Confirm action</span></div>
        <h2 className="su-title" id="su-title">Verify your identity</h2>
        <p className="su-sub">Enter the 6-digit code from your authenticator app to confirm this action.</p>

        {/* Action-bound context — named, consequence stated, ref carried. */}
        <div className="su-action">
          <svg className="ic" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>
          <div className="su-action-text">
            You're about to <b>{action.verb} {action.context}</b>{' '}
            <span className="su-ref">{action.target}</span>. This can't be undone.
          </div>
        </div>

        <div className="otp-row">
          {digits.map((v, i) => {
            const isError = effectiveStatus === 'error'
            return (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                className={`otp-cell${isError ? ' is-error' : ''}`}
                type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={1}
                value={v}
                disabled={isLocked || status === 'verifying'}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
              />
            )
          })}
        </div>

        {effectiveStatus === 'error' && (
          <div className="su-error">
            <svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16v.5" /></svg>
            Incorrect code — <b>{remaining} attempt{remaining === 1 ? '' : 's'} remaining</b> before 15-minute lockout
          </div>
        )}

        {effectiveStatus === 'locked' && (
          <div className="su-locked">
            <svg className="ic" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>
            <div><b>Too many attempts.</b> Try again in 15 minutes. The action was not performed.</div>
          </div>
        )}

        <div className="su-foot">
          <button type="button" className="su-cancel" onClick={cancel} disabled={status === 'verifying'}>
            {isLocked ? 'Close' : 'Cancel'}
          </button>
          {!isLocked && (
            <button
              type="button" className="su-verify"
              onClick={handleSubmit}
              disabled={digits.some(d => d === '') || status === 'verifying'}
            >
              {status === 'verifying' ? <><span className="rp-spinner" /> Verifying…</> : 'Verify'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
