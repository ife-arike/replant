// ─────────────────────────────────────────────────────────────────────────
// screen-ministries.jsx — the "Ministries" sub-tab.
// Branches = group chats connecting up to 7 ministries (John 15:5, the vine
// and the branches). Empty state invites the first branch; the list shows
// invited (consent-required), forming (awaiting consent), and active branches.
// ─────────────────────────────────────────────────────────────────────────

function BranchRow({ branch, branchIcon, onOpen }) {
  const b = resolveBranch(branch);
  const unread = b.unread > 0;
  const forming = b.status === 'forming';
  return (
    <div className={'branch-row' + (unread ? ' unread' : '')} onClick={() => onOpen(b)}>
      <BranchSeal status={b.status} variant={branchIcon} />
      <div className="center">
        <div className="name-line">
          <span className="name">{b.name}</span>
          {forming && <span className="forming-tag">Forming</span>}
        </div>
        <div className="members">
          {b.ministryCount} ministries · {b.leaderCount} leaders
        </div>
        <div className="preview">{b.preview}</div>
      </div>
      <div className="right">
        <span className="time">{b.lastAt}</span>
        {unread && <span className="unread-badge">{b.unread}</span>}
      </div>
    </div>
  );
}

// the consent card — shown when another ministry has invited yours into a branch
function InviteCard({ branch, branchIcon, onAccept, onDecline, onOpen }) {
  const b = resolveBranch(branch);
  return (
    <div className="invite-card">
      <div className="invite-head">
        <BranchSeal status="invited" variant={branchIcon} />
        <div className="who">
          <div className="eyebrow">You're invited to a branch</div>
          <div className="name">{b.name}</div>
        </div>
      </div>
      <div className="invite-body">
        <strong>{b.invitedByName}</strong> invited your ministry to join — {b.ministryCount} ministries,
        {' '}{b.leaderCount} leaders in all. Everyone joins only by consent.
      </div>
      <div className="invite-actions">
        <div className="btn btn-quiet" onClick={onDecline}>Decline</div>
        <div className="btn btn-primary" onClick={onAccept}>Join the branch</div>
      </div>
    </div>
  );
}

function MinistriesEmpty({ branchIcon, onStart }) {
  return (
    <div className="ministries-empty">
      <div className="seal-lg"><IconBranch variant={branchIcon} width="26" height="26" /></div>
      <div className="title">What would you like to start today?</div>
      <div className="body">
        Open a church-to-church conversation. You can bring up to seven ministries
        together into one branch — everyone joins by consent.
      </div>
      <div className="btn btn-primary" style={{ display: 'inline-flex' }} onClick={onStart}>Start a branch</div>
      <div className="vine-verse">
        “I am the vine, ye are the branches: He that abideth in me, and I in him,
        the same bringeth forth much fruit: for without me ye can do nothing.”
        <span className="ref">John 15:5</span>
      </div>
      <div className="post-note">Branches with more than seven ministries coming soon.</div>
    </div>
  );
}

function DeclineConfirm({ branch, onCancel, onConfirm }) {
  return (
    <div className="scrim covenant-wrap" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cm-title">Decline this invitation?</div>
        <div className="cm-body">
          Your ministry won’t join “{branch.name}.” {branch.invitedByName} can invite you again later — no harm, no foul.
        </div>
        <div className="cm-actions">
          <div className="btn btn-quiet" onClick={onCancel}>Keep invitation</div>
          <div className="btn btn-decline" onClick={onConfirm}>Decline</div>
        </div>
      </div>
    </div>
  );
}

function MinistriesScreen({ branches, branchIcon, onOpenBranch, onStart, onAccept, onDecline }) {
  const [declining, setDeclining] = React.useState(null);
  const invited = branches.filter(b => b.status === 'invited');
  const rest = branches.filter(b => b.status !== 'invited');

  if (branches.length === 0) {
    return (
      <React.Fragment>
        <MinistriesEmpty branchIcon={branchIcon} onStart={onStart} />
        <CovenantFooter />
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <div className="branch-list">
        {invited.map(b => (
          <InviteCard key={b.id} branch={b} branchIcon={branchIcon}
            onAccept={() => onAccept(b)} onDecline={() => setDeclining(resolveBranch(b))}
            onOpen={() => onOpenBranch(resolveBranch(b))} />
        ))}
        {rest.map(b => (
          <BranchRow key={b.id} branch={b} branchIcon={branchIcon} onOpen={onOpenBranch} />
        ))}
      </div>
      <CovenantFooter />
      {declining && (
        <DeclineConfirm branch={declining}
          onCancel={() => setDeclining(null)}
          onConfirm={() => { onDecline(declining); setDeclining(null); }} />
      )}
    </React.Fragment>
  );
}

Object.assign(window, { MinistriesScreen, BranchRow, InviteCard, MinistriesEmpty, DeclineConfirm });
