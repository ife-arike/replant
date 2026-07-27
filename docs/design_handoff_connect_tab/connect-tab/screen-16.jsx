// ─────────────────────────────────────────────────────────────────────────
// screen-16.jsx — Thread List (the Connect tab root).
// Header + search + pinned Replant secure thread + peer threads.
// Search matches leader names and church names only — never message content.
// ─────────────────────────────────────────────────────────────────────────

function ThreadRow({ thread, onOpen }) {
  const unread = thread.unread > 0;
  return (
    <div className={'thread-row' + (thread.system ? ' secure' : '') + (unread ? ' unread' : '')}
         onClick={() => onOpen(thread)}>
      <Monogram thread={thread} />
      <div className="center">
        <div className="name-line">
          {thread.system && <span className="lock"><Icon.lock width="11" height="12" /></span>}
          <span className="name">{thread.displayName}</span>
          {thread.system && <span className="secure-tag">Secure</span>}
        </div>
        {thread.church && <div className="church">{thread.church}</div>}
        <div className="preview">{thread.preview}</div>
      </div>
      <div className="right">
        <span className="time">{thread.lastAt}</span>
        {unread && <span className="unread-badge">{thread.unread}</span>}
      </div>
    </div>
  );
}

function ThreadList({ threads, query, onQuery, onOpen, searchFocused, setSearchFocused }) {
  // search activates at 2+ chars; matches name + church only
  const q = query.trim().toLowerCase();
  const filtered = q.length >= 2
    ? threads.filter(t =>
        t.displayName.toLowerCase().includes(q) ||
        (t.church && t.church.toLowerCase().includes(q)))
    : threads;

  // secure thread is pinned above the recency sort; peers already arrive sorted
  // by last_message_at DESC from resolveThreads()
  return (
    <React.Fragment>
      <div className={'cn-search' + (searchFocused ? ' is-focused' : '')}>
        <Icon.search />
        <input
          value={query}
          placeholder="Search by name or church"
          onChange={(e) => onQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      <div className="thread-list">
        {filtered.length === 0 && (
          <div className="empty-quiet" style={{ padding: '40px 28px' }}>
            <div className="title" style={{ fontSize: 19 }}>No matches.</div>
            <div className="body" style={{ marginBottom: 0 }}>
              No conversation with a leader or church by that name.
            </div>
          </div>
        )}
        {filtered.map(t => (
          <ThreadRow key={t.id} thread={t} onOpen={onOpen} />
        ))}
      </div>

      <CovenantFooter />
    </React.Fragment>
  );
}

Object.assign(window, { ThreadList, ThreadRow });
