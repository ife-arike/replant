/* eslint-disable */
// ── SURFACE 3 · OUTREACH & MISSIONS ─────────────────────────────────
// Phase 1 (ships): content page on the shared pattern + mission fields.
// Phase 2 (concept): partner org CRM + application intake.
// Phase 3 (concept): missions marketplace — trips + interest + prayer.
const { useState: ouS } = React;

function MissionCard({ item, expanded, onToggle, marker, flash, onPreview }) {
  const head = (
    <div className="cs-card-headmain">
      <span className="cs-card-title">{item.title}</span>
      <span className="cs-card-sub">
        <StatePill state={item.today ? 'published' : (item.next ? 'scheduled' : 'published')} when={item.when} />
        <Tag kind="src">{item.missionType}</Tag>
        <span style={{ font: '400 10.5px var(--rp-mono)', color: 'var(--rp-muted-2)' }}>{item.location}</span>
        {item.org && <span style={{ font: '400 10.5px var(--rp-mono)', color: '#b9a3d8' }}>{item.org}</span>}
      </span>
    </div>
  );
  const body = (
    <>
      <div className="cs-card-text">{item.body}</div>
      <div className="cs-metagrid">
        <div className="mg"><span className="mg-k">Mission type</span><span className="mg-v">{item.missionType}</span></div>
        <div className="mg"><span className="mg-k">Location</span><span className="mg-v">{item.location}</span></div>
        <div className="mg"><span className="mg-k">Dates</span><span className="mg-v">{item.dates}</span></div>
        <div className="mg"><span className="mg-k">Apply</span><span className="mg-v" style={{ fontFamily: 'var(--rp-mono)', fontSize: 11, color: 'var(--rp-sky)' }}>{item.apply}</span></div>
      </div>
      <div className="cs-card-actions">
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onPreview(item)}>{I.eye} Preview</button>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Test send queued.', 'test=true.', true)}>{I.send} Test send</button>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Duplicated to a new draft.')}>{I.copy} Duplicate</button>
        <span className="spacer" />
        <span className="cs-ghost-slot">interest · prayer coverage — Phase 3</span>
      </div>
    </>
  );
  return <CollapsibleCard item={item} expanded={expanded} onToggle={onToggle} marker={marker} head={head} body={body} />;
}

function MissionEditor({ flash, previewOpen, onTogglePreview }) {
  const o = OUTREACH[1];
  const [missionType, setMissionType] = ouS(o.missionType);
  const [source, setSource] = ouS(o.source);
  const [title, setTitle] = ouS(o.title);
  const [body, setBody] = ouS(o.body);
  const previewItem = { ...o, missionType, source, title, body };
  return (
    <div className={`cs-editor-grid ${previewOpen ? 'with-preview' : ''}`}>
      <div className="cs-editor-card">
        <h3>Draft mission listing</h3>
        <div className="sub">Same shared editor as Announcements + mission-specific fields.</div>
        <div className="cs-field-2col">
          <Field label="Mission type" req map={<>maps to <b>mission_type</b></>}><Select value={missionType} onChange={setMissionType} options={MISSIONTYPE_OPTS} /></Field>
          <Field label="Source" req map={<>maps to <b>author_type</b></>}><Select value={source} onChange={setSource} options={SOURCE_OPTS} labels={human} /></Field>
        </div>
        <Field label="Title" req count={<Counter len={title.length} max={100} />}><input className="rp-input" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Location" req hint="Country / region picker, or Global / Unspecified." map={<>maps to <b>location</b></>}><input className="rp-input" defaultValue={o.location} /></Field>
        <div className="cs-field-2col">
          <Field label="Start date" hint="For trips." map={<>maps to <b>date_start</b></>}><input className="rp-input" type="date" defaultValue="2026-09-12" /></Field>
          <Field label="End date" map={<>maps to <b>date_end</b></>}><input className="rp-input" type="date" defaultValue="2026-09-26" /></Field>
        </div>
        <Field label="Body" req count={<Counter len={body.length} max={1000} />}><textarea className="rp-textarea" value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 110 }} /></Field>
        <Field label="Contact / apply URL" req hint="How leaders express interest." map={<>maps to <b>apply_url</b></>}><input className="rp-input" defaultValue={o.apply} /></Field>
        <Field label="Coordinating org" hint="The partner org running the opportunity — ties into Phase 2." map={<>maps to <b>org_id</b> → partner_orgs</>}><Select value={o.org} onChange={() => {}} options={['Frontier Medical Fellowship', 'Diaspora Church Network', '— none —']} /></Field>
        <div className="cs-editor-foot">
          <button className="rp-btn rp-btn-ghost" onClick={() => flash('Saved as draft.')}>Save to Drafts</button>
          <button className="rp-btn rp-btn-ghost" onClick={onTogglePreview}>{I.eye} {previewOpen ? 'Hide preview' : 'Preview'}</button>
          <span className="spacer" />
          <button className="rp-btn rp-btn-primary" onClick={() => flash('Published to the Outreach tab.')}>Publish</button>
        </div>
      </div>
      {previewOpen && (
        <div>
          <div className="cs-preview-note">Live MissionCard — how what you curate here shows up on the leader Outreach tab.</div>
          <div className="cs-preview-center"><PhoneFrame tab="Outreach"><MissionLeaderCard item={previewItem} /></PhoneFrame></div>
        </div>
      )}
      <div style={{ gridColumn: '1 / -1' }}><FieldMapFooter map={FIELD_MAPS.outreach} title="Outreach editor" /></div>
    </div>
  );
}

// ---- Phase 1 leader mobile view (the whole Outreach tab) ----
function OutreachLeaderView() {
  return (
    <div>
      <div className="cs-preview-note" style={{ maxWidth: 620 }}>Concept · Phase 1 leader experience. What curators post on the Outreach &amp; Missions surface is exactly what leaders see on the Outreach tab in the mobile app.</div>
      <div className="cs-preview-center">
        <PhoneFrame tab="Outreach" full>
          <div style={{ padding: '6px 2px 4px' }}>
            <div style={{ font: '500 10px var(--rp-mono)', letterSpacing: '0.16em', color: 'rgba(240,237,230,0.45)', textTransform: 'uppercase', marginBottom: 14 }}>Outreach &amp; Missions</div>
            {OUTREACH.map(o => <MissionLeaderCard key={o.id} item={o} />)}
          </div>
        </PhoneFrame>
      </div>
      <div style={{ maxWidth: 620, margin: '0 auto' }}><FieldMapFooter map={FIELD_MAPS.outreach} title="Leader Outreach tab" /></div>
    </div>
  );
}

// ---- Phase 2 concept: partner application intake queue ----
function PartnerIntake({ flash }) {
  return (
    <>
      <div className="cs-concept-band"><span className="cb-tag">Concept · Phase 2</span><span className="cb-txt"><b>Partner org CRM + application intake.</b> Orgs (VOM et al.) apply to be featured. Curator reviews → approves → org gets the <b>partner</b> badge and can post content. Same shape as the leader submissions queue.</span></div>
      <div className="cs-cap"><span className="cap-q">Application intake queue — org-level, not post-level.</span></div>
      {PARTNER_APPS.map(a => (
        <div className="cs-subrow" key={a.id}>
          <div className="sr-src"><span className="cs-srcpill partner">Org app</span></div>
          <div className="sr-main">
            <div className="sr-author">{a.org}</div>
            <div className="sr-title" style={{ fontSize: 15 }}>{a.profile}</div>
            <div className="cs-metagrid" style={{ marginTop: 8 }}>
              <div className="mg"><span className="mg-k">Mission fit</span><span className="mg-v">{a.fit}</span></div>
              <div className="mg"><span className="mg-k">Contact</span><span className="mg-v" style={{ fontFamily: 'var(--rp-mono)', fontSize: 11 }}>{a.contact}</span></div>
            </div>
            <div className="sr-firstline" style={{ marginTop: 8 }}>Evidence: {a.evidence}</div>
            <div className="sr-when">Applied {a.when}</div>
          </div>
          <div className="sr-actions">
            <button className="rp-btn rp-btn-approve rp-btn-sm" onClick={() => flash('Partner approved.', `${a.org} now carries the partner badge and can post.`)}>{I.check} Approve org</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Opened org profile.')}>{I.eye} Review profile</button>
            <button className="rp-btn rp-btn-reject rp-btn-sm" onClick={() => flash('Declined.', 'Reason required.')}>Decline</button>
          </div>
        </div>
      ))}
    </>
  );
}

// ---- Phase 2 concept: partner org profile (admin edit) ----
function PartnerProfile({ flash }) {
  return (
    <>
      <div className="cs-concept-band"><span className="cb-tag">Concept · Phase 2</span><span className="cb-txt">Partner org profile — admin sees + edits. The org that content threads back to.</span></div>
      <div className="cs-partnerprofile">
        <div className="pp-head">
          <div className="pp-logo">F</div>
          <div style={{ flex: 1 }}>
            <div className="pp-name">Frontier Medical Fellowship</div>
            <div className="pp-badge"><span className="cs-srcpill partner">Partner · verified</span> <span style={{ font: '400 10px var(--rp-mono)', color: 'var(--rp-muted)', marginLeft: 8 }}>since 2004 · 3 references</span></div>
          </div>
          <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Editing partner profile.')}>{I.edit} Edit</button>
        </div>
        <div className="pp-body">
          <div className="cs-metagrid" style={{ marginTop: 0 }}>
            <div className="mg"><span className="mg-k">Focus</span><span className="mg-v">Medical missions · Sahel + Horn of Africa</span></div>
            <div className="mg"><span className="mg-k">Contact</span><span className="mg-v" style={{ fontFamily: 'var(--rp-mono)', fontSize: 11 }}>ops@fmf.example</span></div>
            <div className="mg"><span className="mg-k">Active listings</span><span className="mg-v">2 open · 1 completed</span></div>
            <div className="mg"><span className="mg-k">Posting</span><span className="mg-v">Enabled</span></div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ font: '500 9.5px var(--rp-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rp-muted-2)', marginBottom: 10 }}>Profile</div>
            <div className="cs-card-text">A medical-missions fellowship placing clinicians in access-restricted contexts, pairing mobile clinics with quiet discipleship. All field workers complete Replant's safety protocol before a listing goes live.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--rp-faint)' }}>
            <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => flash('Saved.')}>Save changes</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm">View as leader</button>
            <span style={{ flex: 1 }} />
            <button className="rp-btn rp-btn-reject rp-btn-sm" onClick={() => flash('Posting suspended.', 'Org can no longer post until re-enabled.')}>Suspend posting</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- Phase 3 concept: missions marketplace / trip listing ----
function TripMarketplace() {
  return (
    <>
      <div className="cs-concept-band"><span className="cb-tag">Concept · Phase 3</span><span className="cb-txt"><b>Missions marketplace.</b> Trip listings across all partner orgs, interest signals, prayer coverage, and post-trip feedback — the curator's aggregate view.</span></div>
      <div className="cs-trip-grid">
        {TRIPS.map(t => (
          <div className="cs-trip" key={t.id}>
            <div className="t-media"><span>{'{ trip image }'}</span></div>
            <div className="t-body">
              <div className="t-org">{t.org}</div>
              <div className="t-name">{t.name}</div>
              <div className="t-loc">{t.loc}</div>
              <div className="t-signals">
                <div className="cs-signal"><span className="sg-v sky">{t.interest}</span><span className="sg-k">Interested</span></div>
                <div className="cs-signal"><span className="sg-v green">{t.prayer}</span><span className="sg-k">Praying</span></div>
                <div className="cs-signal"><span className="sg-v">{t.feedback ? '✓' : '—'}</span><span className="sg-k">Feedback</span></div>
              </div>
              <div className="cs-prayer-widget">
                <div className="pw-head"><span className="pw-lab">Prayer coverage</span><span className="pw-count">{t.prayer}/{t.prayerGoal}</span></div>
                <div className="cs-prayer-bar"><div className="pb-fill" style={{ width: `${Math.min(100, t.prayer / t.prayerGoal * 100)}%` }} /></div>
                <div className="pw-note">{t.feedback ? t.feedback : t.prayer >= t.prayerGoal ? 'Coverage goal met — the team is fully upheld.' : `${t.prayerGoal - t.prayer} more intercessors to reach coverage.`}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function OutreachSurface({ initial, flash }) {
  const [wf, setWf] = ouS(initial.workflow || 'home');
  const [view, setView] = ouS(initial.view || 'list'); // list | editor | leaderview | intake | profile | trips
  const [previewOpen, setPreviewOpen] = ouS(initial.previewOpen || false);
  const [expanded, setExpanded] = ouS(() => new Set(OUTREACH.filter(o => o.today || o.next).map(o => o.id)));
  const [drawer, setDrawer] = ouS(null);
  const toggleExp = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const wfTabs = [{ id: 'home', label: 'Home', count: 3 }, { id: 'drafts', label: 'Drafts', count: 2 }, { id: 'posted', label: 'Posted', count: 41 }];

  if (view === 'leaderview') return <OutreachLeaderView />;
  if (view === 'intake') return <PartnerIntake flash={flash} />;
  if (view === 'profile') return <PartnerProfile flash={flash} />;
  if (view === 'trips') return <TripMarketplace />;

  return (
    <>
      {view === 'editor' ? (
        <MissionEditor flash={flash} previewOpen={previewOpen} onTogglePreview={() => setPreviewOpen(v => !v)} />
      ) : (
        <>
          <WorkflowTabs tabs={wfTabs} active={wf} onChange={setWf} />
          <div className="cs-toolbar">
            <button className="cs-filtertrigger" onClick={() => setDrawer('filter')}>{I.filter} Filters</button>
            <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => setView('editor')}>{I.plus} New listing</button>
            <span className="cs-sortnote">Phase 1 · curated outreach content, shared pattern</span>
          </div>
          {OUTREACH.map(o => (
            <MissionCard key={o.id} item={o} marker={o.today ? 'today' : o.next ? 'next' : null}
              expanded={expanded.has(o.id)} onToggle={() => toggleExp(o.id)}
              flash={flash} onPreview={(it) => setDrawer({ type: 'preview', item: it })} />
          ))}
          <PaginationFooter page={1} pages={5} total={41} onPage={() => {}} />
          <FieldMapFooter map={FIELD_MAPS.outreach} title="Outreach & Missions · Phase 1" />
        </>
      )}
      {drawer === 'filter' && (
        <FilterDrawer applied={0} onClose={() => setDrawer(null)} onClear={() => {}}
          facets={[
            { label: 'State', options: ['Draft', 'Scheduled', 'Published', 'Archived'], selected: new Set(), onToggle: () => {} },
            { label: 'Author', options: ['Ruth', 'Ada'], selected: new Set(), onToggle: () => {} },
            { label: 'Date range', type: 'daterange', from: '2026-06-01', to: '2026-12-01' },
            { label: 'Mission type', options: MISSIONTYPE_OPTS, selected: new Set(), onToggle: () => {} },
            { label: 'Coordinating org', options: ['Frontier Medical Fellowship', 'Diaspora Church Network'], selected: new Set(), onToggle: () => {} },
          ]} />
      )}
      {drawer?.type === 'preview' && <PreviewDrawer item={drawer.item} kind="outreach" onClose={() => setDrawer(null)} />}
    </>
  );
}

Object.assign(window, { OutreachSurface });
