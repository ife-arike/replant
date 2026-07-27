// Revelation surface — 7 churches of Revelation 2–3
// Interactive: leaders share commentary, warnings, prophecies, scripture

const TYPE_LABELS = {
  commentary: 'Commentary',
  warning: 'Warning',
  prophecy: 'Prophecy',
  scripture: 'Scripture',
};

function RevelationList({ onSelect }) {
  return (
    <div className="rev-surface">
      <div className="rev-intro">
        <div className="rev-eyebrow">The Seven Churches</div>
        <div className="rev-intro-text">
          Seven archetypes. Every church carries one at any moment.
          Find insight, conviction, and revelation here — drawn from the
          Spirit's word to His Church across the ages.
        </div>
      </div>

      <div className="rev-grid">
        {ARCHETYPES.map((a, i) => (
          <div
            key={a.id}
            className={
              'rev-card'
              + (a.affirming ? ' affirming' : '')
              + (a.linksTo ? ' links-out' : '')
            }
            onClick={() => onSelect && onSelect(a.id)}
          >
            <div className="rev-card-num">{String(i + 1).padStart(2, '0')}</div>
            <div className="rev-card-body">
              <div className="rev-card-condition">{a.condition}</div>
              <div className="rev-card-city">The Church at {a.city}</div>
              <div className="rev-card-brief">{a.brief}</div>
              <div className="rev-card-footer">
                <span className="rev-card-ref">{a.ref}</span>
                {a.voices > 0 && (
                  <span className="rev-card-voices">
                    <svg width="10" height="10" viewBox="0 0 14 14">
                      <path d="M7 2v4M5 4l2-2 2 2M3 13V8.5a2 2 0 0 1 4 0V11M7 11V8.5a2 2 0 0 1 4 0V13"
                        fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {a.voices} speaking
                  </span>
                )}
              </div>
            </div>
            {a.linksTo ? (
              <div className="rev-card-link">
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.4"
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : (
              <div style={{ color: 'var(--muted-2)', flexShrink: 0, paddingTop: 6 }}>
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.4"
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rev-foot">
        <div className="rev-foot-text">
          "He who has an ear, let him hear what the Spirit says to the churches."
        </div>
        <div className="rev-foot-ref">Revelation 2:7</div>
      </div>
    </div>
  );
}

function RevelationDetail({ data, onBack }) {
  const d = data || LUKEWARM_DETAIL;
  return (
    <div className="rev-detail">
      <div className="rev-detail-head">
        <div className="rev-detail-condition">{d.condition}</div>
        <div className="rev-detail-city">The Church at {d.city}</div>
        <div className="rev-detail-ref">{d.ref}</div>
      </div>

      <div className="rev-detail-section">
        <div className="rev-section-label">Christ Speaks</div>
        <div className="rev-section-verse">{d.address}</div>
      </div>

      <div className="rev-detail-section">
        <div className="rev-section-label">The Conviction</div>
        <div className="rev-section-verse">{d.conviction}</div>
      </div>

      <div className="rev-detail-section">
        <div className="rev-section-label">The Counsel</div>
        <div className="rev-section-verse">{d.counsel}</div>
      </div>

      <div className="rev-detail-section promise">
        <div className="rev-section-label">The Promise to the Overcomer</div>
        <div className="rev-section-verse">{d.promise}</div>
        <div className="rev-section-ref">{d.promiseRef}</div>
      </div>

      {/* ───── Interactive: Voices from the Body ───── */}
      <div className="rev-detail-section rev-voices-section">
        <div className="rev-section-label">Voices from the Body</div>
        <div className="rev-section-sub">
          Commentary, warnings, prophecies, and scripture from leaders who carry this word
        </div>

        {/* compose prompt */}
        <div className="rev-compose">
          <div className="rev-compose-prompt">
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M8 2v5M6 4l2-2 2 2M4 14V9a2.5 2.5 0 0 1 5 0v3M7 12V9a2.5 2.5 0 0 1 5 0v5"
                fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Speak to the church here…</span>
          </div>
          <div className="rev-compose-types">
            <span className="rev-type-option">Commentary</span>
            <span className="rev-type-option">Warning</span>
            <span className="rev-type-option">Prophecy</span>
            <span className="rev-type-option">Scripture</span>
          </div>
        </div>

        {/* existing voices */}
        <div className="rev-insights-list">
          {d.insights.map((ins, i) => (
            <div key={i} className="rev-insight">
              <div className="rev-insight-head">
                {ins.type && (
                  <span className={'rev-insight-type ' + ins.type}>
                    {TYPE_LABELS[ins.type]}
                  </span>
                )}
                <span className="rev-insight-leader">{ins.leader}</span>
                <span className="rev-insight-loc">{ins.loc}</span>
                <span className="rev-insight-time">{ins.time}</span>
              </div>
              <div className="rev-insight-text">"{ins.text}"</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RevelationList, RevelationDetail });
