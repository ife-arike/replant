// sheets.jsx — bottom sheets: Church profile, My Church profile, Prayer pull-up

function SectionHeader({ children, style }) {
  return <div className={'section-h ' + style}>{children}</div>;
}

function ChurchProfileSheet({
  open, church, isOwn, onClose, onConnect, onPray, onShare, onReport, onSave,
  saved, prayed, sectionHeaderStyle, onEdit, onToggleVisibility,
}) {
  if (!church) return null;
  const ragLabel = window.RAG_LABELS[church.rag];
  const leaders = church.leaders || [];

  return (
    <>
      <div className={'sheet-scrim ' + (open ? 'open' : '')} onClick={onClose} />
      <div className={'profile-sheet ' + (open ? 'open' : '')}>
        {/* head */}
        <div className="profile-head">
          <div className="grip" />
          <div className="close-x" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </div>
          <div className="rag-pill-row">
            <div className={'rag-pill ' + church.rag}>
              <span className="d" /> {ragLabel}
            </div>
            <div className="rpl-tag">{church.rpl}</div>
          </div>
          <h2>{church.name}</h2>
          <div className="leaders-stack">
            {leaders.map((l, i) => (
              <div key={i} className={'leader-row' + (l.anon ? ' anon' : '')}>
                <span className="role">{l.role}</span>
                {!l.anon && <span className="name">{l.name.replace(new RegExp('^' + l.role + ' '), '')}</span>}
                {l.anon && <span className="name muted">Name withheld</span>}
              </div>
            ))}
          </div>
          <div className="leader-line" style={{ marginTop: 8 }}>
            {church.city}, {church.country} · {church.type}
          </div>
          {isOwn && (
            <div style={{
              marginTop: 12, padding: '6px 10px',
              background: 'var(--sky-dim)',
              border: '0.5px solid var(--sky-mid)',
              borderRadius: 6,
              fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'var(--sky)',
              display: 'inline-block',
            }}>
              This is how others see you
            </div>
          )}
        </div>

        {/* body */}
        <div className="profile-body">

          {/* Identity */}
          <SectionHeader style={sectionHeaderStyle}>Identity</SectionHeader>
          <div className="kv">
            <div className="k">Type</div>
            <div className="v">{church.type}</div>
          </div>
          <div className="kv">
            <div className="k">Denomination</div>
            <div className="v">{church.denom || '—'}</div>
          </div>
          <div className="kv">
            <div className="k">Language</div>
            <div className="v">{church.language || '—'}</div>
          </div>
          <div className="kv">
            <div className="k">Congregation</div>
            <div className="v">{church.size || 'Not specified'}</div>
          </div>
          {church.website && (
            <div className="kv">
              <div className="k">Website</div>
              <div className="v" style={{ color: 'var(--sky)' }}>{church.website}</div>
            </div>
          )}

          {/* Posture */}
          <SectionHeader style={sectionHeaderStyle}>Posture</SectionHeader>

          <div className="freeform">
            <div className="lbl">What we have</div>
            <div className="body">{church.have || <span style={{ opacity: 0.5, fontStyle: 'normal', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Not yet shared</span>}</div>
          </div>

          <div className="freeform">
            <div className="lbl">What we need</div>
            <div className="body">{church.need || <span style={{ opacity: 0.5, fontStyle: 'normal', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Not yet shared</span>}</div>
          </div>

          <div className="eap-row">
            <div className="eap-chip">
              <div className="lbl">Emergency Plan</div>
              <div className="v">
                <span className={'pill ' + (church.hasPlan ? 'y' : 'n')}>
                  {church.hasPlan ? 'In place' : 'Not yet'}
                </span>
              </div>
            </div>
            <div className="eap-chip">
              <div className="lbl">Open to collaborate</div>
              <div className="v">
                <span className={'pill ' + (church.open ? 'y' : 'n')}>
                  {church.open ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact */}
          {(church.showContact && (church.email || church.address)) ? (
            <>
              <SectionHeader style={sectionHeaderStyle}>Contact</SectionHeader>
              <div className="kv">
                <div className="k">Email</div>
                <div className="v" style={{ color: 'var(--sky)' }}>{church.email}</div>
              </div>
              {church.address && (
                <div className="kv">
                  <div className="k">Address</div>
                  <div className="v" style={{ lineHeight: 1.55 }}>{church.address}</div>
                </div>
              )}
              <div style={{
                marginTop: 10,
                fontFamily: 'var(--mono)',
                fontSize: 9, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'var(--muted)',
                lineHeight: 1.6,
              }}>
                Contact details are shared by the leader's choice. Replant never shares phone numbers.
              </div>
            </>
          ) : (
            <>
              <SectionHeader style={sectionHeaderStyle}>Contact</SectionHeader>
              <div style={{
                background: 'var(--surface)',
                border: '0.5px dashed var(--faint-2)',
                borderRadius: 8,
                padding: '14px 16px',
                fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55,
              }}>
                This leader has not shared contact details on their profile. You can still
                reach out by sending a connection request — Replant will pass it along.
              </div>
            </>
          )}

          {/* Own-church controls */}
          {isOwn && (
            <>
              <SectionHeader style={sectionHeaderStyle}>Your Controls</SectionHeader>
              <div className="toggle on">
                <div className="lbl">
                  <div className="t">Show contact on profile</div>
                  <div className="s">Other verified leaders can see your email and address. Change anytime.</div>
                </div>
                <div className="sw" onClick={onToggleVisibility} />
              </div>
              <div style={{ height: 12 }} />
              <div
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={onEdit}
              >
                Edit Church Profile
              </div>
            </>
          )}
        </div>

        {/* sticky actions */}
        {!isOwn && (
          <div className="sheet-actions">
            <div className="btn btn-primary" onClick={onConnect}>Connect</div>
            <div className="btn btn-ghost" onClick={onPray}>
              {prayed ? '✓ Praying' : 'Pray'}
            </div>
            <div className="btn btn-surface btn-icon" onClick={onSave} title={saved ? 'Saved' : 'Save'}>
              <svg width="14" height="14" viewBox="0 0 16 16">
                <path d="M4 2h8v12l-4-3-4 3z" stroke="currentColor" strokeWidth="1.2" fill={saved ? 'currentColor' : 'none'} />
              </svg>
            </div>
            <div className="btn btn-surface btn-icon" onClick={onShare} title="Share">
              <svg width="14" height="14" viewBox="0 0 16 16">
                <circle cx="4" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <circle cx="12" cy="3.5" r="1.8" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <circle cx="12" cy="12.5" r="1.8" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <line x1="5.6" y1="7.3" x2="10.4" y2="4.5" stroke="currentColor" strokeWidth="1.2" />
                <line x1="5.6" y1="8.7" x2="10.4" y2="11.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </div>
            <div className="btn btn-surface btn-icon" onClick={onReport} title="Report concern">
              <svg width="14" height="14" viewBox="0 0 16 16">
                <path d="M3 2v12M3 2h9l-2 3 2 3H3" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
          </div>
        )}
        {isOwn && (
          <div className="sheet-actions">
            <div className="btn btn-primary" style={{ flex: 2 }} onClick={onEdit}>Edit Profile</div>
            <div className="btn btn-ghost" onClick={onClose}>Close</div>
          </div>
        )}
      </div>
    </>
  );
}

// Prayer pull-up on CAL
function PrayerPullup({ open, onOpen, onClose, pullProgress = 0 }) {
  return (
    <>
      <div className="prayer-pulltab" onClick={onOpen} style={{ opacity: open ? 0 : 1 }}>
        <div className="bar" />
        <div className="text">Global Prayer Wall</div>
        <div className="scripture">"That they all may be one…"</div>
      </div>
      <div className={'prayer-sheet' + (open ? ' open' : '')}>
        <div className="head">
          <div className="grip" />
          <div className="eyebrow">Global Prayer Wall · Live</div>
          <h3>The body, interceding</h3>
          <div className="blurb">
            Recent prayer requests from verified leaders across the network. Tap "Agree in prayer" to add yours.
          </div>
          <div
            onClick={onClose}
            style={{
              position: 'absolute', top: 22, right: 18,
              width: 28, height: 28, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </div>
        </div>
        <div className="body">
          {GLOBAL_INTERCESSIONS.map((it, i) => (
            <div key={i} className="inter">
              <div className="loc">
                <span className={'d ' + (it.rag === 'g' ? '' : it.rag === 'a' ? '' : '')} style={{
                  background: it.rag === 'r' ? 'var(--red)' : it.rag === 'a' ? 'var(--amber)' : 'var(--green)',
                }} />
                <span>{it.loc} · {it.time}</span>
                {it.rpl && <span className="rpl-inline">{it.rpl}</span>}
              </div>
              <div className="text">"{it.text}"</div>
              <div className="meta">
                <span className="agree">+ Agree in prayer</span>
                <span>{it.agreed} interceding</span>
              </div>
            </div>
          ))}
          <UndergroundNote />
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ChurchProfileSheet, PrayerPullup, SectionHeader });
