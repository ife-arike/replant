/* eslint-disable */
// ── Escalated Cases · modal family ────────────────────────────────────
// Renders against globals.css .ov/.mdl/.fld/.sel/.txt/.charcount + .btn.
// Voice register: clinical, peer-respecting, never coddling. The confirm
// modal IS the "are you sure" — no repeated question inside.

const { useState } = React;

function ModalShell({ glyph, tone = 'sky', title, sub, badge, children, foot, onClose, maxW = 540 }) {
  return (
    <div className="ov open" onMouseDown={(e) => e.target.classList.contains('ov') && onClose()}>
      <div className="mdl" style={{ maxWidth: maxW }}>
        <div className="mdl-head">
          {glyph && <span className={`mh-glyph ${tone}`}>{glyph}</span>}
          <div className="mh-text">
            <div className="mdl-title">{title}</div>
            {sub && <div className="mdl-sub">{sub}</div>}
          </div>
          {badge}
        </div>
        <div className="mdl-body">{children}</div>
        <div className="mdl-foot">{foot}</div>
      </div>
    </div>
  );
}

function CharField({ label, value, onChange, min = 30, placeholder, rows }) {
  const len = value.trim().length;
  const ok = len >= min;
  return (
    <div className="fld">
      <span className="fld-label">
        {label} <span className="req">required</span>
        <span className={`hint ${ok ? 'ok' : ''}`}>min {min}</span>
      </span>
      <textarea className="txt" style={rows ? { minHeight: rows * 22 } : undefined}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <div className={`charcount ${ok ? 'ok' : 'under'}`}>{len} / {min} (min)</div>
    </div>
  );
}

// ── Reach out (KAN-220 Connect DM, "<first> from Replant Team") ──
function ReachOutModal({ viewer, target, onClose, onSend }) {
  const [msg, setMsg] = useState('');
  const titleName = target.underground
    ? anonName(target.role)
    : `${roleLabel(target.role)} ${(target.name || '').split(' ')[0]}`;
  return (
    <ModalShell tone="sky" glyph={ICONS.out}
      title={`Reach out to ${titleName}`}
      sub={<>opens a Connect DM thread in your name · sender shown to leader: <b style={{ color: 'var(--rp-text)', fontWeight: 500 }}>{viewer.first} from Replant Team</b> · audit-logged</>}
      onClose={onClose}
      foot={<>
        <span className="mf-spacer" />
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!msg.trim()} onClick={() => onSend(msg.trim())}>Open thread</button>
      </>}>
      <p style={{ fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
        This opens a direct conversation with the leader in the Connect tab. Write in your own voice — no system
        message is generated. The leader sees the thread as a Connect DM from you, framed as Replant Team. If they
        don\u2019t reply within 7 days, a UG-identity-scrubbed email automatically follows up to bring them back to the app.
      </p>
      <div className="fld">
        <span className="fld-label">Your message <span className="req">required</span></span>
        <textarea className="txt" style={{ minHeight: 120 }} value={msg} onChange={(e) => setMsg(e.target.value)}
          placeholder="Write in your own voice…" />
      </div>
      {target.underground && (
        <div className="ec-cue sky" style={{ marginBottom: 0 }}>
          {ICONS.shield}
          <span><b>Underground leader.</b> Your message is scanned for identity leaks before it sends. Don\u2019t reference
            a name, church, region, or anything that could place them.</span>
        </div>
      )}
    </ModalShell>
  );
}

// ── Propose action (super_admin + Manager — two-eyes) ──
function ProposeActionModal({ viewer, caseObj, preset, onClose, onSubmit }) {
  const isMgrPreset = viewer.tier === 'top_tier' && preset === 'escalate_to_manager';
  const [action, setAction] = useState(isMgrPreset ? '' : (preset || ''));
  const [why, setWhy] = useState('');
  const isManager = viewer.tier === 'top_tier';
  const opts = PROPOSE_ACTIONS.filter(a => !(isManager && a.token === 'escalate_to_manager'));
  const ok = action && why.trim().length >= 30;
  return (
    <ModalShell tone="amber" glyph={ICONS.escalate}
      title="Propose action"
      sub={isManager
        ? <>you can propose; another Manager reviews — approve, reject, or close · audit-logged</>
        : <>super admin can propose; a Manager will approve, reject, or close · audit-logged</>}
      badge={<span className="ec-caseid" style={{ marginLeft: 'auto' }}>{caseObj.id}</span>}
      onClose={onClose}
      foot={<>
        <span className="mf-spacer" />
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-amber" disabled={!ok} onClick={() => onSubmit(action, why.trim())}>Send proposal</button>
      </>}>
      <div className="fld">
        <span className="fld-label">Action <span className="req">required</span></span>
        <select className="sel" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">— select —</option>
          {opts.map(a => <option key={a.token} value={a.token}>{a.label}{a.destructive ? ' · destructive' : ''}</option>)}
        </select>
      </div>
      {caseObj.axis === 'pastoral' && (action === 'restrict_temporarily' || action === 'revoke_access') && (
        <div className="ec-cue amber" style={{ marginBottom: 0 }}>
          {ICONS.pastoral}
          <span>This case came up <b>from Pastoral</b> — the sender is a leader in distress. A destructive proposal here
            silences someone who signalled they need care. {isManager ? 'Reach out — or hold — before you sanction.' : 'Reach out or escalate before you sanction.'}</span>
        </div>
      )}
      <CharField label="Why is this action needed?" value={why} onChange={setWhy} min={30}
        placeholder="The Manager reviewing this sees your reasoning in full. Be specific." />
    </ModalShell>
  );
}

// ── Review proposal (Manager) — two-eyes confirm ceremony ──
function ApproveProposalModal({ viewer, caseObj, onClose, onApprove, onReject, onCloseCase }) {
  const p = caseObj.proposal;
  const isSelf = p.proposer.name === viewer.first;
  const destructive = p.action !== 'escalate_to_manager';
  return (
    <ModalShell tone={destructive ? 'red' : 'amber'} glyph={destructive ? ICONS.warn : ICONS.escalate}
      title={`Review ${PROPOSE_LABEL[p.action].toLowerCase()} on ${caseObj.id}`}
      sub={<>proposed by {p.proposer.first || p.proposer.name} from Replant Team · awaiting your review</>}
      onClose={onClose}
      foot={<>
        <button className="btn btn-ghost btn-sm" onClick={onCloseCase}>Close case</button>
        <span className="mf-spacer" />
        <button className="btn btn-amber" onClick={onReject}>Reject</button>
        <button className="btn btn-approve" disabled={isSelf} onClick={() => onApprove(p)}>Approve</button>
      </>}>
      <div className="recap">
        <div className="recap-row">
          <span className="recap-k">Action</span>
          <span className="recap-v">{PROPOSE_LABEL[p.action]}{destructive && <> · <b>destructive</b></>}</span>
        </div>
        <div className="recap-row">
          <span className="recap-k">Reasoning</span>
          <span className="recap-v"><span className="quote">"{p.reasoning}"</span></span>
        </div>
        <div className="recap-row">
          <span className="recap-k">Proposed by</span>
          <span className="recap-v"><span className="by">{p.proposer.name}</span> · {TIER_LABEL[p.proposer.tier]} · {p.when}</span>
        </div>
      </div>
      <div className="leader-preview">
        <div className="lp-label">On approve</div>
        <div style={{ fontSize: 12, color: 'var(--rp-muted-2)', lineHeight: 1.6, fontWeight: 300 }}>
          {p.action === 'escalate_to_manager'
            ? 'Routes the case for Manager attention — no destructive action is executed.'
            : <>Fires the <b style={{ color: '#cfcabd' }}>{PROPOSE_LABEL[p.action].toLowerCase()}</b> endpoint. Destructive execution + the
              leader-side experience land in the Leader Suspension Lifecycle ticket — <b style={{ color: '#cfcabd' }}>stubbed here</b>. Reject keeps
              the case in the register for a different action.</>}
        </div>
      </div>
      {isSelf && (
        <div className="rp-error" role="alert">You proposed this action; another Manager must approve it.</div>
      )}
    </ModalShell>
  );
}

// ── Close this case (KAN-295) ──
function CloseCaseModal({ caseObj, preset, onClose, onSubmit }) {
  const [disp, setDisp] = useState(preset || '');
  const [note, setNote] = useState('');
  const ok = disp && note.trim().length >= 30;
  return (
    <ModalShell tone="sky" glyph={ICONS.close}
      title="Close this case"
      sub="records the disposition · the case leaves the register · the leader\u2019s account is unaffected"
      badge={<span className="ec-caseid" style={{ marginLeft: 'auto' }}>{caseObj.id}</span>}
      onClose={onClose}
      foot={<>
        <span className="mf-spacer" />
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!ok} onClick={() => onSubmit(disp, note.trim())}>Close case</button>
      </>}>
      <p style={{ fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
        Closing a case removes it from the escalated register. The disposition you choose is recorded against the case
        in the audit log — pick the option that most honestly reflects how the situation resolved.
      </p>
      <div className="fld">
        <span className="fld-label">Disposition <span className="req">required</span></span>
        <select className="sel" value={disp} onChange={(e) => setDisp(e.target.value)}>
          <option value="">— select —</option>
          {DISPOSITIONS.map(d => <option key={d.token} value={d.token}>{d.label}</option>)}
        </select>
      </div>
      <CharField label="Add context for the audit log. Why this disposition?" value={note} onChange={setNote} min={30}
        placeholder="Recorded against the case. Be specific enough that a reviewer understands the call." />
    </ModalShell>
  );
}

// ── Escalate this case (regular admin, on /pastoral + /flagged) ──
function EscalateThisCaseModal({ source, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [ctx, setCtx] = useState('');
  const ok = reason && ctx.trim().length >= 30;
  return (
    <ModalShell tone="sky" glyph={ICONS.escalate}
      title="Escalate this case"
      sub="routes up for super admin or Manager review · audit-logged"
      onClose={onClose}
      foot={<>
        <span className="mf-spacer" />
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!ok} onClick={() => onSubmit(reason, ctx.trim())}>Escalate</button>
      </>}>
      <p style={{ fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
        Describe why you\u2019re escalating. Once submitted, the case leaves your view — if further action is needed from
        you, someone will reach out.
      </p>
      <div className="fld">
        <span className="fld-label">Reason <span className="req">required</span></span>
        <select className="sel" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">— select —</option>
          {ESCALATE_REASONS.map(r => <option key={r.token} value={r.token}>{r.label}</option>)}
        </select>
      </div>
      <CharField label="Add context" value={ctx} onChange={setCtx} min={30}
        placeholder="What the higher tier needs to know. PII auto-scrubbed at write." />
    </ModalShell>
  );
}

// ── Confirmation (cross-tier, LOCKED verbatim — both directions) ──
function ConfirmationModal({ onClose }) {
  return (
    <div className="ov open" onMouseDown={(e) => e.target.classList.contains('ov') && onClose()}>
      <div className="mdl" style={{ maxWidth: 440 }}>
        <div className="ec-confirm-body">
          <div className="cb-glyph">{ICONS.check && React.cloneElement(ICONS.check, { style: { width: 52, height: 52, stroke: 'currentColor', strokeWidth: 1.3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } })}</div>
          <div className="cb-title">Your escalation has gone up. If further action is needed from you, someone will reach out.</div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Concurrent-action failure (two SAs propose simultaneously) ──
function ConcurrentProposalModal({ onRefresh, onClose }) {
  return (
    <ModalShell tone="amber" glyph={ICONS.warn} maxW={440}
      title="This case has a pending proposal"
      sub="another admin acted while this was open"
      onClose={onClose}
      foot={<>
        <span className="mf-spacer" />
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-amber" onClick={onRefresh}>Refresh to review</button>
      </>}>
      <p style={{ fontSize: 12.5, color: 'var(--rp-muted-2)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
        A proposal landed on this case after you opened it. Refresh to see what was proposed before you act — your
        submission was not recorded.
      </p>
    </ModalShell>
  );
}

Object.assign(window, {
  ModalShell, CharField,
  ReachOutModal, ProposeActionModal, ApproveProposalModal, CloseCaseModal,
  EscalateThisCaseModal, ConfirmationModal, ConcurrentProposalModal,
});
