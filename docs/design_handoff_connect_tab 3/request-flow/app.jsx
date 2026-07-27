// ─────────────────────────────────────────────────────────────────────────
// app.jsx — Page layout, spec blocks, recommendation, and main render
// for the Message Request Flow handoff.
// ─────────────────────────────────────────────────────────────────────────

// ── Layout helpers ───────────────────────────────────────────────────────

function Section({ num, title, sub, children }) {
  return (
    <div className="hoff-section">
      <div className="hoff-section-head">
        <div className="hoff-section-num">{num}</div>
        <div>
          <div className="hoff-section-title">{title}</div>
          {sub && <div className="hoff-section-sub">{sub}</div>}
        </div>
      </div>
      <div className="hoff-frames">{children}</div>
    </div>
  );
}

function FrameCol({ label, children }) {
  return (
    <div className="hoff-frame">
      <div className="hoff-frame-label">{label}</div>
      {children}
    </div>
  );
}

function Spec({ text }) {
  return (
    <div className="spec-block">
      <pre dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}

// ── Recommendation callout (Option B — in-thread) ────────────────────────

function Recommendation() {
  return (
    <div className="rec-callout" style={{marginBottom:32}}>
      <div className="rec-title">Recommendation: Option B — In-Thread</div>
      <p>
        <strong>The in-thread approach fits Replant's sealed-letter metaphor.</strong>{' '}
        A connection request is a letter — the recipient opens it, reads the full message,
        and decides whether to respond. This mirrors the existing "forming" branch pattern
        (locked composer + action bar above it), reducing new visual surface and cognitive
        overhead. It's quieter than a card in the list — a knock on a door, not a
        notification. And declining from inside the thread, after reading the full letter,
        is more considered and gracious.
      </p>
    </div>
  );
}

// ── Spec text (RN StyleSheet values, copy-paste ready) ───────────────────

const SPEC_1 = `<span class="st">RequestNote</span> (composer inline notice)
────────────────────────────────────────
<span class="st">container:</span> {
  flexDirection: <span class="sv">'row'</span>,
  alignItems: <span class="sv">'center'</span>,
  justifyContent: <span class="sv">'center'</span>,
  gap: <span class="sv">7</span>,
  paddingVertical: <span class="sv">9</span>,
  paddingHorizontal: <span class="sv">18</span>,
  backgroundColor: <span class="sv">'rgba(8,8,8,0.96)'</span>,
  borderTopWidth: <span class="sv">StyleSheet.hairlineWidth</span>,
  borderTopColor: <span class="sv">'rgba(240,237,230,0.08)'</span>,
}
<span class="st">icon:</span> {
  width: <span class="sv">13</span>, height: <span class="sv">13</span>,
  color: <span class="sv">'#6BB5E8'</span>, opacity: <span class="sv">0.6</span>,
}
<span class="st">label:</span> {
  fontFamily: <span class="sv">'DMSans_400Regular'</span>,
  fontSize: <span class="sv">11</span>,
  color: <span class="sv">'#6BB5E8'</span>,
  letterSpacing: <span class="sv">0.06</span>,
}
<span class="sn">Position: above composer input row, inside
the composer zone. Sits between CovenantStrip
and the text field. Shown only when composing
to an unconnected leader. Removing the note
restores the composer's default borderTop.</span>`;

const SPEC_2 = `<span class="st">SentRequestModal</span> (covenant-card variant)
────────────────────────────────────────
<span class="sc">Matches CovenantNotice exactly (§6.4):</span>
<span class="st">scrim:</span> {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: <span class="sv">'rgba(4,4,4,0.74)'</span>,
}
<span class="st">card:</span> {
  width: <span class="sv">'100%'</span>, maxWidth: <span class="sv">360</span>,
  backgroundColor: <span class="sv">'#111111'</span>,
  borderWidth: <span class="sv">0.5</span>,
  borderColor: <span class="sv">'rgba(240,237,230,0.14)'</span>,
  borderRadius: <span class="sv">18</span>,
  paddingTop: <span class="sv">30</span>, paddingHorizontal: <span class="sv">26</span>,
  paddingBottom: <span class="sv">24</span>,
  alignItems: <span class="sv">'center'</span>,
}
<span class="st">seal:</span> {
  width: <span class="sv">48</span>, height: <span class="sv">48</span>, borderRadius: <span class="sv">14</span>,
  borderWidth: <span class="sv">0.5</span>,
  borderColor: <span class="sv">'rgba(107,181,232,0.35)'</span>,
  backgroundColor: <span class="sv">'rgba(107,181,232,0.08)'</span>,
  marginBottom: <span class="sv">20</span>,
}
<span class="st">eyebrow:</span> <span class="sc">"REQUEST SENT"</span> {
  fontFamily: <span class="sv">'DMMono_400Regular'</span>,
  fontSize: <span class="sv">9</span>, letterSpacing: <span class="sv">2.34</span>,
  textTransform: <span class="sv">'uppercase'</span>,
  color: <span class="sv">'#6BB5E8'</span>, marginBottom: <span class="sv">14</span>,
}
<span class="st">heading:</span> {
  fontFamily: <span class="sv">'CormorantGaramond_400Regular'</span>,
  fontSize: <span class="sv">24</span>, lineHeight: <span class="sv">30</span>,
  color: <span class="sv">'#F0EDE6'</span>, marginBottom: <span class="sv">14</span>,
}
<span class="st">body:</span> {
  fontFamily: <span class="sv">'DMSans_400Regular'</span>,
  fontSize: <span class="sv">13</span>, lineHeight: <span class="sv">22</span>,
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
  marginBottom: <span class="sv">22</span>,
}
<span class="st">body.name:</span> {
  fontFamily: <span class="sv">'DMSans_500Medium'</span>,
  color: <span class="sv">'#F0EDE6'</span>,
}
<span class="st">CTA:</span> btn-primary, width: <span class="sv">'100%'</span>
<span class="sn">Enter: translateY(12)+scale(0.98)→0, 260ms
cubic-bezier(.32,.72,0,1). Dismiss: CTA only.</span>`;

const SPEC_3 = `<span class="st">PendingTag</span> (thread row badge)
────────────────────────────────────────
<span class="st">tag:</span> {
  fontFamily: <span class="sv">'DMMono_400Regular'</span>,
  fontSize: <span class="sv">8</span>, letterSpacing: <span class="sv">1.28</span>,
  textTransform: <span class="sv">'uppercase'</span>,
  color: <span class="sv">'#6BB5E8'</span>,
  borderWidth: <span class="sv">0.5</span>,
  borderColor: <span class="sv">'rgba(107,181,232,0.35)'</span>,
  borderRadius: <span class="sv">4</span>,
  paddingVertical: <span class="sv">2</span>, paddingHorizontal: <span class="sv">5</span>,
}

<span class="st">PendingRow</span> (thread-row variant)
────────────────────────────────────────
<span class="st">monogram:</span> {
  opacity: <span class="sv">0.55</span>,
  borderStyle: <span class="sv">'dashed'</span>,
  <span class="sc">// rest inherits standard monogram</span>
}
<span class="st">preview:</span> {
  color: <span class="sv">'rgba(240,237,230,0.25)'</span>,
  fontStyle: <span class="sv">'italic'</span>,
  <span class="sc">// text: "Awaiting their reply"</span>
}
<span class="sn">Row is not tappable — no drill-in while
pending. Pending rows sort by sent time,
below active threads, above declined.</span>`;

const SPEC_4A = `<span class="st">RequestCard</span> (Option A — inline)
────────────────────────────────────────
<span class="st">card:</span> {
  marginTop: <span class="sv">10</span>, marginHorizontal: <span class="sv">22</span>,
  marginBottom: <span class="sv">14</span>,
  padding: <span class="sv">16</span>, paddingBottom: <span class="sv">14</span>,
  backgroundColor: <span class="sv">'#111111'</span>,
  borderWidth: <span class="sv">0.5</span>,
  borderColor: <span class="sv">'rgba(107,181,232,0.35)'</span>,
  borderRadius: <span class="sv">14</span>,
}
<span class="st">eyebrow:</span> <span class="sc">"CONNECTION REQUEST"</span> {
  fontFamily: <span class="sv">'DMMono_400Regular'</span>,
  fontSize: <span class="sv">8.5</span>, letterSpacing: <span class="sv">1.7</span>,
  textTransform: <span class="sv">'uppercase'</span>,
  color: <span class="sv">'#6BB5E8'</span>, marginBottom: <span class="sv">4</span>,
}
<span class="st">name:</span> {
  fontFamily: <span class="sv">'CormorantGaramond_500Medium'</span>,
  fontSize: <span class="sv">19</span>, color: <span class="sv">'#F0EDE6'</span>,
}
<span class="st">church:</span> {
  fontFamily: <span class="sv">'DMSans_400Regular'</span>,
  fontSize: <span class="sv">11.5</span>,
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
  marginBottom: <span class="sv">10</span>,
}
<span class="st">messageBox:</span> {
  padding: <span class="sv">10</span>, paddingHorizontal: <span class="sv">13</span>,
  backgroundColor: <span class="sv">'#181818'</span>,
  borderWidth: <span class="sv">0.5</span>,
  borderColor: <span class="sv">'rgba(240,237,230,0.08)'</span>,
  borderRadius: <span class="sv">10</span>, marginBottom: <span class="sv">14</span>,
}
<span class="st">messageText:</span> {
  fontFamily: <span class="sv">'DMSans_400Regular'</span>,
  fontSize: <span class="sv">12.5</span>, lineHeight: <span class="sv">19</span>,
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
}
<span class="st">actions:</span> flex row, gap: <span class="sv">8</span>
  Decline: btn-quiet, flex: <span class="sv">1</span>
  Accept:  btn-primary, flex: <span class="sv">1.4</span>`;

const SPEC_4B = `<span class="st">RequestActionsBar</span> (Option B — in-thread)
────────────────────────────────────────
<span class="st">bar:</span> {
  paddingVertical: <span class="sv">14</span>,
  paddingHorizontal: <span class="sv">18</span>,
  backgroundColor: <span class="sv">'#111111'</span>,
  borderTopWidth: <span class="sv">StyleSheet.hairlineWidth</span>,
  borderTopColor: <span class="sv">'rgba(240,237,230,0.08)'</span>,
  alignItems: <span class="sv">'center'</span>,
}
<span class="st">label:</span> <span class="sc">"Accept this conversation?"</span> {
  fontFamily: <span class="sv">'DMSans_400Regular'</span>,
  fontSize: <span class="sv">12</span>,
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
  marginBottom: <span class="sv">12</span>,
}
<span class="st">buttons:</span> flex row, gap: <span class="sv">8</span>
  Decline: btn-quiet, flex: <span class="sv">1</span>
  Accept:  btn-primary, flex: <span class="sv">1.4</span>

<span class="st">LockedComposer</span> (reuses forming-branch)
────────────────────────────────────────
<span class="st">note:</span> <span class="sc">"Reply opens when you accept"</span>
  <span class="sc">// identical to branch forming locked
  // composer — same field, same disabled send</span>

<span class="st">SystemLabel:</span> <span class="sc">"CONNECTION REQUEST · {time}"</span>
  <span class="sc">// uses branch-event style (§7.3)</span>
  fontFamily: <span class="sv">'DMMono_400Regular'</span>,
  fontSize: <span class="sv">9</span>, letterSpacing: <span class="sv">0.9</span>,
  textTransform: <span class="sv">'uppercase'</span>,
  color: <span class="sv">'rgba(240,237,230,0.25)'</span>,
  alignSelf: <span class="sv">'center'</span>,`;

const SPEC_5 = `<span class="st">DeclinedRow</span> (thread-row variant)
────────────────────────────────────────
<span class="st">row:</span> {
  opacity: <span class="sv">0.72</span>,
  <span class="sc">// not tappable — no drill-in</span>
}
<span class="st">monogram:</span> {
  opacity: <span class="sv">0.4</span>,
  <span class="sc">// rest inherits standard monogram</span>
}
<span class="st">name:</span> {
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
}
<span class="st">declineText:</span> {
  fontFamily: <span class="sv">'DMSans_400Regular'</span>,
  fontSize: <span class="sv">12.5</span>, lineHeight: <span class="sv">19</span>,
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
  marginTop: <span class="sv">5</span>,
}
<span class="st">prayer:</span> <span class="sc">"Keep them in your prayers."</span> {
  fontFamily: <span class="sv">'CormorantGaramond_400Regular'</span>,
  fontStyle: <span class="sv">'italic'</span>,
  fontSize: <span class="sv">13</span>,
  color: <span class="sv">'rgba(240,237,230,0.25)'</span>,
}
<span class="sn">Behavior: row auto-dismisses after 48h or
on swipe-to-dismiss (soft remove). Server
removes the pending record; no thread is
created. Copy tone: gentle, prayerful.</span>

<span class="st">removeLink:</span> {
  fontFamily: <span class="sv">'DMMono_400Regular'</span>,
  fontSize: <span class="sv">9</span>,
  letterSpacing: <span class="sv">1.26</span>,
  textTransform: <span class="sv">'uppercase'</span>,
  color: <span class="sv">'rgba(240,237,230,0.25)'</span>,
  hitSlop: <span class="sv">{ top: 8, bottom: 8, left: 12, right: 12 }</span>,
}
<span class="sn">Positioned in the right column below the
timestamp. Tap removes the declined row
from the list (server deletes the pending
record). Also removable via swipe-to-dismiss.</span>`;

const SPEC_6 = `<span class="st">AcceptSystemMessage</span>
────────────────────────────────────────
<span class="sc">Matches existing branch-event (§7.3):</span>
<span class="st">event:</span> {
  alignSelf: <span class="sv">'center'</span>,
  textAlign: <span class="sv">'center'</span>,
  maxWidth: <span class="sv">'84%'</span>,
  marginVertical: <span class="sv">8</span>,
  fontFamily: <span class="sv">'DMMono_400Regular'</span>,
  fontSize: <span class="sv">9</span>, letterSpacing: <span class="sv">0.9</span>,
  textTransform: <span class="sv">'uppercase'</span>,
  lineHeight: <span class="sv">14</span>,
  color: <span class="sv">'rgba(240,237,230,0.25)'</span>,
}
<span class="sc">Copy: "[Name] accepted your request."</span>

<span class="sn">Positioned as the first element in the
message list (above the sender's original
message). Thread opens normally after
acceptance — full composer, no locked state.</span>`;

const SPEC_7 = `<span class="st">EmptyState</span> (approved DM copy)
────────────────────────────────────────
<span class="st">glyph:</span> lock icon, <span class="sv">22×24</span>,
  color: <span class="sv">'#6BB5E8'</span>, opacity: <span class="sv">0.7</span>
<span class="st">title:</span> <span class="sc">"A letter to a fellow leader."</span> {
  fontFamily: <span class="sv">'CormorantGaramond_300Light'</span>,
  fontStyle: <span class="sv">'italic'</span>,
  fontSize: <span class="sv">20</span>, lineHeight: <span class="sv">29</span>,
  color: <span class="sv">'#F0EDE6'</span>,
}
<span class="st">sub:</span> <span class="sc">"Let your words be with grace."</span> {
  fontFamily: <span class="sv">'DMSans_400Regular'</span>,
  fontSize: <span class="sv">12.5</span>, lineHeight: <span class="sv">20</span>,
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
  maxWidth: <span class="sv">240</span>,
}
<span class="st">verse:</span> {
  fontFamily: <span class="sv">'CormorantGaramond_300Light'</span>,
  fontStyle: <span class="sv">'italic'</span>,
  fontSize: <span class="sv">15</span>, lineHeight: <span class="sv">23</span>,
  color: <span class="sv">'rgba(240,237,230,0.45)'</span>,
  maxWidth: <span class="sv">260</span>, marginTop: <span class="sv">16</span>,
}
<span class="st">ref:</span> <span class="sc">"MATTHEW 18:20"</span> {
  fontFamily: <span class="sv">'DMMono_400Regular'</span>,
  fontSize: <span class="sv">9</span>, letterSpacing: <span class="sv">1.98</span>,
  textTransform: <span class="sv">'uppercase'</span>,
  color: <span class="sv">'rgba(240,237,230,0.25)'</span>,
  marginTop: <span class="sv">8</span>,
}
<span class="sn">This is the post-connection empty state —
shown when an accepted DM has no messages
yet. The pre-connection empty (Frame 1)
uses different copy.</span>`;


// ── Main layout ──────────────────────────────────────────────────────────

function HandoffApp() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:64}}>

      {/* ── I. Sending a Request ── */}
      <Section num="I" title="Sending a Request"
        sub="The leader searches for someone, opens the composer, and sees a gentle notice that this will be sent as a connection request — not an instant DM.">
        <FrameCol label="1 · Composer with request note">
          <PhoneBezel><Frame1_ComposerNote /></PhoneBezel>
          <Spec text={SPEC_1} />
        </FrameCol>
        <FrameCol label="2 · Sent request confirmation">
          <PhoneBezel><Frame2_SentModal /></PhoneBezel>
          <Spec text={SPEC_2} />
        </FrameCol>
      </Section>

      {/* ── II. Waiting & Decline ── */}
      <Section num="II" title="Waiting & Outcome"
        sub="The sender returns to the Leaders list. A pending row signals the request is out. If declined, it resolves gently — no harsh treatment.">
        <FrameCol label="3 · Pending row (sender's list)">
          <PhoneBezel><Frame3_PendingRow /></PhoneBezel>
          <Spec text={SPEC_3} />
        </FrameCol>
        <FrameCol label="5 · Decline notice (sender's list)">
          <PhoneBezel><Frame5_DeclineNotice /></PhoneBezel>
          <Spec text={SPEC_5} />
        </FrameCol>
      </Section>

      {/* ── III. Recipient's View ── */}
      <Section num="III" title="Receiving a Request"
        sub="Two options for how the recipient sees and acts on the request. Both shown at full fidelity.">
        <Recommendation />
        <FrameCol label="4A · Option A — Inline card (list)">
          <PhoneBezel><Frame4A_InlineCard /></PhoneBezel>
          <Spec text={SPEC_4A} />
        </FrameCol>
        <FrameCol label="4B · Option B — In-thread (recommended)">
          <PhoneBezel><Frame4B_InThread /></PhoneBezel>
          <Spec text={SPEC_4B} />
        </FrameCol>
      </Section>

      {/* ── IV. Connection Established ── */}
      <Section num="IV" title="Connection Established"
        sub="After acceptance, the thread opens normally. The system message at the top confirms the connection. The empty state uses the approved copy.">
        <FrameCol label="6 · Accept — system message">
          <PhoneBezel><Frame6_AcceptMessage /></PhoneBezel>
          <Spec text={SPEC_6} />
        </FrameCol>
        <FrameCol label="7 · Empty state (approved copy)">
          <PhoneBezel><Frame7_EmptyState /></PhoneBezel>
          <Spec text={SPEC_7} />
        </FrameCol>
      </Section>

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<HandoffApp />);
