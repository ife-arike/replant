// screens.jsx — the five surfaces.
// Each is self-contained, scrollable, and matches the existing visual vocabulary.

// ═════════════════════════════════════════════════════════════════════
// Surface 1 — Front Page
// ═════════════════════════════════════════════════════════════════════

const ROUND_SIZE = 4;

function RoundedHeartcryList({ visible, heldMap, onHold }) {
  const [round, setRound] = React.useState(0);
  const total = visible.length;
  const totalRounds = Math.max(1, Math.ceil(total / ROUND_SIZE));
  React.useEffect(() => { setRound(0); }, [total]);
  const start = round * ROUND_SIZE;
  const slice = visible.slice(start, start + ROUND_SIZE);
  const isFirst = round === 0;
  const isLast = round >= totalRounds - 1;
  return (
    <>
      <div className="heartcry-list">
        {slice.map(h => (
          <HeartcryCard key={h.id} h={h} held={!!heldMap[h.id]} onHold={onHold} />
        ))}
      </div>
      <div className="round-nav">
        <span className={'link' + (isFirst ? ' disabled' : '')}
              onClick={() => !isFirst && setRound(r => r - 1)}>
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          previous
        </span>
        <span className="count">{start + 1}–{Math.min(start + ROUND_SIZE, total)} of {total}</span>
        <span className={'link' + (isLast ? ' disabled' : '')}
              onClick={() => !isLast && setRound(r => r + 1)}>
          next
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </>
  );
}

function WitnessOfDayCard({ w, onOpenArchive }) {
  return (
    <div className="witness-day">
      <div className="head">
        <span className="era-pill">{w.era}</span>
        {w.martyr && (
          <span className="martyr-badge">
            <svg width="7" height="7" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" fill="currentColor" />
            </svg>
            {w.martyrLabel || 'Martyr'}
          </span>
        )}
      </div>
      <div className="name">{w.name}</div>
      <div className="meta">{w.yearsLabel} · {w.category} · {w.region}</div>
      <div className="quote">“{w.quote}”</div>
      <div className="scripture-row">
        <span className="ref">{w.scriptureRef}</span>
        <span className="archive" onClick={onOpenArchive}>Witness archive</span>
      </div>
    </div>
  );
}

function FrontPage({ showNotif, onDismissNotif, onNavigate, populated, heldMap, onHold, activeRegion, onRegion }) {
  const notifText = 'The Replant team has responded — check your secure messages.';

  const visible = HEARTCRIES.filter(h =>
    activeRegion === 'all' ? true : h.region === activeRegion
  );
  return (
    <>
      <NavBar />
      {showNotif && (
        <NotifBar
          text={notifText}
          onTap={() => onNavigate('my-heartcries')}
          onClose={onDismissNotif}
        />
      )}
      <div className="surface-scroll">
        <ThresholdPreamble />
        <ActionCard onShare={() => {}} />

        <SectionHead label="Heartcries from the body" />
        <RegionFilter active={activeRegion} onSelect={onRegion} />
        <div style={{ height: 14 }} />

        {populated ? (
          <RoundedHeartcryList visible={visible} heldMap={heldMap} onHold={onHold} />
        ) : (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 36 36" style={{ margin: '0 auto 18px', display: 'block', opacity: 0.6 }}>
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(217,89,79,0.6)" strokeWidth="1.2" strokeDasharray="2 3" />
              <path d="M18 11v8M18 23v.5" stroke="#D9594F" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 19, color: 'var(--off-white)', marginBottom: 10 }}>
              Quiet here, for now.
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65, maxWidth: 280, margin: '0 auto' }}>
              This space is held in prayer until someone speaks. If you are experiencing any form of persecution, you can share here.
            </div>
          </div>
        )}

        {/* Entry points to sub-pages */}
        <div className="entry-points">
          <div className="ep-eyebrow">For further sight</div>
          <EntryPoint
            title="My Heartcries"
            sub="What you have shared, and what the team has held."
            meta="Four submitted · one awaiting you"
            onTap={() => onNavigate('my-heartcries')}
          />
          <EntryPoint
            title="Bear Witness"
            sub="For those watching, and those who came before."
            meta="Stories · witnesses · living stats"
            onTap={() => onNavigate('memorial')}
          />
          <EntryPoint
            title="Take Heart"
            sub="Scripture for the threshold and practical guidance."
            meta="Word for today · guidance · the body with you"
            onTap={() => onNavigate('encouragement')}
          />
          <EntryPoint
            title="Together"
            sub="How the body is praying across the regions, this hour."
            meta="Aggregate only · no identity exposure"
            onTap={() => onNavigate('stand')}
          />
        </div>

        <ScriptureFooter
          verse={'“Remember those who are in prison, as though in prison with them, and those who are mistreated, since you also are in the body.”'}
          verseRef="Hebrews 13:3"
        />
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Surface 2 — My Heartcries
// ═════════════════════════════════════════════════════════════════════

function StatusTrack({ status }) {
  const order = ['received', 'seen', 'responded'];
  const idx = order.indexOf(status);
  return (
    <div className="status-track">
      <div className="status-step">
        <span className={'status-dot' + (idx >= 0 ? ' done' : '')} />
        <span className={'status-label' + (idx >= 0 ? ' on' : '')}>Received</span>
      </div>
      <div className={'status-line' + (idx >= 1 ? ' done' : '')} />
      <div className="status-step">
        <span className={'status-dot' + (idx >= 1 ? ' done sky' : '')} />
        <span className={'status-label' + (idx >= 1 ? ' on sky' : '')}>Seen</span>
      </div>
      <div className={'status-line' + (idx >= 2 ? ' done sky' : '')} />
      <div className="status-step">
        <span className={'status-dot' + (idx >= 2 ? ' done green' : '')} />
        <span className={'status-label' + (idx >= 2 ? ' on green' : '')}>Responded</span>
      </div>
    </div>
  );
}

function MyHeartcryCard({ m }) {
  return (
    <div className="mhc-card">
      <div className="head">
        <span className={'sev ' + (m.severity === 'active_persecution' ? 'active' : m.severity)}>
          {SEVERITY_LABELS[m.severity]}
        </span>
        <span className="ts">{m.relative}</span>
      </div>
      <div className="excerpt">{m.excerpt}</div>
      <StatusTrack status={m.status} />
      {m.status === 'responded' && (
        <div className="responded">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5l5 4 5-4M2 3.5h10v7H2z" stroke="#5BAD7A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="label">Open Secure Message</span>
          <svg className="chev" width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

function MyHeartcriesPage({ withBack, onBack, populated }) {
  return (
    <>
      <NavBar withBack={withBack} onBack={onBack} title="My Heartcries" subtitle="HELD · ENCRYPTED · ONLY YOU" />
      <div className="surface-scroll">
        <div className="mhc-intro">
          <div className="eyebrow">Held For You</div>
          <div className="body">
            What you have shared with Replant. The team reads each one, prays through it, and reaches you directly in your secure messages when there is something to say.
          </div>
        </div>

        {populated ? (
          <div className="mhc-list">
            {MY_HEARTCRIES.map(m => <MyHeartcryCard key={m.id} m={m} />)}
          </div>
        ) : (
          <div className="mhc-empty">
            <div className="glyph">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3l5 4 5-4M2 3h10v8H2z" stroke="currentColor" strokeWidth="0.8" />
              </svg>
            </div>
            <div className="title">You have shared nothing here, and that is fine.</div>
            <div className="body">
              If a day comes when you need to be heard, this space will hold it. Until then, the body is praying around you.
            </div>
            <div className="cta">Share My Heartcry</div>
          </div>
        )}

        <ScriptureFooter
          eyebrow="The Lord Hears"
          verse={'“I cry to the Lord with my voice; with my voice I plead for mercy to the Lord.”'}
          verseRef="Psalm 142:1"
        />
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Surface 3 — The Memorial / Stories
// ═════════════════════════════════════════════════════════════════════

function MemorialPage({ withBack, onBack, onOpenArticle, onOpenStoryArchive, onOpenWitnessArchive }) {
  return (
    <>
      <NavBar withBack={withBack} onBack={onBack} title="Bear Witness" subtitle="WITNESSES · STORIES · THE LIVING BODY" />
      <div className="surface-scroll">
        {/* Stats — living witness */}
        <div className="memorial-stats">
          <div className="eyebrow">Standing This Week</div>
          {MEMORIAL_STATS.map((s, i) => (
            <div key={i} className="stat-row">
              <span className="num">{s.num}</span>
              <span className="desc">{s.desc}</span>
            </div>
          ))}
        </div>

        {/* Stories */}
        <SectionHead label="Around the world" link="All stories" onLink={onOpenStoryArchive} />
        <div>
          {STORIES.map((s, i) => (
            <div key={i} className="story-card" onClick={() => onOpenArticle && onOpenArticle()}>
              <div className="src">
                <span className="author">{s.source}</span>
                <span className="sep">·</span>
                <span>{s.author}</span>
              </div>
              <div className="title">{s.title}</div>
              <div className="excerpt">{s.excerpt}</div>
              <div className="read-time">{s.read}</div>
            </div>
          ))}
        </div>

        {/* Witness of the day */}
        <SectionHead label="Witness of the day" link="Archive" onLink={onOpenWitnessArchive} />
        <WitnessOfDayCard w={WITNESS_OF_DAY} onOpenArchive={onOpenWitnessArchive} />

        <ScriptureFooter
          eyebrow="A Cloud Of Witnesses"
          verse={'“Since we are surrounded by so great a cloud of witnesses, let us also lay aside every weight and run with endurance the race that is set before us.”'}
          verseRef="Hebrews 12:1"
        />
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Surface 4 — Encouragement
// ═════════════════════════════════════════════════════════════════════

function GuidanceIcon({ type }) {
  switch (type) {
    case 'lock':
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <rect x="2.5" y="6" width="9" height="6.5" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
          <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      );
    case 'door':
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <rect x="3" y="2" width="8" height="11" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="9" cy="7.5" r="0.6" fill="currentColor" />
        </svg>
      );
    case 'shield':
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5l4.5 1.5v4.5c0 2.5-2 4.5-4.5 5-2.5-0.5-4.5-2.5-4.5-5V3z" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      );
    case 'book':
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M2 2.5h4a2 2 0 0 1 2 2v8a2 2 0 0 0-2-2H2z" stroke="currentColor" strokeWidth="1" fill="none" />
          <path d="M12 2.5H8a2 2 0 0 0-2 2v8a2 2 0 0 1 2-2h4z" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      );
    default: return null;
  }
}

function EncouragementPage({ withBack, onBack, verseIndex, onCycleVerse, onOpenGuidance }) {
  const v = ENCOURAGEMENT_VERSES[verseIndex % ENCOURAGEMENT_VERSES.length];
  return (
    <>
      <NavBar withBack={withBack} onBack={onBack} title="Take Heart" subtitle="A WORD · GUIDANCE · THE BODY WITH YOU" />
      <div className="surface-scroll">
        {/* Word for today */}
        <div className="word-today" onClick={onCycleVerse}>
          <div className="eyebrow">Word For Today</div>
          <div className="verse">“{v.text}”</div>
          <div className="ref">{v.ref}</div>
          <div className="verse-pager">
            {ENCOURAGEMENT_VERSES.map((_, i) => (
              <span key={i} className={'v-dot' + (i === verseIndex % ENCOURAGEMENT_VERSES.length ? ' on' : '')} />
            ))}
          </div>
        </div>

        {/* Guidance */}
        <SectionHead label="Practical guidance" />
        <div className="guidance-list">
          {GUIDANCE_CARDS.map((g, i) => (
            <div key={i} className="guidance" onClick={() => onOpenGuidance && onOpenGuidance()}>              <div className="icon"><GuidanceIcon type={g.icon} /></div>
              <div className="body">
                <div className="title">{g.title}</div>
                <div className="sub">{g.sub}</div>
              </div>
              <svg className="chev" width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </div>

        {/* The body with you */}
        <SectionHead label="The body with you" />
        <div className="body-with-you">
          <div className="count">9,089</div>
          <div className="copy">verified leaders are standing in prayer with the persecuted church right now — anonymously, faithfully, across forty-three regions.</div>
          <div className="meta">Aggregate Only · No Identity Exposure</div>
        </div>

        <ScriptureFooter
          eyebrow="Take Heart"
          verse={'“I have said these things to you, that in me you may have peace. In the world you will have tribulation. But take heart; I have overcome the world.”'}
          verseRef="John 16:33"
        />
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Surface 5 — Stand Together
// ═════════════════════════════════════════════════════════════════════

function StandPage({ withBack, onBack }) {
  return (
    <>
      <NavBar withBack={withBack} onBack={onBack} title="Together" subtitle="AGGREGATE ONLY · NO IDENTITY EXPOSURE" />
      <div className="surface-scroll">
        <div className="stand-aggr">
          <div className="eyebrow">The Body, This Hour</div>
          {STAND_AGGR.map((a, i) => (
            <div key={i} className="aggr-row">
              <span className="label">{a.label}</span>
              <span className="value">{a.value}<span className="unit">{a.unit}</span></span>
            </div>
          ))}
        </div>

        <SectionHead label="By region" />
        <div className="region-grid">
          {REGION_PRAYER.map((r, i) => (
            <div key={i} className="region-cell">
              <div className="name">{r.name}</div>
              <div className="count">{r.count}</div>
              <div className="sub">{r.sub}</div>
              <div className="heat" style={{ opacity: r.heat }} />
            </div>
          ))}
        </div>

        <div className="streak-card">
          <div className="eyebrow">Consecutive Days In Prayer</div>
          <div className="num">412</div>
          <div className="copy">since Replant opened, the body has stood every day for those under persecution. No day has been missed.</div>
        </div>

        <ScriptureFooter
          eyebrow="Bear One Another"
          verse={'“Bear one another’s burdens, and so fulfill the law of Christ.”'}
          verseRef="Galatians 6:2"
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// In-app Article Reader (pushed from Bear Witness)
// ═══════════════════════════════════════════════════════════════════
function ArticleReader({ onBack }) {
  const a = ARTICLE_BODY;
  return (
    <>
      <NavBar withBack onBack={onBack} title="Bear Witness" subtitle="AN EDITORIAL · HELD IN-APP" />
      <div className="surface-scroll">
        <div className="reader-meta">
          <div className="src">{a.source} · {a.author}</div>
          <div className="title">{a.title}</div>
          <div className="read">{a.read}</div>
        </div>
        <div className="reader-body">
          {a.paragraphs.map((p, i) => <p key={'p' + i}>{p}</p>)}
          {a.pullQuote && <div className="pull">“{a.pullQuote}”</div>}
          {a.paragraphsAfter && a.paragraphsAfter.map((p, i) => <p key={'q' + i}>{p}</p>)}
        </div>
        <ScriptureFooter
          eyebrow="Where Two Or Three"
          verse={'“' + a.scripture.verse + '”'}
          verseRef={a.scripture.ref}
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// In-app Guidance Reader (pushed from Take Heart)
// ═══════════════════════════════════════════════════════════════════
function GuidanceReader({ onBack }) {
  const g = GUIDANCE_BODY;
  return (
    <>
      <NavBar withBack onBack={onBack} title="Take Heart" subtitle="GUIDANCE · HELD IN-APP · NOTHING LOGGED" />
      <div className="surface-scroll">
        <div className="guidance-intro">
          <div className="eyebrow">{g.eyebrow}</div>
          <div className="title">{g.title}</div>
          <div className="sub">{g.sub}</div>
          <div className="secure">
            <svg width="8" height="10" viewBox="0 0 10 12">
              <rect x="1.5" y="5" width="7" height="6" rx="1" fill="none" stroke="currentColor" />
              <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" />
            </svg>
            Held in-app
          </div>
        </div>
        <div className="steps-list">
          {g.steps.map((s, i) => (
            <div key={i} className="step-row">
              <div className="num">{s.n}</div>
              <div className="body">
                <div className="label">{s.label}</div>
                <div className="copy">{s.body}</div>
                {s.scripture && (
                  <div className="scripture-ref">
                    “{s.scripture.text}”
                    <span className="ref">{s.scripture.ref}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <ScriptureFooter
          eyebrow="Wise As Serpents"
          verse={'“' + g.scripture.verse + '”'}
          verseRef={g.scripture.ref}
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Story Archive (“All stories” — pushed from Bear Witness)
// ═══════════════════════════════════════════════════════════════════
function StoryArchive({ onBack, onOpenArticle }) {
  const [filter, setFilter] = React.useState('all');
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'replant', label: 'Replant Editorial' },
    { id: 'partner', label: 'Partner feeds' },
  ];
  const visible = STORY_ARCHIVE.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'replant') return s.source === 'Replant Editorial';
    return s.source !== 'Replant Editorial';
  });
  return (
    <>
      <NavBar withBack onBack={onBack} title="All stories" subtitle="AROUND THE WORLD · HELD IN-APP" />
      <div className="surface-scroll">
        <div className="archive-intro">
          <div className="eyebrow">From The Body</div>
          <div className="body">
            Editorials and partner-feed dispatches that have been held by the body. Tap any to read in full.
          </div>
        </div>
        <div className="archive-filter">
          {filters.map(f => (
            <div key={f.id}
              className={'archive-chip' + (filter === f.id ? ' on' : '')}
              onClick={() => setFilter(f.id)}>
              {f.label}
            </div>
          ))}
        </div>
        <div className="archive-stories">
          {visible.map((s, i) => (
            <div key={i} className="archive-story" onClick={() => onOpenArticle && onOpenArticle()}>
              <div className="meta">
                <span className="author">{s.source}</span>
                <span className="sep">·</span>
                <span>{s.author}</span>
              </div>
              <div className="title">{s.title}</div>
              <div className="date">{s.date}</div>
            </div>
          ))}
        </div>
        <ScriptureFooter
          eyebrow="The Body Speaks"
          verse={'“And they overcame him by the blood of the Lamb, and by the word of their testimony.”'}
          verseRef="Revelation 12:11"
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Witness Archive (pushed from Bear Witness)
// ═══════════════════════════════════════════════════════════════════
function WitnessArchive({ onBack }) {
  const [filter, setFilter] = React.useState('all');
  const filters = [
    { id: 'all',       label: 'All' },
    { id: 'martyr',    label: 'Martyrs' },
    { id: 'father',    label: 'Fathers of the faith' },
    { id: 'mother',    label: 'Mothers of the faith' },
    { id: 'general',   label: 'God’s generals' },
    { id: 'scripture', label: 'From scripture' },
  ];
  const visible = WITNESS_ARCHIVE.filter(w => {
    if (filter === 'all') return true;
    if (filter === 'martyr') return w.martyr;
    if (filter === 'father') return w.category === 'Father of the Faith';
    if (filter === 'mother') return w.category === 'Mother of the Faith';
    if (filter === 'general') return w.category === 'God’s General';
    if (filter === 'scripture') return w.category === 'From Scripture';
    return true;
  });
  return (
    <>
      <NavBar withBack onBack={onBack} title="Witness archive" subtitle="THOSE WHO CAME BEFORE" />
      <div className="surface-scroll">
        <div className="archive-intro">
          <div className="eyebrow">A Cloud Of Witnesses</div>
          <div className="body">
            Martyrs, fathers and mothers of the faith, God’s generals, and those Scripture remembers. One rises each day in the feed; here they are all together.
          </div>
        </div>
        <div className="archive-filter">
          {filters.map(f => (
            <div key={f.id}
              className={'archive-chip' + (filter === f.id ? ' on' : '')}
              onClick={() => setFilter(f.id)}>
              {f.label}
            </div>
          ))}
        </div>

        {/* Featured — today's witness */}
        {filter === 'all' && (
          <>
            <div className="archive-featured-label">Witness of the day</div>
            <div className="archive-witness featured">
              <div className="era">{WITNESS_OF_DAY.era}</div>
              <div className="body">
                <div className="name-row">
                  <span className="name">{WITNESS_OF_DAY.name}</span>
                  {WITNESS_OF_DAY.martyr && <span className="badge-small">Martyr</span>}
                </div>
                <div className="desc">{WITNESS_OF_DAY.region} · {WITNESS_OF_DAY.category}</div>
                <div className="desc">“{WITNESS_OF_DAY.quote}”</div>
                <div className="verse">{WITNESS_OF_DAY.scriptureRef}</div>
              </div>
            </div>
            <div className="archive-section-label">Past witnesses</div>
          </>
        )}

        <div className="archive-witnesses">
          {visible.map((w, i) => (
            <div key={i} className="archive-witness">
              <div className="era">{w.era}</div>
              <div className="body">
                <div className="name-row">
                  <span className="name">{w.name}</span>
                  {w.martyr
                    ? <span className="badge-small">Martyr</span>
                    : <span className="badge-small muted">{w.category}</span>}
                </div>
                <div className="desc">{w.desc}</div>
                <div className="verse">{w.verse}</div>
              </div>
            </div>
          ))}
        </div>

        <ScriptureFooter
          eyebrow="Run With Endurance"
          verse={'“Therefore, since we are surrounded by so great a cloud of witnesses, let us also lay aside every weight…”'}
          verseRef="Hebrews 12:1"
        />
      </div>
    </>
  );
}

Object.assign(window, {
  FrontPage, MyHeartcriesPage, MemorialPage, EncouragementPage, StandPage,
  ArticleReader, GuidanceReader,
  RoundedHeartcryList, WitnessOfDayCard,
  StoryArchive, WitnessArchive,
});
