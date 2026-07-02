// states.jsx — loading, error, unverified gate, modals, toast

function LoadingState() {
  return (
    <div className="caml" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: 16, paddingTop: 60 }}>
        <div className="skel" style={{ height: 240, marginBottom: 16 }} />
        <div className="skel" style={{ height: 14, width: '40%', marginBottom: 8 }} />
        <div className="skel" style={{ height: 60, marginBottom: 8 }} />
        <div className="skel" style={{ height: 60, marginBottom: 8 }} />
        <div className="skel" style={{ height: 60, marginBottom: 8 }} />
      </div>
      <div style={{
        position: 'absolute', bottom: 100, left: 0, right: 0,
        textAlign: 'center',
      }}>
        <div className="tiny" style={{ color: 'var(--sky)' }}>Loading the network…</div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="fullstate">
      <div className="glyph">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(224,85,85,0.4)" strokeWidth="0.8" strokeDasharray="3 3" />
          <path d="M16 16l16 16M32 16L16 32" stroke="var(--red)" strokeWidth="1.2" />
        </svg>
      </div>
      <h2>We couldn't reach the network.</h2>
      <p style={{ marginBottom: 22 }}>
        Could be our servers, could be your connection. Try again in a moment — the body is still gathered.
      </p>
      <div className="btn btn-ghost" style={{ flex: '0 0 auto', minWidth: 120 }} onClick={onRetry}>Retry</div>
    </div>
  );
}

function UnverifiedGate() {
  return (
    <div className="fullstate">
      <div className="glyph">
        <div className="glyph-cross" style={{ width: 36, height: 36 }} />
      </div>
      <h2>Your account is being verified.</h2>
      <p style={{ marginBottom: 20 }}>
        Once your church is confirmed by a Replant team member, you'll unlock The Church tab —
        and be able to see, and be seen by, every verified leader on the network.
      </p>
      <p className="tiny" style={{ color: 'var(--sky)', marginBottom: 28 }}>
        Most verifications complete in 24–72 hours.
      </p>
      <div style={{
        padding: '12px 16px',
        background: 'rgba(107,181,232,0.06)',
        border: '0.5px solid var(--sky-mid)',
        borderRadius: 8,
        fontFamily: 'var(--serif)', fontStyle: 'italic',
        fontSize: 13.5, color: 'var(--off-white)', lineHeight: 1.5,
        maxWidth: 300,
        textAlign: 'center',
      }}>
        "He which hath begun a good work in you will perform it…"
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'var(--sky)', marginTop: 8, fontStyle: 'normal',
        }}>Philippians 1:6</div>
      </div>
    </div>
  );
}

function ConnectModal({ open, church, onConfirm, onCancel }) {
  if (!church) return null;
  const leaders = church.leaders || [];
  // pick the first non-anon leader; fall back to first
  const target = leaders.find(l => !l.anon) || leaders[0];
  const targetLabel = target
    ? (target.anon
        ? `the ${target.role} at ${church.name}`
        : `${target.name} at ${church.name}`)
    : `the leaders at ${church.name}`;
  return (
    <div className={'modal-scrim' + (open ? ' open' : '')} onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="eyebrow">Send a connection request</div>
        <h3>Reach out to {targetLabel}?</h3>
        <div className="body">
          Replant will let them know you'd like to connect. If they accept, the conversation
          will open in your Connect tab.
        </div>
        <div className="row">
          <div className="btn btn-ghost" onClick={onCancel}>Cancel</div>
          <div className="btn btn-primary" style={{ flex: 2 }} onClick={onConfirm}>Send request</div>
        </div>
      </div>
    </div>
  );
}

function VisibilityModal({ open, onConfirm, onCancel, turningOn }) {
  return (
    <div className={'modal-scrim' + (open ? ' open' : '')} onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="eyebrow">Change contact visibility</div>
        <h3>{turningOn ? 'Show your contact?' : 'Hide your contact?'}</h3>
        <div className="body">
          {turningOn
            ? 'Other verified leaders will be able to see your email and address. You can change this at any time.'
            : 'Your email and address will no longer be shown on your profile. Connection requests still work — Replant will pass them along.'}
        </div>
        <div className="row">
          <div className="btn btn-ghost" onClick={onCancel}>Cancel</div>
          <div className="btn btn-primary" style={{ flex: 2 }} onClick={onConfirm}>
            {turningOn ? 'Show contact' : 'Hide contact'}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, show }) {
  return (
    <div className={'toast' + (show ? ' show' : '')}>
      <svg width="11" height="11" viewBox="0 0 12 12">
        <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </svg>
      {message}
    </div>
  );
}

Object.assign(window, {
  LoadingState, ErrorState, UnverifiedGate,
  ConnectModal, VisibilityModal, Toast,
});
