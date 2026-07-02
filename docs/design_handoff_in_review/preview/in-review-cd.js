/* ═══════════════════════════════════════════════════
   Replant Admin — "Mark as in review" CD · interactions
   Vanilla, class-based. Founder rulings LOCKED.
   Tweaks expose visual forks only — copy is fixed.
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = window.__TWEAKS || {
    slaBanner: 'neutral',  // neutral | blue
    staleness: 'quiet',    // quiet | bold
    flagGlyph: 'flag',     // flag | none
    stateDots: 'colored',  // colored | plain
  };

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const FLAG = '<svg class="flag" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2v12M4 3h7l-2 2.5L11 8H4"/></svg>';

  /* ── apply visual tweaks ── */
  function applyTweaks() {
    // SLA banner hue
    $$('[data-sla-banner]').forEach(b => {
      b.classList.toggle('sla-agg-neutral', T.slaBanner === 'neutral');
      b.classList.toggle('sla-agg-blue', T.slaBanner === 'blue');
    });
    // staleness — bold restores the rejected alarm treatment for comparison
    document.body.classList.toggle('stale-bold', T.staleness === 'bold');
    // flag glyph
    document.body.classList.toggle('no-flag', T.flagGlyph === 'none');
    // state pill dots — colored pins vs plain neutral circle
    document.body.classList.toggle('state-dots-colored', T.stateDots === 'colored');
  }

  /* ── Force-unmark modal variants ── */
  const FU = {
    'fu-default': { title: 'Force-unmark Maria S?', sub: 'Founder action · audit-logged', stale: false, reason: '', supp: '', day25: false },
    'fu-stale':   { title: 'Force-unmark Maria S?', sub: 'Founder action · audit-logged', stale: true,  reason: '', supp: '', day25: false },
    'fu-day25':   { title: "Day 25 — re-route Maria S's claim?", sub: 'Auto-routing to Founder · audit-logged', stale: false, reason: 'Case re-routed', supp: 'Day 25 auto-routing — claim transferred to Founder per protocol.', day25: true },
  };

  function fuMarkup(cfg) {
    const intro = cfg.day25
      ? 'This submission reached day 25 and is routing to the Founder per protocol. Maria S will be notified via Slack burst-alert and in-app banner.'
      : "This removes Maria S's claim. They'll be notified via Slack burst-alert and in-app banner. Reach out to them first when possible — the 24-hour grace protocol is part of how we steward each other's work.";
    const aal2 = cfg.stale
      ? `<div class="gate warn"><span class="gate-left"><svg class="ic" viewBox="0 0 16 16"><path d="M8 1.5 1.5 13.5h13L8 1.5Z"/><path d="M8 6v3.5"/></svg>Re-authentication required</span><button class="reauth" data-reauth>Re-authenticate</button></div>`
      : `<div class="gate ok"><svg class="ic" viewBox="0 0 16 16"><path d="M3 8.5 6.5 12 13 4"/></svg>Re-authenticated 2 minutes ago</div>`;
    const reasonOpts = ['Admin off > 7 days', 'Admin offboarded', 'Case re-routed', 'Other']
      .map(o => `<option ${o === cfg.reason ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const reasonSel = cfg.day25
      ? `<select class="sel" disabled><option selected>Case re-routed</option></select>`
      : `<select class="sel" data-fu-reason><option value="">— select —</option>${reasonOpts}</select>`;
    return `
      <div class="mdl" style="max-width:470px">
        <div class="mdl-head">
          <span class="mh-glyph red"><svg class="ic" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg></span>
          <div class="mh-text"><div class="mdl-title">${esc(cfg.title)}</div><div class="mdl-sub">${esc(cfg.sub)}</div></div>
        </div>
        <div class="mdl-body" style="gap:13px">
          <p style="font-family:var(--rp-sans);font-size:12.5px;color:var(--rp-muted-2);font-weight:300;line-height:1.6">${esc(intro)}</p>
          ${aal2}
          <div class="fld"><span class="fld-label">Type "Maria S" to confirm</span><input class="inp ct-typed" data-fu-name placeholder="Maria S" autocomplete="off"></div>
          <div class="fld"><span class="fld-label">Reason <span class="req">required</span></span>${reasonSel}</div>
          <div class="fld"><span class="fld-label">Audit supplement <span class="req">required</span><span class="hint" data-fu-hint>min 30</span></span><textarea class="txt" data-fu-supp>${esc(cfg.supp)}</textarea><div class="charcount ${cfg.supp.length >= 30 ? 'ok' : 'under'}" data-fu-count>${cfg.supp.length} / 30 (min)</div></div>
        </div>
        <div class="mdl-foot"><button class="btn btn-ghost" data-close>Cancel</button><div class="mf-spacer"></div><button class="btn btn-danger" data-fu-submit disabled>${cfg.day25 ? 'Re-route claim' : 'Force unmark'}</button></div>
      </div>`;
  }

  function wireForceUnmark(ov, cfg) {
    const nameI = $('[data-fu-name]', ov);
    const reasonS = $('[data-fu-reason]', ov);
    const suppT = $('[data-fu-supp]', ov);
    const count = $('[data-fu-count]', ov);
    const submit = $('[data-fu-submit]', ov);
    const reauth = $('[data-reauth]', ov);
    let aal2Fresh = !cfg.stale;

    function recompute() {
      const nameOk = (nameI?.value.trim() === 'Maria S');
      const reasonOk = cfg.day25 ? true : (reasonS && reasonS.value !== '');
      const suppLen = (suppT?.value || '').trim().length;
      const suppOk = suppLen >= 30;
      if (count) {
        count.textContent = `${suppLen} / 30 (min)`;
        count.className = 'charcount ' + (suppOk ? 'ok' : 'under');
      }
      if (submit) submit.disabled = !(nameOk && reasonOk && suppOk && aal2Fresh);
    }
    nameI && nameI.addEventListener('input', recompute);
    reasonS && reasonS.addEventListener('change', recompute);
    suppT && suppT.addEventListener('input', recompute);
    if (reauth) reauth.addEventListener('click', () => {
      aal2Fresh = true;
      const gate = reauth.closest('.gate');
      gate.className = 'gate ok';
      gate.innerHTML = '<svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8.5 6.5 12 13 4"/></svg>Re-authenticated just now';
      recompute();
    });
    recompute();
  }

  function openModal(name) {
    const ov = $(`.ov[data-modal="${name}"]`);
    if (!ov || !FU[name]) return;
    const cfg = FU[name];
    ov.innerHTML = fuMarkup(cfg);
    ov.classList.add('open');
    wireForceUnmark(ov, cfg);
    $$('[data-close]', ov).forEach(b => b.addEventListener('click', () => closeModal(ov)));
  }
  function closeModal(ov) { ov.classList.remove('open'); ov.innerHTML = ''; }

  function initOpeners() {
    $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.getAttribute('data-open'))));
    $$('.ov').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov); }));
    window.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.ov.open').forEach(closeModal); });
  }

  /* ── claim-check toggle demo (unclaimed → mine, in the Ask 1 frame only) ── */
  function initClaimDemo() {
    $$('.claim-check').forEach(c => c.addEventListener('click', e => {
      e.preventDefault();
      const box = $('.box', c);
      if (box) box.innerHTML = box.innerHTML ? '' : '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="var(--rp-sky)" stroke-width="2"><path d="M3 8.5 6.5 12 13 4"/></svg>';
    }));
  }

  /* ═══════════════════════════════════════════════════
     Tweaks host protocol
  ═══════════════════════════════════════════════════ */
  const refreshers = [];
  function rerenderAll() { applyTweaks(); refreshers.forEach(f => f()); }
  function setTweak(key, val) {
    T[key] = val;
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*'); } catch (_) {}
    rerenderAll();
  }
  function mountTweaks() {
    const panel = document.getElementById('tweaks'); if (!panel) return;
    panel.querySelectorAll('[data-tw-seg]').forEach(seg => {
      const key = seg.getAttribute('data-tw-seg');
      const opts = JSON.parse(seg.getAttribute('data-opts'));
      const render = () => { seg.innerHTML = opts.map(o => `<button data-v="${esc(o.v)}" class="${T[key] === o.v ? 'on' : ''}">${esc(o.label)}</button>`).join(''); };
      seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setTweak(key, b.getAttribute('data-v')); });
      refreshers.push(render); render();
    });
    const close = panel.querySelector('.tw-close');
    if (close) close.addEventListener('click', () => { panel.classList.remove('show'); try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (_) {} });
    const head = panel.querySelector('.tw-head');
    let drag = null;
    head.addEventListener('mousedown', e => { if (e.target.closest('.tw-close')) return; drag = { x: e.clientX, y: e.clientY, r: panel.getBoundingClientRect() }; e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (!drag) return; panel.style.left = (drag.r.left + e.clientX - drag.x) + 'px'; panel.style.top = (drag.r.top + e.clientY - drag.y) + 'px'; panel.style.right = 'auto'; });
    window.addEventListener('mouseup', () => { drag = null; });
    window.addEventListener('message', e => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') panel.classList.add('show');
      else if (d.type === '__deactivate_edit_mode') panel.classList.remove('show');
    });
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (_) {}
  }

  function boot() {
    applyTweaks();
    initOpeners();
    initClaimDemo();
    mountTweaks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
