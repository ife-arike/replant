/* eslint-disable */
// ── SURFACE 1 · ANNOUNCEMENTS (v2) ──────────────────────────────────
// Simplified per the "one job per level" system. Sibling tab: Witness
// of the Day (its own real schema + rotation workflow). Sub-surface:
// Leader / Partner / Blog submissions review queue.
const { useState: anS } = React;

// ---- one announcement card ----
function AnnCard({ item, expanded, onToggle, selectable, selected, onSelect, anySelected, marker, mode, onPreview, onOverflow, onCorrection, onPublish }) {
  const isPosted = item.state === 'published';
  return (
    <CollapsibleCard expanded={expanded} onToggle={onToggle}
      selectable={selectable} selected={selected} onSelect={onSelect} anySelected={anySelected}
      marker={marker} title={item.title} when={item.when} state={item.state}>
      {mode === 'posted' && isPosted && <LockCue when={item.when} onCorrection={() => onCorrection(item)} />}
      {mode === 'posted' && item.correctionOf && (
        <div className="cs-correction"><span className="node">└─</span> Threads to <b style={{color:'var(--rp-muted-2)',fontWeight:500}}>{'\u201C'}{item.correctionOf}{'\u201D'}</b> via correction_of · the reader sees both.</div>
      )}
      <div className="cs-body-text">{item.body}</div>
      <MetaLine parts={[human(item.cardType), item.author, item.pushed ? 'push on' : 'push off', item.source !== 'admin' ? `via ${item.source}` : null]} />
      <CardActions>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onPreview(item)}>{I.eye} Preview</button>
        {mode === 'drafts' && <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.edit} Edit</button>}
        <OverflowMenu items={[
          ...(mode !== 'posted' ? [{ label: 'Test send — Coming Soon', icon: I.send, onClick: () => {} }] : []),   /* greyed at MVP — no endpoint ships (Founder + SEC F9) */
          { label: 'Duplicate', icon: I.copy, onClick: () => onOverflow('duplicate') },
          ...(mode === 'drafts' ? [{ label: 'Version history', icon: I.history, onClick: () => onOverflow('history', item) }] : []),
        ]} />
        <span className="sp" />
        {mode === 'drafts'
          ? <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => onPublish(item)}>Post to Feed</button>
          : <GhostSlot />}
      </CardActions>
    </CollapsibleCard>
  );
}

// author → byline template map (byline auto-fills, stays editable)
const AUTHOR_INFO = { admin: '', leader: 'From a bishop · West Africa', partner: 'Voice of the Persecuted', blog: 'The Persecuted Church Today' };

// ---- the announcement editor (a writing surface) ----
function AnnouncementEditor({ viewer, previewOpen, onTogglePreview, onCeremony, onCancel }) {
  const [source, setSource] = anS('leader');
  const [byline, setByline] = anS(AUTHOR_INFO.leader);
  const [bylineEdited, setBylineEdited] = anS(false);
  const [topic, setTopic] = anS('testimony');
  const [badge, setBadge] = anS('none');
  const [cardType, setCardType] = anS('standard');
  const [more, setMore] = anS(false);
  const [title, setTitle] = anS('A testimony from a bishop in West Africa');
  const [body, setBody] = anS('Do not measure the harvest by the size of the field you can see. The seed you cannot see is the seed God is keeping.');
  const [push, setPush] = anS(false);
  const [targeting, setTargeting] = anS(false);
  const [sched, setSched] = anS(false);
  // byline auto-populates from the author; a manual edit takes over.
  function changeSource(v) { setSource(v); if (!bylineEdited) setByline(bylineTemplate(v, AUTHOR_INFO[v])); }
  function resetByline() { setByline(bylineTemplate(source, AUTHOR_INFO[source])); setBylineEdited(false); }
  const previewItem = { title, body, source, byline, topic, badge, cardType, resource: 'Where the Church Stands — 2026', linkSource: 'briefing · external link', url: '#' };

  return (
    <div className={`cs-editor ${previewOpen ? 'with-preview' : ''}`}>
      <div className="cs-editor-card">
        <div className="cs-editor-h">New announcement</div>
        <div className="cs-editor-sub">Posts to the network feed for every active church.</div>

        <Field label="Title" req count={<Counter len={title.length} max={100} />} className="cs-editor-title">
          <input className="rp-input" value={title} onChange={e => setTitle(e.target.value.slice(0, 100))} placeholder="Announcement title…" />
        </Field>
        <Field label="Body" req count={<Counter len={body.length} max={1000} />}>
          <textarea className="rp-textarea" value={body} onChange={e => setBody(e.target.value.slice(0, 1000))} style={{ minHeight: 150 }} placeholder="Write the announcement…" />
        </Field>

        <div className="cs-classrow">
          <Field label="Source" req><Select value={source} onChange={changeSource} options={SOURCE_OPTS} labels={human} /></Field>
          <Field label="Topic" req><Select value={topic} onChange={setTopic} options={TOPIC_OPTS} labels={human} /></Field>
          <Field label="Badge"><Select value={badge} onChange={setBadge} options={BADGE_OPTS} labels={human} /></Field>
        </div>

        {source === 'leader' && (
          <Field label="Leader" hint="The verified leader who authored this word.">
            <input className="rp-input" defaultValue="Bishop · West Africa (verified)" />
          </Field>
        )}
        {source === 'partner' && (
          <Field label="Partner org" req hint="Only orgs carrying the partner badge appear here.">
            <Select value="Voice of the Persecuted" onChange={() => {}} options={['Voice of the Persecuted', 'Frontier Medical Fellowship']} />
          </Field>
        )}
        <Field label="Byline" count={<Counter len={byline.length} max={30} />} hint={source === 'admin' ? 'Admin posts carry the Replant Team seal — no byline needed.' : bylineEdited ? 'Edited — overrides the auto-fill from the author.' : 'Auto-filled from the author · editable.'}>
          <input className="rp-input" value={byline} onChange={e => { setByline(e.target.value.slice(0, 30)); setBylineEdited(true); }} placeholder="Optional byline…" />
          {bylineEdited && <button className="cs-linkbtn" style={{ marginTop: 7 }} onClick={resetByline}>Reset to the author template</button>}
        </Field>

        <ShowMore open={more} onToggle={() => setMore(v => !v)} label="card type & delivery">
          <Field label="Card type" hint="How the mobile app renders this. Default standard.">
            <Select value={cardType} onChange={setCardType} options={CARDTYPE_OPTS} labels={human} />
          </Field>
          {cardType === 'link' && (
            <div className="cs-classrow two" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
              <Field label="Link URL" req><input className="rp-input" defaultValue="https://" /></Field>
              <Field label="Resource label" hint="The framed link's title on the card."><input className="rp-input" defaultValue="Where the Church Stands — 2026" /></Field>
            </div>
          )}
          <ToggleRow title="Push notification" sub="Off by default · opt in per post" on={push} onClick={() => setPush(v => !v)} />
          <ToggleRow title="Recipient targeting" sub="Default all leaders · segment by verified / region / role" on={targeting} onClick={() => setTargeting(v => !v)} />
        </ShowMore>

        <div className="cs-editor-foot">
          <label className="cs-checkline">
            <input type="checkbox" checked={sched} onChange={e => setSched(e.target.checked)} /> Schedule for later
          </label>
          {sched && <input type="datetime-local" className="rp-input" defaultValue="2026-07-03T09:00" style={{ maxWidth: 220, colorScheme: 'dark' }} />}
          <span className="sp" />
          <button className="rp-btn rp-btn-ghost" onClick={onCancel}>Save to Drafts</button>
          <button className="rp-btn rp-btn-ghost" onClick={onTogglePreview}>{I.eye} {previewOpen ? 'Hide preview' : 'Preview'}</button>
          <button className="rp-btn rp-btn-primary" onClick={() => onCeremony(sched ? 'schedule' : 'publish')}>{sched ? 'Schedule' : 'Post to Feed'}</button>
        </div>
        <div className="cs-hint" style={{ marginTop: 12 }}>Posting as <b style={{ color: 'var(--rp-text)' }}>{viewer.first} · {viewer.tierLabel}</b> · content is curated by any admin tier.</div>
      </div>

      {previewOpen && (
        <PreviewSurface note="The live AnnouncementCard the leader app ships — not a screenshot.">
          <AnnouncementLeaderCard item={previewItem} />
        </PreviewSurface>
      )}
    </div>
  );
}

// ============================================================
// WITNESS OF THE DAY — real schema + rotation workflow
//   Today (derived) / Roster (rotation pool) / Drafts
// ============================================================
function WitnessCard({ w, expanded, onToggle, derived, onPreview, onOverflow }) {
  return (
    <div className={`cs-witness rp-card ${expanded ? 'open' : ''}`}>
      <div className="cs-witness-head" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {derived && <Eyebrow tone="today">Today · derived by rotation</Eyebrow>}
          <div className="cs-witness-era">{w.category.toUpperCase()}{w.martyr && w.category !== 'Martyr' ? ' · MARTYRED' : ''} &nbsp;·&nbsp; {w.era} · {w.yearsLabel} · {w.region}</div>
          <div className="cs-witness-name">{w.name}</div>
        </div>
        <div className="cs-row-meta"><span className="cs-chev">{I.chevD}</span></div>
      </div>
      {expanded && (
        <>
          <div className="cs-witness-quote">{'\u201C'}{w.quote}{'\u201D'}</div>
          <div className="cs-witness-desc">{w.description}</div>
          <div className="cs-witness-foot">
            <span className="cs-witness-ref">{w.scriptureRef}</span>
            <span className="cs-witness-src">Source · {w.sourceAttribution}</span>
            <span className="sp" />
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onPreview(w)}>{I.eye} Preview</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm">{I.edit} Edit</button>
            <OverflowMenu items={[{ label: 'Duplicate', icon: I.copy, onClick: () => onOverflow('duplicate') }]} />
          </div>
        </>
      )}
    </div>
  );
}

function WitnessEditor({ onCeremony, onCancel }) {
  const [cat, setCat] = anS('Martyr');
  const [martyr, setMartyr] = anS(true);
  const [quote, setQuote] = anS('Eighty and six years have I served Him, and He has done me no wrong. How then can I blaspheme my King who saved me?');
  const [desc, setDesc] = anS('');
  return (
    <div className="cs-editor">
      <div className="cs-editor-card">
        <div className="cs-editor-h">New witness</div>
        <div className="cs-editor-sub">Witnesses carry their own fields and enter the rotation once published. The quote is the centerpiece of the card.</div>
        <div className="cs-classrow two">
          <Field label="Name" req><input className="rp-input" defaultValue="Polycarp of Smyrna" /></Field>
          <Field label="Years label" req hint="One label, e.g. &ldquo;c. 69 – 155&rdquo;."><input className="rp-input" defaultValue="c. 69 – 155" /></Field>
        </div>
        <div className="cs-classrow">
          <Field label="Era" req><input className="rp-input" defaultValue="Apostolic Fathers" /></Field>
          <Field label="Region"><input className="rp-input" defaultValue="Smyrna, Asia Minor" /></Field>
          <Field label="Category" req><Select value={cat} onChange={setCat} options={WITNESS_CATEGORIES} /></Field>
        </div>
        <Field label="Quote" req count={<Counter len={quote.length} max={300} />} hint="The witness&rsquo;s own words. Renders in serif italic on the card.">
          <textarea className="rp-textarea scriptureItalic" value={quote} onChange={e => setQuote(e.target.value.slice(0, 300))} style={{ minHeight: 90, fontSize: 16 }} />
        </Field>
        <div className="cs-classrow two">
          <Field label="Scripture reference" req><input className="rp-input" defaultValue="2 Timothy 4:7" /></Field>
          <Field label="Scripture text"><input className="rp-input" placeholder="Optional verse text…" /></Field>
        </div>
        <Field label="Testimony / description" count={<Counter len={desc.length} max={600} />} hint="The roman body beneath the quote.">
          <textarea className="rp-textarea" value={desc} onChange={e => setDesc(e.target.value.slice(0, 600))} style={{ minHeight: 100 }} placeholder="A short account of the witness…" />
        </Field>
        <div className="cs-classrow two">
          <Field label="Source attribution"><input className="rp-input" defaultValue="The Martyrdom of Polycarp" /></Field>
          <div className="cs-field"><ToggleRow title="Martyr" sub="Marks this witness as martyred" on={martyr} onClick={() => setMartyr(v => !v)} /></div>
        </div>
        <div className="cs-editor-foot">
          <span className="sp" />
          <button className="rp-btn rp-btn-ghost" onClick={onCancel}>Save to Drafts</button>
          <button className="rp-btn rp-btn-primary" onClick={() => onCeremony('witness-publish')}>Add to roster</button>
        </div>
      </div>
    </div>
  );
}

function WitnessSurface({ onCeremony, onPreview }) {
  const [wf, setWf] = anS('today');
  const [view, setView] = anS('list');
  const [expanded, setExpanded] = anS(() => new Set(['W1']));
  const toggle = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const today = WITNESSES.find(w => w.today);

  if (view === 'editor') return <WitnessEditor onCeremony={onCeremony} onCancel={() => setView('list')} />;

  return (
    <>
      <WorkflowTabs tabs={[{ id: 'today', label: 'Today', count: null }, { id: 'roster', label: 'Roster', count: WITNESSES.length }, { id: 'drafts', label: 'Drafts', count: WITNESS_DRAFTS.length }]}
        active={wf} onChange={setWf}
        right={<>
          <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('import-roster')}>{I.copy} Import roster</button>
          <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setView('editor')}>{I.plus} New witness</button>
        </>} />

      {wf === 'today' && (
        <>
          <div className="cs-rotation">The app derives today&rsquo;s witness by day-of-year rotation across the {WITNESSES.length}-name roster — <b>computed, not scheduled</b>. Today, that is:</div>
          <WitnessCard w={today} derived expanded={expanded.has(today.id)} onToggle={() => toggle(today.id)} onPreview={onPreview} onOverflow={(k) => onCeremony('duplicate')} />
        </>
      )}
      {wf === 'roster' && (
        <>
          <div className="cs-rotation">The roster is the rotation pool. Curate it here, or <b>sync the shared witness spreadsheet</b> — each row maps to the <span style={{ fontFamily: 'var(--rp-mono)', fontSize: 11 }}>witnesses</span> table (name, era, years, region, category, martyr, quote, scripture, description, source).</div>
          {WITNESSES.map(w => (
            <WitnessCard key={w.id} w={w} expanded={expanded.has(w.id)} onToggle={() => toggle(w.id)} onPreview={onPreview} onOverflow={(k) => onCeremony('duplicate')} />
          ))}
        </>
      )}
      {wf === 'drafts' && WITNESS_DRAFTS.map(w => (
        <WitnessCard key={w.id} w={w} expanded={expanded.has(w.id)} onToggle={() => toggle(w.id)} onPreview={onPreview} onOverflow={(k) => onCeremony('duplicate')} />
      ))}
    </>
  );
}

// ---- submissions review queue (all actions ghost — directive #5) ----
function SubmissionsQueue({ onCeremony }) {
  const [src, setSrc] = anS(new Set());
  const rows = SUBMISSIONS.filter(s => src.size === 0 || src.has(s.src));
  return (
    <>
      <div className="cs-band" style={{ borderBottom: 'none', marginBottom: 14 }}>
        <div className="cs-chipwrap">
          {['leader', 'partner', 'blog'].map(s => (
            <FilterChip key={s} on={src.has(s)} label={human(s)} onClick={() => setSrc(p => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; })} />
          ))}
        </div>
        <span className="cs-page-count" style={{ marginLeft: 'auto' }}>{rows.length} awaiting triage · oldest first</span>
      </div>
      {rows.map(s => (
        <div className="cs-sub rp-card" key={s.id}>
          <div className="cs-sub-src"><span className="cs-srcpill">{s.src}</span></div>
          <div className="cs-sub-main">
            <div className="cs-sub-author">{s.author} <span className="org">· {s.org}</span></div>
            <div className="cs-sub-title">{s.title}</div>
            <div className="cs-sub-line">{s.firstLine}</div>
            <div className="cs-sub-when">Submitted {s.when}</div>
          </div>
          <div className="cs-sub-actions">
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('approve', s)}>{I.check} Approve</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('approve-edits', s)}>{I.edit} Approve with edits</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('decline', s)}>Decline with reason</button>
          </div>
        </div>
      ))}
    </>
  );
}

// ============================================================
// ANNOUNCEMENTS SURFACE SHELL
// ============================================================
function AnnouncementsSurface({ initial, viewer }) {
  const [topLevel, setTopLevel] = anS(initial.topLevel || 'announcements');
  const [wf, setWf] = anS(initial.workflow || 'home');
  const [view, setView] = anS(initial.view || 'list'); // list | editor | submissions
  const [previewOpen, setPreviewOpen] = anS(initial.previewOpen || false);
  const [expanded, setExpanded] = anS(() => new Set(ANNOUNCEMENTS.filter(a => a.today || a.next).map(a => a.id)));
  const [sel, setSel] = anS(() => new Set(initial.selected || []));
  const [drafts, setDrafts] = anS(ANNOUNCEMENT_DRAFTS);
  const [drawer, setDrawer] = anS(null);
  const [modal, setModal] = anS(null);

  const toggleExp = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSel = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // in-place state flip: publishing a draft removes it (it "moves" to Posted)
  const publishDraft = (item) => setDrafts(ds => ds.filter(d => d.id !== item.id));

  const ACK = {
    test: { eyebrow: 'Test send', title: 'Sent to you', body: <p>Delivered to your device with <span className="k">test=true</span>. It never counts toward analytics and no leader received it.</p> },
    duplicate: { eyebrow: 'Duplicate', title: 'Duplicated to a new draft', body: <p>A new draft was pre-filled with the title, body, source, and badge of this post. The audit log records the parent id.</p> },
    publish: { eyebrow: 'Post to feed', title: 'Posted to network feed', body: <p>Reached every active church. This post is now <b>locked</b> — corrections thread to it as a new post.</p> },
    schedule: { eyebrow: 'Schedule', title: 'Scheduled', body: <p>Queued to post at the chosen time. It stays editable in Drafts until it goes out.</p> },
    'witness-publish': { eyebrow: 'Roster', title: 'Added to the rotation', body: <p>This witness now sits in the rotation pool. The app will surface it on its day-of-year turn.</p> },
    approve: { eyebrow: 'Submissions', title: 'Approved & posted', body: <p>Live on the network feed for every active church. The submitter is emailed that it&rsquo;s now live. Audit-logged.</p> },
    'approve-edits': { eyebrow: 'Submissions', title: 'Opened for edits', body: <p>Loaded into the editor as a draft. When you publish, they&rsquo;re emailed that it&rsquo;s live, with an honest note that a few words were tightened. Audit-logged.</p> },
    decline: { eyebrow: 'Submissions', title: 'Decline with reason', body: <><p>The email sends as soon as you confirm.</p><div className="cs-modal-field"><label className="rp-label">Reason (required)</label><textarea className="rp-textarea" style={{ minHeight: 80 }} placeholder="Write this as the leader will read it — your words go into their email." /></div><p style={{marginTop:8}}>They&rsquo;ll receive: a short note that this wasn&rsquo;t published this time, your reason above, and an invitation to send it again.</p></> },
    'import-roster': { eyebrow: 'Witness roster', title: 'Import from the spreadsheet', body: <><p>Map the shared spreadsheet to the <span className="k">witnesses</span> table. Rows land as Drafts to review before they enter the rotation.</p><div className="cs-modal-field"><label className="rp-label">Source</label><select className="rp-select"><option>Shared Google Sheet · Witnesses</option><option>Upload CSV…</option></select></div></> },
    correction: { eyebrow: 'Correction', title: 'Draft a correction', body: <p>Starts a new &ldquo;Correction to…&rdquo; post threaded to the locked original via <span className="k">correction_of</span>. The original is never rewritten.</p> },
    'bulk-delete': { eyebrow: 'Bulk action', title: 'Delete selected drafts', body: <p>Removes the selected drafts. Audit-logged per row. This cannot be undone.</p> },
    'bulk-archive': { eyebrow: 'Bulk action', title: 'Archive selected', body: <p>Moves the selected drafts to the archive. Audit-logged per row.</p> },
    'bulk-publish': { eyebrow: 'Bulk action', title: 'Publish selected now', body: <p>Posts the selected drafts to the feed immediately. Each becomes locked. Audit-logged per row.</p> },
    'bulk-reschedule': { eyebrow: 'Bulk action', title: 'Reschedule selected', body: <p>Pick a new time for the selected drafts. Audit-logged per row.</p> },
  };
  const CONFIRM = { correction: 'Start draft', 'bulk-delete': 'Delete', 'bulk-archive': 'Archive', 'bulk-publish': 'Publish now', 'bulk-reschedule': 'Reschedule', decline: 'Decline', 'import-roster': 'Import' };
  const ceremony = (type, ctx) => setModal({ type, ctx });
  const modalDef = modal ? ACK[modal.type] : null;
  const modalConfirm = modal ? CONFIRM[modal.type] : null;

  const topTabs = [{ id: 'announcements', label: 'Announcements' }, { id: 'witness', label: 'Witness of the Day' }];
  const wfTabs = [{ id: 'home', label: 'Home', count: 4 }, { id: 'drafts', label: 'Drafts', count: drafts.length }, { id: 'posted', label: 'Posted', count: 128 }];
  const homeItems = ANNOUNCEMENTS;
  const postedItems = ANNOUNCEMENTS.filter(a => a.state === 'published');

  const bandRight = view === 'list' && (
    <>
      <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setDrawer({ type: 'filter' })}>{I.filter} Filters</button>
      <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setView('submissions')}>{I.route} Submissions<span className="cs-count-badge">4</span></button>
      <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => setView('editor')}>{I.plus} New</button>
    </>
  );

  return (
    <>
      <SiblingTabs tabs={topTabs} active={topLevel} onChange={(t) => { setTopLevel(t); setView('list'); }} />

      {topLevel === 'witness' ? (
        <WitnessSurface onCeremony={ceremony} onPreview={(w) => setDrawer({ type: 'preview', item: w, kind: 'witness' })} />
      ) : view === 'editor' ? (
        <AnnouncementEditor viewer={viewer} previewOpen={previewOpen} onTogglePreview={() => setPreviewOpen(v => !v)} onCeremony={ceremony} onCancel={() => setView('list')} />
      ) : view === 'submissions' ? (
        <>
          <div className="cs-band"><div className="q-tabs cs-band-tabs"><button className="q-tab active">Submissions<span className="tcount">4</span></button></div>
            <div className="cs-band-right"><button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setView('list')}>← Back to announcements</button></div></div>
          <SubmissionsQueue onCeremony={ceremony} />
        </>
      ) : (
        <>
          <WorkflowTabs tabs={wfTabs} active={wf} onChange={setWf} right={bandRight} />
          {wf === 'home' && (<>
            {homeItems.map(a => (
              <AnnCard key={a.id} item={a} mode="home" marker={a.today ? 'today' : a.next ? 'next' : null}
                expanded={expanded.has(a.id)} onToggle={() => toggleExp(a.id)}
                onPreview={(it) => setDrawer({ type: 'preview', item: it })} onOverflow={(k, it) => k === 'history' ? setDrawer({ type: 'history', item: it }) : ceremony(k)} />
            ))}
            <PaginationFooter page={1} pages={13} total={128} onPage={() => {}} />
          </>)}
          {wf === 'drafts' && (<>
            {drafts.map(a => (
              <AnnCard key={a.id} item={a} mode="drafts" selectable selected={sel.has(a.id)} anySelected={sel.size > 0} onSelect={() => toggleSel(a.id)}
                expanded={expanded.has(a.id)} onToggle={() => toggleExp(a.id)} onPublish={publishDraft}
                onPreview={(it) => setDrawer({ type: 'preview', item: it })} onOverflow={(k, it) => k === 'history' ? setDrawer({ type: 'history', item: a }) : ceremony(k)} />
            ))}
            <BulkBar count={sel.size} onClear={() => setSel(new Set())} actions={[
              { label: 'Delete', icon: I.trash, onClick: () => ceremony('bulk-delete') },
              { label: 'Archive', icon: I.archive, onClick: () => ceremony('bulk-archive') },
              { label: 'Publish now', icon: I.send, onClick: () => ceremony('bulk-publish') },
              { label: 'Reschedule', icon: I.clock, onClick: () => ceremony('bulk-reschedule') },
            ]} />
          </>)}
          {wf === 'posted' && (<>
            {postedItems.map(a => (
              <AnnCard key={a.id} item={a} mode="posted"
                expanded={expanded.has(a.id) || a.today || !!a.correctionOf} onToggle={() => toggleExp(a.id)}
                onPreview={(it) => setDrawer({ type: 'preview', item: it })} onOverflow={(k) => ceremony(k)} onCorrection={(it) => ceremony('correction', it)} />
            ))}
            <PaginationFooter total={128} loadMore={() => {}} />
          </>)}
        </>
      )}

      {drawer?.type === 'filter' && (
        <FilterDrawer applied={1} onClose={() => setDrawer(null)} onClear={() => {}}
          facets={[
            { label: 'State', options: ['Draft', 'Scheduled', 'Posted', 'Archived'], selected: new Set(['Posted']), onToggle: () => {}, onClear: () => {} },
            { label: 'Author', options: ['Ruth', 'Ada'], selected: new Set(), onToggle: () => {} },
            { label: 'Date range', type: 'daterange', from: '2026-06-01', to: '2026-07-01' },
            { label: 'Source', options: ['admin', 'leader', 'partner', 'blog'], selected: new Set(), onToggle: () => {}, secondary: true },
            { label: 'Topic', options: TOPIC_OPTS.map(human), selected: new Set(), onToggle: () => {}, secondary: true },
            { label: 'Badge', options: ['none', 'new', 'urgent'], selected: new Set(), onToggle: () => {}, secondary: true },
          ]} />
      )}
      {drawer?.type === 'preview' && <PreviewDrawer item={drawer.item} kind={drawer.kind || 'announcements'} onClose={() => setDrawer(null)} />}
      {drawer?.type === 'history' && <VersionHistoryDrawer title={drawer.item.title} onClose={() => setDrawer(null)} />}

      {modal && (
        <CeremonyModal eyebrow={modalDef.eyebrow} title={modalDef.title}
          confirmLabel={modalConfirm || null}
          dismissLabel={modalConfirm ? 'Cancel' : 'Close'}
          onConfirm={() => setModal(null)} onClose={() => setModal(null)}>
          {modalDef.body}
        </CeremonyModal>
      )}
    </>
  );
}

Object.assign(window, { AnnouncementsSurface });
