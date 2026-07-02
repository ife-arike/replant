// EscalatedCases — KAN-293. The 4th TAB under the merged Triage parent
// surface (Pastoral Signals / Flagged Messages / Replant Team Inbox /
// Escalated Cases — see Shell.nav-patch.jsx). TriageSurface renders the
// shared tab bar; this component renders the Escalated tab's own chrome
// (eyebrow Operations / Sensitive + title) and its PAGE body. The tab is
// not rendered in the bar for regular admins; this route is also gated
// (RequireTier min='super_admin'), and the component asserts the gate
// defensively below.
//
// PAGE body (NOT internal tabs): SLA aggregate banner (3 / 7 / 14, gray /
// neutral), two stacked sections by SOURCE AXIS — From Pastoral (renders
// FIRST; life-safety above moderation) then From Flagged — and a Resolved
// (last 14 days) collapsible. Anti-category-collapse is held by the two
// distinct sections + per-axis columns (the colored "spine" was dropped on
// review; section headers are neutral).
//
// Failure UX: server-down → ErrorState (NOT empty); realtime drop →
// debounced refresh on focus; optimistic close fail → undo + error;
// concurrent proposal → "refresh to review"; permission downgrade
// mid-session → 403 on next action → clear surface + route home.
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { RpFrame, SkeletonRows, ErrorBanner, EmptyState } from '../components/Shell'
import { getAdminTier, tierAtLeast } from '../lib/admin-tier'
import { listEscalatedCases } from '../lib/api'
import { roleLabel } from '../lib/role-humanisation'
import EscalatedCaseDrawer from '../components/escalated/EscalatedCaseDrawer'
import ReachOutModal from '../components/escalated/ReachOutModal'
import ProposeActionModal from '../components/escalated/ProposeActionModal'
import ApproveProposalModal from '../components/escalated/ApproveProposalModal'
import CloseCaseModal from '../components/escalated/CloseCaseModal'
import { FiltersTrigger, DropdownPanel, DropdownRow, useClickOutside, useEscapeKey } from '../components/FilterPrimitives'

const FLAG_CODE_LABELS = { location_probe: 'Location probe', identity_probe: 'Identity probe', spiritual_coercion: 'Spiritual coercion', off_platform_push: 'Off-platform push', impersonation: 'Impersonation' }
const FLAG_CODE_TIER = { identity_probe: 1, spiritual_coercion: 1, impersonation: 1, location_probe: 2, off_platform_push: 3 }   // severity → .tlvl color (T1 red / T2 amber / T3 blue)
const TIER_LABEL = { top_tier: 'Manager', super_admin: 'Super admin', regular: 'Admin' }

function StatePill({ c }) {
  if (c.state === 'open') return <span className="state state-open"><span className="sd" />Open</span>
  if (c.state === 'awaiting') return <span className="state state-awaiting"><span className="sd" />Awaiting reply</span>
  if (c.state === 'replied') return <span className="state state-replied"><span className="sd" />Leader replied</span>
  if (c.state === 'pending_mgr') return <span className="state state-pending-mgr"><span className="sd" />Proposal pending Manager</span>
  return null
}
function AgeCell({ days }) {
  const hot = days > 3
  return <span className={`ec-age ${hot ? 'hot' : ''}`}>{hot && <span className={`age-dot ${days > 14 ? 'late' : ''}`} />}{days}d</span>
}

function CaseSection({ axis, cases, viewerTier, expanded, onToggle, onAction }) {
  const pastoral = axis === 'pastoral'
  return (
    <div className={`ec-section ${pastoral ? 'from-pastoral' : 'from-flagged'}`}>
      <div className="ec-axis-cap">
        <span className="cap-q">{pastoral ? 'How do we care for this leader?' : 'Do we sanction — and does the recipient need follow-up?'}</span>
        <span className="cap-count">{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span>
      </div>
      {cases.length === 0 ? (
        <div className="q-card" style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--rp-muted-2)', fontSize: 12.5 }}>
          No {pastoral ? 'pastoral-escalated' : 'flagged-escalated'} cases match the current filters.
        </div>
      ) : (
        <div className="q-card">
          <table className="ec-table">
            <thead><tr>
              <th style={{ width: 96 }}>Case</th>
              <th style={{ width: '24%' }}>{pastoral ? 'Leader' : 'Sender → Receiver'}</th>
              <th>Escalation reason</th>
              <th style={{ width: 150 }}>Escalated by</th>
              <th style={{ width: 180 }}>State</th>
              <th style={{ width: 64 }}>Age</th>
              <th style={{ width: 30 }}></th>
            </tr></thead>
            <tbody>
              {cases.map(c => {
                const open = expanded.has(c.id)
                return (
                  <React.Fragment key={c.id}>
                    <tr className={`ec-row ${open ? 'open' : ''}`} onClick={() => onToggle(c.id)}>
                      <td><span className="ec-caseid">{c.id}</span></td>
                      <td>
                        {pastoral ? (
                          <>
                            <div className="ec-leader">{c.leader.is_underground ? <span className="ec-anon">A fellow {roleLabel(c.leader.role).toLowerCase()}</span> : c.leader.full_name}</div>
                            <div className="ec-sub">{c.leader.is_underground ? 'Underground' : `${roleLabel(c.leader.role)} · ${c.leader.church}`} &nbsp;·&nbsp; <span className="tlvl"><span className={`lv ${c.tier1 ? 't1' : 't2'}`}>{c.tier1 ? 'T1' : 'T2'}</span> {c.tier1 ? '· expedited' : '· standard'}</span></div>
                          </>
                        ) : (
                          <>
                            <div className="ec-leader">{c.sender.is_underground ? <span className="ec-anon">A fellow {roleLabel(c.sender.role).toLowerCase()}</span> : c.sender.full_name}<span className="arr">→</span><span className="recv">{c.receiver.is_underground ? `A fellow ${roleLabel(c.receiver.role).toLowerCase()}` : c.receiver.full_name}</span></div>
                            <div className="ec-sub" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}><span className="tlvl">{FLAG_CODE_LABELS[c.codes[0]]}</span>{c.codes.length > 1 && <span className="tlvl ec-more">+{c.codes.length - 1}</span>}</div>
                          </>
                        )}
                      </td>
                      <td><div className="ec-reason">{c.escalation_reason}</div></td>
                      <td><div className="ec-by">{c.escalated_by.auto
                        ? <><b>Auto-routed</b><br /><span className="ec-when">underground · {c.escalated_when}</span></>
                        : <><b>{c.escalated_by.name}</b><br /><span className="ec-when">{c.escalated_when}</span></>}</div></td>
                      <td><StatePill c={c} /></td>
                      <td><AgeCell days={c.age_days} /></td>
                      <td><span className="ec-chev"><svg className="ic" viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M6 9l6 6 6-6" /></svg></span></td>
                    </tr>
                    {open && <tr><td className="ec-drawer-cell" colSpan={7}><EscalatedCaseDrawer caseRow={c} viewerTier={viewerTier} onAction={onAction} /></td></tr>}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function EscalatedCases({ session, navigate }) {
  const viewerTier = getAdminTier(session)
  const viewerFirstName = (session?.user?.user_metadata?.full_name || '').split(' ')[0] || 'Admin'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [bucket, setBucket] = useState(null)
  const [fAxis, setFAxis] = useState(() => new Set())
  const [fRole, setFRole] = useState(() => new Set())
  const [fBy, setFBy] = useState(() => new Set())
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { rows: data } = await listEscalatedCases()   // BE: AAL2 + tier gate
      setRows(data || [])
    } catch (e) { setError(e?.message || 'Failed to load escalated cases'); setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // realtime drop → debounced full-refresh on focus return
  useEffect(() => {
    let t
    const onFocus = () => { clearTimeout(t); t = setTimeout(load, 400) }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus); clearTimeout(t) }
  }, [load])

  const toggleSet = (setter) => (v) => setter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  const onToggle = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const sortCases = (arr) => [...arr].sort((a, b) => (b.age_days - a.age_days) || (Number(b.tier1) - Number(a.tier1)))
  const applyFilters = (arr, axis) => arr.filter(c => {
    if (fAxis.size && !fAxis.has(axis)) return false
    if (bucket && !(c.age_days > bucket)) return false
    if (fBy.size && !fBy.has(c.escalated_by.name)) return false
    if (fRole.size && !fRole.has(axis === 'pastoral' ? c.leader.role : c.sender.role)) return false
    return true
  })

  const past = useMemo(() => rows.filter(r => r.axis === 'pastoral'), [rows])
  const flag = useMemo(() => rows.filter(r => r.axis === 'flagged'), [rows])
  const openCount = rows.length
  const at7 = rows.filter(c => c.age_days > 7).length

  // optimistic mutators (handlers omitted for brevity — fire api.js calls,
  // patch local rows, and on failure re-fetch + surface error; see preview
  // app.jsx for the full optimistic/undo wiring).
  function onAction(kind, c) {
    if (kind === 'reach') setModal({ type: 'reach', c })
    else if (kind === 'close') setModal({ type: 'close', c })
    else if (kind === 'review') setModal({ type: 'review', c })
    else if (kind.startsWith('propose:')) setModal({ type: 'propose', c, preset: kind.split(':')[1] })
  }

  // ---- defensive tier gate (route guard is primary; this is belt-and-braces) ----
  if (!tierAtLeast(viewerTier, 'super_admin')) {
    return (
      <RpFrame crumb="Operations / Sensitive" title="Escalated Cases" session={session}>
        <div className="ec-denied">
          <span className="d-glyph"><svg viewBox="0 0 24 24" style={{ width: 48, height: 48, stroke: 'currentColor', strokeWidth: 1.3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span>
          <div className="d-title">Not your register</div>
          <div className="d-body">The Escalated Cases register is for super admins and Managers. Regular admins escalate from Pastoral Signals or Flagged Messages — once escalated, a case leaves your view.</div>
        </div>
      </RpFrame>
    )
  }

  const sla = { a3: rows.filter(c => c.age_days > 3).length, a7, a14: rows.filter(c => c.age_days > 14).length }
  const roleOpts = [...new Set(rows.map(c => c.axis === 'pastoral' ? c.leader.role : c.sender.role))]
  const byOpts = [...new Set(rows.map(c => c.escalated_by.name))]

  return (
    <RpFrame crumb="Operations / Sensitive" title="Escalated Cases"
      meta={!loading && !error && <span><b>{openCount}</b> open · <b>{at7}</b> at the 7-day mark</span>}
      session={session}>

      {loading ? (
        <div className="q-card">{[1,2,3,4].map(i => <div key={i} className="rp-skeleton" style={{ height: 52, margin: 12, borderRadius: 3 }} />)}</div>
      ) : error ? (
        <>
          <ErrorBanner message={error} />
          <EmptyState label="Couldn't load escalated cases" message="See the error above. The register did NOT load — this is not the empty state." />
        </>
      ) : rows.length === 0 ? (
        <EmptyState label="No escalated cases" message="The admin queue and pastoral queue haven't produced any escalations needing case-level action." />
      ) : (
        <>
          <div className="sla-agg sla-agg-neutral">
            <span className="agg-ico"><svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg></span>
            <span className="agg-label">SLA · this register</span>
            <div className="agg-stats">
              <button className={`agg-stat ${bucket === 3 ? 'is-active' : ''}`} onClick={() => setBucket(b => b === 3 ? null : 3)}><b>{sla.a3}</b> open more than 3 days</button>
              <button className={`agg-stat is-amber ${bucket === 7 ? 'is-active' : ''}`} onClick={() => setBucket(b => b === 7 ? null : 7)}><b>{sla.a7}</b> more than 7 days</button>
              <button className={`agg-stat is-red ${bucket === 14 ? 'is-active' : ''}`} onClick={() => setBucket(b => b === 14 ? null : 14)}><b>{sla.a14}</b> more than 14 days</button>
            </div>
          </div>

          {/* ONE combined filter dropdown — mirror the CM mega-dropdown
              (DropdownPanel with sections). Facets: State / Tier level /
              Escalated by. (Leader-role + source-axis facets dropped.) */}
          <div className="ec-filters">
            {/* <FilterMenu> sections: State · Tier level · Escalated by */}
            <span className="ec-sortnote">sorted oldest first</span>
          </div>

          {/* PAGE VIEW — two stacked sections, Pastoral first (life-safety above moderation) */}
          <CaseSection axis="pastoral" cases={sortCases(applyFilters(past, 'pastoral'))} viewerTier={viewerTier} expanded={expanded} onToggle={onToggle} onAction={onAction} />
          <CaseSection axis="flagged" cases={sortCases(applyFilters(flag, 'flagged'))} viewerTier={viewerTier} expanded={expanded} onToggle={onToggle} onAction={onAction} />

          {/* No Resolved/closed register held on this surface (Founder): once a
              case is closed/actioned via the confirmation, it leaves the view
              entirely — the disposition already lives in the audit log. */}
        </>
      )}

      {/* modal family (handlers wire api.js + optimistic patch; see preview app.jsx) */}
      {modal?.type === 'reach' && <ReachOutModal caseRow={modal.c} viewerFirstName={viewerFirstName} onSent={() => { setModal(null); load() }} onCancel={() => setModal(null)} />}
      {modal?.type === 'propose' && <ProposeActionModal caseRow={modal.c} viewerTier={viewerTier} presetAction={modal.preset} onProposed={() => { setModal(null); load() }} onCancel={() => setModal(null)} />}
      {modal?.type === 'review' && <ApproveProposalModal caseRow={modal.c} viewerUserId={session?.user?.id} onApproved={() => { setModal(null); load() }} onRejected={() => { setModal(null); load() }} onCloseCase={(c) => setModal({ type: 'close', c, preset: c.proposal?.action === 'revoke_access' ? 'access_revoked' : c.proposal?.action === 'restrict_temporarily' ? 'restriction_applied' : 'escalated_to_higher' })} onCancel={() => setModal(null)} />}
      {modal?.type === 'close' && <CloseCaseModal caseRow={modal.c} presetDisposition={modal.preset} onClosed={() => { setModal(null); load() }} onCancel={() => setModal(null)} />}
    </RpFrame>
  )
}
