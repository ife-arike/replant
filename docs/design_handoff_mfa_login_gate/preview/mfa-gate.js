/* ═══════════════════════════════════════════════════
   Replant Admin — MFA Login Gate · CD preview script
   Vanilla JS. Renders both surfaces in real chrome with
   the dispatch-required state toggles. No build step.
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── icons (stroke, currentColor) ── */
  const IC = {
    lock: '<svg class="ic" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    out: '<svg class="ic" viewBox="0 0 24 24"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 12h11M16 8l4 4-4 4"/></svg>',
    info: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v.5M12 11v6"/></svg>',
    tri: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/></svg>',
    copy: '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5h10"/></svg>',
    alert: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v.5"/></svg>',
  };

  /* ── pseudo-QR data URI (the real one comes from Supabase as a
       base64 SVG; this is a visual stand-in only) ── */
  function qrDataUri(seed) {
    const N = 25, cell = 8, pad = 0, size = N * cell;
    let s = seed || 1;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let r = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#F0EDE6"/>`;
    const finder = (ox, oy) => {
      r += `<rect x="${ox*cell}" y="${oy*cell}" width="${7*cell}" height="${7*cell}" fill="#06151f"/>`;
      r += `<rect x="${(ox+1)*cell}" y="${(oy+1)*cell}" width="${5*cell}" height="${5*cell}" fill="#F0EDE6"/>`;
      r += `<rect x="${(ox+2)*cell}" y="${(oy+2)*cell}" width="${3*cell}" height="${3*cell}" fill="#06151f"/>`;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inFinder = (x < 8 && y < 8) || (x > N-9 && y < 8) || (x < 8 && y > N-9);
      if (inFinder) continue;
      if (rnd() > 0.52) r += `<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}" fill="#06151f"/>`;
    }
    finder(0,0); finder(N-7,0); finder(0,N-7);
    r += '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(r);
  }

  /* ───────────────────────────────────────────────
     OTP cell input — advance / backspace / paste.
     Mirrors the handlers in TotpChallengeModal.jsx.
  ─────────────────────────────────────────────── */
  function mountOtp(host, opts) {
    opts = opts || {};
    const count = opts.count || 6;
    host.innerHTML = '';
    host.className = 'otp-row';
    const cells = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('input');
      el.className = 'otp-cell';
      el.type = 'text';
      el.inputMode = 'numeric';
      el.autocomplete = 'one-time-code';
      el.maxLength = 1;
      if (opts.disabled) el.disabled = true;
      if (opts.error) el.classList.add('is-error');
      el.addEventListener('input', () => {
        el.value = el.value.replace(/\D/g, '').slice(-1);
        cells.forEach(c => c.classList.remove('is-error'));
        if (el.value && i < count - 1) cells[i + 1].focus();
        emit();
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !el.value && i > 0) cells[i - 1].focus();
      });
      if (i === 0) el.addEventListener('paste', (e) => {
        const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, count);
        if (!t) return;
        e.preventDefault();
        cells.forEach((c, j) => { c.value = t[j] || ''; c.classList.remove('is-error'); });
        cells[Math.min(t.length, count) - 1].focus();
        emit();
      });
      cells.push(el);
      host.appendChild(el);
    }
    function value() { return cells.map(c => c.value).join(''); }
    function emit() { if (opts.onChange) opts.onChange(value()); }
    return { cells, value, focus: () => cells[0] && cells[0].focus() };
  }

  /* ───────────────────────────────────────────────
     TotpEnrollmentScreen replica (rendered verbatim —
     CD does not redesign this). Returns an HTML string.
  ─────────────────────────────────────────────── */
  function enrollmentHTML() {
    return `
      <div class="te-required">Required · One-time setup</div>
      <h1 class="te-h1">Set up two-factor authentication</h1>
      <p class="te-intro">Admin access reaches sensitive information about leaders in restricted contexts. Two-factor authentication is required before you continue.</p>

      <section class="te-section">
        <div class="te-step-head">
          <div class="te-badge">1</div>
          <div>
            <div class="te-step-title">Choose an authenticator app</div>
            <div class="te-step-sub">Pick a local-only authenticator. We recommend one app per platform.</div>
          </div>
        </div>
        <div class="te-apps">
          <div class="te-app"><div class="te-app-os">Android</div><div class="te-app-name">Aegis Authenticator</div><div class="te-app-meta">Open-source · local-only</div></div>
          <div class="te-app"><div class="te-app-os">iOS</div><div class="te-app-name">Ente Auth</div><div class="te-app-meta">or Tofu Authenticator as alternative</div></div>
        </div>
        <div class="te-advisory">${IC.info}<div><b>Avoid apps that sync to the cloud</b> (Authy, Google Authenticator with cloud backup). Cloud-synced codes may be accessible to third parties under legal compulsion.</div></div>
        <div class="te-advisory is-amber">${IC.tri}<div><b>Enroll on two physical devices if possible</b> — a primary and a backup. If your primary device is lost, a backup device lets you recover without contacting support.</div></div>
      </section>

      <section class="te-section">
        <div class="te-step-head">
          <div class="te-badge">2</div>
          <div>
            <div class="te-step-title">Scan the QR code</div>
            <div class="te-step-sub">Open your authenticator and add a new account by scanning this code.</div>
          </div>
        </div>
        <div class="te-qr-card">
          <div class="te-qr"><img src="${qrDataUri(7)}" alt="Two-factor authentication QR code"></div>
          <div>
            <div class="te-key-label">Can't scan? Enter this key manually</div>
            <div class="te-key"><span>JBSW Y3DP EHPK 3PXP</span><button class="te-copy" type="button">${IC.copy}Copy</button></div>
            <div class="te-issuer">Issuer: Replant Admin</div>
          </div>
        </div>
      </section>

      <section class="te-section">
        <div class="te-step-head">
          <div class="te-badge">3</div>
          <div>
            <div class="te-step-title">Confirm setup</div>
            <div class="te-step-sub">Enter the 6-digit code from your app to confirm setup.</div>
          </div>
        </div>
        <div class="te-confirm-card">
          <div data-te-otp></div>
          <div class="te-confirm-actions"><button class="te-complete" type="button" disabled>Complete setup</button></div>
        </div>
      </section>

      <div class="te-recovery">If you are ever locked out of your authenticator, contact the Replant Operations team at accounts@projectreplant.org to restore access. There is no automated recovery.</div>
    `;
  }

  /* ═══════════════════════════════════════════════════
     SURFACE 1 — BlockingEnrollmentGate
  ═══════════════════════════════════════════════════ */
  // Universal welcome — one message for both entry conditions (new invitee
  // and break-glass factor-reset). No eyebrow.
  const GATE_WELCOME = {
    title: "One more step before you're in.",
    sub: 'Replant admins must sign in with an authenticator code. Set yours up to continue.',
  };

  function mountGate(root) {
    root.innerHTML = `
      <div class="gate">
        <div class="gate-vignette"></div>
        <div class="gate-grid"></div>
        <div class="gate-chrome">
          <div class="gate-brand">
            <div class="gate-brand-mark">R</div>
            <div class="gate-brand-name">Replant</div>
          </div>
          <button class="gate-signout" type="button">${IC.out}Sign out</button>
        </div>
        <div class="gate-scroll">
          <div class="gate-col">
            <div class="gate-welcome">
              <h1 class="gate-title">${GATE_WELCOME.title}</h1>
              <p class="gate-sub">${GATE_WELCOME.sub}</p>
            </div>
            <div class="gate-card">
              ${enrollmentHTML()}
            </div>
            <div class="gate-card-foot">${IC.lock}<span>Every admin enrolls before reaching the dashboard. There's no skip.</span></div>
          </div>
        </div>
      </div>
    `;
    const otpHost = root.querySelector('[data-te-otp]');
    const complete = root.querySelector('.te-complete');
    const otp = mountOtp(otpHost, {
      onChange: (v) => { complete.disabled = v.length !== 6; },
    });
    root.querySelector('.te-copy').addEventListener('click', (e) => {
      e.currentTarget.innerHTML = IC.copy + 'Copied';
      setTimeout(() => { e.currentTarget.innerHTML = IC.copy + 'Copy'; }, 1600);
    });
  }

  /* ═══════════════════════════════════════════════════
     SURFACE 2 — StepUpTotpModal
  ═══════════════════════════════════════════════════ */
  // action registry — the modal receives one of these (label + ref).
  const ACTION = { label: 'reject', verb: 'Reject', target: 'UG-A540', context: 'underground verification' };
  const MAX_ATTEMPTS = 5;

  function stepUpBody(state, attempt) {
    const remaining = MAX_ATTEMPTS - attempt;
    const verifying = state === 'verifying';
    const error = state === 'error';
    const locked = state === 'locked';
    return `
      <div class="su-card" role="dialog" aria-modal="true" aria-labelledby="su-title">
        <div class="su-eyebrow">${IC.lock}<span>Two-factor · Confirm action</span></div>
        <h2 class="su-title" id="su-title">Verify your identity</h2>
        <p class="su-sub">Enter the 6-digit code from your authenticator app to confirm this action.</p>

        <div class="su-action">${IC.tri}<div class="su-action-text">You're about to <b>reject ${ACTION.context}</b> <span class="su-ref">${ACTION.target}</span>. This can't be undone.</div></div>

        <div data-su-otp></div>

        ${error ? `<div class="su-error">${IC.alert}Incorrect code — <b>${remaining} attempt${remaining === 1 ? '' : 's'} remaining</b> before 15-minute lockout</div>` : ''}
        ${locked ? `<div class="su-locked">${IC.tri}<div><b>Too many attempts.</b> Try again in 15 minutes. The action was not performed.</div></div>` : ''}

        <div class="su-foot">
          <button class="su-cancel" type="button">${locked ? 'Close' : 'Cancel'}</button>
          ${locked ? '' : `<button class="su-verify" type="button" ${verifying ? 'disabled' : 'disabled'}>${verifying ? '<span class="rp-spinner"></span> Verifying…' : 'Verify'}</button>`}
        </div>
      </div>
    `;
  }

  function mountStepUp(root) {
    let state = 'idle';
    let attempt = 1;        // shown count for the error state demo
    function render() {
      root.innerHTML = `<div class="su-ov">${stepUpBody(state, attempt)}</div>`;
      const otpHost = root.querySelector('[data-su-otp]');
      const verify = root.querySelector('.su-verify');
      const otp = mountOtp(otpHost, {
        disabled: state !== 'idle',
        error: state === 'error',
        onChange: (v) => { if (verify) verify.disabled = v.length !== 6; },
      });
      if (state === 'idle') setTimeout(() => otp.focus(), 20);
    }
    render();
    function setState(s) { state = s; attempt = (s === 'error') ? 4 : 1; render(); }
    return { setState };
  }

  /* ── segmented control wiring ── */
  function wireSeg(el, onPick) {
    const opts = JSON.parse(el.dataset.opts);
    el.classList.add('seg');
    el.innerHTML = opts.map((o, i) =>
      `<button type="button" data-v="${o.v}" aria-pressed="${i === 0 ? 'true' : 'false'}">${o.label}</button>`
    ).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      onPick(b.dataset.v);
    });
  }

  /* ── boot ── */
  document.addEventListener('DOMContentLoaded', () => {
    mountGate(document.querySelector('[data-mount-gate]'));

    const su = mountStepUp(document.querySelector('[data-mount-stepup]'));
    wireSeg(document.querySelector('[data-seg-stepup]'), su.setState);
  });
})();
