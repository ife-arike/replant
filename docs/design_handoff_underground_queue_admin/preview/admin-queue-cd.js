/* ═══════════════════════════════════════════════════
   Replant — Underground Verification Queue · Admin CD
   Interactions. Vanilla, class-based. Founder rulings LOCKED.
   Tweaks expose visual forks only — copy is fixed.
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = window.__TWEAKS || {
    slaPill: 'compact',     // both | compact  — Founder default: day only
    statePill: 'dot',       // dot | plain     — Founder default: dot + label
    relayStyle: 'cells',    // cells | single  — Founder default: 4 cells
    density: 'comfortable', // comfortable | compact — Founder default
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ── SLA band derivation (locked thresholds 5/15/25/30) ── */
  function slaBand(day) {
    if (day >= 30) return { cls: 'band-past',    msg: 'past window — auto-reject pending' };
    if (day >= 25) return { cls: 'band-red',     msg: 'final overdue' };
    if (day >= 15) return { cls: 'band-amber',   msg: 'final by day 25' };
    if (day >= 5)  return { cls: 'band-yellow',  msg: 'decision-or-info by day 15' };
    return { cls: 'band-neutral', msg: 'contact within day 5' };
  }
  function slaPillHTML(day) {
    const b = slaBand(day);
    const msg = T.slaPill === 'both' ? `<span class="sep">·</span><span class="msg">${b.msg}</span>` : '';
    return `<span class="sla-pill ${b.cls}"><span class="dot"></span><span class="dn">Day ${day}</span>${msg}</span>`;
  }

  const STATE = {
    untouched: { cls: 'state-untouched', label: 'Untouched' },
    await:     { cls: 'state-await',     label: 'Awaiting confirm' },
    info:      { cls: 'state-info',      label: 'Info requested' },
    locked:    { cls: 'state-locked',    label: 'Locked by A. Mensah' },
    stalled:   { cls: 'state-stalled',   label: 'Stalled · clock paused' },
  };
  function statePillHTML(key) {
    const s = STATE[key]; if (!s) return '';
    const dot = T.statePill === 'dot' ? '<span class="sd"></span>' : '';
    return `<span class="state ${s.cls}">${dot}${esc(s.label)}</span>`;
  }

  function renderRows() {
    $$('[data-sla]').forEach(td => { td.innerHTML = slaPillHTML(parseInt(td.getAttribute('data-sla'), 10)); });
    $$('[data-state]').forEach(td => { td.innerHTML = statePillHTML(td.getAttribute('data-state')); });
  }

  /* ── Tabs (live on the Pending frame) ── */
  function initTabs() {
    const bar = $('[data-tabs]'); if (!bar) return;
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      $$('[data-tab]', bar).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  }

  /* ── Filters collapse/expand ── */
  function initFilters() {
    const wrap = $('[data-filters]'); if (!wrap) return;
    const toggle = $('[data-filters-toggle]', wrap);
    toggle.addEventListener('click', () => wrap.classList.toggle('q-filters-collapsed'));
    $$('.q-chip', wrap).forEach(chip => chip.addEventListener('click', () => {
      chip.classList.toggle('on');
      const ck = $('.ck', chip); if (ck) ck.textContent = chip.classList.contains('on') ? '✓' : '○';
    }));
    const clear = $('.q-filters-clear', wrap);
    if (clear) clear.addEventListener('click', () => $$('.q-chip', wrap).forEach(c => { c.classList.remove('on'); const ck = $('.ck', c); if (ck) ck.textContent = '○'; }));
  }

  /* ── Aggregate bucket → filter rows ── */
  function initAggregate() {
    const agg = $('[data-agg]'); if (!agg) return;
    const rows = $$('[data-rows] tr');
    agg.addEventListener('click', e => {
      const s = e.target.closest('[data-bucket]'); if (!s) return;
      const active = s.classList.toggle('is-active-filter');
      $$('[data-bucket]', agg).forEach(x => { if (x !== s) x.classList.remove('is-active-filter'); });
      const b = parseInt(s.getAttribute('data-bucket'), 10);
      rows.forEach(r => {
        if (!active) { r.style.display = ''; return; }
        const day = parseInt(r.getAttribute('data-day'), 10);
        r.style.display = day > b ? '' : 'none';
      });
      s.style.textDecoration = active ? 'underline' : '';
    });
  }

  /* ═══════════════════════════════════════════════════
     MODALS
  ═══════════════════════════════════════════════════ */
  const CHANNELS = ['Signal', 'Wire', 'In-person', 'Letter', 'Referring-leader-relay'];
  const chanOpts = CHANNELS.map(c => `<option>${c}</option>`).join('');

  const MODALS = {
    verify: () => `
      <div class="mdl">
        <div class="mdl-head">
          <span class="mh-glyph green"><svg class="ic" viewBox="0 0 16 16"><path d="M3 8.5 6.5 12 13 4"/></svg></span>
          <div class="mh-text"><div class="mdl-title">Propose verify · UG-9E22</div><div class="mdl-sub">You are Admin A · this awaits Admin B</div></div>
        </div>
        <div class="mdl-body">
          <div class="propose verify" style="margin:0;border:none">
            <div class="propose-body" style="padding:0;gap:15px">
              <div class="fld"><span class="fld-label">Admin notes <span class="req">required</span><span class="hint ok">42 / 30 min ✓</span></span><textarea class="txt">Identity confirmed by Signal call + network referral. Leader chose Hidden. Ready to verify.</textarea></div>
              <div class="fld"><span class="fld-label">Contact channel <span class="req">required</span></span><select class="sel">${chanOpts}</select></div>
              <div class="fld"><span class="fld-label">Evidence tier <span class="req">required</span></span><div class="radio-row"><label class="radio-opt"><span class="rd"></span>T1 · referral</label><label class="radio-opt on"><span class="rd"></span>T2 · call</label></div></div>
            </div>
          </div>
        </div>
        <div class="mdl-foot"><div class="mf-spacer"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-approve" data-close>Submit proposal</button></div>
      </div>`,

    reject: () => `
      <div class="mdl">
        <div class="mdl-head">
          <span class="mh-glyph red"><svg class="ic" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg></span>
          <div class="mh-text"><div class="mdl-title">Propose reject · UG-5F07</div><div class="mdl-sub">Trauma-aware · the leader never sees "rejected"</div></div>
        </div>
        <div class="mdl-body">
          <div class="fld"><span class="fld-label">Rejection reason <span class="req">required</span></span>
            <select class="sel">
              <option>identity_unconfirmed — team unable to confirm your identity</option>
              <option>church_unconfirmed — unable to confirm the church through references</option>
              <option selected>insufficient_evidence — not enough information at this time</option>
              <option>contact_unreachable — unable to reach you through channels provided</option>
              <option>out_of_scope — appears to fall outside Replant's scope</option>
              <option>safety_concern — unable to verify at this time</option>
              <option>duplicate_registration — another registration is being reviewed</option>
              <option>other — requires rationale</option>
            </select>
          </div>
          <div class="fld"><span class="fld-label">Rationale <span class="req">required</span><span class="hint">≥60 for "other"</span></span><textarea class="txt">Two contact attempts over Signal and Letter unanswered; referral could not corroborate the fellowship. No safety signal.</textarea><div class="txt-meta"><span>internal only · never shown to leader</span><span class="c-ok">132 chars</span></div></div>
        </div>
        <div class="mdl-foot"><div class="mf-spacer"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-reject" data-close>Submit proposal</button></div>
      </div>`,

    confirm: () => `
      <div class="mdl">
        <div class="mdl-head">
          <span class="mh-glyph green"><svg class="ic" viewBox="0 0 16 16"><path d="M3 8.5 6.5 12 13 4"/></svg></span>
          <div class="mh-text"><div class="mdl-title">Confirm verification · UG-9E22</div><div class="mdl-sub">Proposed by A. Mensah · you are Admin B</div></div>
          <span class="mdl-ttl-badge"><span class="ttl" data-ttl="live"><svg class="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4"/><path d="M8 4.5V8l2.4 1.6"/></svg><b>71:48:12</b> to confirm</span></span>
        </div>
        <div class="mdl-body">
          <div class="recap">
            <div class="recap-row"><span class="recap-k">Proposal</span><span class="recap-v">Verify · evidence tier <b>T2 · call</b> · channel <b>Signal</b></span></div>
            <div class="recap-row"><span class="recap-k">A's notes</span><span class="recap-v"><span class="quote">"Identity confirmed by Signal call + network referral. Leader chose Hidden. Ready to verify."</span></span></div>
            <div class="recap-row"><span class="recap-k">Proposed by</span><span class="recap-v"><span class="by">A. Mensah</span> · 2026-06-22 14:11</span></div>
          </div>
          <div class="leader-preview"><div class="lp-label">Exact text the leader will see if you confirm</div><div class="lp-text">"Your church is verified. You are not standing alone."</div></div>
        </div>
        <div class="mdl-foot"><button class="btn btn-ghost btn-sm" data-goto="decline">Decline · counter-propose</button><div class="mf-spacer"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-approve" data-close>Confirm verification</button></div>
      </div>`,

    decline: () => `
      <div class="mdl" style="max-width:480px">
        <div class="mdl-head">
          <span class="mh-glyph amber"><svg class="ic" viewBox="0 0 16 16"><path d="M8 14V9M3 9l5-5 5 5"/></svg></span>
          <div class="mh-text"><div class="mdl-title">Decline this proposal</div><div class="mdl-sub">Returns the row to Untouched · not a rejection of the church</div></div>
        </div>
        <div class="mdl-body">
          <div class="specs-note amber" style="margin:0"><div class="specs-note-label">What this does</div><div class="specs-note-body">You're declining <strong>A. Mensah's proposal</strong>, not the church. The row returns to <strong>Untouched</strong> and A is notified with your counter-notes. The church's standing is unchanged.</div></div>
          <div class="fld"><span class="fld-label">Counter-notes <span class="req">required</span><span class="hint">visible to A only</span></span><textarea class="txt" placeholder="Tell A why — what you'd want to see before this is confirmed."></textarea></div>
        </div>
        <div class="mdl-foot"><div class="mf-spacer"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-amber" data-close>Decline &amp; return to Untouched</button></div>
      </div>`,

    visibility: () => `
      <div class="mdl" style="max-width:520px">
        <div class="mdl-head">
          <span class="mh-glyph sky"><svg class="ic" viewBox="0 0 16 16"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2"/></svg></span>
          <div class="mh-text"><div class="mdl-title">Visibility override</div><div class="mdl-sub">Two-eyes · requires relay token</div></div>
        </div>
        <div class="mdl-body">
          <div class="fld"><span class="fld-label">Direction <span class="req">required</span></span>
            <div class="dir-seg" data-dir>
              <label class="dir-opt on" data-dir-opt="h2v"><span class="do-dir">Hidden <span class="dir-arrow">→</span> Visible</span><span class="do-sub">Name becomes listed; location stays hidden.</span></label>
              <label class="dir-opt" data-dir-opt="v2h"><span class="do-dir">Visible <span class="dir-arrow">→</span> Hidden</span><span class="do-sub">Region only; name withheld.</span></label>
            </div>
          </div>
          <div class="fld"><span class="fld-label">Contact channel <span class="req">required</span></span><select class="sel">${chanOpts}</select></div>
          <div class="relay">
            <span class="fld-label">4-digit relay token <span class="req">required</span></span>
            <p class="relay-note">Type the <b>4-digit code the leader spoke during the verification call.</b> This proves you reached the real leader, not an impersonator.</p>
            <div data-relay-mount></div>
          </div>
          <div class="fld"><span class="fld-label">Notes <span class="req">required</span><span class="hint">≥40 char</span></span><textarea class="txt">Leader confirmed by Signal that they want the church listed as Visible. Token matched.</textarea></div>
          <label class="ack on" data-ack><span class="ackbox"></span><span class="ack-text" data-ack-text>I confirm the leader requested <b>Hidden → Visible</b> directly, and the relay token matched what they spoke on the call.</span></label>
        </div>
        <div class="mdl-foot"><div class="mf-spacer"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-close>Propose override</button></div>
      </div>`,

    harddelete: () => `
      <div class="mdl" style="max-width:480px">
        <div class="mdl-head">
          <span class="mh-glyph red"><svg class="ic" viewBox="0 0 16 16"><path d="M3 4h10M6 4V2.5h4V4M5 4l.6 9h4.8L11 4"/></svg></span>
          <div class="mh-text"><div class="mdl-title">Hard-delete · permanent</div><div class="mdl-sub">One church at a time · no bulk operation</div></div>
        </div>
        <div class="mdl-body">
          <div class="specs-note red" style="margin:0"><div class="specs-note-label">This cannot be undone</div><div class="specs-note-body">Hard-delete permanently purges this church and its encrypted record. There is no reinstate after this. Type the church code below to confirm you mean this exact church.</div></div>
          <div class="confirm-type" data-confirm-type>
            <span class="ct-prompt">Type <b>RPL-12345</b> to confirm.</span>
            <div class="ct-target">RPL-12345</div>
            <input class="inp" type="text" placeholder="RPL-•••••" autocomplete="off" data-ct-input>
            <div class="ct-state no" data-ct-state>Awaiting exact match</div>
          </div>
        </div>
        <div class="mdl-foot"><div class="mf-spacer"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger" data-ct-submit disabled>Hard-delete church</button></div>
      </div>`,
  };

  let ttlTimer = null;

  function openModal(name) {
    const ov = document.querySelector(`.ov[data-modal="${name}"]`);
    if (!ov || !MODALS[name]) return;
    ov.innerHTML = MODALS[name]();
    ov.classList.add('open');
    // wire dynamic bits per modal
    if (name === 'visibility') { mountRelay(ov); initDir(ov); initAck(ov); }
    if (name === 'harddelete') initConfirmType(ov);
    if (name === 'confirm') startTtl(ov);
    // close handlers
    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(ov)));
    ov.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => { closeModal(ov); openModal(b.getAttribute('data-goto')); }));
  }
  function closeModal(ov) { ov.classList.remove('open'); ov.innerHTML = ''; if (ttlTimer) { clearInterval(ttlTimer); ttlTimer = null; } }

  /* ── relay token (4 cells | single field) ── */
  function relayHTML() {
    if (T.relayStyle === 'single') {
      return `<input class="inp" inputmode="numeric" maxlength="4" placeholder="••••" style="font-family:var(--mono);letter-spacing:0.5em;text-align:center;font-size:22px;max-width:160px" data-relay-single>`;
    }
    return `<div class="relay-cells" data-relay-cells>${[0,1,2,3].map(i => `<div class="relay-cell empty${i===0?' cursor':''}" data-i="${i}">•</div>`).join('')}</div>`;
  }
  function mountRelay(root) {
    const mount = root.querySelector('[data-relay-mount]'); if (!mount) return;
    mount.innerHTML = relayHTML();
    if (T.relayStyle === 'cells') {
      const cells = $$('.relay-cell', mount);
      let buf = '';
      const paint = () => cells.forEach((c, i) => {
        c.classList.remove('cursor');
        if (buf[i]) { c.textContent = buf[i]; c.classList.add('filled'); c.classList.remove('empty'); }
        else { c.textContent = '•'; c.classList.add('empty'); c.classList.remove('filled'); }
        if (i === buf.length && buf.length < 4) c.classList.add('cursor');
      });
      // make it typable via a hidden input trick: focus on click, listen keydown
      mount.setAttribute('tabindex', '0');
      mount.style.outline = 'none';
      mount.addEventListener('click', () => mount.focus());
      mount.addEventListener('keydown', e => {
        if (/^[0-9]$/.test(e.key) && buf.length < 4) { buf += e.key; paint(); e.preventDefault(); }
        else if (e.key === 'Backspace') { buf = buf.slice(0, -1); paint(); e.preventDefault(); }
      });
      paint();
      setTimeout(() => mount.focus(), 60);
    }
  }
  function initDir(root) {
    const seg = root.querySelector('[data-dir]'); if (!seg) return;
    const ackText = root.querySelector('[data-ack-text]');
    seg.addEventListener('click', e => {
      const o = e.target.closest('[data-dir-opt]'); if (!o) return;
      $$('[data-dir-opt]', seg).forEach(x => x.classList.remove('on'));
      o.classList.add('on');
      if (ackText) {
        const v = o.getAttribute('data-dir-opt');
        const dir = v === 'h2v' ? 'Hidden → Visible' : 'Visible → Hidden';
        ackText.innerHTML = `I confirm the leader requested <b>${dir}</b> directly, and the relay token matched what they spoke on the call.`;
      }
    });
  }
  function initAck(root) {
    $$('[data-ack]', root).forEach(a => a.addEventListener('click', () => a.classList.toggle('on')));
  }

  /* ── hard-delete typed confirm ── */
  function initConfirmType(root) {
    const wrap = root.querySelector('[data-confirm-type]'); if (!wrap) return;
    const input = $('[data-ct-input]', wrap);
    const state = $('[data-ct-state]', wrap);
    const submit = root.querySelector('[data-ct-submit]');
    const target = 'RPL-12345';
    input.addEventListener('input', () => {
      const v = input.value.trim().toUpperCase();
      const match = v === target;
      input.classList.toggle('match', match);
      state.textContent = match ? 'Exact match — confirmed' : (v ? 'Does not match' : 'Awaiting exact match');
      state.className = 'ct-state ' + (match ? 'yes' : 'no');
      submit.disabled = !match;
    });
  }

  /* ── live 72h TTL countdown ── */
  function startTtl(root) {
    const el = root.querySelector('[data-ttl="live"] b'); if (!el) return;
    let total = 71 * 3600 + 48 * 60 + 12;
    const tick = () => {
      total = Math.max(0, total - 1);
      const h = String(Math.floor(total / 3600)).padStart(2, '0');
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      el.textContent = `${h}:${m}:${s}`;
    };
    if (ttlTimer) clearInterval(ttlTimer);
    ttlTimer = setInterval(tick, 1000);
  }

  /* ── decline from the static confirm modal in §5 frame ── */
  function initStaticConfirm() {
    const b = $('[data-decline-from-confirm]');
    if (b) b.addEventListener('click', () => openModal('decline'));
  }

  /* ── join-code state machine ── */
  function initJcsm() {
    const sm = $('[data-jcsm]'); if (!sm) return;
    const go = $('[data-jc-go]', sm);
    if (go) go.addEventListener('click', () => {
      $$('[data-jc]', sm).forEach(s => s.classList.remove('active-state'));
      sm.querySelector('[data-jc="revealed"]').classList.add('active-state');
    });
  }

  /* ── open triggers ── */
  function initOpeners() {
    $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.getAttribute('data-open'))));
    $$('.ov').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov); }));
    window.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.ov.open').forEach(closeModal); });
  }

  /* ═══════════════════════════════════════════════════
     Tweaks
  ═══════════════════════════════════════════════════ */
  function applyDensity() {
    document.body.classList.toggle('density-compact', T.density === 'compact');
  }
  const refreshers = [];
  function rerenderAll() { renderRows(); applyDensity(); refreshers.forEach(f => f()); }

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

  /* ── static in-document interactive bits (§6 visibility frame) ── */
  function initStaticInteractive() {
    $$('.doc .frame').forEach(frame => {
      if (frame.querySelector('[data-relay-mount]')) mountRelay(frame);
      if (frame.querySelector('[data-dir]')) initDir(frame);
      $$('[data-ack]', frame).forEach(a => a.addEventListener('click', () => a.classList.toggle('on')));
    });
  }

  /* ── boot ── */
  function boot() {
    renderRows();
    applyDensity();
    initTabs();
    initFilters();
    initAggregate();
    initOpeners();
    initStaticConfirm();
    initStaticInteractive();
    initJcsm();
    mountTweaks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
