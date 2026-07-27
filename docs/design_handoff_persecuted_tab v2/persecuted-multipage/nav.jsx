// nav.jsx — three navigation patterns wrapping the five surfaces.
//
// Option A — Nested stack (push). Front page is root. Entry-points push sub-pages.
// Option B — Pill tabs below NavBar. Quick switching.
// Option C — Swipe pages with indicator. Discovery through swipe.

const PAGES = [
  { id: 'front',         label: 'Feed' },
  { id: 'my-heartcries', label: 'My Heartcries' },
  { id: 'memorial',      label: 'Bear Witness' },
  { id: 'encouragement', label: 'Take Heart' },
  { id: 'stand',         label: 'Together' },
];

function pageNode(id, props) {
  switch (id) {
    case 'front':         return <FrontPage {...props} />;
    case 'my-heartcries': return <MyHeartcriesPage {...props} />;
    case 'memorial':      return <MemorialPage {...props} />;
    case 'encouragement': return <EncouragementPage {...props} />;
    case 'stand':         return <StandPage {...props} />;
    case 'article':       return <ArticleReader {...props} />;
    case 'guidance':      return <GuidanceReader {...props} />;
    case 'story-archive': return <StoryArchive {...props} />;
    case 'witness-archive': return <WitnessArchive {...props} />;
    default:              return null;
  }
}

// ─────────── Option A: Nested Stack ───────────
function StackNav({ page, onNavigate, sharedProps }) {
  const isRoot = page === 'front';
  const READER = ['article', 'guidance', 'story-archive', 'witness-archive'];
  const backTarget =
    page === 'article' ? 'memorial' :
    page === 'guidance' ? 'encouragement' :
    page === 'story-archive' ? 'memorial' :
    page === 'witness-archive' ? 'memorial' : 'front';
  return (
    <div className="persec-root">
      <div className="left-edge-accent" />
      {pageNode(page, {
        ...sharedProps,
        withBack: !isRoot,
        onBack: () => onNavigate(backTarget),
        onNavigate,
        onOpenArticle: () => onNavigate('article'),
        onOpenGuidance: () => onNavigate('guidance'),
      })}
      <TabBar active={2} />
    </div>
  );
}

// ─────────── Option B: Pill Tabs ───────────
function PillNav({ page, onNavigate, sharedProps }) {
  // Reader screens take over the full surface (cover the pills)
  const OVERLAY = ['article', 'guidance', 'story-archive', 'witness-archive'];
  if (OVERLAY.includes(page)) {
    const backTo = (page === 'article' || page === 'story-archive' || page === 'witness-archive') ? 'memorial' : 'encouragement';
    const onBack = () => onNavigate(backTo);
    return (
      <div className="persec-root">
        <div className="left-edge-accent" />
        {pageNode(page, { ...sharedProps, onBack, onOpenArticle: () => onNavigate('article') })}
        <TabBar active={2} />
      </div>
    );
  }
  return (
    <div className="persec-root">
      <div className="left-edge-accent" />
      <NavBar />
      <div className="pill-tabs">
        {PAGES.map(p => (
          <div key={p.id}
            className={'pill-tab' + (p.id === page ? ' on' : '')}
            onClick={() => onNavigate(p.id)}>
            {p.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PillBody page={page} sharedProps={{
          ...sharedProps,
          onNavigate,
          withBack: false,
          onOpenArticle: () => onNavigate('article'),
          onOpenGuidance: () => onNavigate('guidance'),
          onOpenStoryArchive: () => onNavigate('story-archive'),
          onOpenWitnessArchive: () => onNavigate('witness-archive'),
        }} />
      </div>
      <TabBar active={2} />
    </div>
  );
}

function PillBody({ page, sharedProps }) {
  // For pills, we strip the NavBar inside each surface by rendering a
  // light shell that mounts just the scrollable body of each page.
  switch (page) {
    case 'front':
      return (
        <div className="surface-scroll">
          <ThresholdPreamble />
          <ActionCard onShare={() => {}} />
          <SectionHead label="Heartcries from the body" />
          <RegionFilter active={sharedProps.activeRegion} onSelect={sharedProps.onRegion} />
          <div style={{ height: 14 }} />
          <RoundedHeartcryList
            visible={HEARTCRIES.filter(h => sharedProps.activeRegion === 'all' ? true : h.region === sharedProps.activeRegion)}
            heldMap={sharedProps.heldMap}
            onHold={sharedProps.onHold}
          />
          <ScriptureFooter
            verse={'“Remember those who are in prison, as though in prison with them, and those who are mistreated, since you also are in the body.”'}
            verseRef="Hebrews 13:3"
          />
        </div>
      );
    case 'my-heartcries': return <MyHeartcriesBody populated={sharedProps.populated} />;
    case 'memorial':      return <MemorialBody onOpenArticle={sharedProps.onOpenArticle} onOpenStoryArchive={sharedProps.onOpenStoryArchive} onOpenWitnessArchive={sharedProps.onOpenWitnessArchive} />;
    case 'encouragement': return <EncouragementBody verseIndex={sharedProps.verseIndex} onCycleVerse={sharedProps.onCycleVerse} onOpenGuidance={sharedProps.onOpenGuidance} />;
    case 'stand':         return <StandBody />;
    default:              return null;
  }
}

// Lightweight body-only versions (no NavBar) for pill / swipe layouts:
function MyHeartcriesBody({ populated }) {
  return (
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
          <div className="body">If a day comes when you need to be heard, this space will hold it.</div>
          <div className="cta">Share My Heartcry</div>
        </div>
      )}
      <ScriptureFooter eyebrow="The Lord Hears" verse={'“I cry to the Lord with my voice; with my voice I plead for mercy to the Lord.”'} verseRef="Psalm 142:1" />
    </div>
  );
}

function MemorialBody({ onOpenArticle, onOpenStoryArchive, onOpenWitnessArchive }) {
  return (
    <div className="surface-scroll">
      <div className="memorial-stats">
        <div className="eyebrow">Standing This Week</div>
        {MEMORIAL_STATS.map((s, i) => (
          <div key={i} className="stat-row">
            <span className="num">{s.num}</span>
            <span className="desc">{s.desc}</span>
          </div>
        ))}
      </div>
      <SectionHead label="Around the world" link="All stories" onLink={onOpenStoryArchive} />
      <div>{STORIES.map((s, i) => (
        <div key={i} className="story-card" onClick={() => onOpenArticle && onOpenArticle()}>
          <div className="src"><span className="author">{s.source}</span><span className="sep">·</span><span>{s.author}</span></div>
          <div className="title">{s.title}</div>
          <div className="excerpt">{s.excerpt}</div>
          <div className="read-time">{s.read}</div>
        </div>
      ))}</div>
      <SectionHead label="Witness of the day" link="Archive" onLink={onOpenWitnessArchive} />
      <WitnessOfDayCard w={WITNESS_OF_DAY} onOpenArchive={onOpenWitnessArchive} />
      <ScriptureFooter eyebrow="A Cloud Of Witnesses" verse={'“Since we are surrounded by so great a cloud of witnesses, let us also lay aside every weight and run with endurance the race that is set before us.”'} verseRef="Hebrews 12:1" />
    </div>
  );
}

function EncouragementBody({ verseIndex, onCycleVerse, onOpenGuidance }) {
  const v = ENCOURAGEMENT_VERSES[verseIndex % ENCOURAGEMENT_VERSES.length];
  return (
    <div className="surface-scroll">
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
      <SectionHead label="Practical guidance" />
      <div className="guidance-list">
        {GUIDANCE_CARDS.map((g, i) => (
          <div key={i} className="guidance" onClick={() => onOpenGuidance && onOpenGuidance()}>
            <div className="icon"><GuidanceIcon type={g.icon} /></div>
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
      <SectionHead label="The body with you" />
      <div className="body-with-you">
        <div className="count">9,089</div>
        <div className="copy">verified leaders are standing in prayer with the persecuted church right now — anonymously, faithfully, across forty-three regions.</div>
        <div className="meta">Aggregate Only · No Identity Exposure</div>
      </div>
      <ScriptureFooter eyebrow="Take Heart" verse={'“I have said these things to you, that in me you may have peace. In the world you will have tribulation. But take heart; I have overcome the world.”'} verseRef="John 16:33" />
    </div>
  );
}

function StandBody() {
  return (
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
      <ScriptureFooter eyebrow="Bear One Another" verse={'“Bear one another’s burdens, and so fulfill the law of Christ.”'} verseRef="Galatians 6:2" />
    </div>
  );
}

// ─────────── Option C: Swipe Pages with Dot Indicator ───────────
function SwipeNav({ page, onNavigate, sharedProps }) {
  const OVERLAY = ['article', 'guidance', 'story-archive', 'witness-archive'];
  if (OVERLAY.includes(page)) {
    const backTo = (page === 'article' || page === 'story-archive' || page === 'witness-archive') ? 'memorial' : 'encouragement';
    const onBack = () => onNavigate(backTo);
    return (
      <div className="persec-root">
        <div className="left-edge-accent" />
        {pageNode(page, { ...sharedProps, onBack, onOpenArticle: () => onNavigate('article') })}
        <TabBar active={2} />
      </div>
    );
  }
  const idx = PAGES.findIndex(p => p.id === page);
  const active = PAGES[idx] || PAGES[0];
  return (
    <div className="persec-root">
      <div className="left-edge-accent" />
      <NavBar />
      <div className="swipe-dots">
        {PAGES.map((p, i) => (
          <span key={p.id}
            className={'swipe-dot' + (i === idx ? ' on' : '')}
            onClick={() => onNavigate(p.id)}
          />
        ))}
        <span className="swipe-label">{active.label}</span>
      </div>
      <PillBody page={page} sharedProps={{
        ...sharedProps,
        onNavigate,
        withBack: false,
        onOpenArticle: () => onNavigate('article'),
        onOpenGuidance: () => onNavigate('guidance'),
        onOpenStoryArchive: () => onNavigate('story-archive'),
        onOpenWitnessArchive: () => onNavigate('witness-archive'),
      }} />
      <TabBar active={2} />
    </div>
  );
}

Object.assign(window, { StackNav, PillNav, SwipeNav, PAGES, MyHeartcriesBody, MemorialBody, EncouragementBody, StandBody });
