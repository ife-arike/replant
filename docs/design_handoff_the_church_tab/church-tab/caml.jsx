// caml.jsx — Page 0: Church At My Location (flat map + pull-up list)

const PAN_LIMIT = 50; // % — max each direction from home, equivalent to ~50km in this stylized space

function CamlMap({ markerStyle, onPickChurch, onPickOwn, onPickCluster, ragFilter, recenterToken }) {
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef(null);
  const mapRef = React.useRef(null);

  // recenter when parent bumps the token
  React.useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [recenterToken]);

  const onPointerDown = (e) => {
    if (e.target.closest('.caml-pin') || e.target.closest('.caml-cluster')) return;
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      panX: pan.x, panY: pan.y, moved: false,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    const w = mapRef.current.offsetWidth || 380;
    const h = mapRef.current.offsetHeight || 420;
    const nx = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, dragRef.current.panX + (dx / w) * 100));
    const ny = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, dragRef.current.panY + (dy / h) * 100));
    setPan({ x: nx, y: ny });
  };
  const onPointerUp = (e) => {
    if (dragRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
      // keep moved flag long enough for click handlers to read it, then clear
      const wasMoved = dragRef.current.moved;
      dragRef.current = wasMoved ? { moved: true } : null;
      if (wasMoved) setTimeout(() => { dragRef.current = null; }, 50);
    }
  };

  // simple stylized streets/water for the local map
  const roads = [
    "M -10 88 Q 50 60, 120 85 T 280 80",
    "M -10 250 Q 90 240, 200 260 T 420 250",
    "M 60 -10 Q 70 80, 50 200 Q 30 320, 60 420",
    "M 180 -10 Q 200 100, 220 220 Q 240 320, 230 420",
    "M 290 0 Q 270 100, 290 200 Q 300 320, 290 420",
  ];

  const ownX = OWN_CHURCH.x, ownY = OWN_CHURCH.y;
  const clusterPos = { x: 86, y: 14 };
  const visiblePins = NEARBY_CHURCHES.filter(c => ragFilter[c.rag]);

  const panStyle = {
    transform: `translate(${pan.x}%, ${pan.y}%)`,
    transition: dragRef.current ? 'none' : 'transform .35s ease-out',
  };
  const atLimit = Math.abs(pan.x) >= PAN_LIMIT - 0.5 || Math.abs(pan.y) >= PAN_LIMIT - 0.5;
  const safeClick = (fn) => (e) => {
    if (dragRef.current?.moved) { e.stopPropagation(); return; }
    fn(e);
  };

  return (
    <div
      className="caml-map"
      ref={mapRef}
      style={{ pointerEvents: 'auto', cursor: 'grab', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="grid" />

      <div className="caml-pan-layer" style={panStyle}>
        <svg className="water" viewBox="0 0 380 420" preserveAspectRatio="none">
          <path d="M 320 360 Q 280 340, 270 380 Q 290 420, 360 420 L 380 420 L 380 360 Q 350 350, 320 360 Z" fill="rgba(107,181,232,0.18)" />
          <path d="M -10 0 Q 40 -10, 70 30 Q 95 60, 80 100 Q 50 80, 20 60 Q -5 40, -10 0 Z" fill="rgba(107,181,232,0.10)" />
        </svg>
        <svg className="roads" viewBox="0 0 380 420" preserveAspectRatio="none">
          {roads.map((d, i) => (
            <path key={i} d={d} stroke="rgba(240,237,230,0.06)" strokeWidth="14" fill="none" strokeLinecap="round" />
          ))}
          {roads.map((d, i) => (
            <path key={'b' + i} d={d} stroke="rgba(240,237,230,0.10)" strokeWidth="1" fill="none" strokeLinecap="round" />
          ))}
          <rect x="100" y="120" width="60" height="60" fill="rgba(240,237,230,0.02)" />
          <rect x="170" y="180" width="40" height="40" fill="rgba(240,237,230,0.02)" />
          <rect x="40" y="280" width="60" height="60" fill="rgba(240,237,230,0.02)" />
          <rect x="230" y="280" width="55" height="55" fill="rgba(240,237,230,0.02)" />
        </svg>

        {/* labels for context */}
        <div style={{
          position: 'absolute', top: '8%', left: '6%',
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
          color: 'rgba(240,237,230,0.22)', textTransform: 'uppercase',
        }}>Walnut Grove</div>
        <div style={{
          position: 'absolute', bottom: '12%', right: '7%',
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
          color: 'rgba(240,237,230,0.22)', textTransform: 'uppercase',
        }}>Lake Carlton</div>
        <div style={{
          position: 'absolute', top: '72%', left: '68%',
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
          color: 'rgba(240,237,230,0.22)', textTransform: 'uppercase',
        }}>Lawrenceville</div>
        <div style={{
          position: 'absolute', top: '36%', right: '8%',
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
          color: 'rgba(240,237,230,0.22)', textTransform: 'uppercase',
        }}>Snellville</div>

        {/* faint 50km radius ring around home */}
        <svg style={{
          position: 'absolute', inset: '-20%', pointerEvents: 'none',
        }} viewBox="-100 -100 200 200" preserveAspectRatio="none">
          <circle cx="0" cy="0" r="50" fill="none" stroke="rgba(107,181,232,0.16)" strokeWidth="0.4" strokeDasharray="1.5 2.5" />
        </svg>

        {/* own church marker */}
        <div
          className="caml-pin own"
          style={{ left: ownX + '%', top: ownY + '%' }}
          onClick={safeClick(() => onPickOwn())}
        >
          <div className="halo" />
          <div className="core" />
          <div className="label">Your Church</div>
        </div>

        {/* nearby */}
        {visiblePins.map(c => (
          <div
            key={c.id}
            className={'caml-pin style-' + markerStyle}
            style={{ left: c.x + '%', top: c.y + '%' }}
            onClick={safeClick(() => onPickChurch(c))}
          >
            <div className={'core rag-' + c.rag} />
          </div>
        ))}

        {/* cluster */}
        <div
          className="caml-cluster"
          style={{ left: clusterPos.x + '%', top: clusterPos.y + '%' }}
          onClick={safeClick(() => onPickCluster())}
        >5</div>
      </div>

      {/* pan limit / drag hint */}
      <div className={'caml-pan-hint' + (atLimit ? ' at-limit' : pan.x === 0 && pan.y === 0 ? ' resting' : '')}>
        {atLimit
          ? '50 km — the edge of your local view'
          : (pan.x === 0 && pan.y === 0)
            ? 'Drag to explore · up to 50 km'
            : `${Math.round(Math.sqrt(pan.x*pan.x + pan.y*pan.y))} km from home`}
      </div>
    </div>
  );
}

function CamlListRow({ church, compact, onClick }) {
  const leaderText = church.leaders.map((l, i) =>
    l.anon ? l.role : `${l.role} ${l.name.split(' ').slice(-1)[0]}`
  ).join(' · ');
  return (
    <div className={'list-row' + (compact ? ' compact' : '')} onClick={onClick}>
      <div className={'marker ' + church.rag} />
      <div className="body">
        <div className="name">{church.name}</div>
        <div className="leader">{leaderText}</div>
        <div className="rpl">{church.rpl}</div>
      </div>
      <div className="dist">{church.dist} mi</div>
    </div>
  );
}

function CamlSheet({ open, onToggle, onPickChurch, density, ragFilter, isEmpty, emptyTone }) {
  const filtered = NEARBY_CHURCHES.filter(c => ragFilter[c.rag]);
  const count = filtered.length;
  const compact = density === 'compact';

  return (
    <div className={'caml-sheet ' + (open ? 'open' : 'peek')}>
      <div className="sheet-grip" onClick={onToggle}>
        <div className="bar" />
        <div className="meta">
          {isEmpty
            ? 'No nearby churches'
            : `${count} ${count === 1 ? 'church' : 'churches'} near you · sorted by distance`}
        </div>
      </div>
      <div className="sheet-body">
        {isEmpty ? (
          <CamlEmpty tone={emptyTone} />
        ) : (
          <>
            {filtered.map(c => (
              <CamlListRow
                key={c.id}
                church={c}
                compact={compact}
                onClick={() => onPickChurch(c)}
              />
            ))}
            <div style={{
              padding: '20px 8px 12px',
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--muted-2)',
              textAlign: 'center',
            }}>
              End of nearby list
            </div>
            <UndergroundNote />
          </>
        )}
      </div>
    </div>
  );
}

function CamlEmpty({ tone = 'pastoral' }) {
  if (tone === 'scriptural') {
    return (
      <div style={{ padding: '32px 12px 16px', textAlign: 'center' }}>
        <div className="glyph-cross" style={{ margin: '0 auto 22px' }} />
        <div style={{
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17,
          lineHeight: 1.5, color: 'var(--off-white)', marginBottom: 14,
        }}>
          "Yet I have reserved seven thousand in Israel — all whose knees have not bowed to Baal."
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'var(--sky)', marginBottom: 24,
        }}>1 Kings 19:18</div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65, maxWidth: 280, margin: '0 auto' }}>
          No verified churches have been found in your area yet. You are not alone — others are scattered and waiting.
        </p>
      </div>
    );
  }
  if (tone === 'quiet') {
    return (
      <div style={{ padding: '40px 12px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
          No other verified churches in your area yet.
        </p>
      </div>
    );
  }
  // pastoral default
  return (
    <div style={{ padding: '32px 12px 16px', textAlign: 'center' }}>
      <svg width="42" height="42" viewBox="0 0 42 42" style={{ display: 'block', margin: '0 auto 22px' }}>
        <circle cx="21" cy="21" r="18" fill="none" stroke="rgba(107,181,232,0.35)" strokeWidth="0.8" strokeDasharray="2 3" />
        <circle cx="21" cy="21" r="3" fill="var(--sky)" />
      </svg>
      <h3 style={{
        fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 21,
        lineHeight: 1.3, letterSpacing: '0.02em', marginBottom: 12,
      }}>
        You may be the first here.
      </h3>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 270, margin: '0 auto' }}>
        No other verified churches have joined Replant in your area yet. Others will come.
        Hold this ground. We will let you know the moment another leader is verified nearby.
      </p>
      <div style={{
        marginTop: 22, padding: '12px 14px',
        background: 'rgba(107,181,232,0.06)',
        border: '0.5px solid var(--sky-mid)',
        borderRadius: 8,
        fontFamily: 'var(--serif)', fontStyle: 'italic',
        fontSize: 13.5, color: 'var(--off-white)', lineHeight: 1.5,
      }}>
        "Where two or three are gathered in My name, there am I in the midst of them."
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'var(--sky)', marginTop: 8, fontStyle: 'normal',
        }}>Matthew 18:20</div>
      </div>
    </div>
  );
}

function UndergroundNote() {
  const c = window.COUNTS;
  return (
    <div className="underground-note">
      <div className="eyebrow">Underground · not pictured</div>
      <span className="num">+ {c.underground}</span>
      <div className="body">
        churches gather in places we cannot show on a map.<br />
        You are part of their covering.
      </div>
    </div>
  );
}

Object.assign(window, { CamlMap, CamlSheet, CamlEmpty, CamlListRow, UndergroundNote });
