// ─────────────────────────────────────────────────────────────────────────
// screen-branch.jsx — Branch (group) thread view.
// Multi-party: received bubbles carry sender + ministry; system events narrate
// the branch's life. A "forming" branch is locked (composer disabled) until
// every invited leader consents. A members sheet shows ministries + per-leader
// consent status.
// ─────────────────────────────────────────────────────────────────────────

function GroupBubble({ m, prevSameSender, onRetry }) {
  if (m.system) {
    return <div className="branch-event">{m.text}</div>;
  }
  const showAuthor = !m.mine && !prevSameSender;
  const cls = 'msg-row ' + (m.mine ? 'sent' : 'recv')
    + (m.state === 'pending' ? ' pending' : '')
    + (m.state === 'failed' ? ' failed' : '');
  return (
    <React.Fragment>
      {showAuthor && (
        <div className="bubble-author">
          {m.sender}<span className="min">{m.ministry}</span>
        </div>
      )}
      <div className={cls}>
        <div className="bubble">{m.text}</div>
      </div>
      {m.state === 'pending' && <div className="msg-status pending"><Icon.clock /> Sending</div>}
      {m.state === 'failed' && (
        <div className="msg-status failed" onClick={() => onRetry(m.id)}>
          <Icon.alert /> Not delivered · Tap to retry
        </div>
      )}
    </React.Fragment>
  );
}

// consent state for a given leader, by demo scenario.
// baseline (br3): host joined, Living Word joined; others awaiting consent.
function leaderConsent(branch, ministry, leaderIdx, scenario) {
  if (branch.status === 'active') return 'joined';
  if (ministry.mine) return 'joined';
  if (ministry.id === 'mn2') return 'joined';
  if (scenario === 'partial-decline' && ministry.id === 'mn3') return leaderIdx === 1 ? 'declined' : 'pending';
  if (scenario === 'ministry-declined' && ministry.id === 'mn5') return 'declined';
  return 'pending';
}

// tally consent across a branch, excluding any dropped ministries.
function tallyConsent(branch, scenario, dropped) {
  const live = branch.ministries.filter(m => !dropped.includes(m.id));
  let joined = 0, declined = 0, pending = 0, total = 0;
  const fullyDeclined = [];
  live.forEach(m => {
    let dCount = 0;
    m.leaders.forEach((_, j) => {
      total++;
      const s = leaderConsent(branch, m, j, scenario);
      if (s === 'joined') joined++;
      else if (s === 'declined') { declined++; dCount++; }
      else pending++;
    });
    if (dCount === m.leaders.length && !m.mine) fullyDeclined.push(m);
  });
  return { joined, declined, pending, total, fullyDeclined };
}

function MembersSheet({ branch, scenario, dropped, onClose }) {
  const consentLabel = (s) => {
    if (s === 'joined') return <span className="consent in"><Icon.check width="11" height="11" /> Joined</span>;
    if (s === 'declined') return <span className="consent out"><Icon.x width="11" height="11" /> Declined</span>;
    return <span className="consent">Invited</span>;
  };
  return (
    <div className="scrim gate-sheet-wrap" style={{ background: 'rgba(4,4,4,0.55)' }} onClick={onClose}>
      <div className="members-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="members-title">{branch.name}</div>
        <div className="members-sub">{branch.ministryCount} ministries · {branch.leaderCount} leaders</div>
        <div className="members-list">
          {branch.ministries.map((m) => {
            const isDropped = dropped.includes(m.id);
            return (
              <div className={'ministry-block' + (isDropped ? ' dropped' : '')} key={m.id}>
                <div className="ministry-name">
                  {ministryLabel(m)}
                  {m.mine && <span className="you-tag">Your ministry</span>}
                  {isDropped && <span className="you-tag" style={{ color: 'var(--muted)', borderColor: 'var(--border-2)' }}>Removed</span>}
                </div>
                {m.leaders.map((ln, j) => (
                  <div className="member-leader" key={j}>
                    <span className="ml-name">{ln}</span>
                    {isDropped ? <span className="consent">—</span> : consentLabel(leaderConsent(branch, m, j, scenario))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="btn btn-quiet" style={{ width: '100%' }} onClick={onClose}>Close</div>
      </div>
    </div>
  );
}

let __branchSeq = 0;

function BranchView({ thread: branch, branchIcon, consentScenario = 'awaiting', reconnecting, onToast, onBack }) {
  const [messages, setMessages] = React.useState(BRANCH_MESSAGES[branch.id] || []);
  const [draft, setDraft] = React.useState('');
  const [showMembers, setShowMembers] = React.useState(false);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [dropped, setDropped] = React.useState([]); // ministries removed via "continue without"
  const [resolved, setResolved] = React.useState(false); // creator acted on a decline
  const scrollRef = React.useRef(null);
  const taRef = React.useRef(null);
  const forming = branch.status === 'forming';
  const tally = tallyConsent(branch, consentScenario, dropped);
  const declinedMinistry = (!resolved && consentScenario === 'ministry-declined')
    ? tally.fullyDeclined[0] : null;

  React.useEffect(() => {
    setMessages(BRANCH_MESSAGES[branch.id] || []);
    setDraft(''); setDropped([]); setResolved(false);
  }, [branch.id, consentScenario]);
  React.useEffect(() => {
    const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const autoGrow = () => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 124) + 'px';
  };
  const send = () => {
    const text = draft.trim(); if (!text) return;
    const id = 'b' + (++__branchSeq);
    setMessages(prev => [...prev, { id, mine: true, text, at: 'now', group: null, state: 'pending' }]);
    setDraft(''); if (taRef.current) taRef.current.style.height = 'auto';
    setTimeout(() => setMessages(prev => prev.map(x => x.id === id ? { ...x, state: 'sent' } : x)), 850);
  };
  const canSend = draft.trim().length > 0;

  const attach = () => onToast && onToast('Attachments are coming soon. Sharing files will require consent and must follow the Replant community standard.');
  const proceedWithout = (m) => {
    setDropped(prev => [...prev, m.id]);
    setResolved(true);
    const after = tallyConsent(branch, consentScenario, [...dropped, m.id]);
    onToast && onToast(after.pending === 0
      ? `Branch formed without ${m.name}.`
      : `Continuing without ${m.name} — ${after.pending} still to consent.`);
  };

  return (
    <div className="thread-view">
      <div className="thread-head branch">
        <div className="back" onClick={onBack}><Icon.back /></div>
        <div className="who">
          <div className="name"><span className="lock"><IconBranch variant={branchIcon} width="14" height="14" /></span>{branch.name}</div>
          <div className="church">{branch.ministryCount} ministries · {branch.leaderCount} leaders</div>
        </div>
        <div className="head-action" onClick={() => setShowMembers(true)} title="Members"><Icon.users /></div>
      </div>

      <div className="messages" ref={scrollRef}>
        {forming && (
          <div className="forming-banner">
            <div className="fb-title">Forming this branch</div>
            <div className="fb-body">
              {tally.declined > 0
                ? <>{tally.joined} of {tally.total} joined · {tally.declined} declined. {tally.pending} still to consent.</>
                : <>{tally.joined} of {tally.total} leaders have joined. Messages open once every leader accepts — {tally.pending} still to consent.</>}
            </div>
          </div>
        )}
        {declinedMinistry && (
          <div className="decline-prompt">
            <div className="dp-title">{declinedMinistry.name} declined this branch.</div>
            <div className="dp-body">Their leaders chose not to join. You can continue forming the branch without them — no harm, no foul.</div>
            <div className="dp-actions">
              <div className="btn btn-quiet" onClick={onBack}>Cancel branch</div>
              <div className="btn btn-primary" onClick={() => proceedWithout(declinedMinistry)}>Continue without them</div>
            </div>
          </div>
        )}
        {reconnecting && <div className="reconnect"><span className="pulse" /> Reconnecting</div>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const prevSameSender = prev && !prev.system && !m.system && prev.mine === m.mine && prev.sender === m.sender && !m.group;
          return (
            <React.Fragment key={m.id}>
              {m.group && <div className="ts-divider">{m.group}</div>}
              <GroupBubble m={m} prevSameSender={prevSameSender} onRetry={() => {}} />
            </React.Fragment>
          );
        })}
      </div>

      {attachOpen && <div className="attach-catch" onClick={() => setAttachOpen(false)} />}

      <CovenantStrip />

      {forming ? (
        <div className="composer locked">
          <div className="field locked-note">Messaging opens once everyone has joined</div>
          <div className="send disabled"><Icon.send /></div>
        </div>
      ) : (
        <div className="composer">
          <div className="attach-wrap">
            {attachOpen && <AttachPopover />}
            <div className="attach" onClick={() => setAttachOpen(o => !o)} title="Attachments coming soon"><Icon.clip /></div>
          </div>
          <textarea
            ref={taRef} className="field" rows={1}
            placeholder="Message the branch"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); autoGrow(); setAttachOpen(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <div className={'send' + (canSend ? '' : ' disabled')} onClick={send}><Icon.send /></div>
        </div>
      )}

      {showMembers && <MembersSheet branch={branch} scenario={consentScenario} dropped={dropped} onClose={() => setShowMembers(false)} />}
    </div>
  );
}

Object.assign(window, { BranchView, GroupBubble, MembersSheet });
