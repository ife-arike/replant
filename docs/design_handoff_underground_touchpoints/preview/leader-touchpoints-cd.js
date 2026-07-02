/* ═══════════════════════════════════════════════════
   Replant — Underground Queue · Leader Touchpoints CD
   Mobile mockups. RN-faithful. Pastoral copy LOCKED.
   Tweaks expose visual forks only.
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = window.__TWEAKS || {
    qDelivery: 'modal',  // modal | banner  — Founder default: modal-on-launch
    rejGlyph: 'none',    // none | quiet    — Founder default: no glyph
    codeBlock: 'quiet',  // boxed | quiet   — Founder default: quiet
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CODE_STR = 'RPL-VXQM-71903';

  const instances = [];
  const refreshers = [];
  function rerenderAll() { instances.forEach(i => i.render()); refreshers.forEach(f => f()); }

  function phoneShell(inner) {
    return `
      <div class="phone p14">
        <div class="dynamic-island"></div>
        <div class="status-bar">
          <span class="status-time">9:41</span>
          <span class="status-icons">
            <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M8 2.2c2 0 3.8.8 5.2 2l1.1-1.2A9.3 9.3 0 0 0 8 .3 9.3 9.3 0 0 0 1.7 3l1.1 1.2A7.6 7.6 0 0 1 8 2.2Z"/><path d="M8 5.4c1.1 0 2.1.4 2.9 1.2l1.1-1.2A6 6 0 0 0 8 3.6a6 6 0 0 0-4 1.8l1.1 1.2A4.2 4.2 0 0 1 8 5.4Z"/><circle cx="8" cy="9" r="1.6"/></svg>
            <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor"/><rect x="24" y="3.5" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.5"/></svg>
          </span>
        </div>
        <div class="screen">${inner}</div>
      </div>`;
  }

  const LOGO = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8 14V6M8 6C8 4 6.5 2.5 4.5 2.5 4.5 5 6 6 8 6ZM8 6c0-2 1.5-3.5 3.5-3.5C11.5 5 10 6 8 6Z"/></svg>';

  function homeShell(banner) {
    return `
      <div class="home-head">
        <div class="home-brand"><span class="home-logo">${LOGO}</span><span class="home-wordmark">Replant</span></div>
        <span class="home-burger">☰</span>
      </div>
      <div class="screen-scroll"><div class="home-body">
        ${banner || ''}
        <div class="home-eyebrow">Today</div>
        <div class="home-verse">I will lift up mine eyes unto the hills, from whence cometh my help.</div>
        <div class="home-verse-ref">Psalm 121:1 · KJV</div>
      </div></div>`;
  }

  function modalOverlay(inner, open) {
    return `<div class="modal-overlay ${open ? 'open' : ''}"><div class="modal pastoral" data-stop="1">${inner}</div></div>`;
  }

  /* ════ §16 — admin question ════ */
  function createQuestion(mount) {
    const st = { screen: 'home' };
    const questionBanner = `
      <div class="vb neutral" data-act="open">
        <span class="vb-well">${LOGO}</span>
        <div class="vb-main">
          <div class="vb-head">The Replant team has a question</div>
          <div class="vb-detail">Tap to read and reply when you're ready.</div>
        </div>
        <span class="vb-x">›</span>
      </div>`;

    function modal() {
      return modalOverlay(`
        <div class="modal-glyph">${LOGO}</div>
        <div class="modal-eyebrow">A message for you</div>
        <div class="modal-title">The Replant team has a question for you</div>
        <div class="aq-quote">"Could you share the name of one more leader who knows your fellowship? It helps us confirm and protect you."</div>
        <div class="aq-rest">Reply when you're ready. There's no rush.</div>
        <div class="modal-actions">
          <button class="modal-btn" style="background:var(--sky);color:var(--bg)" data-act="reply">Send a reply</button>
          <button class="modal-btn ghost" data-act="later">Not now</button>
        </div>`, true);
    }

    function replied() {
      return `<div class="reply-sent" style="height:100%">
        <div class="reply-sent-mark"><svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 14.5 12 19.5 21.5 9" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="reply-sent-title">Your reply was sent to the team.</div>
        <div class="reply-sent-sub">They'll review it with care. You can close the app — we'll let you know here.</div>
      </div>`;
    }

    function render() {
      if (st.screen === 'replied') { mount.innerHTML = phoneShell(replied()); return; }
      const useModal = T.qDelivery === 'modal';
      mount.innerHTML = phoneShell(homeShell(questionBanner) + (useModal && st.screen === 'home' ? modal() : ''));
    }

    mount.addEventListener('click', e => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      const a = t.getAttribute('data-act');
      if (a === 'reply') { st.screen = 'replied'; render(); setTimeout(() => { st.screen = 'home'; render(); }, 2600); }
      else if (a === 'later' || a === 'open') { st.screen = st.screen === 'home' ? 'home' : 'home'; render(); }
    });

    const api = { render }; instances.push(api); render(); return api;
  }

  /* ════ §17 — reply composer ════ */
  function createReply(mount, sentState) {
    const st = { sent: !!sentState };
    function composer() {
      return `
        <div class="rc-head" style="border-bottom:0.5px solid var(--faint)">
          <span class="rc-back" data-act="noop">‹ Back</span>
          <div class="rc-eyebrow">Reply to the team</div>
          <div class="rc-title" style="font-size:26px">Your reply</div>
        </div>
        <div class="screen-scroll"><div class="reply-screen">
          <div class="reply-context">"Could you share the name of one more leader who knows your fellowship?"</div>
          <div class="reply-field ${st.typed ? '' : 'ph'}" data-act="type">${st.typed ? 'Brother Tomas leads the fellowship two valleys over. He has known us for three years and can speak for who we are.' : 'Write your reply…'}</div>
          <div class="reply-foot-note">Only the Replant team will see this. Take your time — there's no rush.</div>
        </div></div>
        <div class="rc-footer"><button class="cta ${st.typed ? 'on' : 'off'}" data-act="send">Send reply</button></div>`;
    }
    function sent() {
      return `<div class="reply-sent" style="height:100%">
        <div class="reply-sent-mark"><svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 14.5 12 19.5 21.5 9" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="reply-sent-title">Your reply was sent to the team.</div>
        <div class="reply-sent-sub">They'll review it with care. You can close the app — we'll let you know here.</div>
      </div>`;
    }
    function render() { mount.innerHTML = phoneShell(st.sent ? sent() : composer()); }
    mount.addEventListener('click', e => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      const a = t.getAttribute('data-act');
      if (a === 'type') { st.typed = true; render(); }
      else if (a === 'send' && st.typed) { st.sent = true; render(); setTimeout(() => { st.sent = false; st.typed = false; render(); }, 2800); }
    });
    const api = { render }; instances.push(api); render(); return api;
  }

  /* ════ §18 — rejection (standard + safety) ════ */
  function createRejection(mount, variant) {
    function glyph() {
      if (T.rejGlyph === 'none') return '<div class="modal-glyph muted">' + LOGO + '</div>';
      return '<div class="modal-glyph muted"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="10" r="7.5"/><path d="M10 6.5v4.5" stroke-linecap="round"/><circle cx="10" cy="13.6" r="0.5" fill="currentColor" stroke="none"/></svg></div>';
    }
    function body() {
      if (variant === 'safety') {
        return `
          ${glyph()}
          <div class="modal-eyebrow muted">A message for you</div>
          <div class="rej-lead">After review, your registration could not be verified at this time.</div>
          <div class="rej-appeal">If you believe this is a mistake, you can write to <b>accounts@projectreplant.org</b>.</div>
          <div class="modal-actions"><button class="modal-btn ghost" data-act="close">I understand</button></div>
          <div class="rej-silence">No reason shown · no re-apply prompt — by design.</div>`;
      }
      return `
        ${glyph()}
        <div class="modal-eyebrow muted">A message for you</div>
        <div class="rej-lead">After review, your registration could not be verified at this time.</div>
        <div class="rej-reason">Our team was not able to confirm the church through the references available to us.</div>
        <div class="rej-close">You are welcome to re-apply when you're ready.</div>
        <div class="rej-appeal">If you believe this is a mistake, you can write to <b>accounts@projectreplant.org</b>.</div>
        <div class="modal-actions"><button class="modal-btn ghost" data-act="close">I understand</button></div>`;
    }
    function render() { mount.innerHTML = phoneShell(homeShell('') + modalOverlay(body(), true)); }
    const api = { render }; instances.push(api); render(); return api;
  }

  /* ════ §19 — persistent banner ════ */
  function createBanner(mount) {
    const banner = `
      <div class="vb neutral">
        <span class="vb-well">${LOGO}</span>
        <div class="vb-main">
          <div class="vb-head">Registration update</div>
          <div class="vb-detail">Your registration could not be verified at this time.</div>
          <span class="vb-read">Read details <span class="arr">→</span></span>
        </div>
      </div>`;
    function render() { mount.innerHTML = phoneShell(homeShell(banner)); }
    const api = { render }; instances.push(api); render(); return api;
  }

  /* ════ §20 — day-23 warning ════ */
  function createDay23(mount) {
    function body() {
      return `
        <div class="modal-glyph amber"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="10" r="7.5"/><path d="M10 5.5v5" stroke-linecap="round"/><circle cx="10" cy="13.4" r="0.5" fill="currentColor" stroke="none"/></svg></div>
        <div class="modal-eyebrow amber">A note for you</div>
        <div class="modal-title">We don't want to lose your registration</div>
        <div class="rej-reason" style="margin-bottom:16px">Your registration hasn't been completed yet, and it's set to be removed from our records in a few days. Sometimes that's because we're still reviewing on our end. If you'd still like to join — or if you've been waiting to hear from us — please reach out and we'll pick it back up with you.</div>
        <div class="rej-appeal">You can reach us any time at <b>accounts@projectreplant.org</b>.</div>
        <div class="modal-actions"><button class="modal-btn ghost" data-act="close">I understand</button></div>`;
    }
    function render() { mount.innerHTML = phoneShell(homeShell('') + modalOverlay(body(), true)); }
    const api = { render }; instances.push(api); render(); return api;
  }

  /* ════ §21 — visibility flips + join refresh ════ */
  function createFlip(mount, dir) {
    function body() {
      if (dir === 'h2v') {
        return `
          <div class="modal-glyph">${LOGO}</div>
          <div class="modal-eyebrow">Your church</div>
          <div class="flip-body">
            <div class="flip-head">Your visibility setting was updated</div>
            <span class="flip-pill visible"><span class="fp-dot"></span>Now Visible</span>
            <div class="flip-text">Your church is now listed as <b>Visible</b> in the Replant network. Your location remains hidden.</div>
          </div>
          <div class="modal-actions" style="margin-top:18px"><button class="modal-btn ghost" data-act="close">Got it</button></div>`;
      }
      return `
        <div class="modal-glyph muted">${LOGO}</div>
        <div class="modal-eyebrow muted">Your church</div>
        <div class="flip-body">
          <div class="flip-head">Your visibility setting was updated</div>
          <span class="flip-pill hidden"><span class="fp-dot"></span>Now Hidden</span>
          <div class="flip-text">Your church is now listed as <b>Hidden</b>. Other leaders will see "Underground Church" and your region only.</div>
        </div>
        <div class="modal-actions" style="margin-top:18px"><button class="modal-btn ghost" data-act="close">Got it</button></div>`;
    }
    function render() { mount.innerHTML = phoneShell(homeShell('') + modalOverlay(body(), true)); }
    const api = { render }; instances.push(api); render(); return api;
  }

  function createJoinRefresh(mount) {
    const st = { copied: false };
    let timer = null;
    function codeBlock() {
      if (T.codeBlock === 'quiet') return `<div class="code-quiet" data-act="copy"><span class="code-text">${CODE_STR}</span></div>`;
      return `<div class="code-boxed" data-act="copy"><span class="code-text">${CODE_STR}</span></div>`;
    }
    function body() {
      return `
        <div class="modal-glyph"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="13.5" r="3.5"/><path d="M9 11 16 4M13.5 6.5l2 2M11.5 8.5l1.5 1.5" stroke-linecap="round"/></svg></div>
        <div class="modal-eyebrow">Invite code</div>
        <div class="modal-title">Your join code has been refreshed</div>
        <div class="rej-reason" style="margin-bottom:10px">Your previous code no longer works. Use this new code to invite one trusted leader, in person.</div>
        <div class="refresh-code-wrap">
          ${codeBlock()}
          <div class="code-tap-hint ${st.copied ? 'copied' : ''}"><span class="ico">${st.copied ? '✓' : '⧉'}</span>${st.copied ? 'Copied' : 'Tap to copy'}</div>
        </div>
        <div class="modal-actions"><button class="modal-btn ghost" data-act="close">Got it</button></div>`;
    }
    function render() {
      mount.innerHTML = phoneShell(homeShell('') + modalOverlay(body(), true) + `<div class="toast ${st.copied ? 'show' : ''}"><span class="check">✓</span>Code copied</div>`);
    }
    mount.addEventListener('click', e => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      if (t.getAttribute('data-act') === 'copy') {
        st.copied = true; render();
        clearTimeout(timer); timer = setTimeout(() => { st.copied = false; render(); }, 1900);
      }
    });
    const api = { render }; instances.push(api); render(); return api;
  }

  /* ════ tweaks + inline segs ════ */
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
  function buildSeg(container) {
    const key = container.getAttribute('data-seg');
    const opts = JSON.parse(container.getAttribute('data-opts'));
    const render = () => { container.innerHTML = opts.map(o => `<button data-v="${esc(o.v)}" aria-pressed="${T[key] === o.v}">${esc(o.label)}</button>`).join(''); };
    container.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setTweak(key, b.getAttribute('data-v')); });
    refreshers.push(render); render();
  }

  function boot() {
    mountTweaks();
    const q = document.getElementById('m-question'); if (q) createQuestion(q);
    const r = document.getElementById('m-reply'); if (r) createReply(r, false);
    const rs = document.getElementById('m-reply-sent'); if (rs) createReply(rs, true);
    const rstd = document.getElementById('m-rej-standard'); if (rstd) createRejection(rstd, 'standard');
    const rsaf = document.getElementById('m-rej-safety'); if (rsaf) createRejection(rsaf, 'safety');
    const bn = document.getElementById('m-banner'); if (bn) createBanner(bn);
    const d23 = document.getElementById('m-day23'); if (d23) createDay23(d23);
    const fh = document.getElementById('m-flip-h2v'); if (fh) createFlip(fh, 'h2v');
    const fv = document.getElementById('m-flip-v2h'); if (fv) createFlip(fv, 'v2h');
    const jr = document.getElementById('m-join-refresh'); if (jr) createJoinRefresh(jr);
    document.querySelectorAll('[data-seg]').forEach(buildSeg);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
