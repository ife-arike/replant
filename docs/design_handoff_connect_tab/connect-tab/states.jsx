// ─────────────────────────────────────────────────────────────────────────
// states.jsx — shared chrome + every non-happy-path state.
// TabBar, icon set, loading skeletons, inline error, empty thread-list,
// the unverified gate (soft bottom sheet), and a transient error toast.
// ─────────────────────────────────────────────────────────────────────────

// ── icon set (stroke icons, 1.5 — port directly to react-native-svg) ──────
const Icon = {
  search: (p) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>),
  back: (p) => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  chevron: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  compose: (p) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M4 20h4l10.5-10.5a2 2 0 0 0-2.8-2.8L5 17.2z" strokeLinejoin="round" /><path d="M13.5 6.5l4 4" /></svg>),
  send: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M5 12l15-7-5.5 16-3.2-6.3L5 12z" strokeLinejoin="round" strokeLinecap="round" /></svg>),
  lock: (p) => (<svg width="12" height="13" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><rect x="2.5" y="6.5" width="9" height="7.5" rx="1.4" /><path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" /></svg>),
  shield: (p) => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" strokeLinejoin="round" /><path d="M9 12l2 2 4-4.2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  clock: (p) => (<svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3.2l2 1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  alert: (p) => (<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="7" cy="7" r="5.8" /><path d="M7 4v3.4M7 9.6v.2" strokeLinecap="round" /></svg>),
  retry: (p) => (<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><path d="M12 7a5 5 0 1 1-1.5-3.6" strokeLinecap="round" /><path d="M12 1.5V4H9.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  x: (p) => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" /></svg>),
  anon: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" strokeLinecap="round" /></svg>),
  plus: (p) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>),
  branch: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="6" cy="6" r="2.3" /><circle cx="18" cy="7" r="2.3" /><circle cx="12" cy="18" r="2.3" /><path d="M7.7 7.5l3.1 8.4M16.4 8.7L13 15.9M8.2 6.4h7.4" strokeLinecap="round" /></svg>),
  check: (p) => (<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M2.5 7.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  users: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.3-4.5" strokeLinecap="round" /></svg>),
  clip: (p) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 7.5v8a3 3 0 0 0 6 0V6a4.5 4.5 0 0 0-9 0v9.5a6 6 0 0 0 12 0V8" /></svg>),
};

// branch glyph variants — swappable via Tweaks (default 'network')
function IconBranch({ variant = 'network', ...p }) {
  const c = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', ...p };
  if (variant === 'union') return (<svg {...c}><circle cx="9.5" cy="12" r="5.5" /><circle cx="14.5" cy="12" r="5.5" /></svg>);
  if (variant === 'link')  return (<svg {...c}><rect x="2.5" y="8.5" width="11" height="7" rx="3.5" /><rect x="10.5" y="8.5" width="11" height="7" rx="3.5" /></svg>);
  if (variant === 'people') return (<svg {...c}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.3-4.5" /></svg>);
  return (<svg {...c}><circle cx="6" cy="6" r="2.3" /><circle cx="18" cy="7" r="2.3" /><circle cx="12" cy="18" r="2.3" /><path d="M7.7 7.5l3.1 8.4M16.4 8.7L13 15.9M8.2 6.4h7.4" /></svg>);
}

// ── Tab bar (Connect = tab 5, active sky) ─────────────────────────────────
function TabBar({ active = 4 }) {
  const tabs = [
    { name: 'Home', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
    { name: 'The Church', icon: <g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></g> },
    { name: 'Persecuted', icon: <g><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g> },
    { name: 'Prayer', icon: <g><path d="M12 2v8M9 4l3-2 3 2M5 22V11a3 3 0 0 1 6 0v6" /><path d="M19 22V11a3 3 0 0 0-6 0v6" /><path d="M5 22h14" /></g> },
    { name: 'Connect', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  ];
  return (
    <div className="tc-tabbar">
      {tabs.map((t, i) => {
        const isActive = i === active;
        return (
          <div key={t.name} className={'tc-tab' + (isActive ? ' active' : '')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke={isActive ? '#6BB5E8' : 'currentColor'} strokeWidth="1.5"
                 strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
            <div className="name" style={{ color: isActive ? 'var(--sky)' : 'var(--muted)' }}>{t.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Monogram (rounded-square seal) ────────────────────────────────────────
function Monogram({ thread }) {
  if (thread.system) {
    // Replant Team — the Replant mark sits in the seal
    return <div className="monogram"><img className="rp-mark" src="connect-tab/rp-mark.svg" alt="Replant" /></div>;
  }
  if (thread.underground) {
    return <div className="monogram anon"><Icon.anon /></div>;
  }
  return <div className={'monogram' + (thread.anonymous ? ' anon' : '')}>{thread.monogram}</div>;
}

// ── Branch seal (group of ministries) ─────────────────────────────────────
function BranchSeal({ status, variant = 'network' }) {
  return <div className={'monogram branch-seal' + (status === 'invited' ? ' invited' : '')}><IconBranch variant={variant} /></div>;
}

// ── Segmented control (Ministries | Leaders) ──────────────────────────────
function Segmented({ value, options, onChange }) {
  return (
    <div className="cn-seg">
      {options.map(o => (
        <div key={o.value}
             className={'cn-seg-item' + (o.value === value ? ' on' : '')}
             onClick={() => onChange(o.value)}>{o.label}</div>
      ))}
    </div>
  );
}

// ── Persistent community-covenant note (always at the foot of a list) ─────
function CovenantFooter() {
  return (
    <div className="covenant-footer">
      Conversations within Replant are governed by our community covenant.
      Chats are protected within the network. Keywords flagged for review if misuse is detected.
    </div>
  );
}

// ── Condensed covenant strip — pinned above the composer in every thread ──
function CovenantStrip() {
  return (
    <div className="covenant-strip">
      <Icon.lock width="10" height="11" />
      Protected within the network · flagged keywords are reviewed
    </div>
  );
}

// ── Loading skeleton (thread-row dimensions) ──────────────────────────────
function ThreadListSkeleton() {
  return (
    <div className="thread-list" aria-busy="true">
      {[68, 80, 56, 74, 62, 70].map((w, i) => (
        <div className="skel-row" key={i}>
          <div className="skel-mono" />
          <div className="skel-lines">
            <div className="skel-bar" style={{ width: w + '%' }} />
            <div className="skel-bar" style={{ width: (w - 28) + '%', height: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Inline error + retry ──────────────────────────────────────────────────
function ThreadListError({ onRetry }) {
  return (
    <div className="cn-error">
      <div className="glyph">
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="18" cy="18" r="15" strokeDasharray="2 3" />
          <path d="M18 11v8M18 23v.4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="line">Couldn't load your conversations.</div>
      <div className="retry" onClick={onRetry}><Icon.retry /> Tap to retry</div>
    </div>
  );
}

// ── Empty thread list (verified, no threads) ──────────────────────────────
function ThreadListEmpty({ onFind }) {
  return (
    <div className="empty-quiet">
      <div className="glyph">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--sky)" strokeWidth="1" opacity="0.75">
          <path d="M7 10h26a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H15l-6 5v-5H7a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="title">No conversations yet.</div>
      <div className="body">Find a leader in the network and start one.</div>
      <div className="btn btn-ghost" style={{ display: 'inline-flex' }} onClick={onFind}>Find a Leader</div>
    </div>
  );
}

// ── Unverified gate — soft bottom sheet (list visible + dimmed behind) ────
function UnverifiedGate({ onDismiss }) {
  return (
    <div className="scrim gate-sheet-wrap" style={{ background: 'rgba(4,4,4,0.5)' }} onClick={onDismiss}>
      <div className="gate-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="glyph"><Icon.shield /></div>
        <div className="title">For verified leaders</div>
        <div className="body">Available to verified leaders. Verification confirms your place in the network.</div>
        <div className="btn btn-quiet" onClick={onDismiss}>I understand</div>
      </div>
    </div>
  );
}

// ── Transient error toast (deactivated leader, network failure) ───────────
function Toast({ text, onClose }) {
  React.useEffect(() => {
    const id = setTimeout(onClose, 3600);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <div className="cn-toast" onClick={onClose}>
      <span className="x"><Icon.alert width="14" height="14" /></span>
      <span>{text}</span>
    </div>
  );
}

Object.assign(window, {
  Icon, IconBranch, TabBar, Monogram, BranchSeal, Segmented, CovenantFooter, CovenantStrip,
  ThreadListSkeleton, ThreadListError, ThreadListEmpty,
  UnverifiedGate, Toast,
});
