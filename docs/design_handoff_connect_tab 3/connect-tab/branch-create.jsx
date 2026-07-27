// ─────────────────────────────────────────────────────────────────────────
// branch-create.jsx — Start a branch (pushes over the Ministries list).
// Name it, then invite up to 7 ministries (your own ministry is the host and
// is always included). Selecting a ministry brings its leaders; the branch is
// created server-side as "forming" only when invitations are sent — and opens
// to messages only once every invited leader consents.
// ─────────────────────────────────────────────────────────────────────────

function BranchCreate({ onBack, onCreate }) {
  const [name, setName] = React.useState('');
  const [q, setQ] = React.useState('');
  const [picked, setPicked] = React.useState([]); // ministry ids (excludes host)

  const host = MINISTRIES.find(m => m.mine);
  const selectable = MINISTRIES.filter(m => !m.mine);
  const cap = MAX_MINISTRIES_PER_BRANCH - 1; // host occupies one slot
  const atCap = picked.length >= cap;

  const term = q.trim().toLowerCase();
  const results = term.length >= 1
    ? selectable.filter(m => ministryLabel(m).toLowerCase().includes(term))
    : selectable;

  const toggle = (id) => {
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id)
      : (prev.length >= cap ? prev : [...prev, id]));
  };

  const totalMinistries = picked.length + 1;
  const totalLeaders = [host, ...picked.map(ministryById)].reduce((n, m) => n + m.leaders.length, 0);
  const canSend = name.trim().length > 0 && picked.length >= 1;

  return (
    <div className="push-screen">
      <div className="push-nav">
        <div className="back" onClick={onBack}><Icon.back /></div>
        <div className="nav-title">Start a branch</div>
      </div>

      <div className="create-scroll">
        <div className="vine-eyebrow" style={{ textAlign: 'left', margin: '14px 0 14px' }}>
          "I am the vine, ye are the branches" · John 15:5
        </div>

        <label className="field-label">Name this branch</label>
        <input className="create-name" value={name} maxLength={48}
               placeholder="e.g. East Africa Outreach"
               onChange={(e) => setName(e.target.value)} />

        <div className="create-section">
          <label className="field-label">Invite ministries</label>
          <span className="cap-count">{picked.length} of {cap} selected</span>
        </div>

        <div className="host-chip">
          <div className="monogram branch-seal" style={{ width: 34, height: 34, borderRadius: 9 }}>{ministryInitials(host)}</div>
          <div className="host-meta">
            <div className="hc-name">{host.name}</div>
            <div className="hc-sub">Your ministry · host</div>
          </div>
          <span className="host-lock"><Icon.lock width="12" height="13" /></span>
        </div>

        <div className={'cn-search' + ''} style={{ margin: '4px 0 8px' }}>
          <Icon.search />
          <input value={q} placeholder="Search ministries" onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="pick-list">
          {results.map(m => {
            const on = picked.includes(m.id);
            const disabled = !on && atCap;
            return (
              <div key={m.id} className={'pick-row' + (on ? ' on' : '') + (disabled ? ' disabled' : '')}
                   onClick={() => !disabled && toggle(m.id)}>
                <div className={'monogram' + (m.underground ? ' anon' : '')} style={{ width: 36, height: 36 }}>
                  {m.underground ? <Icon.anon /> : ministryInitials(m)}
                </div>
                <div className="center">
                  <div className="name">{m.underground ? 'Underground Church' : m.name}</div>
                  <div className="church">{m.underground ? `${m.leaders.length} leader${m.leaders.length > 1 ? 's' : ''}` : `${m.location} · ${m.leaders.length} leader${m.leaders.length > 1 ? 's' : ''}`}</div>
                </div>
                <div className={'pick-box' + (on ? ' on' : '')}>{on && <Icon.check width="12" height="12" />}</div>
              </div>
            );
          })}
          {results.length === 0 && <div className="search-hint">No ministries found.</div>}
        </div>
      </div>

      <div className="create-foot">
        <div className="create-summary">{totalMinistries} ministries · {totalLeaders} leaders will be invited</div>
        <div className={'btn btn-primary' + (canSend ? '' : ' disabled-btn')}
             onClick={() => canSend && onCreate({ name: name.trim(), ministryIds: ['mn4', ...picked] })}>
          Send invitations
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BranchCreate });
