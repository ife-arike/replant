/* eslint-disable */
// ── Content Section · PATTERN REFERENCE SHEET (v2, deliverable #1) ────
// Every shared primitive shown once in the v2 register, plus the
// simplification thesis made explicit (before/after density).
const { useState: pS } = React;

function RefCard({ n, label, desc, children }) {
  return (
    <div className="cs-refcard">
      <div className="rc-lab"><span className="n">{n}</span> · {label}</div>
      <div className="rc-desc">{desc}</div>
      {children}
    </div>
  );
}

function PatternSheet() {
  const [tab, setTab] = pS('home');
  const [openA, setOpenA] = pS(true);
  const [more, setMore] = pS(false);

  return (
    <div>
      <div className="cs-quiet">
        The Content section is the tone-setter for everyone who reads what lands here. <b>One pattern, applied everywhere</b> — Announcements, Daily Scripture, Outreach &amp; Missions, and every future Content surface are the same shell with different content. v2 re-renders that shell in the admin dashboard&rsquo;s own register: q-tabs, ghost buttons, <span className="scriptureItalic" style={{ color: 'var(--rp-text)' }}>serif</span> for editorial only, mono eyebrows, and type + whitespace carrying the hierarchy.
      </div>

      {/* THESIS — one job per level */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">A</span><span className="cs-refsec-title">The v2 thesis — one job per level</span><span className="cs-refsec-q">Simpler, cleaner. Every level does exactly one thing.</span></div>
        <div className="cs-thesis">
          <div className="cs-thesis-col before">
            <div className="cs-thesis-tag">Before · v1 — every card a small dashboard</div>
            <div className="cs-thesis-demo">
              <div className="cs-b1-card">
                <div className="cs-b1-sub"><span className="cs-b1-pill a">admin</span><span className="cs-b1-pill b">prayer</span><span className="cs-b1-pill c">urgent</span><span className="cs-b1-pill d">call to action</span></div>
                <div className="cs-b1-title">Standing with the church in Manipur</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {['Preview', 'Test send', 'Duplicate', 'History', 'Publish'].map(b => <span key={b} style={{ fontSize: 10, padding: '4px 8px', border: '1px solid #2a2a2a', borderRadius: 3, color: '#9a9a9a' }}>{b}</span>)}
                </div>
              </div>
            </div>
          </div>
          <div className="cs-thesis-col after">
            <div className="cs-thesis-tag">After · v2 — one line, then the content</div>
            <div className="cs-thesis-demo">
              <CollapsibleCard expanded={openA} onToggle={() => setOpenA(v => !v)} marker="today"
                title="Standing with the church in Manipur this week" when="Jun 30" state="published">
                <div className="cs-body-text">Renewed violence has displaced dozens of house-church families across the hills. Set aside time this week to pray for shelter and for the pastors coordinating relief.</div>
                <MetaLine parts={['call to action', 'Ruth', 'push on']} />
                <CardActions>
                  <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.eye} Preview</button>
                  <OverflowMenu items={[{ label: 'Test send', icon: I.send }, { label: 'Duplicate', icon: I.copy }, { label: 'Version history', icon: I.history }]} />
                  <span className="sp" /><GhostSlot />
                </CardActions>
              </CollapsibleCard>
            </div>
          </div>
        </div>
      </div>

      {/* 1 — Tabs */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">01</span><span className="cs-refsec-title">Tabs — one grammar</span><span className="cs-refsec-q">Everything is q-tabs (Founder-locked). No filled segmented control.</span></div>
        <div className="cs-refgrid">
          <RefCard n="1a" label="Sibling surfaces — q-tabs" desc="Announcements ↔ Witness of the Day. The upper q-tabs row, a notch heavier, mirroring the app’s TriageTabBar + inner tabs.">
            <SiblingTabs tabs={[{ id: 'a', label: 'Announcements' }, { id: 'b', label: 'Witness of the Day' }]} active="a" onChange={() => {}} />
          </RefCard>
          <RefCard n="1b" label="Workflow — Home / Drafts / Posted" desc="Every surface carries these. One control band: tabs left, Filters / Submissions / New right, sharing the underline.">
            <WorkflowTabs tabs={[{ id: 'home', label: 'Home', count: 4 }, { id: 'drafts', label: 'Drafts', count: 5 }, { id: 'posted', label: 'Posted', count: 128 }]} active={tab} onChange={setTab}
              right={<button className="rp-btn rp-btn-ghost rp-btn-sm">{I.plus} New</button>} />
          </RefCard>
        </div>
      </div>

      {/* 2 — State + markers */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">02</span><span className="cs-refsec-title">State &amp; markers</span><span className="cs-refsec-q">.state pills from globals. Today / Next up are mono eyebrows, never colored pills.</span></div>
        <div className="cs-refgrid">
          <RefCard n="2a" label="State pills" desc="Draft (neutral) · Scheduled (sky, the one accent) · Posted (neutral, at rest). Color rises only where it earns its place.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><StatePill state="draft" /><StatePill state="scheduled" /><StatePill state="published" /></div>
          </RefCard>
          <RefCard n="2b" label="Today / Next up — eyebrows" desc="Mono uppercase eyebrow text, not marker pills. Today carries the one sky accent; Next up is muted.">
            <div style={{ display: 'flex', gap: 20 }}><Eyebrow tone="today">Today</Eyebrow><Eyebrow tone="next">Next up</Eyebrow></div>
          </RefCard>
          <RefCard n="2c" label="Analytics ghost seat" desc="Per-post opens / reactions / saves are post-MVP. The ghost holds the seat so a future card slots the number in without a redesign.">
            <GhostSlot />
          </RefCard>
        </div>
      </div>

      {/* 3 — Multi-select + bulk */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">03</span><span className="cs-refsec-title">Multi-select &amp; bulk actions</span><span className="cs-refsec-q">Checkbox appears on hover / once selection begins. All actions ghost — the confirm carries the weight.</span></div>
        <BulkBar count={3} onClear={() => {}} actions={[{ label: 'Delete', icon: I.trash }, { label: 'Archive', icon: I.archive }, { label: 'Publish now', icon: I.send }, { label: 'Reschedule', icon: I.clock }]} />
      </div>

      {/* 4 — Toolbar affordances */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">04</span><span className="cs-refsec-title">Affordances</span><span className="cs-refsec-q">Filters / Preview / overflow (Test send · Duplicate · History) / pagination.</span></div>
        <div className="cs-refgrid">
          <RefCard n="4a" label="Filters — right drawer" desc="Right-side slide-in on the shipped drawer chassis, shared with Preview + Version history. State first, then Author, Date range, then surface facets.">
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.filter} Filters</button>
          </RefCard>
          <RefCard n="4b" label="Preview — leader card, no phone chrome" desc="Renders the same leader card the app ships, on a plain dark surface. No notch, no fake status bar, no invented tab bar.">
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.eye} Preview</button>
          </RefCard>
          <RefCard n="4c" label="Overflow — not five buttons" desc="Preview stays visible; Test send / Duplicate / Version history fold into a ⋯ menu so the action row reads as two, not five.">
            <OverflowMenu items={[{ label: 'Test send', icon: I.send }, { label: 'Duplicate', icon: I.copy }, { label: 'Version history', icon: I.history }]} />
          </RefCard>
          <RefCard n="4d" label="Pagination — 10 per page" desc="Content pages only. Posted supports load-on-demand for the archive.">
            <PaginationFooter page={2} pages={4} total={38} onPage={() => {}} />
          </RefCard>
        </div>
      </div>

      {/* 5 — Publish-lock + correction */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">05</span><span className="cs-refsec-title">Publish-lock &amp; correction</span><span className="cs-refsec-q">Post-publish = full lock. Restrained cue, not a colored box. Correction affordance lives beneath it.</span></div>
        <div className="cs-refcard">
          <LockCue when="Jun 30" onCorrection={() => {}} />
          <div className="cs-correction"><span className="node">└─</span> A correction is a new &ldquo;Correction to…&rdquo; post threaded via <b style={{ color: 'var(--rp-muted-2)', fontWeight: 500 }}>correction_of</b>. The reader sees both — nothing is silently rewritten.</div>
        </div>
      </div>

      {/* 6 — Confirmation model */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">06</span><span className="cs-refsec-title">Confirmation — no toasts</span><span className="cs-refsec-q">Confirmation IS the state change: the pill flips, the row moves, the lock cue appears. Anything more is a modal ceremony.</span></div>
        <div className="cs-refgrid">
          <RefCard n="6a" label="In-place state change" desc="Post a draft and it leaves Drafts for Posted; the pill flips. No floating flash.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><StatePill state="draft" /><span style={{ color: 'var(--rp-muted-2)' }}>→</span><StatePill state="published" /></div>
          </RefCard>
          <RefCard n="6b" label="Modal ceremony" desc="When an operation needs acknowledgment beyond the state change (test send, correction, bulk delete), it is a modal ceremony — the confirm is the action.">
            <span className="scriptureItalic" style={{ color: 'var(--rp-muted-2)', fontSize: 14 }}>&ldquo;audit-logged&rdquo; · &ldquo;Locked&rdquo; · &ldquo;cannot be undone&rdquo; — kept only where literally true.</span>
          </RefCard>
        </div>
      </div>

      {/* 7 — Editor grammar */}
      <div className="cs-refsec">
        <div className="cs-refsec-head"><span className="cs-refsec-num">07</span><span className="cs-refsec-title">Editor grammar — a writing surface</span><span className="cs-refsec-q">Title + Body dominant. Classification in one compact row. Delivery behind Show more. No DB hints in the UI.</span></div>
        <div className="cs-editor-card" style={{ maxWidth: 620 }}>
          <Field label="Title" req count={<Counter len={44} max={100} />} className="cs-editor-title">
            <input className="rp-input" defaultValue="Standing with the church in Manipur this week" />
          </Field>
          <div className="cs-classrow">
            <Field label="Source" req><Select value="admin" onChange={() => {}} options={SOURCE_OPTS} labels={human} /></Field>
            <Field label="Topic" req><Select value="prayer" onChange={() => {}} options={TOPIC_OPTS} labels={human} /></Field>
            <Field label="Badge"><Select value="urgent" onChange={() => {}} options={BADGE_OPTS} labels={human} /></Field>
          </div>
          <ShowMore open={more} onToggle={() => setMore(v => !v)} label="card type & delivery">
            <Field label="Card type"><Select value="call_to_action" onChange={() => {}} options={CARDTYPE_OPTS} labels={human} /></Field>
            <ToggleRow title="Push notification" sub="Off by default · opt in per post" on={false} onClick={() => {}} />
          </ShowMore>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PatternSheet });
