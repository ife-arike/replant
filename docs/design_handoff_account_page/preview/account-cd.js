/* ═══════════════════════════════════════════════════
   Replant Admin — Account page · CD interactions
   Renders the admin shell + account page, wires the
   View-as tier/TOTP switch and the Tweaks host protocol.
   Vanilla, class-based. Copy LOCKED; tweaks are visual.
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = window.__TWEAKS || {
    tags:   'show',    // show | hide
    ribbon: 'show',    // show | hide
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // current view-as state
  const V = { tier: 'admin', totp: 'not' };

  const TIERS = {
    admin:    { label: 'Admin',       chip: 'tier-admin',    name: 'Asha Bello',   initials: 'AB', email: 'asha.bello@projectreplant.org' },
    super:    { label: 'Super admin', chip: 'tier-super',    name: 'Maria Santos', initials: 'MS', email: 'maria.santos@projectreplant.org' },
    overseer: { label: 'Overseer',    chip: 'tier-overseer', name: 'Ruth Adeyemi', initials: 'RA', email: 'ruth@projectreplant.org' },
  };

  /* ── icons ── */
  const IC = {
    network: '<path d="M2 3h5v5H2zM9 3h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"/>',
    church:  '<path d="M8 1v4M6 3h4M3 14V7l5-3 5 3v7M6 14v-3h4v3"/>',
    queue:   '<path d="M2 4h12M2 8h12M2 12h8"/>',
    shield:  '<path d="M8 2 3 4v4c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 2Z"/>',
    cry:     '<path d="M3 7a5 5 0 0 1 10 0c0 4-5 7-5 7s-5-3-5-7Z"/>',
    pastoral:'<path d="M8 2v12M3 6l5-4 5 4"/>',
    flag:    '<path d="M4 2v12M4 3h7l-2 2.5L11 8H4"/>',
    scripture:'<path d="M3 3h7a2 2 0 0 1 2 2v8H5a2 2 0 0 0-2 2z"/>',
    megaphone:'<path d="M3 7v2l8 3V4zM3 7H2v2h1"/>',
    scrub:   '<path d="M3 13l4-9 6 2-3 7zM3 13h8"/>',
    log:     '<path d="M4 2h6l3 3v9H4zM10 2v3h3"/>',
    team:    '<circle cx="6" cy="6" r="2.5"/><path d="M2 13a4 4 0 0 1 8 0M11 5a2 2 0 0 1 0 4"/>',
    grant:   '<path d="M8 2v8M5 7l3 3 3-3M3 13h10"/>',
    out:     '<path d="M6 14H3V2h3M10 11l3-3-3-3M13 8H6"/>',
  };
  const svg = (p, w = 14) => `<svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:${w}px;height:${w}px">${p}</svg>`;

  /* ── nav config (mirrors Shell.jsx; tier classes hide per tier) ── */
  const NAV = [
    { label: 'Network', items: [
      { ic: 'network', t: 'Network Overview' }, { ic: 'church', t: 'Church Management' } ] },
    { label: 'Operations', items: [
      { ic: 'queue', t: 'Verification Queue', n: 7 }, { ic: 'shield', t: 'Underground Oversight' },
      { ic: 'cry', t: 'Heartcry Inbox', n: 5 }, { ic: 'pastoral', t: 'Pastoral Signals' },
      { ic: 'flag', t: 'Flagged Messages' } ] },
    { label: 'Content', items: [
      { ic: 'scripture', t: 'Daily Scripture' }, { ic: 'megaphone', t: 'Announcements' } ] },
    { label: 'Compliance', items: [
      { ic: 'scrub', t: 'PII Scrub History' }, { ic: 'log', t: 'Audit Log' },
      { ic: 'team', t: 'Team Management', cls: 'nav-team' },
      { ic: 'grant', t: 'Admin Tier', cls: 'nav-admintier' } ] },
  ];

  function navHTML() {
    return NAV.map(sec => `
      <div class="adm-nav-label">${sec.label}</div>
      <nav class="adm-nav">
        ${sec.items.map(it => `
          <a class="adm-nav-item ${it.cls || ''}">${svg(IC[it.ic], 13)}<span>${esc(it.t)}</span>${it.n ? `<span class="count">${it.n}</span>` : ''}</a>
        `).join('')}
      </nav>`).join('');
  }

  /* ── shell foot: the click target ── */
  function footHTML(tier) {
    const d = TIERS[tier];
    return `
      <div class="adm-foot">
        <div class="adm-logout">${svg(IC.out, 13)}<span>Sign out</span></div>
        <a class="adm-id">
          <span class="adm-id-avatar">${d.initials}</span>
          <span class="adm-id-main">
            <span class="adm-id-name">${esc(d.name)}</span>
            <span class="adm-id-tier ${d.chip}"><span class="tc-dot" style="width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block"></span>${esc(d.label)}</span>
          </span>
          <span class="adm-id-chev">›</span>
        </a>
      </div>`;
  }

  /* ═══════════ account page content ═══════════ */
  function tag() { return ''; }

  function headHTML(tier) {
    const d = TIERS[tier];
    return `
      <div class="acct-head">
        <span class="acct-head-avatar">${d.initials}</span>
        <div class="acct-head-main">
          <div class="acct-head-name">${esc(d.name)}</div>
          <div class="acct-head-row">
            <span class="tier-chip ${d.chip}"><span class="tc-dot"></span>${esc(d.label)}</span>
            <span class="acct-head-email">${esc(d.email)}</span>
            <span class="readonly-tag">read-only</span>
          </div>
          <div class="acct-head-meta">Member since <b>March 2025</b> · last signed in <b>2 hours ago</b></div>
        </div>
      </div>`;
  }

  function totpStatusHTML() {
    return `
      <div class="totp-status">
        <span class="totp-shield">${svg('<path d="M8 2 3 4v4c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 2Z"/><path d="M6 8l1.5 1.5L11 6"/>', 20)}</span>
        <div class="totp-main">
          <div class="totp-headline">Two-factor authentication is on</div>
          <div class="totp-sub">Your account is protected by a time-based code from your authenticator app. You'll be asked for it on sign-in and before sensitive actions.</div>
          <div class="totp-detail-grid">
            <div class="totp-dt"><span class="k">Authenticator</span><span class="v">Aegis · added device</span></div>
            <div class="totp-dt"><span class="k">Enrolled</span><span class="v">12 March 2025</span></div>
            <div class="totp-dt"><span class="k">Last verified</span><span class="v">Today · 2 hours ago</span></div>
            <div class="totp-dt"><span class="k">Recovery</span><span class="v">Founding team (manual)</span></div>
          </div>
          <div class="totp-actions">
            <button class="btn btn-ghost btn-sm">Reset TOTP</button>
          </div>
          <div class="totp-reset-note">Resetting removes your current authenticator and walks you through setup again from scratch. You'll need your authenticator app on hand.</div>
        </div>
      </div>`;
  }

  function totpEnrollHTML(compact) {
    // a faithful compact recreation of TotpEnrollmentScreen's 3 steps
    return `
      <div class="totp-enroll-embed-note">${svg('<path d="M3 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M6 8l1.5 1.5L10 7"/>', 12)}<span><b>Existing component · rendered verbatim.</b> <code>TotpEnrollmentScreen.jsx</code> — unchanged by this CD, only hosted here. Representation below is for context.</span></div>
      <div class="totp-enroll-lead">Set up an authenticator app to protect your account. This takes about two minutes and is required before you can reach sensitive screens.</div>
      <div class="enr-step">
        <span class="enr-badge">1</span>
        <div class="enr-step-main">
          <div class="enr-step-title">Choose an authenticator app</div>
          <div class="enr-step-sub">Pick a local-only authenticator. We recommend one app per platform.</div>
          <div class="enr-app-grid">
            <div class="enr-app"><div class="plat">Android</div><div class="name">Aegis Authenticator</div><div class="meta">Open-source · local-only</div></div>
            <div class="enr-app"><div class="plat">iOS</div><div class="name">Ente Auth</div><div class="meta">or Tofu Authenticator</div></div>
          </div>
          <div class="enr-advisory neutral">${svg('<circle cx="8" cy="8" r="6.4"/><path d="M8 5v.4M8 7.5v4"/>', 13)}<div><b>Avoid apps that sync to the cloud.</b> Cloud-synced codes may be accessible to third parties under legal compulsion.</div></div>
          <div class="enr-advisory warn">${svg('<path d="M8 2 1.5 13.5h13L8 2Z"/><path d="M8 6.5v3.5"/>', 13)}<div><b>Enroll on two physical devices if possible</b> — a primary and a backup, so a lost phone doesn't lock you out.</div></div>
        </div>
      </div>
      <div class="enr-step">
        <span class="enr-badge">2</span>
        <div class="enr-step-main">
          <div class="enr-step-title">Scan the QR code</div>
          <div class="enr-step-sub">Open your authenticator and add a new account by scanning this code.</div>
          <div class="enr-qr-row">
            <div class="enr-qr">${qrSvg()}</div>
            <div>
              <div class="enr-key-label">Can't scan? Enter this key manually</div>
              <div class="enr-key"><span>K5J3 9Q2P X7M4 D8WZ</span><button class="btn btn-ghost btn-sm" style="height:26px">Copy</button></div>
              <div style="font-family:var(--rp-mono);font-size:10.5px;color:var(--rp-muted-2);margin-top:9px">Issuer: Replant Admin</div>
            </div>
          </div>
        </div>
      </div>
      <div class="enr-step" style="margin-bottom:0">
        <span class="enr-badge">3</span>
        <div class="enr-step-main">
          <div class="enr-step-title">Confirm setup</div>
          <div class="enr-step-sub">Enter the 6-digit code from your app to confirm setup.</div>
          <div class="enr-code-cells">
            <span class="enr-cell filled">4</span><span class="enr-cell filled">1</span><span class="enr-cell cursor">9</span><span class="enr-cell">·</span><span class="enr-cell">·</span><span class="enr-cell">·</span>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary btn-sm" style="height:34px">Complete setup</button></div>
        </div>
      </div>`;
  }

  // deterministic faux-QR (visual only)
  function qrSvg() {
    let cells = '';
    const n = 21, seed = 1234567;
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
      const on = finder ? ((x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) ? 1 : ((x >= n - 7) && (x === n - 1 || x === n - 7 || y === 0 || y === 6 || (x >= n - 5 && x <= n - 3 && y >= 2 && y <= 4)) ? 1 : ((y >= n - 7) && (x === 0 || x === 6 || y === n - 1 || y === n - 7 || (x >= 2 && x <= 4 && y >= n - 5 && y <= n - 3)) ? 1 : 0))) : (rnd() > 0.55 ? 1 : 0);
      if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return `<svg viewBox="0 0 ${n} ${n}" fill="#06151f" shape-rendering="crispEdges">${cells}</svg>`;
  }

  function sectionsHTML(tier) {
    return `
      <div class="acct">
        <div class="acct-section">
          <div class="acct-eyebrow"><span class="lbl">Identity</span>${tag('baseline')}</div>
          ${headHTML(tier)}
        </div>

        <div class="acct-section">
          <div class="acct-eyebrow"><span class="lbl">Two-factor authentication</span>${tag('baseline')}</div>
          <div class="panel"><div class="panel-body">
            <div class="totp-block" data-totp="${V.totp}">
              <div class="totp-status-view">${totpStatusHTML()}</div>
              <div class="totp-enroll-view">${totpEnrollHTML()}</div>
            </div>
          </div></div>
        </div>

        <div class="acct-section">
          <div class="acct-eyebrow"><span class="lbl">Active sessions</span>${tag('postmvp')}</div>
          <div class="panel"><div class="panel-body">
            <div class="sess-row">
              <span class="sess-ico">${svg('<rect x="2" y="3" width="12" height="8" rx="1"/><path d="M6 14h4M8 11v3"/>', 16)}</span>
              <div class="sess-main"><div class="sess-dev">This device · Firefox on macOS <span class="sess-this">current</span></div><div class="sess-meta"><span class="mono">Signed in 2h ago</span> · approximate location withheld</div></div>
            </div>
            <div class="sess-row">
              <span class="sess-ico">${svg('<rect x="4" y="2" width="8" height="12" rx="1.5"/><path d="M7 12h2"/>', 16)}</span>
              <div class="sess-main"><div class="sess-dev">iPhone · Replant Admin</div><div class="sess-meta"><span class="mono">Last active yesterday</span></div></div>
              <button class="sess-revoke">Sign out</button>
            </div>
            <div style="margin-top:14px;padding-top:14px;border-top:0.5px solid var(--rp-faint);display:flex;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm">Sign out other devices</button>
            </div>
          </div></div>
        </div>

        <div class="acct-section">
          <div class="acct-eyebrow"><span class="lbl">Recent account activity</span>${tag('postmvp')}</div>
          <div class="panel"><div class="panel-body">
            <div class="act-row"><span class="act-when">Today · 14:02</span><span class="act-what"><b>Signed in</b> with TOTP</span><span class="act-where">this device</span></div>
            <div class="act-row"><span class="act-when">Yesterday · 09:18</span><span class="act-what"><b>Signed in</b> with TOTP</span><span class="act-where">iPhone</span></div>
            <div class="act-row"><span class="act-when">12 Jun · 16:40</span><span class="act-what">TOTP code verified for a sensitive action</span><span class="act-where">this device</span></div>
            <div class="act-foot">This is your own account activity only — a mirror so you can spot anything you don't recognize. <a href="#">Something look wrong?</a></div>
          </div></div>
        </div>

        <div class="acct-section">
          <div class="acct-eyebrow"><span class="lbl">Preferences</span>${tag('postmvp')}</div>
          <div class="panel"><div class="panel-body">
            <div class="pref-row">
              <div class="pref-main"><div class="pref-name">Timezone</div><div class="pref-desc">Audit logs and case timestamps display in this timezone.</div></div>
              <div class="pref-control"><select class="sel"><option>Africa/Lagos (GMT+1)</option><option>Europe/London (GMT+0)</option><option>America/New_York (GMT-5)</option></select></div>
            </div>
            <div class="pref-row">
              <div class="pref-main"><div class="pref-name">Language <span class="lang-soon">More languages coming</span></div><div class="pref-desc">Interface language.</div></div>
              <div class="pref-control"><select class="sel"><option>English</option></select></div>
            </div>
            <div class="pref-row">
              <div class="pref-main"><div class="pref-name">In-app notifications</div><div class="pref-desc">Queue, Heartcry, and pastoral-signal counts in the nav.</div></div>
              <div class="pref-control"><span class="toggle on"></span></div>
            </div>
            <div class="pref-row">
              <div class="pref-main"><div class="pref-name">Email digest</div><div class="pref-desc">A daily summary of what needs attention.</div></div>
              <div class="pref-control"><select class="sel"><option>Daily</option><option>Weekly</option><option>Off</option></select></div>
            </div>
            <div class="xnotify-wrap">
              <div class="xnotify">
                <div class="xnotify-head"><span class="tc-dot"></span>Overseer cross-notify</div>
                <div class="xnotify-note">You and the other Overseer are notified in real time on every top-tier action — promotions, demotions, invites.</div>
                <div class="pref-row" style="padding-top:0;border-bottom:none">
                  <div class="pref-main"><div class="pref-name">Real-time top-tier alerts</div><div class="pref-desc">Ruth ↔ Replant Operations.</div></div>
                  <div class="pref-control"><span class="alwayson"><span class="ao-dot"></span>Always on</span></div>
                </div>
              </div>
            </div>
          </div></div>
        </div>

        <div class="acct-section">
          <div class="acct-eyebrow"><span class="lbl">Account</span>${tag('baseline')}</div>
          <div class="acct-footer-card">
            <div class="acct-foot-row">
              <div class="acct-foot-main"><div class="acct-foot-title">Sign out</div><div class="acct-foot-desc">End your session on this device.</div></div>
              <button class="btn btn-ghost btn-sm">${svg(IC.out, 13)}Sign out</button>
            </div>
            <div class="acct-foot-row">
              <div class="acct-foot-main"><div class="acct-foot-title">Request account deactivation ${tag('consider')}</div><div class="acct-foot-desc">Admin accounts aren't self-deleted. This sends a request to the Ops inbox for another admin to review and action.</div></div>
              <button class="btn btn-ghost btn-sm">Request deactivation</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── render the full shell into the mount ── */
  function renderShell() {
    const mount = $('[data-mount-shell]');
    if (!mount) return;
    mount.setAttribute('data-tier', V.tier);
    mount.innerHTML = `
      <aside class="adm-side" style="display:flex;flex-direction:column">
        <div class="adm-brand"><span class="adm-brand-mark">R</span><span><span class="adm-brand-name">Replant</span><span class="adm-brand-sub">Admin · v2.0</span></span></div>
        <div style="flex:1;overflow:hidden">${navHTML()}</div>
        ${footHTML(V.tier)}
      </aside>
      <div class="adm-main">
        <div class="adm-top"><div><div class="adm-crumb">Account</div><div class="adm-h1">${esc(TIERS[V.tier].name)}</div></div><div class="adm-top-meta"><span>${esc(TIERS[V.tier].label)}</span></div></div>
        <div class="adm-body" style="background:var(--rp-bg)">${sectionsHTML(V.tier)}</div>
      </div>`;
    // account isn't in nav — leave all nav items inactive
  }

  function renderTotpStandalones() {
    const a = $('[data-mount-totp-not]');
    if (a) a.innerHTML = `<div class="acct"><div class="panel" style="border:none"><div class="panel-body" style="padding:0">${totpEnrollHTML()}</div></div></div>`;
    const b = $('[data-mount-totp-enrolled]');
    if (b) b.innerHTML = `<div class="acct"><div class="panel" style="border:none"><div class="panel-body" style="padding:4px 0">${totpStatusHTML()}</div></div></div>`;
  }

  function renderAll() { renderShell(); renderTotpStandalones(); }

  /* ── View-as segmented controls ── */
  function buildSeg(container) {
    const key = container.getAttribute('data-seg');
    const opts = JSON.parse(container.getAttribute('data-opts'));
    const render = () => { container.innerHTML = opts.map(o => `<button data-v="${esc(o.v)}" aria-pressed="${V[key] === o.v}">${esc(o.label)}</button>`).join(''); };
    container.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      V[key] = b.getAttribute('data-v');
      render(); renderAll();
    });
    render();
  }

  /* ═══════════ Tweaks host protocol ═══════════ */
  const refreshers = [];
  function rerenderAll() { renderAll(); refreshers.forEach(f => f()); }
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
    renderAll();
    $$('[data-seg]').forEach(buildSeg);
    mountTweaks();
    // illustrative: make preference toggles feel real (not the always-on status)
    document.addEventListener('click', e => {
      const t = e.target.closest('.toggle');
      if (t) t.classList.toggle('on');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
