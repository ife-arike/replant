// shared.jsx — primitives shared across all surfaces.
// Pixel-faithful to the live PersecutedScreen.tsx so visual continuity holds.

// ─────────── NavBar ───────────
function NavBar({ withBack, onBack, title = 'The Persecuted Church', subtitle = 'ENCRYPTED · ANONYMOUS · WITHIN THE NETWORK' }) {
  return (
    <div className={'persec-navbar' + (withBack ? ' has-back' : '')}>
      {withBack && (
        <div className="back" onClick={onBack}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </div>
      )}
      <div className="title">{title}</div>
      <div className="subtitle">{subtitle}</div>
      <div className="hairline" />
    </div>
  );
}

// ─────────── Threshold Preamble ───────────
function ThresholdPreamble() {
  return (
    <div className="threshold">
      <div className="eyebrow">A Held Space</div>
      <div className="body">
        For churches under imprisonment, prohibition of fellowship, violence, and active hunting for the faith. Handle with prayer and sobriety.
      </div>
      <div className="meta">
        <svg width="9" height="11" viewBox="0 0 10 12" style={{ marginRight: 2, verticalAlign: -1 }}>
          <rect x="1.5" y="5" width="7" height="6" rx="1" fill="none" stroke="#6BB5E8" />
          <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="#6BB5E8" />
        </svg>
        <span className="sky">Encrypted</span>
        <span className="dot">·</span>
        <span>No location stored</span>
        <span className="dot">·</span>
        <span>Region only</span>
      </div>
    </div>
  );
}

// ─────────── Action Card ───────────
function ActionCard({ onShare }) {
  return (
    <div className="action-card">
      <div className="prompt">Are you currently suffering persecution for the name of Jesus?</div>
      <div className="sub">Heartcries shared to Replant are encrypted and your identity is held. This is a safe space for your voice.</div>
      <div className="cta" onClick={onShare}>Share My Heartcry</div>
    </div>
  );
}

// ─────────── Heartcry Card ───────────
function formatCount(n) {
  if (n < 1000) return n.toString();
  if (n < 10000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n / 1000) + 'k';
}
function HeartcryCard({ h, held, onHold }) {
  const [expanded, setExpanded] = React.useState(false);
  const long = h.text.length > 220;
  const showExpanded = expanded || !long;
  return (
    <div className={'heartcry' + (held ? ' held' : '')}>
      <div className="loc">
        <span className="d" />
        A Voice <span style={{ color: 'rgba(217,89,79,0.5)' }}>·</span>{' '}
        <span className="region">{h.region}</span>
        <span className="time">{h.time} ago</span>
      </div>
      <div className={'text' + (showExpanded ? '' : ' clamp')}>{h.text}</div>
      {long && (
        <div className="readon" onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}>
          <span className="rule" />
          <span className="label">{expanded ? 'fold' : 'read on'}</span>
        </div>
      )}
      <div className="meta-row">
        <span className="hold" onClick={() => onHold && onHold(h.id)}>
          {held ? (
            <>
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Keep Holding
            </>
          ) : '+ Hold In Prayer'}
        </span>
        <span className="praying">{formatCount(h.interceding)} praying</span>
      </div>
    </div>
  );
}

// ─────────── Section Head ───────────
function SectionHead({ label, link, onLink }) {
  return (
    <div className="section-head">
      <span className="label">{label}</span>
      <span className="rule" />
      {link && <span className="link" onClick={onLink}>{link}</span>}
    </div>
  );
}

// ─────────── Region Filter ───────────
function RegionFilter({ active, onSelect }) {
  return (
    <div className="region-bar">
      {REGIONS.map(r => (
        <div key={r.id}
          className={'region-chip' + (active === r.id ? ' on' : '')}
          onClick={() => onSelect(r.id)}>
          {r.label}
        </div>
      ))}
    </div>
  );
}

// ─────────── Scripture Footer ───────────
function ScriptureFooter({ verse, verseRef, eyebrow = 'Pray With Us' }) {
  return (
    <div className="scripture-foot">
      <div className="eyebrow">{eyebrow}</div>
      <div className="verse">{verse}</div>
      <div className="ref">{verseRef}</div>
    </div>
  );
}

// ─────────── Tab Bar (bottom — Persecuted active, red) ───────────
function TabBar({ active = 2 }) {
  const tabs = [
    { name: 'Home',       icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
    { name: 'The Church', icon: <g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></g> },
    { name: 'Persecuted', icon: <g><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g> },
    { name: 'Prayer Wall',     icon: <g><path d="M12 2v8M9 4l3-2 3 2M5 22V11a3 3 0 0 1 6 0v6" /><path d="M19 22V11a3 3 0 0 0-6 0v6" /><path d="M5 22h14" /></g> },
    { name: 'Connect',    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  ];
  return (
    <div className="tabbar">
      {tabs.map((t, i) => {
        const isActive = i === active;
        const color = isActive ? (i === 2 ? '#D9594F' : '#6BB5E8') : 'currentColor';
        return (
          <div key={t.name} className={'tab' + (isActive ? ' active' : '')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">{t.icon}</svg>
            <div className="name" style={{ color: isActive ? color : 'var(--muted)' }}>{t.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────── Notification Bar ───────────
function NotifBar({ text, onTap, onClose }) {
  return (
    <div className="notif-bar" onClick={onTap}>
      <span className="notif-dot" />
      <div className="notif-body">
        <div className="notif-eyebrow">Your Heartcry</div>
        <div className="notif-text">{text}</div>
      </div>
      <svg className="notif-chev" width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="notif-close" onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// ─────────── Entry-point block (front page → sub-page) ───────────
function EntryPoint({ title, sub, meta, onTap }) {
  return (
    <div className="entry" onClick={onTap}>
      <div className="ep-marker" />
      <div className="ep-body">
        <div className="ep-title">{title}</div>
        <div className="ep-sub">{sub}</div>
        {meta && <div className="ep-meta">{meta}</div>}
      </div>
      <svg className="ep-chev" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

Object.assign(window, {
  NavBar, ThresholdPreamble, ActionCard, HeartcryCard,
  SectionHead, RegionFilter, ScriptureFooter, TabBar,
  NotifBar, EntryPoint, formatCount,
});
