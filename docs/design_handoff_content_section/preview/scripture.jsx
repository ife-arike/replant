/* eslint-disable */
// ── SURFACE 2 · DAILY SCRIPTURE ─────────────────────────────────────
// Same shared pattern + theme + translation + reflection + prompt +
// related-scripture linking. Two-column editor (verse | reflection).
const { useState: scS } = React;

function ScriptureCard({ item, expanded, onToggle, marker, flash, onPreview }) {
  const head = (
    <div className="cs-card-headmain">
      <span className="cs-card-title scripture">{item.ref}</span>
      <span className="cs-card-sub">
        <StatePill state={item.today ? 'published' : (item.state || 'scheduled')} when={item.when} />
        <Tag kind="theme">{item.theme}</Tag>
        <span style={{ font: '400 10.5px var(--rp-mono)', color: 'var(--rp-muted-2)' }}>{item.translation}</span>
        {item.related && item.related.length > 0 && <span style={{ font: '400 10px var(--rp-mono)', color: 'var(--rp-muted)' }}>{I.link} {item.related.length} related</span>}
      </span>
    </div>
  );
  const body = (
    <>
      <div className="cs-card-verse">{'\u201C'}{item.verse}{'\u201D'}</div>
      {item.reflection && <div className="cs-card-text" style={{ marginTop: 14 }}>{item.reflection}</div>}
      {item.prompt && <div style={{ font: '300 15px var(--rp-serif)', fontStyle: 'italic', color: 'var(--rp-muted-2)', marginTop: 12 }}>Reflect: {item.prompt}</div>}
      <div className="cs-metagrid">
        <div className="mg"><span className="mg-k">Theme</span><span className="mg-v">{item.theme}</span></div>
        <div className="mg"><span className="mg-k">Translation</span><span className="mg-v">{item.translation}</span></div>
        <div className="mg"><span className="mg-k">Related</span><span className="mg-v">{item.related && item.related.length ? item.related.map(r => r.ref).join(', ') : '—'}</span></div>
        <div className="mg"><span className="mg-k">Author</span><span className="mg-v">{item.author}</span></div>
      </div>
      <div className="cs-card-actions">
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => onPreview(item)}>{I.eye} Preview</button>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Test send queued.', 'test=true.', true)}>{I.send} Test send</button>
        <button className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => flash('Duplicated to a new draft.')}>{I.copy} Duplicate</button>
        <span className="spacer" />
        <span className="cs-ghost-slot">opens · reactions · saves — post-MVP</span>
      </div>
    </>
  );
  return <CollapsibleCard item={item} expanded={expanded} onToggle={onToggle} marker={marker} head={head} body={body} />;
}

function ScriptureEditor({ flash, previewOpen, onTogglePreview }) {
  const s = SCRIPTURES[0];
  const [translation, setTranslation] = scS(s.translation);
  const [theme, setTheme] = scS(s.theme);
  const [verse, setVerse] = scS(s.verse);
  const [reflection, setReflection] = scS(s.reflection);
  const [prompt, setPrompt] = scS(s.prompt);
  const previewItem = { ...s, translation, theme, verse, reflection, prompt };
  return (
    <div className={`cs-editor-grid ${previewOpen ? 'with-preview' : ''}`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }} className="cs-scripture-editor">
        {/* left: the verse */}
        <div className="cs-editor-card">
          <h3>The verse</h3>
          <div className="sub">Reference autocompletes as Book Chapter:Verse.</div>
          <div className="cs-field-2col">
            <Field label="Publish date" req map={<>maps to <b>scripture_date</b> · PK</>}><input className="rp-input" type="date" defaultValue="2026-06-30" /></Field>
            <Field label="Translation" req map={<>col <b>translation</b> exists</>}><Select value={translation} onChange={setTranslation} options={TRANSLATION_OPTS} /></Field>
          </div>
          <Field label="Reference" req hint="Book chapter:verse — autocomplete."><input className="rp-input" defaultValue={s.ref} /></Field>
          <Field label="Theme" req hint="Filter facet on the surface." map={<>maps to <b>theme</b> (new)</>}><Select value={theme} onChange={setTheme} options={THEME_OPTS} /></Field>
          <Field label="Verse text" req count={<Counter len={verse.length} max={500} />} map={<>maps to <b>content</b></>}>
            <textarea className="rp-textarea" value={verse} onChange={e => setVerse(e.target.value)} style={{ minHeight: 140, fontFamily: 'var(--rp-serif)', fontStyle: 'italic', fontSize: 15 }} />
          </Field>
        </div>

        {/* right: reflection + related */}
        <div className="cs-editor-card">
          <h3>Reflection &amp; related</h3>
          <div className="sub">Optional — the leader sees these below the reference.</div>
          <Field label="Companion reflection" count={<Counter len={reflection.length} max={800} />} map={<>maps to <b>reflection</b> · optional</>}>
            <textarea className="rp-textarea" value={reflection} onChange={e => setReflection(e.target.value)} style={{ minHeight: 120 }} placeholder="A short reflection alongside the verse…" />
          </Field>
          <Field label="Reflection prompt" count={<Counter len={prompt.length} max={200} />} hint='One line leaders see under the reflection.' map={<>maps to <b>reflect_prompt</b> ≤200</>}>
            <input className="rp-input" value={prompt} onChange={e => setPrompt(e.target.value.slice(0, 200))} placeholder="Reflect on…" />
          </Field>
          <Field label="Related scripture" hint="Attach 1-N verses. Leader browses via a 'See related →' chip." map={<>maps to <b>scripture_related</b> join</>}>
            {s.related.map((r, i) => (
              <div className="cs-relrow" key={i}>
                <span className="rr-ref">{r.ref}</span>
                <span className="rr-txt">{r.txt}</span>
                <button className="rr-x">{I.x}</button>
              </div>
            ))}
            <button className="rp-btn rp-btn-ghost rp-btn-sm" style={{ marginTop: 4 }} onClick={() => flash('Add a related verse.', 'Reference autocomplete opens.')}>{I.plus} Add related verse</button>
          </Field>
          <ToggleRow title="Allow multiple translations this date" sub="Leader-side picker: same date, multiple translations" on={true} onClick={() => {}} />
        </div>

        <div className="cs-editor-foot" style={{ gridColumn: '1 / -1' }}>
          <button className="rp-btn rp-btn-ghost" onClick={() => flash('Saved as draft.')}>Save to Drafts</button>
          <button className="rp-btn rp-btn-ghost" onClick={() => flash('Test send queued.', 'test=true.', true)}>{I.send} Test send</button>
          <button className="rp-btn rp-btn-ghost" onClick={onTogglePreview}>{I.eye} {previewOpen ? 'Hide preview' : 'Preview'}</button>
          <span className="spacer" />
          <span className="by">Distributed at the date's local 06:00</span>
          <button className="rp-btn rp-btn-primary" onClick={() => flash('Scheduled.', 'Seeded to the network feed for that date.')}>Schedule</button>
        </div>
      </div>

      {previewOpen && (
        <div>
          <div className="cs-preview-note">Live ScriptureCard — scriptureItalic reserved for the verse itself, per the typography ruling.</div>
          <div className="cs-preview-center"><PhoneFrame tab="Scripture"><ScriptureLeaderCard item={previewItem} /></PhoneFrame></div>
        </div>
      )}
      <div style={{ gridColumn: '1 / -1' }}><FieldMapFooter map={FIELD_MAPS.scripture} title="Scripture editor" /></div>
    </div>
  );
}

function ScriptureSurface({ initial, flash }) {
  const [wf, setWf] = scS(initial.workflow || 'home');
  const [view, setView] = scS(initial.view || 'list');
  const [previewOpen, setPreviewOpen] = scS(initial.previewOpen || false);
  const [expanded, setExpanded] = scS(() => new Set(SCRIPTURES.filter(s => s.today || s.next).map(s => s.id)));
  const [drawer, setDrawer] = scS(initial.drawer || null);
  const toggleExp = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const wfTabs = [{ id: 'home', label: 'Home', count: 4 }, { id: 'drafts', label: 'Drafts', count: 6 }, { id: 'posted', label: 'Posted', count: 214 }];

  return (
    <>
      {view === 'editor' ? (
        <ScriptureEditor flash={flash} previewOpen={previewOpen} onTogglePreview={() => setPreviewOpen(v => !v)} />
      ) : (
        <>
          <WorkflowTabs tabs={wfTabs} active={wf} onChange={setWf} />
          <div className="cs-toolbar">
            <button className="cs-filtertrigger" onClick={() => setDrawer('filter')}>{I.filter} Filters</button>
            <button className="rp-btn rp-btn-primary rp-btn-sm" onClick={() => setView('editor')}>{I.plus} New entry</button>
            <span className="cs-sortnote">today's verse expanded · theme + translation visible</span>
          </div>
          {SCRIPTURES.map(s => (
            <ScriptureCard key={s.id} item={s} marker={s.today ? 'today' : s.next ? 'next' : null}
              expanded={expanded.has(s.id)} onToggle={() => toggleExp(s.id)}
              flash={flash} onPreview={(it) => setDrawer({ type: 'preview', item: it })} />
          ))}
          <PaginationFooter page={1} pages={22} total={214} onPage={() => {}} />
          <FieldMapFooter map={FIELD_MAPS.scripture} title="Daily Scripture" />
        </>
      )}

      {drawer === 'filter' && (
        <FilterDrawer applied={2} onClose={() => setDrawer(null)} onClear={() => {}}
          facets={[
            { label: 'State', options: ['Draft', 'Scheduled', 'Published', 'Archived'], selected: new Set(['Scheduled']), onToggle: () => {}, onClear: () => {} },
            { label: 'Author', options: ['Ruth', 'Ada'], selected: new Set(), onToggle: () => {} },
            { label: 'Date range', type: 'daterange', from: '2026-06-01', to: '2026-09-01' },
            { label: 'Theme', options: THEME_OPTS, selected: new Set(['Suffering']), onToggle: () => {}, onClear: () => {} },
            { label: 'Translation', options: TRANSLATION_OPTS, selected: new Set(), onToggle: () => {} },
            { label: 'Book', options: ['Genesis', 'Psalms', 'Isaiah', 'Matthew', 'John', 'Romans', 'James', 'Revelation'], selected: new Set(), onToggle: () => {} },
          ]} />
      )}
      {drawer?.type === 'preview' && <PreviewDrawer item={drawer.item} kind="scripture" onClose={() => setDrawer(null)} />}
    </>
  );
}

Object.assign(window, { ScriptureSurface });
