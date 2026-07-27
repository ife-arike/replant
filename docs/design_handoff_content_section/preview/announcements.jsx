/* eslint-disable */
// ── SURFACE 1 · ANNOUNCEMENTS ───────────────────────────────────────
// Retrofitted onto the shared pattern + column reconciliation
// (Source/Byline/Topic/Badge/Card type) + Witness of the Day sibling
// + Leader/Partner/Blog submissions review queue.
const { useState: anS } = React;

// ---- one announcement card (Home / Posted / Drafts) ----
function AnnCard({ item, expanded, onToggle, selectable, selected, onSelect, marker, mode, flash, onPreview, onHistory }) {
  const isPosted = item.state === 'published';
  const head = (
    <div className="cs-card-headmain">
      <span className="cs-card-title">{item.title}</span>
      <span className="cs-card-sub">
        <StatePill state={item.state} when={item.when} />
        <Tag kind="src">{item.source}</Tag>
        {item.byline && <span style={{ font: '400 10.5px var(--rp-mono)', color: 'var(--rp-sky)' }}>{item.byline}</span>}
        <Tag kind="topic">{human(item.topic)}</Tag>
        {item.badge && item.badge !== 'none' && <Tag kind={`badge-${item.badge}`}>{item.badge}</Tag>}
      </span>
    </div>
  );
  const body = (
    <>
      {mode === 'posted' && isPosted && <LockCue when={item.when.replace('Published ', '')} />}
      <div className="cs-card-text">{item.body}</div>
      <div className="cs-metagrid">
        <div className="mg"><span className="mg-k">Card type</span><span className="mg-v">{human(item.cardType)}</span></div>
        <div className="mg"><span className="mg-k">Author</span><span className="mg-v">{item.author}</span></div>
        <div className="mg"><span className="mg-k">Push</span><span className="mg-v">{item.pushed ? 'On' : 'Off'}</span></div>
      </div>
      {mode === 'posted' && item.correctionOf && (
        <div className="cs-correction-thread">
          <div className="ct-lab">Correction chain</div>
          <div className="ct-item"><span className="ct-node">└─</span> This post corrects an earlier announcement · threaded via correction_of</div>
        </div>
      )}
      <div className="cs-card-actions">
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onPreview(item)}>{I.eye} Preview</button>
        {mode !== 'posted' && <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Test send queued.', 'Sent to you with test=true. Never counts toward analytics.', true)}>{I.send} Test send</button>}
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Duplicated to a new draft.', 'Pre-filled title / body / source / tag from this post. Parent id recorded.')}>{I.copy} Duplicate</button>
        {mode === 'drafts' && <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onHistory(item)}>{I.history} History</button>}
        {mode === 'posted' && isPosted && <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Drafting a correction.', 'A new "Correction to…" post threads to this one.')}>{I.edit} Draft a correction</button>}
        {mode === 'drafts' && <button className="rp-btn rp-btn-primary rp-btn-sm">Publish</button>}
        <span className="spacer" />
        <span className="cs-ghost-slot">opens · reactions · saves — post-MVP</span>
      </div>
    </>
  );
  return (
    <CollapsibleCard item={item} expanded={expanded} onToggle={onToggle}
      selectable={selectable} selected={selected} onSelect={onSelect} marker={marker}
      head={head} body={body} />
  );
}

// ---- the announcement editor (all 5 reconciled fields + preview) ----
function AnnouncementEditor({ flash, previewOpen, onTogglePreview }) {
  const [source, setSource] = anS('leader');
  const [byline, setByline] = anS('From a bishop · West Africa');
  const [topic, setTopic] = anS('word_from_family');
  const [badge, setBadge] = anS('none');
  const [cardType, setCardType] = anS('leader_word');
  const [adv, setAdv] = anS(true);
  const [title, setTitle] = anS('A word from a bishop in West Africa');
  const [body, setBody] = anS('Do not measure the harvest by the size of the field you can see. The seed you cannot see is the seed God is keeping.');
  const [push, setPush] = anS(false);
  const [targeting, setTargeting] = anS(false);

  const previewItem = { title, body, source, byline, topic, badge, cardType };

  return (
    <div className={`cs-editor-grid ${previewOpen ? 'with-preview' : ''}`}>
      <div className="cs-editor-card">
        <h3>Draft announcement</h3>
        <div className="sub">Source drives the downstream fields and the approval flow.</div>

        <Field label="Source" req hint="Selecting partner shows a required Partner org field; selecting leader shows a leader-search field." map={<>maps to <b>author_type</b> · admin / leader / partner / blog</>}>
          <Select value={source} onChange={setSource} options={SOURCE_OPTS} labels={human} />
        </Field>

        {source === 'leader' && (
          <Field label="Leader" hint="Search the verified leader who authored this.">
            <input className="rp-input" defaultValue="Bishop · West Africa (verified)" />
          </Field>
        )}
        {source === 'partner' && (
          <Field label="Partner org" req hint="Only orgs with the partner badge appear here.">
            <Select value="Voice of the Persecuted" onChange={() => {}} options={['Voice of the Persecuted', 'Frontier Medical Fellowship']} />
          </Field>
        )}

        <Field label="Title" req count={<Counter len={title.length} max={100} />}>
          <input className="rp-input" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
        </Field>

        <Field label="Byline (optional)" count={<Counter len={byline.length} max={30} />} hint='Optional byline for card real estate.' map={<>maps to <b>source_label</b> · text ≤30</>}>
          <input className="rp-input" value={byline} onChange={e => setByline(e.target.value.slice(0, 30))} placeholder='Optional byline — "From a pastor · Central Asia"' />
        </Field>

        <div className="cs-field-2col">
          <Field label="Topic" req hint="Filter facet + card decoration." map={<>maps to <b>topic</b> (new)</>}>
            <Select value={topic} onChange={setTopic} options={TOPIC_OPTS} labels={human} />
          </Field>
          <Field label="Badge" hint="Default none. Tiny leader-side badge." map={<>maps to <b>badge</b> · was tag_type</>}>
            <Select value={badge} onChange={setBadge} options={BADGE_OPTS} labels={human} />
          </Field>
        </div>

        <Field label="Body" req count={<Counter len={body.length} max={1000} />}>
          <textarea className="rp-textarea" value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 130 }} maxLength={1000} />
          <div className="cs-field-hint">Scripture references in the body auto-link to a tap-through chip in the leader app.</div>
        </Field>

        <div className="cs-advanced">
          <button className={`cs-advanced-toggle ${adv ? 'open' : ''}`} onClick={() => setAdv(v => !v)}><span className="chev">{I.chev}</span> {adv ? 'Hide' : 'Show more —'} card type &amp; delivery</button>
          {adv && (
            <div style={{ marginTop: 14 }}>
              <Field label="Card type" hint="Mobile rendering router. Default standard." map={<>maps to <b>card_type</b></>}>
                <Select value={cardType} onChange={setCardType} options={CARDTYPE_OPTS} labels={human} />
              </Field>
              <ToggleRow title="Push notification" sub="Off by default · opt in per post" on={push} onClick={() => setPush(v => !v)} />
              <ToggleRow title="Recipient targeting" sub="Default all leaders · segment by verified / region / role" on={targeting} onClick={() => setTargeting(v => !v)} />
            </div>
          )}
        </div>

        <div className="cs-editor-foot">
          <button className="rp-btn rp-btn-ghost" onClick={() => flash('Saved as draft.')}>Save to Drafts</button>
          <button className="rp-btn rp-btn-ghost" onClick={() => flash('Test send queued.', 'Sent to you with test=true.', true)}>{I.send} Test send</button>
          <button className="rp-btn rp-btn-ghost" onClick={onTogglePreview}>{I.eye} {previewOpen ? 'Hide preview' : 'Preview'}</button>
          <span className="spacer" />
          <span className="by">Posting as <b>Ruth · super_admin</b></span>
          <button className="rp-btn rp-btn-primary" onClick={() => flash('Published to the network feed.', 'Reached the targeted segment. Immutable now — corrections thread.')}>Publish</button>
        </div>
      </div>

      {previewOpen && (
        <div>
          <div className="cs-preview-note">Live leader card — the same AnnouncementCard / LeaderWordCard the app ships. Not a screenshot.</div>
          <div className="cs-preview-center"><PhoneFrame tab="Home"><AnnouncementLeaderCard item={previewItem} /></PhoneFrame></div>
        </div>
      )}
      <div style={{ gridColumn: '1 / -1' }}><FieldMapFooter map={FIELD_MAPS.announcements} title="Announcements editor" /></div>
    </div>
  );
}

// ---- witness of the day (sibling top-level tab) ----
function WitnessSurface({ flash }) {
  const [wf, setWf] = anS('home');
  return (
    <>
      <WorkflowTabs tabs={[{ id: 'home', label: 'Home', count: 3 }, { id: 'drafts', label: 'Drafts', count: 2 }, { id: 'posted', label: 'Posted', count: 362 }]} active={wf} onChange={setWf} />
      <div className="cs-cap"><span className="cap-q">Witnesses carry their own fields — name, region, era, life dates, testimony, primary source. A distinct editor, not the announcement editor.</span><span className="cap-right"><button className="rp-btn rp-btn-primary rp-btn-sm">{I.plus} New witness</button></span></div>
      {WITNESSES.map(w => (
        <div className={`cs-witness ${w.today ? 'is-today' : ''}`} key={w.id}>
          <div className="w-portrait"><span>{'{ portrait }'}</span></div>
          <div className="w-main">
            {w.today && <span className="cs-marker today" style={{ marginBottom: 8, display: 'inline-block' }}>Today</span>}
            <div className="w-era">{w.era} · {w.region}</div>
            <div className="w-name">{w.name}</div>
            <div className="w-sub"><span style={{ fontFamily: 'var(--rp-mono)' }}>{w.dates}</span></div>
            <div className="w-testimony">{w.testimony}</div>
            <div className="w-foot">
              <span className="w-scripchip">{w.scripture}</span>
              <span className="w-primary">Source: {w.source}</span>
              <span style={{ flex: 1 }} />
              <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.eye} Preview</button>
              <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.edit} Edit</button>
            </div>
          </div>
        </div>
      ))}
      <FieldMapFooter map={FIELD_MAPS.witness} title="Witness of the Day" />
    </>
  );
}

// ---- submissions review queue (deliverable #3) ----
function SubmissionsQueue({ flash }) {
  const [src, setSrc] = anS(new Set());
  const rows = SUBMISSIONS.filter(s => src.size === 0 || src.has(s.src));
  return (
    <>
      <div className="cs-cap"><span className="cap-q">Leader / Partner / Blog cross-posts drop here for triage. CD call Q5: kept as a filtered sub-surface under Announcements (a count badge lives on the toolbar), not a separate top-level entry — it belongs to the announcements workflow.</span></div>
      <div className="cs-toolbar">
        {['leader', 'partner', 'blog'].map(s => (
          <button key={s} className={`cs-fchip ${src.has(s) ? 'on' : ''}`} onClick={() => setSrc(p => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; })}>
            <span className="ck">{I.check}</span>{human(s)}
          </button>
        ))}
        <span className="cs-sortnote">{rows.length} awaiting triage · oldest first</span>
      </div>
      {rows.map(s => (
        <div className="cs-subrow" key={s.id}>
          <div className="sr-src"><span className={`cs-srcpill ${s.src}`}>{s.src}</span></div>
          <div className="sr-main">
            <div className="sr-author">{s.author} <span className="sr-org">· {s.org}</span></div>
            <div className="sr-title">{s.title}</div>
            <div className="sr-firstline">{s.firstLine}</div>
            <div className="sr-when">Submitted {s.when}</div>
          </div>
          <div className="sr-actions">
            <button className="rp-btn rp-btn-approve rp-btn-sm" onClick={() => flash('Approved & published.', `"${s.title}" is live.`)}>{I.check} Approve</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Opened in editor.', 'Draft pre-loaded for edits before publish.', true)}>{I.edit} Approve with edits</button>
            <button className="rp-btn rp-btn-reject rp-btn-sm" onClick={() => flash('Declined.', 'A reason is required and recorded to the submitter.')}>Decline</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Routed to another curator.')}>{I.route} Send to another curator</button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 16 }}><FieldMapFooter map={FIELD_MAPS.announcements} title="Submissions → announcements" /></div>
    </>
  );
}

// ---- the announcements surface shell ----
function AnnouncementsSurface({ initial, flash }) {
  const [topLevel, setTopLevel] = anS(initial.topLevel || 'announcements');
  const [wf, setWf] = anS(initial.workflow || 'home');
  const [view, setView] = anS(initial.view || 'list'); // list | editor | submissions
  const [previewOpen, setPreviewOpen] = anS(initial.previewOpen || false);
  const [expanded, setExpanded] = anS(() => new Set(ANNOUNCEMENTS.filter(a => a.today || a.next).map(a => a.id)));
  const [sel, setSel] = anS(() => new Set(initial.selected || []));
  const [drawer, setDrawer] = anS(null); // {type, item}

  const toggleExp = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSel = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const topTabs = [
    { id: 'announcements', label: 'Announcements' },
    { id: 'witness', label: 'Witness of the Day' },
  ];
  const wfTabs = [
    { id: 'home', label: 'Home', count: 4 },
    { id: 'drafts', label: 'Drafts', count: 5 },
    { id: 'posted', label: 'Posted', count: 128 },
  ];

  return (
    <>
      <TopLevelTabs tabs={topTabs} active={topLevel} onChange={(t) => { setTopLevel(t); setView('list'); }} />

      {topLevel === 'witness' ? <WitnessSurface flash={flash} /> : view === 'editor' ? (
        <AnnouncementEditor flash={flash} previewOpen={previewOpen} onTogglePreview={() => setPreviewOpen(v => !v)} />
      ) : view === 'submissions' ? (
        <SubmissionsQueue flash={flash} />
      ) : (
        <>
          <WorkflowTabs tabs={wfTabs} active={wf} onChange={setWf} />
          <div className="cs-toolbar">
            <button className="cs-filtertrigger" onClick={() => setDrawer({ type: 'filter' })}>{I.filter} Filters</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setView('submissions')} style={{ position: 'relative' }}>{I.route} Submissions <span className="tcount" style={{ marginLeft: 4 }}>4</span></button>
            <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => setView('editor')}>{I.plus} New announcement</button>
            <span className="cs-sortnote">{wf === 'home' ? "today's + next-scheduled expanded" : wf === 'drafts' ? 'work in progress · edit available' : 'archive · read-only + corrections'}</span>
          </div>

          {wf === 'home' && (
            <>
              {ANNOUNCEMENTS.map(a => (
                <AnnCard key={a.id} item={a} mode="home"
                  marker={a.today ? 'today' : a.next ? 'next' : null}
                  expanded={expanded.has(a.id)} onToggle={() => toggleExp(a.id)}
                  flash={flash} onPreview={(it) => setDrawer({ type: 'preview', item: it })} />
              ))}
              <PaginationFooter page={1} pages={13} total={128} onPage={() => {}} />
            </>
          )}

          {wf === 'drafts' && (
            <>
              {ANNOUNCEMENT_DRAFTS.map(a => (
                <AnnCard key={a.id} item={a} mode="drafts" selectable selected={sel.has(a.id)} onSelect={() => toggleSel(a.id)}
                  expanded={expanded.has(a.id)} onToggle={() => toggleExp(a.id)}
                  flash={flash} onPreview={(it) => setDrawer({ type: 'preview', item: it })}
                  onHistory={(it) => setDrawer({ type: 'history', item: it })} />
              ))}
              <BulkBar count={sel.size} onClear={() => setSel(new Set())} actions={[
                { label: 'Delete', tone: 'rp-btn-reject', icon: I.trash, onClick: () => flash('Deleted.', `${sel.size} drafts removed. Audit-logged per row.`) },
                { label: 'Archive', icon: I.archive, onClick: () => flash('Archived.') },
                { label: 'Publish now', tone: 'rp-btn-primary', onClick: () => flash('Published.', `${sel.size} drafts published to the feed.`) },
                { label: 'Reschedule', icon: I.clock, onClick: () => flash('Reschedule.', 'Pick a new time for the selected drafts.') },
              ]} />
            </>
          )}

          {wf === 'posted' && (
            <>
              {ANNOUNCEMENTS.filter(a => a.state === 'published').map(a => (
                <AnnCard key={a.id} item={a} mode="posted"
                  expanded={expanded.has(a.id) || a.today || !!a.correctionOf} onToggle={() => toggleExp(a.id)}
                  flash={flash} onPreview={(it) => setDrawer({ type: 'preview', item: it })} />
              ))}
              <PaginationFooter total={128} loadMore={() => flash('Loading archive…', 'Posted supports infinite load-on-demand.')} />
            </>
          )}

          <FieldMapFooter map={FIELD_MAPS.announcements} title="Announcements" />
        </>
      )}

      {drawer?.type === 'filter' && (
        <FilterDrawer applied={1} onClose={() => setDrawer(null)} onClear={() => {}}
          facets={[
            { label: 'State', options: ['Draft', 'Scheduled', 'Published', 'Archived'], selected: new Set(['Published']), onToggle: () => {}, onClear: () => {} },
            { label: 'Author', options: ['Ruth', 'Ada'], selected: new Set(), onToggle: () => {} },
            { label: 'Date range', type: 'daterange', from: '2026-06-01', to: '2026-07-01' },
            { label: 'Source', options: ['admin', 'leader', 'partner', 'blog'], selected: new Set(), onToggle: () => {} },
            { label: 'Topic', options: TOPIC_OPTS.map(human), selected: new Set(), onToggle: () => {} },
            { label: 'Badge', options: ['none', 'new', 'urgent'], selected: new Set(), onToggle: () => {} },
          ]} />
      )}
      {drawer?.type === 'preview' && <PreviewDrawer item={drawer.item} kind="announcements" onClose={() => setDrawer(null)} />}
      {drawer?.type === 'history' && <VersionHistoryDrawer title={drawer.item.title} onClose={() => setDrawer(null)} />}
    </>
  );
}

Object.assign(window, { AnnouncementsSurface });
