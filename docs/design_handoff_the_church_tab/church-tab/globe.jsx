// globe.jsx — Page 1: Church At Large (slowly rotating globe with RAG dots)

const GLOBE_R = 140;       // radius in svg units
const GLOBE_VIEW = 320;    // viewBox size

// orthographic projection helper
function project(lat, lon, lon0) {
  const phi = lat * Math.PI / 180;
  const lam = (lon - lon0) * Math.PI / 180;
  const x = GLOBE_R * Math.cos(phi) * Math.sin(lam);
  const y = -GLOBE_R * Math.sin(phi);
  const z = GLOBE_R * Math.cos(phi) * Math.cos(lam);
  return { x, y, z, visible: z >= -1 };
}

// minimal simplified continent outlines as lat/lon polylines.
// Hand-sketched approximations — not geographically accurate, just suggestive.
const CONTINENT_LINES = [
  // North America (rough)
  [[70,-160],[68,-140],[62,-130],[55,-130],[48,-125],[33,-117],[26,-100],[30,-85],[25,-80],[35,-76],[44,-66],[51,-58],[63,-65],[66,-90],[72,-110],[72,-140],[70,-160]],
  // South America
  [[12,-72],[8,-78],[0,-80],[-12,-78],[-22,-72],[-30,-71],[-40,-72],[-52,-74],[-55,-68],[-50,-58],[-40,-60],[-30,-50],[-22,-42],[-10,-37],[2,-50],[8,-60],[12,-72]],
  // Africa
  [[34,-7],[36,10],[32,22],[30,32],[16,42],[10,50],[-2,42],[-18,40],[-30,30],[-34,18],[-30,16],[-16,12],[-4,8],[6,2],[14,-16],[26,-15],[34,-7]],
  // Europe
  [[58,-8],[60,8],[68,28],[58,40],[44,40],[40,28],[36,10],[42,4],[50,-2],[58,-8]],
  // Asia (very rough)
  [[58,40],[68,60],[72,90],[68,140],[55,140],[42,138],[30,122],[22,108],[10,100],[10,80],[24,68],[36,52],[42,40],[58,40]],
  // Australia
  [[-12,135],[-18,148],[-30,153],[-38,146],[-36,132],[-32,118],[-22,114],[-12,128],[-12,135]],
];

// graticule: meridians every 30°, parallels every 30°
function buildGraticule(lon0) {
  const lines = [];
  // meridians
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = project(lat, lon, lon0);
      pts.push(p);
    }
    lines.push({ pts, kind: 'meridian', lon });
  }
  // parallels
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 4) {
      const p = project(lat, lon, lon0);
      pts.push(p);
    }
    lines.push({ pts, kind: 'parallel', lat });
  }
  return lines;
}

function lineToPath(pts, R) {
  // breaks the polyline at sphere edge crossings
  const segs = [];
  let cur = [];
  for (const p of pts) {
    if (p.z >= 0) {
      cur.push(p);
    } else if (cur.length > 1) {
      segs.push(cur);
      cur = [];
    } else {
      cur = [];
    }
  }
  if (cur.length > 1) segs.push(cur);
  return segs.map(seg =>
    seg.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2)).join('')
  ).join(' ');
}

function CalGlobe({ markerStyle, pulseSpeed, dimmed, onPickChurch, onPickRegion }) {
  const [lon0, setLon0] = React.useState(40);
  const [paused, setPaused] = React.useState(false);
  const rafRef = React.useRef();
  const lastT = React.useRef(performance.now());

  React.useEffect(() => {
    function tick(t) {
      const dt = t - lastT.current;
      lastT.current = t;
      if (!paused) {
        setLon0(prev => (prev + dt * 0.006) % 360); // ~60s per rev
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused]);

  const graticule = React.useMemo(() => buildGraticule(lon0), [lon0]);
  const continents = React.useMemo(() =>
    CONTINENT_LINES.map(line => line.map(([lat, lon]) => project(lat, lon, lon0)))
  , [lon0]);

  const dots = GLOBAL_CHURCHES.map(c => {
    const p = project(c.lat, c.lon, lon0);
    return { ...c, ...p };
  });

  const visibleDots = dots.filter(d => d.z >= 4);

  const cx = GLOBE_VIEW / 2;
  const cy = GLOBE_VIEW / 2;

  return (
    <div
      className={'cal-globe-wrap' + (dimmed ? ' dimmed' : '')}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
      style={{ pointerEvents: 'auto', cursor: 'grab' }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${GLOBE_VIEW} ${GLOBE_VIEW}`}
      >
        <defs>
          <radialGradient id="sphereFill" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#1a2a3a" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#0a1018" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#03060a" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="sphereGlow" cx="50%" cy="50%" r="55%">
            <stop offset="80%" stopColor="rgba(107,181,232,0)" />
            <stop offset="100%" stopColor="rgba(107,181,232,0.18)" />
          </radialGradient>
          <radialGradient id="sphereInnerShine" cx="36%" cy="32%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <clipPath id="sphereClip">
            <circle cx={cx} cy={cy} r={GLOBE_R} />
          </clipPath>
        </defs>

        {/* outer glow */}
        <circle cx={cx} cy={cy} r={GLOBE_R + 14} fill="url(#sphereGlow)" />

        {/* sphere fill */}
        <circle cx={cx} cy={cy} r={GLOBE_R} fill="url(#sphereFill)" />

        <g transform={`translate(${cx} ${cy})`} clipPath="url(#sphereClip)">
          {/* graticule */}
          {graticule.map((g, i) => (
            <path
              key={i}
              d={lineToPath(g.pts, GLOBE_R)}
              stroke="rgba(107,181,232,0.13)"
              fill="none"
              strokeWidth="0.5"
            />
          ))}

          {/* continents */}
          {continents.map((line, i) => (
            <path
              key={'c' + i}
              d={lineToPath(line, GLOBE_R)}
              stroke="rgba(240,237,230,0.35)"
              strokeWidth="1"
              fill="rgba(107,181,232,0.04)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* inner shine */}
          <circle cx={0} cy={0} r={GLOBE_R} fill="url(#sphereInnerShine)" />
        </g>

        {/* rim ring */}
        <circle
          cx={cx}
          cy={cy}
          r={GLOBE_R}
          fill="none"
          stroke="rgba(107,181,232,0.22)"
          strokeWidth="0.5"
        />
      </svg>

      {/* dots as DOM elements so they can have CSS pulse */}
      {visibleDots.map(d => {
        const left = (cx + d.x) / GLOBE_VIEW * 100;
        const top = (cy + d.y) / GLOBE_VIEW * 100;
        const isRed = d.rag === 'r';
        // dim dots further on the limb for atmospheric depth
        const opacity = 0.35 + 0.65 * Math.min(1, d.z / GLOBE_R);
        return (
          <div
            key={d.id}
            onClick={() => onPickChurch(d)}
            style={{
              position: 'absolute',
              left: left + '%',
              top: top + '%',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              opacity,
            }}
          >
            <div
              className={'caml-pin style-' + markerStyle}
              style={{ position: 'static' }}
            >
              <div className={'core rag-' + d.rag} style={{ width: 7, height: 7, borderWidth: 1 }} />
            </div>
            {isRed && (
              <>
                <div
                  className="pulse-ring"
                  style={{
                    width: 7,
                    height: 7,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'translate(-50%, -50%)',
                    '--pulse-dur': pulseSpeed + 's',
                  }}
                />
                <div
                  className="pulse-ring delay"
                  style={{
                    width: 7,
                    height: 7,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'translate(-50%, -50%)',
                    '--pulse-dur': pulseSpeed + 's',
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// star field — quiet, subtle
function CalStars() {
  const stars = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i++) {
      arr.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 0.5 + Math.random() * 1.2,
        o: 0.15 + Math.random() * 0.4,
      });
    }
    return arr;
  }, []);
  return (
    <div className="cal-stars">
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x + '%',
            top: s.y + '%',
            width: s.s,
            height: s.s,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.o,
          }}
        />
      ))}
    </div>
  );
}

// regional slide-out panel
function RegionalPanel({ open, region, onClose, onPickChurch }) {
  if (!region) return null;
  const churches = region.churches || [];
  const counts = churches.reduce((acc, c) => (acc[c.rag] = (acc[c.rag] || 0) + 1, acc), {});

  return (
    <div className={'regional-panel' + (open ? ' open' : '')}>
      <div className="regional-head">
        <div className="close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" /></svg>
        </div>
        <div className="eyebrow">Region</div>
        <h3>{region.name}</h3>
        <div className="rag-summary">
          {counts.g > 0 && <div className="chunk"><span className="d g" />{counts.g} freely operating</div>}
          {counts.a > 0 && <div className="chunk"><span className="d a" />{counts.a} with limitations</div>}
          {counts.r > 0 && <div className="chunk"><span className="d r" />{counts.r} not freely</div>}
        </div>
      </div>
      <div className="regional-body">
        {churches.map(c => {
          const leaderText = (c.leaders || []).map(l =>
            l.anon ? l.role : `${l.role} ${l.name.split(' ').slice(-1)[0]}`
          ).join(' · ');
          return (
            <div key={c.id} className="list-row" onClick={() => onPickChurch(c)}>
              <div className={'marker ' + c.rag} />
              <div className="body">
                <div className="name">{c.name}</div>
                <div className="leader">
                  {leaderText}
                  <span style={{ color: 'var(--muted-2)' }}> · {c.city}</span>
                </div>
                <div className="rpl">{c.rpl}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { CalGlobe, CalStars, RegionalPanel });
