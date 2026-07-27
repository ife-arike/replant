// ─────────────────────────────────────────────────────────────────────────
// app.jsx — Connect router + state machine + Tweaks.
// Connect now has two sub-tabs (segmented control): MINISTRIES (branches —
// group coordination) and LEADERS (1:1 DMs). The shared header + segmented
// live here; each sub-tab renders its own body. Push layers: leader search,
// DM thread, branch thread, create-a-branch.
// ─────────────────────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "openTab": "ministries",
  "leadersState": "populated",
  "ministriesState": "populated",
  "branchIcon": "network",
  "consentDemo": "awaiting",
  "branchInvite": "show",
  "messageBadge": "on",
  "badgeDemo": "real",
  "verification": "verified",
  "connection": "stable",
  "sendOutcome": "success"
}/*EDITMODE-END*/;

function ConnectHeader({ tab, onCompose }) {
  return (
    <div className="tab-header">
      <div className="eyebrow">Tab 5 · In Confidence</div>
      <h1>Connect</h1>
      <div className="subtitle">
        {tab === 'ministries' ? 'Ministry to ministry' : 'Leader to leader'}
        <span className="dot">·</span>
        Held in confidence
      </div>
      <div className="compose" onClick={onCompose} title={tab === 'ministries' ? 'Start a branch' : 'New message'}>
        {tab === 'ministries' ? <Icon.plus /> : <Icon.compose />}
      </div>
    </div>
  );
}

function ConnectApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [tab, setTab] = React.useState(t.openTab);
  const [screen, setScreen] = React.useState('list'); // list | search | thread | branch | create
  const [activeThread, setActiveThread] = React.useState(null);
  const [activeBranch, setActiveBranch] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [covenantAck, setCovenantAck] = React.useState(false);
  const [gateDismissed, setGateDismissed] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [branches, setBranches] = React.useState(() => BRANCHES.slice());

  const threads = React.useMemo(() => THREADS.map(resolveThread), []);
  React.useEffect(() => { setTab(t.openTab); }, [t.openTab]);

  const unverified = t.verification === 'unverified';
  React.useEffect(() => { setGateDismissed(false); }, [t.verification]);

  // total unread across all conversations (DMs + branches) drives the tab badge
  const realUnread = threads.reduce((n, x) => n + (x.unread || 0), 0)
    + branches.reduce((n, b) => n + (b.unread || 0), 0);
  const shownUnread = t.badgeDemo === 'none' ? 0 : t.badgeDemo === 'high' ? 128 : realUnread;

  // branch-invitation tweak — re-trigger the consent invite so it can be tested again
  React.useEffect(() => {
    setBranches(prev => {
      if (t.branchInvite === 'show') {
        if (prev.some(b => b.id === 'br4')) return prev.map(b => b.id === 'br4' ? { ...b, status: 'invited', preview: 'Kingdom Mandate invited your ministry to join.' } : b);
        return [BRANCHES.find(b => b.id === 'br4'), ...prev.filter(b => b.id !== 'br4')];
      }
      return prev.filter(b => b.id !== 'br4');
    });
  }, [t.branchInvite]);

  // ── navigation ──
  const openThread = (thread) => { setActiveThread(thread); setScreen('thread'); };
  const openBranch = (branch) => { setActiveBranch(branch); setScreen('branch'); };
  const backToList = () => { setScreen('list'); setQuery(''); };
  const compose = () => setScreen(tab === 'ministries' ? 'create' : 'search');

  const pickLeader = (leader) => {
    if (!leader.active) { setToast('This leader is no longer active in the network.'); return; }
    const existing = threads.find(th => !th.system && th.leaderId === leader.id);
    if (existing) { openThread(existing); return; }
    openThread({
      id: 'new:' + leader.id, isNew: true, leader,
      displayName: leaderName(leader), church: churchLabel(leader),
      anonymous: leader.anonymous, underground: leader.underground, system: false,
    });
  };

  const createBranch = ({ name, ministryIds }) => {
    const id = 'new-' + Date.now();
    BRANCH_MESSAGES[id] = [
      { id: id + '-s1', system: true, text: 'You started this branch.', group: 'Today' },
      { id: id + '-s2', system: true, text: 'Invitations sent. Waiting for every leader to consent.', group: null },
    ];
    const nb = { id, name, status: 'forming', ministryIds, joined: 1,
      preview: 'Waiting for leaders to join the branch.', lastAt: 'now', unread: 0 };
    setBranches(prev => [nb, ...prev]);
    openBranch(resolveBranch(nb));
  };

  const acceptInvite = (b) => {
    setBranches(prev => prev.map(x => x.id === b.id ? { ...x, status: 'active', preview: 'You joined this branch.' } : x));
    setToast('You\u2019ve joined ' + b.name + '.');
  };
  const declineInvite = (b) => {
    setBranches(prev => prev.filter(x => x.id !== b.id));
    setToast('Invitation declined.');
  };

  // ── Leaders body (no header — header is shared) ──
  const renderLeaders = () => {
    if (t.leadersState === 'loading') {
      return (<React.Fragment>
        <div className="cn-search"><Icon.search /><input placeholder="Search by name or church" readOnly /></div>
        <ThreadListSkeleton />
      </React.Fragment>);
    }
    if (t.leadersState === 'error') return <ThreadListError onRetry={() => setTweak('leadersState', 'populated')} />;
    if (t.leadersState === 'empty') return <React.Fragment><ThreadListEmpty onFind={compose} /><CovenantFooter /></React.Fragment>;
    return (
      <ThreadList threads={threads} query={query} onQuery={setQuery}
        onOpen={openThread} searchFocused={searchFocused} setSearchFocused={setSearchFocused} />
    );
  };

  // ── Ministries body ──
  const renderMinistries = () => {
    const list = t.ministriesState === 'empty' ? [] : branches;
    return (
      <MinistriesScreen branches={list} branchIcon={t.branchIcon} onOpenBranch={openBranch} onStart={compose}
        onAccept={acceptInvite} onDecline={declineInvite} />
    );
  };

  return (
    <div className="tab-root connect">
      <div className="tc-pages" style={unverified && !gateDismissed ? { filter: 'brightness(0.5)' } : null}>
        <ConnectHeader tab={tab} onCompose={compose} />
        <Segmented
          value={tab}
          onChange={(v) => { setTab(v); setQuery(''); }}
          options={[{ value: 'ministries', label: 'Ministries' }, { value: 'leaders', label: 'Leaders' }]}
        />
        {tab === 'ministries' ? renderMinistries() : renderLeaders()}
      </div>

      {screen === 'search' && <LeaderSearch onBack={backToList} onPick={pickLeader} />}
      {screen === 'create' && <BranchCreate onBack={backToList} onCreate={createBranch} />}
      {screen === 'thread' && activeThread && (
        <ThreadView thread={activeThread} covenantAck={covenantAck} setCovenantAck={setCovenantAck}
          forceFailNext={t.sendOutcome === 'fail'} reconnecting={t.connection === 'reconnecting'} onToast={setToast} onBack={backToList} />
      )}
      {screen === 'branch' && activeBranch && (
        <BranchView thread={activeBranch} branchIcon={t.branchIcon} consentScenario={t.consentDemo}
          reconnecting={t.connection === 'reconnecting'} onToast={setToast} onBack={backToList} />
      )}

      {toast && <Toast text={toast} onClose={() => setToast(null)} />}

      {unverified && !gateDismissed && screen === 'list' && (
        <UnverifiedGate onDismiss={() => setGateDismissed(true)} />
      )}

      <TabBar active={4} unread={shownUnread} badgeEnabled={t.messageBadge === 'on'} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="View">
          <TweakRadio label="Sub-tab" value={tab}
            onChange={(v) => { setTweak('openTab', v); setTab(v); }}
            options={[{ value: 'ministries', label: 'Ministries' }, { value: 'leaders', label: 'Leaders' }]} />
        </TweakSection>
        <TweakSection label="Notifications">
          <TweakRadio label="New message badge" value={t.messageBadge}
            onChange={(v) => setTweak('messageBadge', v)}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
          <TweakSelect label="Unread count (demo)" value={t.badgeDemo}
            onChange={(v) => setTweak('badgeDemo', v)}
            options={[
              { value: 'real', label: 'Real total' },
              { value: 'high', label: '99+ (cap)' },
              { value: 'none', label: 'None (zero → hidden)' },
            ]} />
        </TweakSection>
        <TweakSection label="Ministries (branches)">
          <TweakRadio label="State" value={t.ministriesState}
            onChange={(v) => setTweak('ministriesState', v)}
            options={[{ value: 'populated', label: 'Populated' }, { value: 'empty', label: 'Empty' }]} />
          <TweakSelect label="Branch icon" value={t.branchIcon}
            onChange={(v) => setTweak('branchIcon', v)}
            options={[
              { value: 'network', label: 'Network (current)' },
              { value: 'union', label: 'Linked rings' },
              { value: 'link', label: 'Chain links' },
              { value: 'people', label: 'People' },
            ]} />
          <TweakSelect label="Branch invitation" value={t.branchInvite}
            onChange={(v) => setTweak('branchInvite', v)}
            options={[{ value: 'show', label: 'Show invite (test consent)' }, { value: 'hide', label: 'Hide invite' }]} />
          <TweakSelect label="Consent (forming branch)" value={t.consentDemo}
            onChange={(v) => setTweak('consentDemo', v)}
            options={[
              { value: 'awaiting', label: 'Awaiting consent' },
              { value: 'partial-decline', label: 'One leader declined' },
              { value: 'ministry-declined', label: 'A whole ministry declined' },
            ]} />
        </TweakSection>
        <TweakSection label="Leaders (DMs)">
          <TweakRadio label="Thread list" value={t.leadersState}
            onChange={(v) => setTweak('leadersState', v)}
            options={[
              { value: 'populated', label: 'Populated' },
              { value: 'empty', label: 'Empty' },
              { value: 'loading', label: 'Loading' },
              { value: 'error', label: 'Error' },
            ]} />
        </TweakSection>
        <TweakSection label="Access">
          <TweakRadio label="Verification" value={t.verification}
            onChange={(v) => setTweak('verification', v)}
            options={[{ value: 'verified', label: 'Verified' }, { value: 'unverified', label: 'Unverified' }]} />
        </TweakSection>
        <TweakSection label="Thread view">
          <TweakRadio label="Connection" value={t.connection}
            onChange={(v) => setTweak('connection', v)}
            options={[{ value: 'stable', label: 'Stable' }, { value: 'reconnecting', label: 'Reconnecting' }]} />
          <TweakRadio label="Next send" value={t.sendOutcome}
            onChange={(v) => setTweak('sendOutcome', v)}
            options={[{ value: 'success', label: 'Succeeds' }, { value: 'fail', label: 'Fails' }]} />
          <TweakButton label="Reset covenant notice" secondary onClick={() => setCovenantAck(false)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ConnectApp />);
