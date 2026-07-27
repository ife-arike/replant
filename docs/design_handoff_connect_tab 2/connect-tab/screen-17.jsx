// ─────────────────────────────────────────────────────────────────────────
// screen-17.jsx — New DM Flow / Leader Search (pushes over the thread list).
// Autofocused search, live results at 2+ chars (~250ms debounce in prod).
// Name + church only — never location, country, or region. Underground rows
// surface as "Underground Church"; their real name is not searchable.
// ─────────────────────────────────────────────────────────────────────────

function ResultRow({ leader, onTap }) {
  return (
    <div className="result-row" onClick={() => onTap(leader)}>
      <div className={'monogram' + (leader.anonymous ? ' anon' : '')}>
        {leader.underground ? <Icon.anon /> : monogramInitial(leader)}
      </div>
      <div className="center">
        <div className="name">{leaderName(leader)}</div>
        <div className="church">{churchLabel(leader)}</div>
      </div>
      <span className="chev"><Icon.chevron /></span>
    </div>
  );
}

function LeaderSearch({ onBack, onPick }) {
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    // autofocus on mount
    const id = setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  React.useEffect(() => {
    // ~250ms debounce — mirrors the production live-search cadence
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  const term = debounced.trim().toLowerCase();
  const active = term.length >= 2;
  // search matches display name + church label only. underground real names
  // are excluded by construction (we never match leader.church on underground
  // rows — only the "Underground Church" label).
  const results = active
    ? LEADERS.filter(l => {
        const nameHit = leaderName(l).toLowerCase().includes(term);
        const churchHit = churchLabel(l).toLowerCase().includes(term);
        return nameHit || churchHit;
      })
    : [];

  return (
    <div className="push-screen">
      <div className="push-nav">
        <div className="back" onClick={onBack}><Icon.back /></div>
        <div className="nav-title">New Message</div>
      </div>

      <div className="search-field">
        <Icon.search width="18" height="18" />
        <input
          ref={inputRef}
          value={q}
          placeholder="Find a leader"
          onChange={(e) => setQ(e.target.value)}
        />
        {q && <span className="clear" onClick={() => setQ('')}><Icon.x /></span>}
      </div>

      <div className="search-results">
        {!active && (
          <div className="search-hint">
            Search the network by a leader's name<br />or the name of their church.
          </div>
        )}
        {active && results.length === 0 && (
          <div className="search-hint">No leaders found matching that search.</div>
        )}
        {active && results.map(l => (
          <ResultRow key={l.id} leader={l} onTap={onPick} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { LeaderSearch, ResultRow });
