/* eslint-disable */
// ── Content Section · SHARED PATTERN PRIMITIVES (v2) ────────────────
// v2 register: no new visual primitives. Everything renders through
// globals.css — q-tabs, .rp-btn(-ghost/-primary), .rp-pill, .state
// pills, .rp-card, .rp-input, mono uppercase eyebrows. The cs-* classes
// added here are STRUCTURAL only (layout / positioning), never a second
// skin over a shipped primitive.
const { useState: sS, useRef: sR, useEffect: sE } = React;

// ---- mono uppercase eyebrow (the register's one label grammar) ----
function Eyebrow({ children, tone }) {
  return <span className={`cs-eyebrow ${tone || ''}`}>{children}</span>;
}

// ---- workflow tabs = q-tabs. One control band: tabs left, actions
//      right, sharing the underline (simplification rule #4). ----
function WorkflowTabs({ tabs, active, onChange, right }) {
  return (
    <div className="cs-band">
      <div className="q-tabs cs-band-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`q-tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
            {t.label}
            {t.count != null && <span className="tcount">{t.count}</span>}
          </button>
        ))}
      </div>
      {right && <div className="cs-band-right">{right}</div>}
    </div>
  );
}

// ---- sibling-surface tabs (Announcements ↔ Witness of the Day) =
//      ALSO q-tabs (Founder-locked: one tab grammar). Renders as the
//      upper q-tabs row, mirroring TriageTabBar + inner tabs in the
//      real app. A hair heavier so the two rows read as a hierarchy,
//      not tab-in-tab. ----
function SiblingTabs({ tabs, active, onChange }) {
  return (
    <div className="q-tabs cs-sibtabs">
      {tabs.map(t => (
        <button key={t.id} className={`q-tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---- state pill — straight from globals .state family. draft =
//      untouched (neutral) · scheduled = await (sky, the one accent) ·
//      posted = stalled (neutral, at rest). Label is the state word;
//      the date lives in its own mono column (simplification #1). ----
function StatePill({ state }) {
  const map = {
    draft:     ['state-untouched', 'Draft'],
    scheduled: ['state-await', 'Scheduled'],
    published: ['state-stalled', 'Posted'],
    posted:    ['state-stalled', 'Posted'],
    archived:  ['state-stalled', 'Archived'],
    live:      ['state-await', 'Live'],
    concept:   ['state-untouched', 'Concept'],
  };
  const [cls, label] = map[state] || ['state-untouched', state];
  return <span className={`state ${cls}`}><span className="sd" />{label}</span>;
}

// ---- selection checkbox (appears on hover / once selection begins) --
function Check({ on, onClick }) {
  return (
    <span className={`cs-check ${on ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}>
      {on && I.check}
    </span>
  );
}

// ============================================================
// COLLAPSIBLE CARD — one job per level (simplification #1 + #2)
//   collapsed = one line: marker · title · state · date
//   expanded  = the content (body first)
// ============================================================
function CollapsibleCard({ expanded, onToggle, selectable, selected, onSelect, anySelected, marker, title, serif, when, state, children }) {
  const cls = ['cs-row', 'rp-card'];
  if (expanded) cls.push('open');
  if (selected) cls.push('sel');
  if (selectable) cls.push('selectable');
  if (anySelected) cls.push('any-sel');
  return (
    <div className={cls.join(' ')}>
      <div className="cs-row-head" onClick={onToggle}>
        {selectable && <Check on={selected} onClick={onSelect} />}
        <div className="cs-row-lead">
          {marker && <Eyebrow tone={marker === 'today' ? 'today' : 'next'}>{marker === 'today' ? 'Today' : 'Next up'}</Eyebrow>}
          <span className={`cs-row-title ${serif ? 'serif' : ''}`}>{title}</span>
        </div>
        <div className="cs-row-meta">
          {state && <StatePill state={state} />}
          {when && <span className="cs-when">{when}</span>}
          <span className="cs-chev">{I.chevD}</span>
        </div>
      </div>
      {expanded && <div className="cs-row-body"><div className="cs-row-body-inner">{children}</div></div>}
    </div>
  );
}

// ---- one quiet mono meta line (replaces the v1 meta grid) ----
function MetaLine({ parts }) {
  return <div className="cs-metaline">{parts.filter(Boolean).join('  ·  ')}</div>;
}

// ---- card action row: Preview + overflow. Not five buttons. ----
function CardActions({ children }) { return <div className="cs-actions">{children}</div>; }

function OverflowMenu({ items }) {
  const [open, setOpen] = sS(false);
  const ref = sR(null);
  sE(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <span className="cs-menu-wrap" ref={ref}>
      <button className="rp-btn rp-btn-ghost rp-btn-sm cs-menu-trigger" onClick={() => setOpen(o => !o)} aria-label="More actions">{I.dots}</button>
      {open && (
        <div className="cs-menu">
          {items.map((it, i) => (
            <button key={i} className="cs-menu-item" onClick={() => { setOpen(false); it.onClick && it.onClick(); }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// ---- analytics ghost seat (post-MVP; holds the slot) ----
function GhostSlot({ label }) { return <span className="cs-ghost">{label || 'opens · reactions · saves — post-MVP'}</span>; }

// ---- publish-lock cue — restrained. Neutral, not a colored box.
//      Correction affordance renders beneath it (CD ratified Q4). ----
function LockCue({ when, onCorrection }) {
  return (
    <div className="cs-lock">
      <span className="cs-lock-line">{I.lock}<b>Locked</b> · posted {when}. {'What leaders read, we don\u2019t retroactively rewrite.'}</span>
      {onCorrection && <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={onCorrection}>Draft a correction</button>}
    </div>
  );
}

// ============================================================
// RIGHT-SIDE DRAWER CHASSIS — the shipped .rp-decrypt-* panel from
// globals, shared by filters / preview / version history.
// ============================================================
function DrawerShell({ eyebrow, title, onClose, foot, children }) {
  return (
    <>
      <div className="rp-decrypt-backdrop" onClick={onClose} />
      <div className="rp-decrypt-panel cs-drawer">
        <div className="rp-decrypt-head">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <div className="rp-decrypt-title">{title}</div>
          </div>
          <button className="cs-x" onClick={onClose}>{I.x}</button>
        </div>
        <div className="rp-decrypt-body">{children}</div>
        {foot && <div className="cs-drawer-foot">{foot}</div>}
      </div>
    </>
  );
}

// ---- filter drawer (State first — CD ratified Q3) ----
function FilterChip({ on, label, onClick }) {
  return (
    <button className={`cs-fchip ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="ck">{I.check}</span>{label}
    </button>
  );
}
function FacetBlock({ f }) {
  return (
    <div className="cs-facet">
      <div className="cs-facet-label">{f.label}{f.selected && f.selected.size > 0 && <span className="clr" onClick={f.onClear}>Clear</span>}</div>
      {f.type === 'daterange' ? (
        <div className="cs-daterow">
          <input className="rp-input" type="date" defaultValue={f.from} />
          <span className="to">to</span>
          <input className="rp-input" type="date" defaultValue={f.to} />
        </div>
      ) : (
        <div className="cs-chipwrap">
          {f.options.map(o => <FilterChip key={o} on={f.selected && f.selected.has(o)} label={o} onClick={() => f.onToggle && f.onToggle(o)} />)}
        </div>
      )}
    </div>
  );
}
function FilterDrawer({ facets, onClose, onClear, applied }) {
  const [more, setMore] = sS(false);
  const primary = facets.filter(f => !f.secondary);
  const secondary = facets.filter(f => f.secondary);
  return (
    <DrawerShell eyebrow="Filter · sticky while scrolling" title="Filters" onClose={onClose}
      foot={<>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={onClear}>Clear all</button>
        <span className="cs-foot-note">{applied} applied</span>
      </>}>
      {primary.map((f, i) => <FacetBlock key={i} f={f} />)}
      {secondary.length > 0 && (
        <>
          <button className={`cs-morefilters ${more ? 'open' : ''}`} onClick={() => setMore(v => !v)}>
            <span className="chev">{I.chev}</span>{more ? 'Fewer filters' : `More filters · ${secondary.length}`}
          </button>
          {more && secondary.map((f, i) => <FacetBlock key={i} f={f} />)}
        </>
      )}
    </DrawerShell>
  );
}

// ---- version history drawer (drafts only; freezes at publish) ----
function VersionHistoryDrawer({ title, onClose }) {
  const revs = [
    { when: 'just now', by: 'Ruth', diff: 'Current working draft.', current: true },
    { when: '12 min ago', by: 'Ruth', diff: 'Tightened the second paragraph; changed badge from New to none.' },
    { when: '1h ago', by: 'Ada', diff: 'Reworked the title; added a byline.' },
    { when: '2h ago', by: 'Ruth', diff: 'Draft created from a duplicate of "July prayer calendar".' },
  ];
  return (
    <DrawerShell eyebrow="Version history · drafts only" title={title} onClose={onClose}
      foot={<span className="cs-foot-note">History freezes at publish. After lock, corrections are separate posts.</span>}>
      {revs.map((r, i) => (
        <div className={`cs-vh ${r.current ? 'current' : ''}`} key={i}>
          <div className="cs-vh-node"><span className="dot" />{i < revs.length - 1 && <span className="line" />}</div>
          <div className="cs-vh-main">
            <div className="cs-vh-when">{r.current ? 'Current' : r.when}{r.current ? ` · ${r.when}` : ''}</div>
            <div className="cs-vh-diff">{r.diff}</div>
            <div className="cs-vh-by">{r.by}{!r.current && <> · <button className="cs-linkbtn">Restore</button></>}</div>
          </div>
        </div>
      ))}
    </DrawerShell>
  );
}

// ============================================================
// LEADER PREVIEW — plain dark surface, NO phone chrome (directive #7).
// Renders the same leader card shapes the app ships.
// ============================================================
function PreviewSurface({ eyebrow, note, children }) {
  return (
    <div className="cs-preview">
      <Eyebrow>{eyebrow || 'Preview · as leaders see it'}</Eyebrow>
      {note && <div className="cs-preview-note">{note}</div>}
      <div className="cs-preview-stage">{children}</div>
    </div>
  );
}

function AnnouncementLeaderCard({ item }) {
  const meta = leaderBadgeMeta(item);
  const isLink = item.cardType === 'link';
  return (
    <div className="lc">
      <div className="lc-eyebrow"><span className="lc-dot" style={{ background: meta.color }} /><span className="lc-lab">{meta.label}</span><span className="lc-rule" /><span className="lc-time">now</span></div>
      <div className="lc-title">{item.title}</div>
      <div className="lc-body">{item.body}</div>
      {isLink ? (
        <a className="lc-link" href="#" onClick={e => e.preventDefault()}>
          {I.link}
          <span className="lc-link-main"><span className="rt">{item.resource}</span><span className="rs">{item.linkSource}</span></span>
          <span className="lc-link-go">Open {I.chev}</span>
        </a>
      ) : (
        <div className="lc-readon"><span className="r-rule" /><span className="r-txt">read on</span></div>
      )}
      <div className="lc-foot"><span className="lc-seal">R</span><span className="lc-by">{item.byline || 'Replant Team'}</span><span className="lc-cc">2 comments</span></div>
    </div>
  );
}
function ScriptureLeaderCard({ item }) {
  return (
    <div className="lc-strip">
      <span className="lc-quote">{'\u201C'}</span>
      <div className="lc-verse scriptureItalic">{item.verse}</div>
      <div className="lc-sref"><b>{item.ref}</b>{item.translation ? ` \u00b7 ${item.translation}` : ''}</div>
    </div>
  );
}
function MissionLeaderCard({ item }) {
  return (
    <div className="lc">
      <div className="lc-media"><span>mission image</span></div>
      <div className="lc-eyebrow"><span className="lc-dot" /><span className="lc-lab">{(item.missionType || '').toUpperCase()}</span><span className="lc-rule" /></div>
      <div className="lc-title">{item.title}</div>
      <div className="lc-body">{item.body}</div>
      <div className="lc-meta">
        <div><span className="k">Location</span><span className="v">{item.location}</span></div>
        <div><span className="k">When</span><span className="v">{item.dates}</span></div>
        {item.org && <div><span className="k">With</span><span className="v">{item.org}</span></div>}
      </div>
      <span className="lc-cta">Express interest</span>
    </div>
  );
}
function WitnessLeaderCard({ item }) {
  return (
    <div className="lc">
      <div className="lc-eyebrow"><span className="lc-dot" /><span className="lc-lab">WITNESS OF THE DAY</span><span className="lc-rule" /></div>
      <div className="lc-w-era">{item.era} · {item.yearsLabel}</div>
      <div className="lc-w-name">{item.name}</div>
      <div className="lc-verse scriptureItalic">{'\u201C'}{item.quote}{'\u201D'}</div>
      <div className="lc-body">{item.description}</div>
      <div className="lc-sref"><b>{item.scriptureRef}</b></div>
    </div>
  );
}

function PreviewDrawer({ item, kind, onClose }) {
  let card, note;
  if (kind === 'scripture') { card = <ScriptureLeaderCard item={item} />; note = 'The live ScriptureCard the leader app ships — scriptureItalic is reserved for the verse itself.'; }
  else if (kind === 'outreach') { card = <MissionLeaderCard item={item} />; note = 'How this listing shows up on the leader Outreach & Missions page (reached from the menu).'; }
  else if (kind === 'witness') { card = <WitnessLeaderCard item={item} />; note = 'The live witness card on the Persecuted tab. The quote is the centerpiece.'; }
  else { card = <AnnouncementLeaderCard item={item} />; note = 'The live AnnouncementCard the leader app ships. Not a screenshot.'; }
  return (
    <DrawerShell eyebrow="Preview · as leaders see it" title="Leader preview" onClose={onClose}
      foot={<span className="cs-foot-note">This is the leader card component, not a screenshot.</span>}>
      <div className="cs-preview-note">{note}</div>
      <div className="cs-preview-stage">{card}</div>
    </DrawerShell>
  );
}

// ============================================================
// CEREMONY MODAL — replaces the toast. Acknowledgment beyond an
// in-place state change is a modal ceremony, never a floating flash.
// ============================================================
function CeremonyModal({ eyebrow, title, children, confirmLabel, onConfirm, onClose, dismissLabel }) {
  return (
    <div className="ov open" onClick={onClose}>
      <div className="mdl cs-mdl" onClick={e => e.stopPropagation()}>
        <div className="mdl-head"><div className="mh-text"><Eyebrow>{eyebrow}</Eyebrow><div className="mdl-title">{title}</div></div></div>
        <div className="mdl-body">{children}</div>
        <div className="mdl-foot">
          <button className="rp-btn rp-btn-ghost" onClick={onClose}>{dismissLabel || 'Close'}</button>
          <span className="mf-spacer" />
          {confirmLabel && <button className="rp-btn rp-btn-primary" onClick={() => { onConfirm && onConfirm(); }}>{confirmLabel}</button>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAGINATION (10 per page — Content only; Posted = load-on-demand)
// ============================================================
function PaginationFooter({ page, pages, total, onPage, loadMore }) {
  return (
    <div className="cs-page">
      <span className="cs-page-count">{total} items · 10 per page</span>
      {loadMore ? (
        <button className="cs-linkbtn" onClick={loadMore}>Load more from the archive {I.chevD}</button>
      ) : (
        <div className="cs-page-nav">
          <button className="cs-pagebtn" onClick={() => onPage && onPage(Math.max(1, page - 1))}>‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 5).map(n => (
            <button key={n} className={`cs-pagebtn ${n === page ? 'on' : ''}`} onClick={() => onPage && onPage(n)}>{n}</button>
          ))}
          {pages > 5 && <span className="cs-page-ell">… {pages}</span>}
          <button className="cs-pagebtn" onClick={() => onPage && onPage(Math.min(pages, page + 1))}>›</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BULK-ACTION BAR (multi-select > 0). All actions ghost (directive
// #5) — nothing in Content is destructive; the confirm carries weight.
// ============================================================
function BulkBar({ count, onClear, actions }) {
  if (!count) return null;
  return (
    <div className="cs-bulk">
      <span className="cs-bulk-count"><b>{count}</b> selected</span>
      <span className="cs-bulk-div" />
      {actions.map((a, i) => (
        <button key={i} className="rp-btn rp-btn-ghost rp-btn-sm" onClick={a.onClick}>{a.icon}{a.label}</button>
      ))}
      <span className="cs-bulk-note">Each operation is audit-logged per row.</span>
      <span className="cs-bulk-spacer" />
      <button className="cs-linkbtn" onClick={onClear}>Clear</button>
    </div>
  );
}

// ============================================================
// EDITOR FIELD PRIMITIVES — a writing surface, not a database form
// (simplification #3). No "maps to author_type" hints in the UI.
// ============================================================
function Counter({ len, max }) {
  const tone = len > max ? 'over' : len > max * 0.8 ? 'amber' : '';
  return <span className={`cs-count ${tone}`}>{len}/{max}</span>;
}
function Field({ label, req, count, hint, children, className }) {
  return (
    <div className={`cs-field ${className || ''}`}>
      {(label || count) && (
        <div className="cs-field-head">
          <label className="rp-label">{label}{req && <span className="cs-req"> ·</span>}</label>
          {count}
        </div>
      )}
      {children}
      {hint && <div className="cs-hint">{hint}</div>}
    </div>
  );
}
function Select({ value, onChange, options, labels }) {
  return (
    <div className="cs-select">
      <select className="rp-select" value={value} onChange={e => onChange && onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{labels ? labels(o) : o}</option>)}
      </select>
      <span className="cs-select-chev">{I.chevD}</span>
    </div>
  );
}
function ShowMore({ open, onToggle, label, children }) {
  return (
    <div className="cs-showmore">
      <button className={`cs-showmore-toggle ${open ? 'open' : ''}`} onClick={onToggle}><span className="chev">{I.chev}</span>{open ? 'Hide' : 'Show more'} — {label}</button>
      {open && <div className="cs-showmore-body">{children}</div>}
    </div>
  );
}
function Switch({ on, onClick }) { return <button className={`cs-switch ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} />; }
function ToggleRow({ title, sub, on, onClick }) {
  return (
    <div className="cs-toggle">
      <div><div className="t">{title}</div><div className="s">{sub}</div></div>
      <Switch on={on} onClick={onClick} />
    </div>
  );
}

Object.assign(window, {
  Eyebrow, WorkflowTabs, SiblingTabs, StatePill, Check, CollapsibleCard, MetaLine,
  CardActions, OverflowMenu, GhostSlot, LockCue, DrawerShell, FilterChip, FilterDrawer,
  VersionHistoryDrawer, PreviewSurface, PreviewDrawer, AnnouncementLeaderCard,
  ScriptureLeaderCard, MissionLeaderCard, WitnessLeaderCard, CeremonyModal,
  PaginationFooter, BulkBar, Counter, Field, Select, ShowMore, Switch, ToggleRow,
});
