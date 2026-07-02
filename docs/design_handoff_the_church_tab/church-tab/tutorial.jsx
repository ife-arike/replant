// tutorial.jsx — one-time onboarding overlay for The Church tab
// Walks a new leader through CAML, CAL, and the prayer wall pull-up.

const TUTORIAL_STEPS = [
  {
    eyebrow: 'Welcome',
    title: 'This is The Church.',
    body: 'Two pages. Your home, and the global body. You\u2019ll move between them with a swipe \u2014 just like turning your eyes from the room to the horizon.',
    spot: null,
  },
  {
    eyebrow: 'At My Location',
    title: 'Your church is here.',
    body: 'The sky-blue marker is yours. Tap it to see how others see you, or tap any nearby dot to open a leader\u2019s profile. Pull the list up from the bottom to browse.',
    spot: { x: 50, y: 50, r: 80 },
  },
  {
    eyebrow: 'At Large',
    title: 'Swipe to see the whole body.',
    body: 'On the right page, the globe slowly turns. Red dots pulse for churches under pressure. Tap any to open. Touch and hold to stop the rotation.',
    spot: { x: 95, y: 18, r: 60, asLine: true },
  },
  {
    eyebrow: 'Global Prayer Wall',
    title: 'Pull up. Pray.',
    body: 'At the bottom of the globe, drag up the handle to see what leaders worldwide are bringing before God in this moment. Agree in prayer with them.',
    spot: { x: 50, y: 92, r: 60 },
  },
  {
    eyebrow: 'A note before you enter',
    title: 'Some are not pictured.',
    body: 'Underground churches are part of this network too. They\u2019re not shown on any map for their protection \u2014 but they\u2019re in our prayers, and yours.',
    spot: null,
  },
];

function TutorialOverlay({ onComplete, onSkip, onStep }) {
  const [step, setStep] = React.useState(0);
  const s = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  React.useEffect(() => {
    if (onStep) onStep(step);
  }, [step, onStep]);

  return (
    <div className="tutorial-overlay">
      {/* darkening backdrop with optional spotlight */}
      <div className="tutorial-scrim">
        {s.spot && (
          <div
            className={'tutorial-spot' + (s.spot.asLine ? ' line' : '')}
            style={{
              left: s.spot.x + '%',
              top: s.spot.y + '%',
              width: s.spot.r * 2 + 'px',
              height: s.spot.r * 2 + 'px',
            }}
          />
        )}
      </div>

      {/* card */}
      <div className={'tutorial-card pos-' + (step <= 1 ? 'bottom' : step === 2 ? 'middle' : 'middle')}>
        <div className="tutorial-progress">
          {TUTORIAL_STEPS.map((_, i) => (
            <div key={i} className={'dot' + (i === step ? ' active' : i < step ? ' done' : '')} />
          ))}
        </div>
        <div className="eyebrow">{s.eyebrow}</div>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        <div className="tutorial-actions">
          {step > 0 && (
            <div className="btn btn-ghost" style={{ flex: 0, minWidth: 80 }} onClick={() => setStep(s => s - 1)}>Back</div>
          )}
          {!isLast && (
            <div className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(s => s + 1)}>Continue</div>
          )}
          {isLast && (
            <div className="btn btn-primary" style={{ flex: 1 }} onClick={onComplete}>Enter The Church</div>
          )}
        </div>
        <div className="tutorial-skip" onClick={onSkip}>Skip · I’ll figure it out</div>
      </div>
    </div>
  );
}

Object.assign(window, { TutorialOverlay, TUTORIAL_STEPS });
