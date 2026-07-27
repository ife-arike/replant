/* ═══════════════════════════════════════════════════
   Replant — Visibility-Change Flow · Mobile CD · preview script
   Vanilla JS. Injects device chrome icons, wires the View-as
   segmented controls, and runs the live interactions (hide-code,
   idle-reveal, day / window pickers). No build step.
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── inline icons (stroke, currentColor) ── */
  const IC = {
    back:      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    'chev-down':'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    'chev-up': '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
    eye:       '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    'eye-off': '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.6"/><path d="M6.2 6.2A16 16 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.2-.5"/><path d="M9.5 9.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2"/></svg>',
    shield:    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z"/></svg>',
    clock:     '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    lock:      '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    mark:      '<img src="rp-mark.svg" width="25" height="25" alt="Replant" style="display:block">',
  };

  /* status-bar cluster: cellular · wifi · battery */
  const SB = `
    <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.5"/><rect x="5" y="5" width="3" height="6" rx="0.5"/><rect x="10" y="2.5" width="3" height="8.5" rx="0.5"/><rect x="15" y="0" width="3" height="11" rx="0.5"/></svg>
    <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M8 2.2c2.6 0 5 1 6.8 2.7l-1.4 1.4A7.6 7.6 0 0 0 8 4.1 7.6 7.6 0 0 0 2.6 6.3L1.2 4.9A9.6 9.6 0 0 1 8 2.2Z"/><path d="M8 6.1c1.5 0 2.9.6 4 1.6l-1.5 1.5A3.5 3.5 0 0 0 8 8.1c-1 0-1.8.4-2.5 1.1L4 7.7A5.6 5.6 0 0 1 8 6.1Z"/><circle cx="8" cy="10" r="1.2"/></svg>
    <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" stroke-opacity="0.4"/><rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor"/><rect x="23.5" y="3.5" width="2" height="5" rx="1" fill="currentColor" fill-opacity="0.5"/></svg>
  `;

  function paintIcons(root) {
    (root || document).querySelectorAll('[data-sb]').forEach(el => { el.innerHTML = SB; });
    (root || document).querySelectorAll('[data-ic]').forEach(el => {
      const k = el.getAttribute('data-ic');
      if (IC[k]) el.innerHTML = IC[k];
    });
  }

  /* ── reusable segmented control (lifted from mfa-gate.js) ── */
  function wireSeg(el, onPick) {
    if (!el) return;
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

  /* ═══════════════════════════════════════════════════
     SURFACE 1 — entry affordance state swap
  ═══════════════════════════════════════════════════ */
  const ENTRY = {
    hidden: {
      block: `
        <div class="set-row-label">Visibility in the network</div>
        <div class="vis-state-row">
          <span class="vis-state-label">You are currently</span>
          <span class="vis-pill"><span class="dot"></span><span class="lbl">Hidden</span></span>
        </div>
        <button class="vis-request" type="button">Request to change to Visible</button>
        <p class="vis-caption">Our team confirms every change on a short call before it goes through. You'll pick a window when you're somewhere safe to talk.</p>`,
      capstate: { cls: 'gray', text: 'Settings · idle' },
      capdesc: 'Hidden church. The CTA points at Visible; the caption sets the expectation of a call before anything changes.',
    },
    visible: {
      block: `
        <div class="set-row-label">Visibility in the network</div>
        <div class="vis-state-row">
          <span class="vis-state-label">You are currently</span>
          <span class="vis-pill visible"><span class="dot"></span><span class="lbl">Visible</span></span>
        </div>
        <button class="vis-request" type="button">Request to change to Hidden</button>
        <p class="vis-caption">Our team confirms every change on a short call before it goes through. You'll pick a window when you're somewhere safe to talk.</p>`,
      capstate: { cls: '', text: 'Settings · idle' },
      capdesc: 'Visible church. The CTA now points back to Hidden — both directions route through the same call.',
    },
    scheduled: {
      block: `
        <div class="set-row-label">Visibility in the network</div>
        <div class="vis-sched">
          <div class="vis-sched-eyebrow">Verification call scheduled</div>
          <div class="vis-sched-when">Today · 14:00 – 16:00</div>
          <div class="vis-sched-sub">Changing Hidden → Visible · we'll call within this window</div>
          <div class="vis-sched-actions">
            <button class="vis-sched-btn" type="button">Reschedule</button>
            <button class="vis-sched-btn danger" type="button">Cancel</button>
          </div>
        </div>`,
      capstate: { cls: '', text: 'pending · call scheduled' },
      capdesc: 'After a window is picked the block becomes this card — same footprint, Reschedule + Cancel, no second entry point.',
    },
  };

  function wireEntry() {
    const block = document.querySelector('[data-entry-block]');
    const capstate = document.querySelector('[data-entry-capstate]');
    const capdesc = document.querySelector('[data-entry-capdesc]');
    if (!block) return;
    wireSeg(document.querySelector('[data-seg-entry]'), (v) => {
      const s = ENTRY[v];
      block.innerHTML = s.block;
      capstate.className = 'dev-cap-state ' + s.capstate.cls;
      capstate.textContent = s.capstate.text;
      capdesc.textContent = s.capdesc;
    });
  }

  /* ═══════════════════════════════════════════════════
     SURFACE 2 — schedule picker selection
  ═══════════════════════════════════════════════════ */
  function wireSchedule() {
    const rail = document.querySelector('[data-day-rail]');
    if (rail) rail.addEventListener('click', (e) => {
      const chip = e.target.closest('.day-chip'); if (!chip) return;
      rail.querySelectorAll('.day-chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
    });
    const list = document.querySelector('[data-win-list]');
    if (list) list.addEventListener('click', (e) => {
      const row = e.target.closest('.win-row'); if (!row || row.classList.contains('off')) return;
      list.querySelectorAll('.win-row').forEach(r => r.classList.remove('on'));
      row.classList.add('on');
    });
  }

  /* ═══════════════════════════════════════════════════
     SURFACE 5 — active screen state machine
  ═══════════════════════════════════════════════════ */
  const CODE = ['7', '2', '9', '4'];
  function digitsHTML(blank) {
    return CODE.map(d => `<span class="code-digit">${blank ? '•' : d}</span>`).join('');
  }

  function wireActive() {
    const screen = document.querySelector('[data-active-screen]');
    if (!screen) return;
    const mid = screen.querySelector('[data-act-mid]');
    const statusEl = screen.querySelector('[data-act-status]');
    const banner = screen.querySelector('[data-act-banner]');
    const hideBtn = screen.querySelector('[data-hide-btn]');
    const capstate = document.querySelector('[data-active-capstate]');
    const capdesc = document.querySelector('[data-active-capdesc]');

    let state = 'revealed';
    let codeHidden = false;   // toggled by the Hide-code button within 'revealed'

    const REVEALED_MID = (blank) => `
      <p class="act-lead">Read these digits aloud to confirm the change to <b>Visible</b>.</p>
      <div class="code-figure${blank ? ' hidden' : ''}">${digitsHTML(blank)}</div>
      <div class="code-rule"></div>
      ${blank
        ? `<div class="code-cap muted">Code hidden</div><a class="reveal-tap" data-reveal>${IC.eye}<span>Tap to show</span></a>`
        : `<div class="code-cap">Read them in the order shown.</div>`}
    `;

    const IDLE_MID = `
      <p class="act-lead">Read these digits aloud to confirm the change to <b>Visible</b>.</p>
      <div class="code-figure hidden">${digitsHTML(true)}</div>
      <div class="code-rule"></div>
      <div class="code-cap muted">Hidden after 90 seconds with no touch</div>
      <a class="reveal-tap" data-reveal>${IC.eye}<span>Tap to reveal</span></a>
    `;

    const VALIDATING_MID = `
      <div class="act-validating">
        <div class="spinner"></div>
        <div class="code-cap muted">Confirming your change…</div>
        <p class="act-lead" style="margin:0;max-width:240px">Stay on this screen. This takes only a moment.</p>
      </div>
    `;

    const CAP = {
      revealed:   ['', 'in_call · code revealed', 'The code is on screen only now, only here. Hide-code, idle-blank, and the duress jog all defend these few minutes.'],
      hidden:     ['', 'in_call · over-shoulder hide', 'One tap on Hide-code blanks the digits instantly. Tap to show brings them back — for when someone steps into the room.'],
      idle:       ['', 'in_call · idle timeout', 'After 90 seconds untouched the code drops to dots on its own. Tap-to-reveal restores it within the TTL.'],
      delayed:    ['', 'in_call · admin delayed', 'Admin offline fallback. The code stays valid; the leader is told to hold, not to retry or leave.'],
      validating: ['', 'in_call → validating', 'The admin has entered the code; the flip is landing. The screen hands off to the outcome on the next poll.'],
    };

    function render() {
      banner.style.display = (state === 'delayed') ? '' : 'none';

      if (state === 'revealed') {
        mid.innerHTML = REVEALED_MID(codeHidden);
        statusEl.className = 'act-status';
        statusEl.innerHTML = `<span class="sdot"></span>On the call`;
        hideBtn.style.visibility = 'visible';
        hideBtn.innerHTML = `${codeHidden ? IC.eye : IC['eye-off']}${codeHidden ? 'Show code' : 'Hide code'}`;
      } else if (state === 'hidden') {
        codeHidden = true;
        mid.innerHTML = REVEALED_MID(true);
        statusEl.className = 'act-status';
        statusEl.innerHTML = `<span class="sdot"></span>On the call`;
        hideBtn.style.visibility = 'visible';
        hideBtn.innerHTML = `${IC.eye}Show code`;
      } else if (state === 'idle') {
        mid.innerHTML = IDLE_MID;
        statusEl.className = 'act-status';
        statusEl.innerHTML = `<span class="sdot"></span>On the call`;
        hideBtn.style.visibility = 'hidden';
      } else if (state === 'delayed') {
        mid.innerHTML = REVEALED_MID(false);
        statusEl.className = 'act-status connecting';
        statusEl.innerHTML = `<span class="sdot"></span>Connecting…`;
        hideBtn.style.visibility = 'visible';
        hideBtn.innerHTML = `${IC['eye-off']}Hide code`;
      } else if (state === 'validating') {
        mid.innerHTML = VALIDATING_MID;
        statusEl.className = 'act-status connecting';
        statusEl.innerHTML = `<span class="sdot"></span>Confirming`;
        hideBtn.style.visibility = 'hidden';
      }

      const c = CAP[state];
      capstate.className = 'dev-cap-state ' + c[0];
      capstate.textContent = c[1];
      capdesc.textContent = c[2];

      const reveal = mid.querySelector('[data-reveal]');
      if (reveal) reveal.addEventListener('click', () => {
        if (state === 'idle') { state = 'revealed'; codeHidden = false; }
        else { codeHidden = false; }
        render();
      });
    }

    hideBtn.addEventListener('click', () => {
      if (state !== 'revealed' && state !== 'hidden') return;
      codeHidden = !codeHidden;
      state = 'revealed';
      render();
    });

    wireSeg(document.querySelector('[data-seg-active]'), (v) => {
      state = v;
      codeHidden = (v === 'hidden');
      render();
    });

    render();
  }

  /* ── boot ── */
  document.addEventListener('DOMContentLoaded', () => {
    paintIcons(document);
    wireEntry();
    wireSchedule();
    wireActive();
  });
})();
