// completion.jsx — Profile Completion Flow (3 steps with progress dots)

function ProgressDots({ step, total = 3 }) {
  return (
    <div className="progress">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={'step ' + (i === step ? 'active' : i < step ? 'done' : '')}
        />
      ))}
    </div>
  );
}

function CompletionIntro({ onBegin, onSkip }) {
  return (
    <div className="completion intro">
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <div style={{
          position: 'absolute', inset: -28,
          background: 'radial-gradient(circle, rgba(107,181,232,0.16), transparent 60%)',
        }} />
        <div className="glyph-cross" style={{ width: 32, height: 32, position: 'relative' }} />
      </div>
      <div className="step-header">A welcome</div>
      <h1>Before you enter the Network,<br />let's finalize your card.</h1>
      <p className="lead">
        You are verified. Other leaders are waiting to find you.
        We'll take three quiet steps to make sure they can — and that you decide
        what they see.
      </p>
      <div className="next-row" style={{ width: '100%', maxWidth: 320 }}>
        <div className="btn btn-primary" style={{ flex: 1 }} onClick={onBegin}>Begin</div>
      </div>
      <div className="skip-link" onClick={onSkip}>Skip · I'll do this later</div>
    </div>
  );
}

function CompletionStep1({ onNext, onBack, draft, setDraft }) {
  return (
    <div className="completion">
      <ProgressDots step={0} />
      <div className="step-header">Step 1 of 3 · Review</div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Is this still you?</h1>
      <div className="field">
        <div className="input-label">Church name</div>
        <div className="input" style={{ color: 'var(--muted)' }}>The Church at Loganville</div>
        <div className="tiny" style={{ marginTop: 6 }}>Confirmed at verification · cannot be changed here</div>
      </div>
      <div className="field">
        <div className="input-label">Type</div>
        <div className="input" style={{ color: 'var(--muted)' }}>Church (Main Campus)</div>
      </div>
      <div className="field">
        <div className="input-label">City, Country</div>
        <div className="input" style={{ color: 'var(--muted)' }}>Loganville, United States</div>
      </div>
      <div className="field">
        <div className="input-label">Your role</div>
        <div className="input" style={{ color: 'var(--muted)' }}>Pastor</div>
      </div>
      <div className="next-row">
        <div className="btn btn-ghost" onClick={onBack}>Back</div>
        <div className="btn btn-primary" style={{ flex: 2 }} onClick={onNext}>Looks right · Continue</div>
      </div>
    </div>
  );
}

function CompletionStep2({ onNext, onBack, draft, setDraft }) {
  return (
    <div className="completion">
      <ProgressDots step={1} />
      <div className="step-header">Step 2 of 3 · Optional details</div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Help others see you clearly.</h1>
      <p className="lead" style={{ marginBottom: 24 }}>
        These are optional — but each one helps another leader recognize they have found their people.
      </p>
      <div className="field">
        <div className="input-label">Website (optional)</div>
        <input
          className="input"
          placeholder="https://"
          value={draft.website}
          onChange={e => setDraft({ ...draft, website: e.target.value })}
          style={{ outline: 'none' }}
        />
      </div>
      <div className="field">
        <div className="input-label">Primary language</div>
        <input
          className="input"
          placeholder="English"
          value={draft.language}
          onChange={e => setDraft({ ...draft, language: e.target.value })}
          style={{ outline: 'none' }}
        />
      </div>
      <div className="field">
        <div className="input-label">Denomination / affiliation (optional)</div>
        <input
          className="input"
          placeholder="Non-denominational"
          value={draft.denom}
          onChange={e => setDraft({ ...draft, denom: e.target.value })}
          style={{ outline: 'none' }}
        />
      </div>
      <div className="field">
        <div className="input-label">Congregation size</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Under 50', '50–200', '200–500', '500+', 'Not specified'].map(s => (
            <div
              key={s}
              onClick={() => setDraft({ ...draft, size: s })}
              style={{
                padding: '8px 12px',
                fontSize: 11.5,
                borderRadius: 100,
                border: '0.5px solid',
                borderColor: draft.size === s ? 'var(--sky-mid)' : 'var(--faint)',
                background: draft.size === s ? 'var(--sky-dim)' : 'var(--surface)',
                color: draft.size === s ? 'var(--sky)' : 'var(--muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >{s}</div>
          ))}
        </div>
      </div>
      <div className="next-row">
        <div className="btn btn-ghost" onClick={onBack}>Back</div>
        <div className="btn btn-primary" style={{ flex: 2 }} onClick={onNext}>Continue</div>
      </div>
    </div>
  );
}

function CompletionStep3({ onComplete, onBack, draft, setDraft }) {
  return (
    <div className="completion">
      <ProgressDots step={2} />
      <div className="step-header">Step 3 of 3 · Contact visibility</div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>How visible would you like to be?</h1>
      <p className="lead" style={{ marginBottom: 20 }}>
        Connection requests are always sent through Replant. Choose whether other verified
        leaders can also see your email and address directly on your profile.
      </p>

      <div
        className={'toggle' + (draft.showContact ? ' on' : '')}
        onClick={() => setDraft({ ...draft, showContact: !draft.showContact })}
      >
        <div className="lbl">
          <div className="t">Show contact on profile</div>
          <div className="s">
            {draft.showContact
              ? 'Email and address visible to verified leaders. Phone is never shown.'
              : 'Others can still request a connection — Replant will pass it along.'}
          </div>
        </div>
        <div className="sw" />
      </div>

      <div style={{
        marginTop: 16, padding: '12px 14px',
        background: 'var(--sky-faint)',
        border: '0.5px solid var(--sky-mid)',
        borderRadius: 8,
        fontSize: 12, color: 'var(--muted)', lineHeight: 1.55,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: 'var(--sky)', marginBottom: 6,
        }}>For leaders in restricted contexts</div>
        Keep this off if you are in a region where being publicly identified would cost you something.
        You can turn it on at any time, from anywhere in the world.
      </div>

      <div className="next-row">
        <div className="btn btn-ghost" onClick={onBack}>Back</div>
        <div className="btn btn-primary" style={{ flex: 2 }} onClick={onComplete}>Enter the Network</div>
      </div>
    </div>
  );
}

function CompletionFlow({ step, draft, setDraft, onAdvance, onBack, onComplete, onSkip }) {
  if (step === -1) {
    return <CompletionIntro onBegin={onAdvance} onSkip={onSkip} />;
  }
  if (step === 0) return <CompletionStep1 onNext={onAdvance} onBack={onBack} draft={draft} setDraft={setDraft} />;
  if (step === 1) return <CompletionStep2 onNext={onAdvance} onBack={onBack} draft={draft} setDraft={setDraft} />;
  if (step === 2) return <CompletionStep3 onComplete={onComplete} onBack={onBack} draft={draft} setDraft={setDraft} />;
  return null;
}

Object.assign(window, { CompletionFlow, ProgressDots });
