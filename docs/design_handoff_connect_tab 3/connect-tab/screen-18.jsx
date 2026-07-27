// ─────────────────────────────────────────────────────────────────────────
// screen-18.jsx — DM Thread View.
// Grouped 5-min timestamps, sent/received bubbles, optimistic send states
// (pending / sent / failed→retry), auto-grow composer, history pagination,
// empty opener for a lazily-created thread, and the one-time Covenant gate
// fired on the leader's very first DM (ever, not per conversation).
// ─────────────────────────────────────────────────────────────────────────

let __pendingSeq = 0;

function Bubble({ m, prevSameAuthor, secure, onRetry }) {
  const tail = prevSameAuthor && !m.group;
  const cls = 'msg-row ' + (m.mine ? 'sent' : 'recv')
    + (tail ? ' tail' : '')
    + (secure && !m.mine ? ' secure' : '')
    + (m.state === 'pending' ? ' pending' : '')
    + (m.state === 'failed' ? ' failed' : '');
  return (
    <React.Fragment>
      <div className={cls}>
        <div className="bubble">{m.text}</div>
      </div>
      {m.state === 'pending' && (
        <div className="msg-status pending"><Icon.clock /> Sending</div>
      )}
      {m.state === 'failed' && (
        <div className="msg-status failed" onClick={() => onRetry(m.id)}>
          <Icon.alert /> Not delivered · Tap to retry
        </div>
      )}
    </React.Fragment>
  );
}

function ThreadView({ thread, covenantAck, setCovenantAck, forceFailNext, reconnecting, onToast, onBack }) {
  const seed = (thread.isNew ? [] : (MESSAGES[thread.id] || []));
  const [messages, setMessages] = React.useState(seed);
  const [draft, setDraft] = React.useState('');
  const [historyExhausted, setHistoryExhausted] = React.useState(false);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [showCovenant, setShowCovenant] = React.useState(false);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const pendingTextRef = React.useRef('');
  const scrollRef = React.useRef(null);
  const taRef = React.useRef(null);

  // reset when switching threads
  React.useEffect(() => {
    setMessages(thread.isNew ? [] : (MESSAGES[thread.id] || []));
    setHistoryExhausted(false);
    setDraft('');
  }, [thread.id]);

  // keep pinned to the newest message
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 124) + 'px';
  };

  // scroll-to-top loads the previous page (mocked as a one-shot)
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || loadingOlder || historyExhausted || thread.isNew) return;
    if (el.scrollTop < 24) {
      setLoadingOlder(true);
      setTimeout(() => { setLoadingOlder(false); setHistoryExhausted(true); }, 900);
    }
  };

  const deliver = (id, fail) => {
    setTimeout(() => {
      setMessages(prev => prev.map(x =>
        x.id === id ? { ...x, state: fail ? 'failed' : 'sent' } : x));
    }, 850);
  };

  const doSend = (text) => {
    const id = 'p' + (++__pendingSeq);
    const fail = !!forceFailNext;
    setMessages(prev => [...prev, { id, mine: true, text, at: 'now', group: null, state: 'pending' }]);
    setDraft('');
    if (taRef.current) { taRef.current.style.height = 'auto'; }
    deliver(id, fail);
  };

  const attemptSend = () => {
    const text = draft.trim();
    if (!text) return;
    if (!covenantAck) {
      // first DM ever — gate behind the covenant notice
      pendingTextRef.current = text;
      setShowCovenant(true);
      return;
    }
    doSend(text);
  };

  const acceptCovenant = () => {
    setCovenantAck(true);
    setShowCovenant(false);
    const text = pendingTextRef.current;
    pendingTextRef.current = '';
    if (text) doSend(text);
  };

  const retry = (id) => {
    setMessages(prev => prev.map(x => x.id === id ? { ...x, state: 'pending' } : x));
    deliver(id, false); // retry succeeds
  };

  const canSend = draft.trim().length > 0;

  return (
    <div className="thread-view">
      <div className={'thread-head' + (thread.system ? ' secure' : '')}>
        <div className="back" onClick={onBack}><Icon.back /></div>
        <div className="who">
          <div className="name">
            {thread.system && <span className="lock"><Icon.lock width="12" height="13" /></span>}
            {thread.system ? 'Replant Team — Secure Message' : thread.displayName}
          </div>
          {thread.system
            ? <div className="church">Replant · system-managed</div>
            : <div className="church">{thread.church}</div>}
        </div>
      </div>

      {thread.isNew && messages.length === 0 ? (
        <div className="messages" ref={scrollRef}>
          <div className="thread-empty">
            <div className="glyph"><Icon.lock width="22" height="24" /></div>
            <div className="line">A new, private letter.</div>
            <div className="sub">Say what is on your heart to begin. Only the two of you will read it.</div>
          </div>
        </div>
      ) : (
        <div className="messages" ref={scrollRef} onScroll={onScroll}>
          {loadingOlder && (
            <div className="history-loading"><span className="spin" /><span>Loading earlier</span></div>
          )}
          {historyExhausted && <div className="history-top">Beginning of conversation</div>}
          {reconnecting && (
            <div className="reconnect"><span className="pulse" /> Reconnecting</div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const prevSameAuthor = prev && prev.mine === m.mine && !m.group;
            return (
              <React.Fragment key={m.id}>
                {m.group && <div className="ts-divider">{m.group}</div>}
                <Bubble m={m} prevSameAuthor={prevSameAuthor} secure={thread.system} onRetry={retry} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {attachOpen && <div className="attach-catch" onClick={() => setAttachOpen(false)} />}

      <CovenantStrip />

      <div className="composer">
        <div className="attach-wrap">
          {attachOpen && <AttachPopover />}
          <div className="attach" onClick={() => setAttachOpen(o => !o)} title="Attachments coming soon"><Icon.clip /></div>
        </div>
        <textarea
          ref={taRef}
          className="field"
          rows={1}
          placeholder={thread.system ? 'Reply to the Replant Team' : 'Write a message'}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); autoGrow(); setAttachOpen(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); attemptSend(); }
          }}
        />
        <div className={'send' + (canSend ? '' : ' disabled')} onClick={attemptSend}>
          <Icon.send />
        </div>
      </div>

      {showCovenant && (
        <CovenantNotice onAccept={acceptCovenant} />
      )}
    </div>
  );
}

Object.assign(window, { ThreadView, Bubble });
