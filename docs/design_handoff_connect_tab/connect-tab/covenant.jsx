// ─────────────────────────────────────────────────────────────────────────
// covenant.jsx — Covenant Notice (first-DM gate).
// Shown ONCE, before the leader sends their very first DM on Connect (ever,
// not per conversation). Requires acknowledgement — no dismiss-without-accept.
// Dim-only overlay (no blur). Tone: a community covenant, not a ToS wall.
//
// COPY STATUS: placeholder. CONTENT writes final copy; Founder review before
// ship. The container / modal shape is the CD deliverable here.
// ─────────────────────────────────────────────────────────────────────────

function CovenantNotice({ onAccept }) {
  return (
    <div className="scrim covenant-wrap">
      <div className="covenant">
        <div className="seal"><Icon.shield /></div>
        <div className="eyebrow">A word before you write</div>
        <div className="heading">Connect is a room of trust.</div>
        <div className="body">
          These letters travel between verified leaders for the work of the kingdom.
          Replant reviews messages that are flagged — nothing here is hidden from God,
          and little is hidden from us.
          <em>"Behave as you would before your King."</em>
        </div>
        <div className="placeholder-note">Placeholder copy · final wording by Content + Founder</div>
        <div className="btn btn-primary" onClick={onAccept}>I understand</div>
      </div>
    </div>
  );
}

Object.assign(window, { CovenantNotice });
