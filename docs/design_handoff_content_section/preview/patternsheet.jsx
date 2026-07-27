/* eslint-disable */
// ── Content Section · SHARED PATTERN REFERENCE SHEET (deliverable #1) ──
// One page. Every shared primitive shown once, with the CD note beside it.
const { useState: pS } = React;

function RefCard({ n, label, desc, children }) {
  return (
    <div className="cs-refcard">
      <div className="rc-lab"><span className="rc-n">{n}</span>{label}</div>
      <div className="rc-desc">{desc}</div>
      <div className="rc-demo">{children}</div>
    </div>
  );
}

function PatternSheet() {
  const [tab, setTab] = pS('home');
  const [expanded, setExpanded] = pS(true);
  const [sel, setSel] = pS(new Set(['x']));
  const [adv, setAdv] = pS(false);

  return (
    <div>
      <div className="cs-quiet-note">
        The Content section is the tone-setter of the app for hundreds of thousands who read what lands here. <b>One pattern, applied everywhere</b> — Announcements, Daily Scripture, Outreach &amp; Missions, and every future Content surface use the primitives on this sheet. Design once; the surfaces are the same shell with different content.
      </div>

      {/* 1 — Tabs */}
      <div className="cs-refsec">
        <div className="cs-refsec-head">
          <span className="cs-refsec-num">01</span>
          <span className="cs-refsec-title">Tabs</span>
          <span className="cs-refsec-q">Top-level (segmented) sits above workflow (underlined) — no tab-in-tab confusion.</span>
        </div>
        <div className="cs-refgrid">
          <RefCard n="1a" label="TOP-LEVEL · segmented" desc="Sibling surfaces at the same level (e.g. Announcements ↔ Witness of the Day). A filled segmented control reads as 'which surface am I in'.">
            <TopLevelTabs tabs={[{ id: 'a', label: 'Announcements' }, { id: 'b', label: 'Witness of the Day' }]} active={'a'} onChange={() => {}} />
          </RefCard>
          <RefCard n="1b" label="WORKFLOW · Home / Drafts / Posted" desc="Every Content surface has these three. Home = today's + next-scheduled, curated. Drafts = WIP, edit available. Posted = archive, read-only + correction affordance. Counts use the .tcount register.">
            <WorkflowTabs tabs={[{ id: 'home', label: 'Home', count: 4 }, { id: 'drafts', label: 'Drafts', count: 5 }, { id: 'posted', label: 'Posted', count: 128 }]} active={tab} onChange={setTab} />
          </RefCard>
        </div>
      </div>

      {/* 2 — Card collapse + state pills */}
      <div className="cs-refsec">
        <div className="cs-refsec-head">
          <span className="cs-refsec-num">02</span>
          <span className="cs-refsec-title">Card collapse &amp; state</span>
          <span className="cs-refsec-q">Default collapsed. Only today's + next-scheduled render expanded on Home &amp; Posted.</span>
        </div>
        <CollapsibleCard
          item={{}} expanded={expanded} onToggle={() => setExpanded(v => !v)}
          selectable selected={false} onSelect={() => {}} marker="today"
          head={<div className="cs-card-headmain">
            <span className="cs-card-title">Standing with the church in Manipur this week</span>
            <span className="cs-card-sub"><StatePill state="published" when="Published Jun 30" /><Tag kind="src">admin</Tag><Tag kind="topic">prayer</Tag><Tag kind="badge-urgent">urgent</Tag></span>
          </div>}
          body={<>
            <div className="cs-card-text">Renewed violence has displaced dozens of house-church families across the hills. Set aside time this week to pray for shelter, for the pastors coordinating relief, and for a swift end to the unrest.</div>
            <div className="cs-card-actions">
              <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.eye} Preview</button>
              <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.send} Test send</button>
              <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.copy} Duplicate</button>
              <span className="spacer" />
              <span className="cs-ghost-slot">opens · reactions · saves — post-MVP</span>
            </div>
          </>}
        />
        <CollapsibleCard item={{}} expanded={false} onToggle={() => {}} selectable selected={false} onSelect={() => {}}
          head={<div className="cs-card-headmain">
            <span className="cs-card-title">A word from a bishop in West Africa</span>
            <span className="cs-card-sub"><StatePill state="published" when="Published Jun 28" /><Tag kind="src">leader</Tag><Tag kind="topic">word from family</Tag></span>
          </div>} body={null} />
        <div className="cs-refgrid" style={{ marginTop: 16 }}>
          <RefCard n="2b" label="STATE PILLS" desc="Draft (neutral gray) · Scheduled (calm sky, carries the time) · Published (muted, no color) · Archived. Color rises only where it earns its place.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatePill state="draft" />
              <StatePill state="scheduled" when="Scheduled · Jul 3 · 9am UTC" />
              <StatePill state="published" when="Published Jun 30" />
              <StatePill state="archived" />
            </div>
          </RefCard>
          <RefCard n="2c" label="ANALYTICS GHOST SLOT" desc="Per-post opens / reactions / saves are post-MVP. The affordance ghost holds the seat so a future card can slot the number in without a redesign.">
            <span className="cs-ghost-slot">opens · reactions · saves — post-MVP</span>
          </RefCard>
        </div>
      </div>

      {/* 3 — Multi-select + bulk bar */}
      <div className="cs-refsec">
        <div className="cs-refsec-head">
          <span className="cs-refsec-num">03</span>
          <span className="cs-refsec-title">Multi-select &amp; bulk actions</span>
          <span className="cs-refsec-q">Row checkbox + a bar that surfaces on selection &gt; 0. Every bulk op is audit-logged per row.</span>
        </div>
        <BulkBar count={3} onClear={() => {}} actions={[
          { label: 'Delete', tone: 'rp-btn-reject', icon: I.trash },
          { label: 'Archive', icon: I.archive },
          { label: 'Publish now', tone: 'rp-btn-primary' },
          { label: 'Reschedule', icon: I.clock },
        ]} />
      </div>

      {/* 4 — Filters / preview / test send / duplicate / history */}
      <div className="cs-refsec">
        <div className="cs-refsec-head">
          <span className="cs-refsec-num">04</span>
          <span className="cs-refsec-title">Toolbar affordances</span>
          <span className="cs-refsec-q">Filters (right drawer) · Preview · Test send · Duplicate · Version history.</span>
        </div>
        <div className="cs-refgrid">
          <RefCard n="4a" label="FILTERS · right drawer" desc="Mirrors the CM mega-dropdown but as a right-side drawer, sticky at top while scrolling. State first (workflow anchor), then Author, Date range, then surface-specific facets. Consistent across all 3 surfaces.">
            <button className="cs-filtertrigger active">{I.filter} Filters <span className="ft-badge">2</span></button>
          </RefCard>
          <RefCard n="4b" label="PREVIEW · right slide-in" desc="Renders the mobile card exactly as leaders see it, using the SAME leader card components the app ships. Right-side slide-in keeps it always-available but out of the way.">
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.eye} Preview</button>
          </RefCard>
          <RefCard n="4c" label="TEST SEND" desc="Sends the post to one leader (usually the curator) before broadcasting — prevents '5,000 recipients + one typo'. Carries test=true; never counts toward analytics.">
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.send} Test send</button>
          </RefCard>
          <RefCard n="4d" label="DUPLICATE / copy from existing" desc="Pick an existing post as a template; the new draft pre-fills title / body / source / tag from the parent. Audit records the parent post id.">
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.copy} Duplicate</button>
          </RefCard>
          <RefCard n="4e" label="VERSION HISTORY · drafts only" desc="Last N revisions of a draft before it locks. Post-lock, history freezes; corrections become separate posts.">
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.history} History</button>
          </RefCard>
          <RefCard n="4f" label="PAGINATION · 10 per page" desc="Content pages only. Posted supports infinite load-on-demand for archive browsing.">
            <PaginationFooter page={2} pages={4} total={38} onPage={() => {}} />
          </RefCard>
        </div>
      </div>

      {/* 5 — Publish-lock + correction */}
      <div className="cs-refsec">
        <div className="cs-refsec-head">
          <span className="cs-refsec-num">05</span>
          <span className="cs-refsec-title">Publish-lock &amp; correction</span>
          <span className="cs-refsec-q">Post-publish = FULL-LOCK. Not a limitation — a discipline.</span>
        </div>
        <LockCue when="Jun 30" />
        <div className="cs-refgrid" style={{ marginTop: 4 }}>
          <RefCard n="5a" label="DRAFT A CORRECTION" desc="Corrections are never in-place edits. A new 'Correction to [title]' post threads to the original via correction_of FK and renders as a follow-up card in the leader feed. The affordance lives in the Posted row's expand drawer (CD call Q4).">
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.edit} Draft a correction</button>
          </RefCard>
          <RefCard n="5b" label="CORRECTION CHAIN" desc="The audit log carries the chain. The reader sees both the original and the follow-up — nothing is silently rewritten.">
            <div className="cs-correction-thread">
              <div className="ct-lab">Correction chain</div>
              <div className="ct-item"><span className="ct-node">└─</span> Correction to "Regional gathering moved to Saturday" · Jun 25</div>
            </div>
          </RefCard>
        </div>
      </div>

      {/* 6 — Editor grammar */}
      <div className="cs-refsec">
        <div className="cs-refsec-head">
          <span className="cs-refsec-num">06</span>
          <span className="cs-refsec-title">Editor grammar</span>
          <span className="cs-refsec-q">Live counters, required markers, advanced-fields fold, per-post toggles.</span>
        </div>
        <div className="cs-editor-card" style={{ maxWidth: 560 }}>
          <Field label="Title" req count={<Counter len={42} max={100} />}>
            <input className="rp-input" defaultValue="Standing with the church in Manipur this week" />
          </Field>
          <Field label="Byline (optional)" count={<Counter len={22} max={30} />} hint='Optional byline — "From a pastor · Central Asia"'>
            <input className="rp-input" placeholder='Optional byline — "From a pastor · Central Asia"' />
          </Field>
          <div className="cs-advanced">
            <button className={`cs-advanced-toggle ${adv ? 'open' : ''}`} onClick={() => setAdv(v => !v)}><span className="chev">{I.chev}</span> Show more — card type</button>
            {adv && <div style={{ marginTop: 12 }}><Field label="Card type" hint="Mobile rendering router. Default standard; change it when the content shape calls for it."><Select value="standard" options={CARDTYPE_OPTS} labels={human} /></Field></div>}
          </div>
          <div className="cs-divider" style={{ height: 1, background: 'var(--rp-border)', margin: '4px 0 14px' }} />
          <ToggleRow title="Push notification" sub="Off by default. Opt in per post." on={false} onClick={() => {}} />
          <ToggleRow title="Recipient targeting" sub="Default: all leaders. Segment by verified / region / role." on={true} onClick={() => {}} />
        </div>
      </div>

      {/* 7 — Field mapping footer */}
      <div className="cs-refsec">
        <div className="cs-refsec-head">
          <span className="cs-refsec-num">07</span>
          <span className="cs-refsec-title">Field / column mapping footer</span>
          <span className="cs-refsec-q">Every mockup carries one. Grounds the design to real DB columns.</span>
        </div>
        <FieldMapFooter map={FIELD_MAPS.announcements} title="Announcements (example)" />
      </div>
    </div>
  );
}

Object.assign(window, { PatternSheet });
