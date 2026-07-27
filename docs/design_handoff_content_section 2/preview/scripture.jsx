/* eslint-disable */
// ── SURFACE 2 · DAILY SCRIPTURE (v2) ────────────────────────────────
// UNIQUE (scripture_date): one scripture per date, one translation.
// MVP = the verse. Reflection + related are designed but held POST-MVP
// (per Founder — "let it live, but don't break a working scripture").
const { useState: scS } = React;

function ScriptureCard({ item, expanded, onToggle, marker, onPreview, onOverflow }) {
  return (
    <CollapsibleCard expanded={expanded} onToggle={onToggle} marker={marker}
      title={item.ref} serif when={item.when} state={item.state || (item.today ? 'published' : 'scheduled')}>
      <div className="cs-body-text lead scriptureItalic" style={{ fontSize: 18, color: '#e0dcd2' }}>{'\u201C'}{item.verse}{'\u201D'}</div>
      <MetaLine parts={[item.theme || 'no theme', item.translation, item.author]} />
      <CardActions>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onPreview(item)}>{I.eye} Preview</button>
        <OverflowMenu items={[
          { label: 'Test send — Coming Soon', icon: I.send, onClick: () => {} }   /* greyed at MVP — no endpoint ships */,
          { label: 'Duplicate', icon: I.copy, onClick: () => onOverflow('duplicate') },
        ]} />
        <span className="sp" />
        <GhostSlot />
      </CardActions>
    </CollapsibleCard>
  );
}

function ScriptureEditor({ previewOpen, onTogglePreview, onCeremony, onCancel }) {
  const s = SCRIPTURES[0];
  const [translation, setTranslation] = scS(s.translation);
  const [theme, setTheme] = scS(s.theme);
  const [book, setBook] = scS('Romans');
  const [chapter, setChapter] = scS('8');
  const [verseNo, setVerseNo] = scS('18');
  const [verse, setVerse] = scS(s.verse);
  const chapters = Array.from({ length: BOOK_CHAPTERS[book] || 1 }, (_, i) => String(i + 1));
  const ref = `${book} ${chapter}:${verseNo}`;
  const previewItem = { ref, verse, translation };

  return (
    <div className={`cs-editor two-col ${previewOpen ? 'with-preview' : ''}`}>
      <div className="cs-editor-main">
        <div className="cs-editor-card">
          <div className="cs-editor-h">The verse</div>
          <div className="cs-editor-sub">One scripture per date, one translation.</div>
          <div className="cs-classrow two" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
            <Field label="Publish date" req><input className="rp-input" type="date" defaultValue="2026-06-30" style={{ colorScheme: 'dark' }} /></Field>
            <Field label="Translation" req><Select value={translation} onChange={setTranslation} options={TRANSLATION_OPTS} /></Field>
          </div>
          <Field label="Reference" req hint="Pick the book and chapter — no free-typing a misspelled book or a chapter that doesn't exist.">
            <div className="cs-refbuild">
              <Select value={book} onChange={(v) => { setBook(v); setChapter('1'); }} options={BIBLE_BOOKS} />
              <Select value={chapter} onChange={setChapter} options={chapters} />
              <input className="rp-input" value={verseNo} onChange={e => setVerseNo(e.target.value)} placeholder="Verse" />
            </div>
          </Field>
          <Field label="Theme" hint="Optional — a filter facet, not required.">
            <Select value={theme} onChange={setTheme} options={['— none —', ...THEME_OPTS]} />
          </Field>
          <Field label="Verse text" req count={<Counter len={verse.length} max={500} />}>
            <textarea className="rp-textarea scriptureItalic" value={verse} onChange={e => setVerse(e.target.value.slice(0, 500))} style={{ minHeight: 150, fontSize: 16 }} />
          </Field>
        </div>

        <div className="cs-postmvp">
          <div className="cs-postmvp-tag">Post-MVP</div>
          <div className="cs-postmvp-note">The daily verse ships on its own. Reflection, a prompt, and related verses are designed and ready — held here so the shape is agreed, not built early.</div>
          <Field label="Companion reflection"><textarea className="rp-textarea" defaultValue={s.reflection} style={{ minHeight: 90 }} placeholder="A short reflection alongside the verse…" /></Field>
          <Field label="Reflection prompt"><input className="rp-input" defaultValue={s.prompt} placeholder="Reflect on…" /></Field>
          <Field label="Related scripture">
            {s.related.map((r, i) => (<div className="cs-relrow" key={i}><span className="ref">{r.ref}</span><span className="txt">{r.txt}</span><button className="x">{I.x}</button></div>))}
          </Field>
        </div>
      </div>

      <div>
        {previewOpen && (
          <PreviewSurface note="The live ScriptureCard — the MVP daily verse. scriptureItalic is reserved for the verse itself.">
            <ScriptureLeaderCard item={previewItem} />
          </PreviewSurface>
        )}
        <div className="cs-editor-foot" style={{ borderTop: 'none', marginTop: previewOpen ? 20 : 0, paddingTop: 0 }}>
          <button className="rp-btn rp-btn-ghost" onClick={onCancel}>Save to Drafts</button>
          <button className="rp-btn rp-btn-ghost" onClick={onTogglePreview}>{I.eye} {previewOpen ? 'Hide' : 'Preview'}</button>
          <span className="sp" />
          <button className="rp-btn rp-btn-primary" onClick={() => onCeremony('schedule')}>Schedule</button>
        </div>
      </div>
    </div>
  );
}

function ScriptureSurface({ initial }) {
  const [wf, setWf] = scS(initial.workflow || 'home');
  const [view, setView] = scS(initial.view || 'list');
  const [previewOpen, setPreviewOpen] = scS(initial.previewOpen || false);
  const [expanded, setExpanded] = scS(() => new Set(SCRIPTURES.filter(s => s.today || s.next).map(s => s.id)));
  const [drawer, setDrawer] = scS(initial.drawer || null);
  const [modal, setModal] = scS(null);
  const toggleExp = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const ACK = {
    test: { eyebrow: 'Test send', title: 'Sent to you', body: <p>Delivered to your device with <span className="k">test=true</span>. It never counts toward analytics.</p> },
    duplicate: { eyebrow: 'Duplicate', title: 'Duplicated to a new draft', body: <p>A new draft was pre-filled from this entry. The audit log records the parent id.</p> },
    schedule: { eyebrow: 'Schedule', title: 'Scheduled', body: <p>Seeded to the network for that date at the local 06:00. One scripture per date is enforced.</p> },
  };
  const ceremony = (type) => setModal({ type });
  const modalDef = modal ? ACK[modal.type] : null;

  const wfTabs = [{ id: 'home', label: 'Home', count: 4 }, { id: 'drafts', label: 'Drafts', count: 6 }, { id: 'posted', label: 'Posted', count: 214 }];
  const bandRight = view === 'list' && (
    <>
      <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setDrawer('filter')}>{I.filter} Filters</button>
      <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => setView('editor')}>{I.plus} New</button>
    </>
  );

  return (
    <>
      {view === 'editor' ? (
        <ScriptureEditor previewOpen={previewOpen} onTogglePreview={() => setPreviewOpen(v => !v)} onCeremony={ceremony} onCancel={() => setView('list')} />
      ) : (
        <>
          <WorkflowTabs tabs={wfTabs} active={wf} onChange={setWf} right={bandRight} />
          {SCRIPTURES.map(s => (
            <ScriptureCard key={s.id} item={s} marker={s.today ? 'today' : s.next ? 'next' : null}
              expanded={expanded.has(s.id)} onToggle={() => toggleExp(s.id)}
              onPreview={(it) => setDrawer({ type: 'preview', item: it })} onOverflow={(k) => ceremony(k)} />
          ))}
          <PaginationFooter page={1} pages={22} total={214} onPage={() => {}} />
        </>
      )}

      {drawer === 'filter' && (
        <FilterDrawer applied={2} onClose={() => setDrawer(null)} onClear={() => {}}
          facets={[
            { label: 'State', options: ['Draft', 'Scheduled', 'Posted', 'Archived'], selected: new Set(['Scheduled']), onToggle: () => {}, onClear: () => {} },
            { label: 'Author', options: ['Ruth', 'Ada'], selected: new Set(), onToggle: () => {} },
            { label: 'Date range', type: 'daterange', from: '2026-06-01', to: '2026-09-01' },
            { label: 'Theme', options: THEME_OPTS.slice(0, 10), selected: new Set(['Suffering']), onToggle: () => {}, onClear: () => {}, secondary: true },
            { label: 'Translation', options: TRANSLATION_OPTS, selected: new Set(), onToggle: () => {}, secondary: true },
            { label: 'Book', options: ['Genesis', 'Psalms', 'Isaiah', 'Matthew', 'John', 'Romans', 'James', 'Revelation'], selected: new Set(), onToggle: () => {}, secondary: true },
          ]} />
      )}
      {drawer?.type === 'preview' && <PreviewDrawer item={drawer.item} kind="scripture" onClose={() => setDrawer(null)} />}
      {modal && <CeremonyModal eyebrow={modalDef.eyebrow} title={modalDef.title} onClose={() => setModal(null)}>{modalDef.body}</CeremonyModal>}
    </>
  );
}

Object.assign(window, { ScriptureSurface });
