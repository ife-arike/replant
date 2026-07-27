/* eslint-disable */
// ── SURFACE 3 · OUTREACH & MISSIONS (v2) ────────────────────────────
// Phase 1 ships on the shared pattern. Phase 2/3 are quiet concept
// surfaces — no gamification, no dev-commentary bands.
const { useState: ouS } = React;

function MissionCard({ item, expanded, onToggle, marker, onPreview, onOverflow }) {
  return (
    <CollapsibleCard expanded={expanded} onToggle={onToggle} marker={marker}
      title={item.title} when={item.when} state={item.state || (item.next ? 'scheduled' : 'published')}>
      <div className="cs-body-text">{item.body}</div>
      <MetaLine parts={[item.missionType, item.location, item.dates, item.org || null]} />
      <CardActions>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onPreview(item)}>{I.eye} Preview</button>
        <OverflowMenu items={[
          { label: 'Test send — Coming Soon', icon: I.send, onClick: () => {} }   /* greyed at MVP — no endpoint ships */,
          { label: 'Duplicate', icon: I.copy, onClick: () => onOverflow('duplicate') },
        ]} />
        <span className="sp" />
        <GhostSlot label="interest · prayer count — post-MVP" />
      </CardActions>
    </CollapsibleCard>
  );
}

function MissionEditor({ previewOpen, onTogglePreview, onCeremony, onCancel }) {
  const o = OUTREACH[1];
  const [missionType, setMissionType] = ouS(o.missionType);
  const [source, setSource] = ouS(o.source);
  const [title, setTitle] = ouS(o.title);
  const [body, setBody] = ouS(o.body);
  const previewItem = { ...o, missionType, source, title, body };
  return (
    <div className={`cs-editor ${previewOpen ? 'with-preview' : ''}`}>
      <div className="cs-editor-card">
        <div className="cs-editor-h">New listing</div>
        <div className="cs-editor-sub">The shared editor plus mission-specific fields.</div>
        <Field label="Title" req count={<Counter len={title.length} max={100} />} className="cs-editor-title">
          <input className="rp-input" value={title} onChange={e => setTitle(e.target.value.slice(0, 100))} />
        </Field>
        <Field label="Body" req count={<Counter len={body.length} max={1000} />}>
          <textarea className="rp-textarea" value={body} onChange={e => setBody(e.target.value.slice(0, 1000))} style={{ minHeight: 130 }} />
        </Field>
        <div className="cs-classrow two">
          <Field label="Mission type" req><Select value={missionType} onChange={setMissionType} options={MISSIONTYPE_OPTS} /></Field>
          <Field label="Source" req><Select value={source} onChange={setSource} options={SOURCE_OPTS} labels={human} /></Field>
        </div>
        <Field label="Location" req hint="Country / region, or Global / Unspecified."><input className="rp-input" defaultValue={o.location} /></Field>
        <div className="cs-classrow two" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
          <Field label="Start date"><input className="rp-input" type="date" defaultValue="2026-09-12" style={{ colorScheme: 'dark' }} /></Field>
          <Field label="End date"><input className="rp-input" type="date" defaultValue="2026-09-26" style={{ colorScheme: 'dark' }} /></Field>
        </div>
        <Field label="Contact / apply URL" req hint="How leaders express interest."><input className="rp-input" defaultValue={o.apply} /></Field>
        <Field label="Coordinating org" hint="The partner org running this — ties into Phase 2."><Select value={o.org} onChange={() => {}} options={['Frontier Medical Fellowship', 'Diaspora Church Network', '— none —']} /></Field>
        <div className="cs-editor-foot">
          <span className="sp" />
          <button className="rp-btn rp-btn-ghost" onClick={onCancel}>Save to Drafts</button>
          <button className="rp-btn rp-btn-ghost" onClick={onTogglePreview}>{I.eye} {previewOpen ? 'Hide' : 'Preview'}</button>
          <button className="rp-btn rp-btn-primary" onClick={() => onCeremony('publish')}>Publish</button>
        </div>
      </div>
      {previewOpen && (
        <PreviewSurface note="How this listing shows up on the leader Outreach & Missions page.">
          <MissionLeaderCard item={previewItem} />
        </PreviewSurface>
      )}
    </div>
  );
}

// Phase 1 leader view — plain surface, NO phone chrome, NO invented
// tab bar. Reached in the app via the hamburger menu (directive #7 + #5).
function OutreachLeaderView() {
  return (
    <div style={{ maxWidth: 460 }}>
      <PreviewSurface eyebrow="Leader view · as leaders see it"
        note="Outreach & Missions lives in the leader app’s menu (hamburger → Outreach & Missions) — not a bottom-tab. What curators post here is exactly what leaders read there.">
        {OUTREACH.map(o => <MissionLeaderCard key={o.id} item={o} />)}
      </PreviewSurface>
    </div>
  );
}

function PartnerIntake({ onCeremony }) {
  return (
    <>
      <Eyebrow tone="next">Phase 2 · concept</Eyebrow>
      <div className="cs-rotation" style={{ marginTop: 10 }}>Org-level application intake — partner orgs apply to be featured; a curator approves, and the org gains the partner badge and posting rights.</div>
      {PARTNER_APPS.map(a => (
        <div className="cs-sub rp-card" key={a.id}>
          <div className="cs-sub-src"><span className="cs-srcpill">Org app</span></div>
          <div className="cs-sub-main">
            <div className="cs-sub-author">{a.org}</div>
            <div className="cs-sub-title" style={{ fontSize: 15 }}>{a.profile}</div>
            <MetaLine parts={[a.fit, a.contact]} />
            <div className="cs-sub-line" style={{ marginTop: 8 }}>Evidence · {a.evidence}</div>
            <div className="cs-sub-when">Applied {a.when}</div>
          </div>
          <div className="cs-sub-actions">
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('approve-org', a)}>{I.check} Approve org</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('review-profile', a)}>{I.eye} Review profile</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('decline', a)}>Decline with reason</button>
          </div>
        </div>
      ))}
    </>
  );
}

function PartnerProfile({ onCeremony }) {
  return (
    <>
      <Eyebrow tone="next">Phase 2 · concept</Eyebrow>
      <div className="cs-partner rp-card" style={{ marginTop: 12 }}>
        <div className="cs-partner-head">
          <div className="cs-partner-logo">F</div>
          <div style={{ flex: 1 }}>
            <div className="cs-partner-name">Frontier Medical Fellowship</div>
            <div className="cs-partner-sub">Partner · verified · since 2004 · 3 references</div>
          </div>
          <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('edit-partner')}>{I.edit} Edit</button>
        </div>
        <div className="cs-partner-body">
          <div className="cs-kv">
            <div><div className="k">Focus</div><div className="v">Medical missions · Sahel + Horn of Africa</div></div>
            <div><div className="k">Contact</div><div className="v" style={{ fontFamily: 'var(--rp-mono)', fontSize: 12 }}>ops@fmf.example</div></div>
            <div><div className="k">Active listings</div><div className="v">2 open · 1 completed</div></div>
            <div><div className="k">Posting</div><div className="v">Enabled</div></div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="k" style={{ fontFamily: 'var(--rp-mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rp-muted)', marginBottom: 8 }}>Profile</div>
            <div className="cs-body-text">A medical-missions fellowship placing clinicians in access-restricted contexts, pairing mobile clinics with quiet discipleship. All field workers complete Replant&rsquo;s safety protocol before a listing goes live.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--rp-faint)' }}>
            <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => onCeremony('save-partner')}>Save changes</button>
            <button className="rp-btn rp-btn-ghost rp-btn-sm">View as leader</button>
            <span style={{ flex: 1 }} />
            <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onCeremony('suspend-partner')}>Suspend posting</button>
          </div>
        </div>
      </div>
    </>
  );
}

// Phase 3 — de-gamified: plain counts, quiet cards, no coverage bars /
// goals (directive #8 — intercession is not a meter to fill).
function TripMarketplace() {
  return (
    <>
      <Eyebrow tone="next">Phase 3 · concept</Eyebrow>
      <div className="cs-rotation" style={{ marginTop: 10 }}>Trip listings across all partner orgs — the curator&rsquo;s aggregate view. Interest and prayer are shown as plain counts.</div>
      <div className="cs-trip-grid">
        {TRIPS.map(t => (
          <div className="cs-trip rp-card" key={t.id}>
            <div className="cs-trip-org">{t.org}</div>
            <div className="cs-trip-name">{t.name}</div>
            <div className="cs-trip-loc">{t.loc}</div>
            <div className="cs-trip-counts">
              <div><span className="n">{t.interest}</span><span className="k">Interested</span></div>
              <div><span className="n">{t.praying}</span><span className="k">Praying</span></div>
              <div><span className="n">{t.status}</span><span className="k">Status</span></div>
            </div>
            {t.feedback && <div className="cs-trip-fb"><b>Post-trip · </b>{t.feedback}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

function OutreachSurface({ initial }) {
  const [wf, setWf] = ouS(initial.workflow || 'home');
  const [view, setView] = ouS(initial.view || 'list');
  const [previewOpen, setPreviewOpen] = ouS(initial.previewOpen || false);
  const [expanded, setExpanded] = ouS(() => new Set(OUTREACH.filter(o => o.today || o.next).map(o => o.id)));
  const [drawer, setDrawer] = ouS(null);
  const [modal, setModal] = ouS(null);
  const toggleExp = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const ACK = {
    test: { eyebrow: 'Test send', title: 'Sent to you', body: <p>Delivered to your device with <span className="k">test=true</span>. It never counts toward analytics.</p> },
    duplicate: { eyebrow: 'Duplicate', title: 'Duplicated to a new draft', body: <p>A new draft was pre-filled from this listing. The audit log records the parent id.</p> },
    publish: { eyebrow: 'Publish', title: 'Published', body: <p>Live on the leader Outreach & Missions page. This listing is now locked; corrections thread to it.</p> },
    'approve-org': { eyebrow: 'Partner intake', title: 'Partner approved', body: <p>The org now carries the partner badge and can post content. Audit-logged.</p> },
    'review-profile': { eyebrow: 'Partner intake', title: 'Opened org profile', body: <p>Loaded the full application and profile for review.</p> },
    decline: { eyebrow: 'Partner intake', title: 'Declined', body: <p>A reason is recorded and sent to the applicant. This cannot be undone.</p> },
    'edit-partner': { eyebrow: 'Partner profile', title: 'Editing', body: <p>The profile fields are now editable. Changes are audit-logged.</p> },
    'save-partner': { eyebrow: 'Partner profile', title: 'Saved', body: <p>Profile changes saved. Audit-logged.</p> },
    'suspend-partner': { eyebrow: 'Partner profile', title: 'Suspend posting', body: <p>The org can no longer post until re-enabled. Existing listings stay live. Audit-logged.</p> },
  };
  const ceremony = (type) => setModal({ type });
  const modalDef = modal ? ACK[modal.type] : null;
  const modalConfirm = modal && ['decline', 'suspend-partner'].includes(modal.type);

  if (view === 'leaderview') return <OutreachLeaderView />;
  if (view === 'intake') return (<><PartnerIntake onCeremony={ceremony} />{modal && <CeremonyModal eyebrow={modalDef.eyebrow} title={modalDef.title} confirmLabel={modalConfirm ? 'Confirm' : null} dismissLabel={modalConfirm ? 'Cancel' : 'Close'} onConfirm={() => setModal(null)} onClose={() => setModal(null)}>{modalDef.body}</CeremonyModal>}</>);
  if (view === 'profile') return (<><PartnerProfile onCeremony={ceremony} />{modal && <CeremonyModal eyebrow={modalDef.eyebrow} title={modalDef.title} confirmLabel={modalConfirm ? 'Confirm' : null} dismissLabel={modalConfirm ? 'Cancel' : 'Close'} onConfirm={() => setModal(null)} onClose={() => setModal(null)}>{modalDef.body}</CeremonyModal>}</>);
  if (view === 'trips') return <TripMarketplace />;

  const wfTabs = [{ id: 'home', label: 'Home', count: 3 }, { id: 'drafts', label: 'Drafts', count: 2 }, { id: 'posted', label: 'Posted', count: 41 }];
  const bandRight = view === 'list' && (
    <>
      <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setDrawer('filter')}>{I.filter} Filters</button>
      <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => setView('editor')}>{I.plus} New</button>
    </>
  );

  return (
    <>
      {view === 'editor' ? (
        <MissionEditor previewOpen={previewOpen} onTogglePreview={() => setPreviewOpen(v => !v)} onCeremony={ceremony} onCancel={() => setView('list')} />
      ) : (
        <>
          <WorkflowTabs tabs={wfTabs} active={wf} onChange={setWf} right={bandRight} />
          {OUTREACH.map(o => (
            <MissionCard key={o.id} item={o} marker={o.today ? 'today' : o.next ? 'next' : null}
              expanded={expanded.has(o.id)} onToggle={() => toggleExp(o.id)}
              onPreview={(it) => setDrawer({ type: 'preview', item: it })} onOverflow={(k) => ceremony(k)} />
          ))}
          <PaginationFooter page={1} pages={5} total={41} onPage={() => {}} />
        </>
      )}
      {drawer === 'filter' && (
        <FilterDrawer applied={0} onClose={() => setDrawer(null)} onClear={() => {}}
          facets={[
            { label: 'State', options: ['Draft', 'Scheduled', 'Posted', 'Archived'], selected: new Set(), onToggle: () => {} },
            { label: 'Author', options: ['Ruth', 'Ada'], selected: new Set(), onToggle: () => {} },
            { label: 'Date range', type: 'daterange', from: '2026-06-01', to: '2026-12-01' },
            { label: 'Mission type', options: MISSIONTYPE_OPTS, selected: new Set(), onToggle: () => {}, secondary: true },
            { label: 'Coordinating org', options: ['Frontier Medical Fellowship', 'Diaspora Church Network'], selected: new Set(), onToggle: () => {}, secondary: true },
          ]} />
      )}
      {drawer?.type === 'preview' && <PreviewDrawer item={drawer.item} kind="outreach" onClose={() => setDrawer(null)} />}
      {modal && <CeremonyModal eyebrow={modalDef.eyebrow} title={modalDef.title} confirmLabel={modalConfirm ? 'Confirm' : null} dismissLabel={modalConfirm ? 'Cancel' : 'Close'} onConfirm={() => setModal(null)} onClose={() => setModal(null)}>{modalDef.body}</CeremonyModal>}
    </>
  );
}

Object.assign(window, { OutreachSurface });
