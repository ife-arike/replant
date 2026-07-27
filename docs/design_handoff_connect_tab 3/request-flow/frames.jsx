// ─────────────────────────────────────────────────────────────────────────
// frames.jsx — Static phone frames for the Message Request Flow handoff.
// Each function renders one screen state inside a PhoneBezel. Reuses shared
// components from connect-tab/ (Icon, Monogram, TabBar, CovenantFooter,
// CovenantStrip) loaded before this file.
// ─────────────────────────────────────────────────────────────────────────

// ── New icon: envelope (sealed-letter metaphor) ──────────────────────────
const IconEnvelope = (p) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 5l9 7 9-7" />
  </svg>
);

// ── Phone bezel — iPhone 15 Pro Max (430 × 932 pt) ──────────────────────
function PhoneBezel({ children }) {
  return (
    <div style={{
      position:'relative', width:430, height:932, borderRadius:60,
      background:'#050505', flexShrink:0,
      boxShadow:'0 50px 120px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(240,237,230,0.05), inset 0 0 0 6px #0a0a0a, inset 0 0 0 8px rgba(240,237,230,0.05)',
      overflow:'hidden',
    }}>
      <div style={{position:'absolute',top:14,left:'50%',transform:'translateX(-50%)',width:126,height:37,background:'#000',borderRadius:22,zIndex:100}} />
      <div style={{position:'absolute',top:22,left:32,fontFamily:'-apple-system,system-ui,sans-serif',fontWeight:590,fontSize:16,color:'#F0EDE6',zIndex:99}}>9:41</div>
      <div style={{position:'absolute',top:23,right:30,zIndex:99,display:'flex',gap:7,alignItems:'center',color:'#F0EDE6'}}>
        <svg width="18" height="12" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="currentColor"/><rect x="4.5" y="5" width="3" height="6" rx="0.6" fill="currentColor"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill="currentColor"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="currentColor"/></svg>
        <svg width="25" height="12" viewBox="0 0 24 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.6"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor"/><path d="M22.5 4v4c0.7-0.2 1.3-1 1.3-2c0-1-0.6-1.8-1.3-2z" fill="currentColor" fillOpacity="0.6"/></svg>
      </div>
      <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',width:140,height:5,borderRadius:100,background:'rgba(240,237,230,0.4)',zIndex:100,pointerEvents:'none'}} />
      <div style={{position:'absolute',inset:0}}>{children}</div>
    </div>
  );
}

// ── Reusable static sub-components ───────────────────────────────────────

function StaticThreadHead({ name, church }) {
  return (
    <div className="thread-head" style={{flexShrink:0}}>
      <div className="back"><Icon.back /></div>
      <div className="who">
        <div className="name">{name}</div>
        <div className="church">{church}</div>
      </div>
    </div>
  );
}

function LeadersHeader() {
  return (
    <React.Fragment>
      <div className="tab-header">
        <div className="eyebrow">Tab 5 · In Confidence</div>
        <h1>Connect</h1>
        <div className="subtitle">
          Leader to leader<span className="dot">·</span>Held in confidence
        </div>
        <div className="compose"><Icon.compose /></div>
      </div>
      <div className="cn-seg">
        <div className="cn-seg-item">Ministries</div>
        <div className="cn-seg-item on">Leaders</div>
      </div>
      <div className="cn-search">
        <Icon.search />
        <input placeholder="Search by name or church" readOnly />
      </div>
    </React.Fragment>
  );
}

function SecureRow({ unread = 1, preview }) {
  return (
    <div className={'thread-row secure' + (unread > 0 ? ' unread' : '')}>
      <div className="monogram">
        <img className="rp-mark" src="connect-tab/rp-mark.svg" alt="Replant" />
      </div>
      <div className="center">
        <div className="name-line">
          <span className="lock"><Icon.lock width="11" height="12" /></span>
          <span className="name">Replant Team</span>
          <span className="secure-tag">Secure</span>
        </div>
        <div className="preview">{preview || 'We have read your heartcry and we are standing with you.'}</div>
      </div>
      <div className="right">
        <span className="time">2h</span>
        {unread > 0 && <span className="unread-badge">{unread}</span>}
      </div>
    </div>
  );
}

function StaticRow({ initial, name, church, preview, time, unread = 0, underground = false }) {
  const hasUnread = unread > 0;
  return (
    <div className={'thread-row' + (hasUnread ? ' unread' : '')}>
      <div className={'monogram' + (underground ? ' anon' : '')}>
        {underground ? <Icon.anon /> : initial}
      </div>
      <div className="center">
        <div className="name-line"><span className="name">{name}</span></div>
        {church && <div className="church">{church}</div>}
        <div className="preview">{preview}</div>
      </div>
      <div className="right">
        <span className="time">{time}</span>
        {hasUnread && <span className="unread-badge">{unread}</span>}
      </div>
    </div>
  );
}

function StaticComposer({ placeholder }) {
  return (
    <div className="composer">
      <div className="attach"><Icon.clip /></div>
      <div className="field" style={{minHeight:42,display:'flex',alignItems:'center',padding:'11px 16px'}}>
        <span style={{color:'rgba(240,237,230,0.25)',fontFamily:'var(--body)',fontSize:'14.5px'}}>{placeholder || 'Write a message'}</span>
      </div>
      <div className="send disabled"><Icon.send /></div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 1 — Composer with request note
//  The DM composer for an unconnected leader. A small sky-tinted notice
//  sits above the text field, inside the composer zone: "This will be
//  sent as a connection request."
// ═════════════════════════════════════════════════════════════════════════

function Frame1_ComposerNote() {
  return (
    <div className="tab-root connect">
      <StaticThreadHead name="Pastor Anand Rao" church="GRACE COMMUNITY CHURCH" />

      <div className="messages" style={{flex:1,overflow:'hidden'}}>
        <div className="thread-empty">
          <div className="glyph"><Icon.lock width="22" height="24" /></div>
          <div className="line">A new, private letter.</div>
          <div className="sub">Say what is on your heart to begin. Only the two of you will read it.</div>
        </div>
      </div>

      <CovenantStrip />

      {/* composer zone — request note + input row */}
      <div style={{flexShrink:0, background:'rgba(8,8,8,0.96)', borderTop:'0.5px solid rgba(240,237,230,0.08)'}}>
        <div className="request-note">
          <IconEnvelope width="13" height="13" />
          <span>This will be sent as a connection request</span>
        </div>
        <div className="composer" style={{borderTop:0,paddingTop:6}}>
          <div className="attach"><Icon.clip /></div>
          <div className="field" style={{minHeight:42,display:'flex',alignItems:'center',padding:'11px 16px'}}>
            <span style={{color:'rgba(240,237,230,0.25)',fontFamily:'var(--body)',fontSize:'14.5px'}}>Write a message</span>
          </div>
          <div className="send disabled"><Icon.send /></div>
        </div>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 2 — Sent request confirmation modal
//  After the leader sends, a centered modal (matching the Covenant Notice
//  card) confirms the request. Thread is visible behind the dim scrim.
//  Single CTA: "Back to Leaders."
// ═════════════════════════════════════════════════════════════════════════

function Frame2_SentModal() {
  return (
    <div className="tab-root connect">
      <StaticThreadHead name="Pastor Anand Rao" church="GRACE COMMUNITY CHURCH" />

      <div className="messages" style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{flex:1}} />
        <div className="ts-divider">Today</div>
        <div className="msg-row sent">
          <div className="bubble">Brother, I wanted to reach out about the regional gathering. I believe our ministries could serve the east coast together.</div>
        </div>
      </div>

      <CovenantStrip />
      <div style={{flexShrink:0,background:'rgba(8,8,8,0.96)',borderTop:'0.5px solid rgba(240,237,230,0.08)'}}>
        <div className="request-note">
          <IconEnvelope width="13" height="13" />
          <span>This will be sent as a connection request</span>
        </div>
        <div className="composer" style={{borderTop:0,paddingTop:6}}>
          <div className="attach"><Icon.clip /></div>
          <div className="field" style={{minHeight:42,display:'flex',alignItems:'center',padding:'11px 16px'}}>
            <span style={{color:'rgba(240,237,230,0.25)',fontFamily:'var(--body)',fontSize:'14.5px'}}>Write a message</span>
          </div>
          <div className="send disabled"><Icon.send /></div>
        </div>
      </div>

      {/* modal overlay */}
      <div className="scrim covenant-wrap" style={{position:'absolute',inset:0,zIndex:60,opacity:1,animation:'none'}}>
        <div className="covenant" style={{opacity:1,animation:'none'}}>
          <div className="seal"><IconEnvelope width="22" height="22" /></div>
          <div className="eyebrow">Request sent</div>
          <div className="heading">Your letter is on the way.</div>
          <div className="body">
            Your message request to{' '}
            <strong style={{color:'#F0EDE6',fontWeight:500}}>Pastor Anand Rao</strong>{' '}
            has been sent. If they accept, your conversation will appear here.
          </div>
          <div className="btn btn-primary" style={{width:'100%'}}>Back to Leaders</div>
        </div>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 3 — Pending row (sender's Leaders list)
//  While waiting for a response, the sender sees a "Pending" row. Dashed
//  monogram border, sky tag, italic preview.
// ═════════════════════════════════════════════════════════════════════════

function Frame3_PendingRow() {
  return (
    <div className="tab-root connect">
      <div className="tc-pages">
        <LeadersHeader />
        <div className="thread-list">
          <SecureRow unread={1} />

          {/* pending row */}
          <div className="thread-row pending-row">
            <div className="monogram">A</div>
            <div className="center">
              <div className="name-line">
                <span className="name">Pastor Anand Rao</span>
                <span className="pending-tag">Pending</span>
              </div>
              <div className="church">Grace Community Church</div>
              <div className="preview">Awaiting their reply</div>
            </div>
            <div className="right">
              <span className="time">2m</span>
            </div>
          </div>

          <StaticRow initial="W" name="Pastor Wangari Mwangi" church="Living Word Nairobi"
            preview="Brother, the baptism is confirmed for Sunday." time="14m" unread={2} />
          <StaticRow initial="F" name="Apostle Femi Okafor" church="Cornerstone Lagos"
            preview="Thank you for the wisdom on the elders' decision." time="1h" />
          <StaticRow name="Underground Church" underground={true}
            preview="We gathered again last night. Twelve of us." time="Yesterday" unread={1} />
        </div>
        <CovenantFooter />
      </div>
      <TabBar active={4} unread={7} badgeEnabled={true} />
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 4A — Incoming request: inline card (Option A)
//  A request card sits above the thread list. Shows sender name, ministry,
//  first line of message, Accept + Decline inline. No drill-in needed.
// ═════════════════════════════════════════════════════════════════════════

function Frame4A_InlineCard() {
  return (
    <div className="tab-root connect">
      <div className="tc-pages">
        <LeadersHeader />

        {/* request card */}
        <div className="request-card">
          <div className="rc-head">
            <div className="monogram">D</div>
            <div className="who">
              <div className="rc-eyebrow">Connection request</div>
              <div className="rc-name">Pastor Daniel Osei</div>
            </div>
          </div>
          <div className="rc-church">Cornerstone Fellowship · Accra, Ghana</div>
          <div className="rc-message">
            "Brother, I wanted to reach out about the regional gathering. I believe our ministries could serve the east coast together."
          </div>
          <div className="rc-actions">
            <div className="btn btn-quiet">Decline</div>
            <div className="btn btn-primary">Accept</div>
          </div>
        </div>

        <div className="thread-list">
          <SecureRow unread={0} preview="A word for you below." />
          <StaticRow initial="W" name="Pastor Wangari Mwangi" church="Living Word Nairobi"
            preview="The curriculum is ready for your review." time="2h" />
          <StaticRow initial="M" name="Pastor Maria Santos" church="Iglesia Manila"
            preview="My nephew walked out of the hospital. He is whole." time="3h" unread={1} />
        </div>
        <CovenantFooter />
      </div>
      <TabBar active={4} unread={2} badgeEnabled={true} />
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 4B — Incoming request: in-thread (Option B — recommended)
//  Tapping the request row opens a thread. The sender's message renders
//  as a bubble; Accept/Decline sit above a locked composer — matching the
//  forming-branch pattern.
// ═════════════════════════════════════════════════════════════════════════

function Frame4B_InThread() {
  return (
    <div className="tab-root connect">
      <StaticThreadHead name="Pastor Daniel Osei" church="CORNERSTONE FELLOWSHIP" />

      <div className="messages" style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div className="branch-event" style={{marginTop:14}}>Connection request · 2:14 PM</div>
        <div className="msg-row recv" style={{marginTop:6}}>
          <div className="bubble">Brother, I wanted to reach out about the regional gathering. I believe our ministries could serve the east coast together.</div>
        </div>
        <div style={{flex:1}} />
      </div>

      {/* accept/decline bar */}
      <div className="request-actions-bar">
        <div className="rab-label">Accept this conversation?</div>
        <div className="rab-btns">
          <div className="btn btn-quiet">Decline</div>
          <div className="btn btn-primary">Accept</div>
        </div>
      </div>

      <CovenantStrip />

      <div className="composer locked">
        <div className="field locked-note">Reply opens when you accept</div>
        <div className="send disabled"><Icon.send /></div>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 5 — Decline notice (sender's Leaders list)
//  When declined, the pending row updates. Gentle, not harsh: dimmed
//  monogram, muted name, and a prayerful close in serif italic.
// ═════════════════════════════════════════════════════════════════════════

function Frame5_DeclineNotice() {
  return (
    <div className="tab-root connect">
      <div className="tc-pages">
        <LeadersHeader />
        <div className="thread-list">
          <SecureRow unread={1} />

          {/* declined row */}
          <div className="thread-row declined-row">
            <div className="monogram">A</div>
            <div className="center">
              <div className="name-line">
                <span className="name">Pastor Anand Rao</span>
              </div>
              <div className="church">Grace Community Church</div>
              <div className="decline-msg">Declined your invitation to connect.</div>
            </div>
            <div className="right">
              <span className="time">1h</span>
              <span className="remove-link">Remove</span>
            </div>
          </div>

          <StaticRow initial="W" name="Pastor Wangari Mwangi" church="Living Word Nairobi"
            preview="Brother, the baptism is confirmed for Sunday." time="14m" unread={2} />
          <StaticRow initial="F" name="Apostle Femi Okafor" church="Cornerstone Lagos"
            preview="Thank you for the wisdom on the elders' decision." time="1h" />
          <StaticRow name="Underground Church" underground={true}
            preview="We gathered again last night. Twelve of us." time="Yesterday" unread={1} />
        </div>
        <CovenantFooter />
      </div>
      <TabBar active={4} unread={5} badgeEnabled={true} />
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 6 — Accept: system message in thread
//  When accepted, the thread opens normally. A system message at the top
//  confirms the connection (matching branch-join system message style).
// ═════════════════════════════════════════════════════════════════════════

function Frame6_AcceptMessage() {
  return (
    <div className="tab-root connect">
      <StaticThreadHead name="Pastor Anand Rao" church="GRACE COMMUNITY CHURCH" />

      <div className="messages" style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div className="branch-event" style={{marginTop:14}}>
          Pastor Anand Rao accepted your request
        </div>
        <div className="ts-divider" style={{marginTop:14}}>Today</div>
        <div className="msg-row sent">
          <div className="bubble">Brother, I wanted to reach out about the regional gathering. I believe our ministries could serve the east coast together.</div>
        </div>
        <div className="msg-row recv" style={{marginTop:8}}>
          <div className="bubble">Daniel — peace to you. I have been praying about the same thing. Let us plan how our teams can partner for this season.</div>
        </div>
        <div style={{flex:1}} />
      </div>

      <CovenantStrip />
      <StaticComposer placeholder="Write a message" />
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════
//  FRAME 7 — Empty state (approved copy)
//  The post-connection empty state for a DM thread. Matthew 18:20.
//  Confirmed: renders cleanly in the request-flow context.
// ═════════════════════════════════════════════════════════════════════════

function Frame7_EmptyState() {
  const verseStyle = {
    fontFamily:'var(--scripture)', fontStyle:'italic', fontWeight:300,
    fontSize:'15px', lineHeight:1.5, color:'rgba(240,237,230,0.45)',
    maxWidth:260, marginTop:16, textAlign:'center', textWrap:'pretty',
  };
  const refStyle = {
    display:'block', marginTop:8,
    fontFamily:'var(--mono)', fontStyle:'normal',
    fontSize:'9px', letterSpacing:'0.22em', textTransform:'uppercase',
    color:'rgba(240,237,230,0.25)',
  };

  return (
    <div className="tab-root connect">
      <StaticThreadHead name="Pastor Anand Rao" church="GRACE COMMUNITY CHURCH" />

      <div className="messages" style={{flex:1,overflow:'hidden'}}>
        <div className="thread-empty">
          <div className="glyph"><Icon.lock width="22" height="24" /></div>
          <div className="line">A letter to a fellow leader.</div>
          <div className="sub">Let your words be with grace.</div>
          <div style={verseStyle}>
            "For where two or three gather in my name, there am I with them."
            <span style={refStyle}>Matthew 18:20</span>
          </div>
        </div>
      </div>

      <CovenantStrip />
      <StaticComposer placeholder="Write a message" />
    </div>
  );
}


Object.assign(window, {
  IconEnvelope, PhoneBezel,
  StaticThreadHead, LeadersHeader, SecureRow, StaticRow, StaticComposer,
  Frame1_ComposerNote, Frame2_SentModal, Frame3_PendingRow,
  Frame4A_InlineCard, Frame4B_InThread,
  Frame5_DeclineNotice, Frame6_AcceptMessage, Frame7_EmptyState,
});
