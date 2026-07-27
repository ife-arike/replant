/* eslint-disable */
// ── Content Section · SHARED PATTERN PRIMITIVES ─────────────────────
// Design once, apply to all three surfaces. Every component here is
// consumed by Announcements / Scripture / Outreach identically.
const { useState: sS } = React;

// ---- workflow tabs (Home / Drafts / Posted) = existing q-tabs ----
function WorkflowTabs({ tabs, active, onChange }) {
  return (
    <div className="q-tabs cs-wtabs">
      {tabs.map(t => (
        <button key={t.id} className={`q-tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <span className="tcount">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- top-level tab bar (segmented control) — CD call Q1 ----
function TopLevelTabs({ tabs, active, onChange }) {
  return (
    <div className="cs-toplevel">
      {tabs.map(t => (
        <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <span className="tl-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- state pill (draft / scheduled / published / archived) ----
function StatePill({ state, when }) {
  const label = { draft: 'Draft', scheduled: when || 'Scheduled', published: when || 'Published', archived: 'Archived' }[state] || state;
  return <span className={`cs-state ${state}`}><span className="sd" />{label}</span>;
}

// ---- small tag chip ----
function Tag({ kind, children }) { return <span className={`cs-tag ${kind || ''}`}>{children}</span>; }

// ---- checkbox ----
function Check({ on, onClick }) {
  return (
    <span className={`cs-card-check ${on ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}>
      {on && I.check}
    </span>
  );
}

// ---- collapsible content card (Home + Posted). Default collapsed;
//      today's + next-scheduled render expanded. ----
function CollapsibleCard({ item, expanded, onToggle, selectable, selected, onSelect, marker, head, body }) {
  const cls = ['cs-card'];
  if (expanded) cls.push('open');
  if (marker === 'today') cls.push('is-today');
  if (marker === 'next') cls.push('is-next');
  if (selected) cls.push('is-selected');
  return (
    <div className={cls.join(' ')}>
      <div className="cs-card-head" onClick={onToggle}>
        {selectable && <Check on={selected} onClick={onSelect} />}
        {marker && <span className={`cs-marker ${marker}`}>{marker === 'today' ? 'Today' : 'Next up'}</span>}
        {head}
        <div className="cs-card-headright">
          <span className="cs-chev">{I.chevD}</span>
        </div>
      </div>
      {expanded && (
        <div className="cs-card-body">
          <div className="cs-card-body-inner">{body}</div>
        </div>
      )}
    </div>
  );
}

// ---- bulk-action bar (multi-select > 0) ----
function BulkBar({ count, onClear, actions, note }) {
  if (!count) return null;
  return (
    <div className="cs-bulkbar">
      <span className="bb-count"><b>{count}</b> selected</span>
      <span className="bb-sep" />
      {actions.map((a, i) => (
        <button key={i} className={`rp-btn rp-btn-sm ${a.tone || 'rp-btn-ghost'}`} onClick={a.onClick}>
          {a.icon}{a.label}
        </button>
      ))}
      <span className="bb-note">{note || 'Bulk operations audit-logged per row.'}</span>
      <span className="bb-spacer" />
      <button className="bb-clear" onClick={onClear}>Clear</button>
    </div>
  );
}

// ---- pagination footer (10 per page — Content only) ----
function PaginationFooter({ page, pages, total, onPage, loadMore }) {
  return (
    <div className="cs-pageft">
      <span className="pf-count">{total} items · 10 per page</span>
      {loadMore ? (
        <button className="pf-loadmore" onClick={loadMore}>Load more from archive {I.chevD}</button>
      ) : (
        <div className="pf-nav">
          <button className="cs-pagebtn" onClick={() => onPage(Math.max(1, page - 1))}>‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
            <button key={n} className={`cs-pagebtn ${n === page ? 'on' : ''}`} onClick={() => onPage(n)}>{n}</button>
          ))}
          <button className="cs-pagebtn" onClick={() => onPage(Math.min(pages, page + 1))}>›</button>
        </div>
      )}
    </div>
  );
}

// ---- field/column mapping footer (grounds every mockup) ----
function FieldMapFooter({ map, title }) {
  return (
    <div className="cs-mapfoot">
      <div className="mf-head">Field / column mapping{title ? ` · ${title}` : ''}</div>
      <div className="cs-maptable">
        {map.map((m, i) => (
          <div className="cs-mapcell" key={i}>
            <div className="mc-field">{m.field}</div>
            <div className="mc-col">{m.col}</div>
            <div className="mc-type">{m.type}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- publish-lock cue (Posted rows) ----
function LockCue({ when }) {
  return (
    <div className="cs-lockcue">
      <span className="lk-ic">{I.lock}</span>
      <span className="lk-txt"><b>Published {when} · Locked.</b> What leaders read, we don{'\u2019'}t retroactively rewrite. Corrections thread to this post.</span>
    </div>
  );
}

// ============================================================
// RIGHT-SIDE DRAWER CHASSIS (filter / preview / version history)
// ============================================================
function DrawerShell({ eyebrow, title, onClose, wide, foot, children }) {
  return (
    <>
      <div className="cs-drawer-backdrop" onClick={onClose} />
      <div className={`cs-drawer-panel ${wide ? 'wide' : ''}`}>
        <div className="cs-drawer-head">
          <div>
            <div className="cs-drawer-eyebrow">{eyebrow}</div>
            <div className="cs-drawer-title">{title}</div>
          </div>
          <button className="cs-drawer-x" onClick={onClose}>{I.x}</button>
        </div>
        <div className="cs-drawer-body">{children}</div>
        {foot && <div className="cs-drawer-foot">{foot}</div>}
      </div>
    </>
  );
}

// ---- filter drawer (facets vary per surface; State first — CD call Q3) ----
function FilterChip({ on, label, onClick }) {
  return (
    <button className={`cs-fchip ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="ck">{I.check}</span>{label}
    </button>
  );
}
function FilterDrawer({ facets, onClose, onClear, applied }) {
  return (
    <DrawerShell
      eyebrow="Filter · sticky while scrolling"
      title="Filters"
      onClose={onClose}
      foot={<>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={onClear}>Clear all</button>
        <span style={{ font: '400 11px var(--rp-mono)', color: 'var(--rp-muted-2)' }}>{applied} applied</span>
      </>}
    >
      {facets.map((f, i) => (
        <div className="cs-facet" key={i}>
          <div className="cs-facet-label">
            {f.label}
            {f.selected && f.selected.size > 0 && <span className="clr" onClick={f.onClear}>Clear</span>}
          </div>
          {f.type === 'daterange' ? (
            <div className="cs-facet-daterow">
              <input className="rp-input" type="date" defaultValue={f.from} style={{ height: 34 }} />
              <span className="to">to</span>
              <input className="rp-input" type="date" defaultValue={f.to} style={{ height: 34 }} />
            </div>
          ) : (
            <div className="cs-chipwrap">
              {f.options.map(o => (
                <FilterChip key={o} on={f.selected && f.selected.has(o)} label={o} onClick={() => f.onToggle(o)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </DrawerShell>
  );
}

// ---- version history drawer (DRAFTS only, pre-lock) ----
function VersionHistoryDrawer({ title, onClose }) {
  const revs = [
    { when: 'just now', by: 'Ruth', diff: 'Current working draft.', current: true },
    { when: '12 min ago', by: 'Ruth', diff: 'Tightened the second paragraph; changed badge from New \u2192 none.' },
    { when: '1h ago', by: 'Ada', diff: 'Reworked the title; added byline.' },
    { when: '2h ago', by: 'Ruth', diff: 'Initial draft created from a duplicate of "July prayer calendar".' },
  ];
  return (
    <DrawerShell eyebrow="Version history · drafts only" title={title} onClose={onClose}
      foot={<span style={{ font: '400 11px var(--rp-mono)', color: 'var(--rp-muted-2)', lineHeight: 1.5 }}>History freezes at publish. After lock, corrections are separate posts.</span>}>
      {revs.map((r, i) => (
        <div className={`cs-vh-row ${r.current ? 'current' : ''}`} key={i}>
          <div className="cs-vh-node"><span className="n-dot" />{i < revs.length - 1 && <span className="n-line" />}</div>
          <div className="cs-vh-main">
            <div className="cs-vh-when">{r.current ? <b>Current</b> : r.when}{r.current ? ` · ${r.when}` : ''}</div>
            <div className="cs-vh-diff">{r.diff}</div>
            <div className="cs-vh-by">{r.by}{!r.current && <> · <button style={{ background: 'none', border: 'none', color: 'var(--rp-sky)', cursor: 'pointer', font: 'inherit', padding: 0 }}>Restore</button></>}</div>
          </div>
        </div>
      ))}
    </DrawerShell>
  );
}

// ============================================================
// MOBILE PREVIEW FRAME + LEADER CARD RENDERERS
// The preview panel + leader-view mocks render the SAME card shapes.
// ============================================================
function PhoneFrame({ tab, full, children }) {
  const tabs = ['Home', 'Scripture', 'Outreach', 'Prayer', 'More'];
  return (
    <div className={`cs-phone ${full ? 'full' : ''}`}>
      <div className="cs-phone-notch" />
      <div className="cs-phone-status"><span>9:41</span><span>Replant</span></div>
      <div className="cs-phone-screen">{children}</div>
      <div className="cs-phone-tabbar">
        {tabs.map(t => <div key={t} className={`pt ${t === tab ? 'on' : ''}`}>{t}</div>)}
      </div>
    </div>
  );
}

const TAG_META = {
  urgent: { dot: 'var(--rp-red)', label: 'Urgent' },
  new: { dot: 'var(--rp-amber)', label: 'Notice' },
  none: { dot: 'var(--rp-sky)', label: 'Network update' },
};
function AnnouncementLeaderCard({ item }) {
  const meta = TAG_META[item.badge] || TAG_META.none;
  if (item.cardType === 'leader_word' || item.source === 'leader') {
    return (
      <div className="lc-card warm">
        <div className="lc-eyebrow"><span className="lc-dot" style={{ background: 'var(--rp-green)' }} /><span className="lc-lab">A WORD FOR TODAY</span><span className="lc-rule" /></div>
        <div className="lc-lead">{item.body}</div>
        <div className="lc-foot"><span className="lc-avatar">{(item.byline || 'L')[0]}</span><span className="by" style={{ marginLeft: 2 }}>{item.byline || 'A verified leader'}</span><span className="cc">{item.commentCount || 3} comments</span></div>
      </div>
    );
  }
  return (
    <div className="lc-card">
      <div className="lc-eyebrow">
        <span className="lc-dot" style={{ background: meta.dot }} />
        <span className="lc-lab">{meta.label.toUpperCase()}</span>
        <span className="lc-rule" />
        <span className="lc-time">now</span>
      </div>
      <div className="lc-title">{item.title}</div>
      <div className="lc-body" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.body}</div>
      <div className="lc-readon"><span className="r-rule" /><span className="r-txt">read on</span></div>
      <div className="lc-foot"><span className="rp-seal">R</span><span className="by">{item.byline || 'Replant Team'}</span><span className="cc">2 comments</span></div>
    </div>
  );
}
function ScriptureLeaderCard({ item }) {
  return (
    <div style={{ padding: '4px 2px 8px' }}>
      <div className="lc-scripture">
        <span className="sq">{'\u201C'}</span>
        <div className="sv">{item.verse}</div>
        <span className="sr"><b>{item.ref}</b> · {item.translation}</span>
      </div>
      {item.reflection && <div className="lc-body" style={{ marginTop: 4 }}>{item.reflection}</div>}
      {item.prompt && <div style={{ font: '300 14px var(--rp-serif)', fontStyle: 'italic', color: 'rgba(240,237,230,0.6)', marginTop: 12, lineHeight: 1.4 }}>{item.prompt}</div>}
      {item.related && item.related.length > 0 && <span className="lc-relchip">See related {I.chev}</span>}
    </div>
  );
}
function MissionLeaderCard({ item }) {
  return (
    <div className="lc-card">
      <div className="lc-mission-media"><span>{'{ mission image }'}</span></div>
      <div className="lc-eyebrow"><span className="lc-dot" style={{ background: 'var(--rp-sky)' }} /><span className="lc-lab">{item.missionType.toUpperCase()}</span><span className="lc-rule" /></div>
      <div className="lc-title" style={{ fontSize: 18 }}>{item.title}</div>
      <div className="lc-body" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.body}</div>
      <div className="lc-mission-meta">
        <div className="mm"><span className="mm-k">Location</span><span className="mm-v">{item.location}</span></div>
        <div className="mm"><span className="mm-k">When</span><span className="mm-v">{item.dates}</span></div>
        {item.org && <div className="mm"><span className="mm-k">With</span><span className="mm-v">{item.org}</span></div>}
      </div>
      <span className="lc-apply">Express interest</span>
    </div>
  );
}

// ---- preview drawer (renders the mobile card exactly as leaders see it) ----
function PreviewDrawer({ item, kind, onClose }) {
  let card;
  if (kind === 'scripture') card = <ScriptureLeaderCard item={item} />;
  else if (kind === 'outreach') card = <MissionLeaderCard item={item} />;
  else card = <AnnouncementLeaderCard item={item} />;
  const tab = kind === 'scripture' ? 'Scripture' : kind === 'outreach' ? 'Outreach' : 'Home';
  return (
    <DrawerShell eyebrow="Preview · as leaders see it" title="Mobile preview" onClose={onClose}
      foot={<span style={{ font: '400 11px var(--rp-mono)', color: 'var(--rp-muted-2)', lineHeight: 1.5 }}>Renders the same {kind === 'scripture' ? 'ScriptureCard' : kind === 'outreach' ? 'MissionCard' : 'AnnouncementCard'} the leader app ships.</span>}>
      <div className="cs-preview-note">This is the live leader card component, not a screenshot. What you see is what 5,000+ leaders will read.</div>
      <div className="cs-preview-center"><PhoneFrame tab={tab}>{card}</PhoneFrame></div>
    </DrawerShell>
  );
}

// ============================================================
// EDITOR FIELD PRIMITIVES
// ============================================================
function Counter({ len, max }) {
  const amber = len > max * 0.8;
  return <span className={`cs-count ${amber ? 'amber' : ''}`}>{len}/{max}</span>;
}
function Field({ label, req, count, hint, map, children }) {
  return (
    <div className="cs-field">
      <div className="cs-field-head">
        <span className="cs-lbl">{label}{req && <span className="cs-req"> ·</span>}</span>
        {count}
      </div>
      {children}
      {hint && <div className="cs-field-hint">{hint}</div>}
      {map && <div className="cs-field-map">{map}</div>}
    </div>
  );
}
function Select({ value, onChange, options, labels }) {
  return (
    <div className="cs-select-wrap">
      <select value={value} onChange={e => onChange && onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{labels ? labels(o) : o}</option>)}
      </select>
      <span className="cs-select-chev">{I.chevD}</span>
    </div>
  );
}
function Switch({ on, onClick }) { return <span className={`cs-switch ${on ? 'on' : ''}`} onClick={onClick} />; }

function ToggleRow({ title, sub, on, onClick }) {
  return (
    <div className="cs-toggle-row">
      <div className="tr-main"><span className="tr-t">{title}</span><span className="tr-s">{sub}</span></div>
      <Switch on={on} onClick={onClick} />
    </div>
  );
}

// ---- toast + confirm modal ----
function Toast({ msg, sub, sky }) {
  return <div className={`cs-toast ${sky ? 'sky' : ''}`}><span className="t-dot" /><span><b style={{ fontWeight: 600 }}>{msg}</b>{sub && <span className="t-sub"> {sub}</span>}</span></div>;
}
function Modal({ eyebrow, title, children, foot, onClose }) {
  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        <div className="cs-modal-head"><div className="cs-modal-eyebrow">{eyebrow}</div><div className="cs-modal-title">{title}</div></div>
        <div className="cs-modal-body">{children}</div>
        <div className="cs-modal-foot">{foot}</div>
      </div>
    </div>
  );
}

// ---- humanize enum labels ----
function human(s) { return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

Object.assign(window, {
  WorkflowTabs, TopLevelTabs, StatePill, Tag, Check, CollapsibleCard, BulkBar,
  PaginationFooter, FieldMapFooter, LockCue, DrawerShell, FilterDrawer, FilterChip,
  VersionHistoryDrawer, PhoneFrame, AnnouncementLeaderCard, ScriptureLeaderCard,
  MissionLeaderCard, PreviewDrawer, Counter, Field, Select, Switch, ToggleRow,
  Toast, Modal, human,
});
