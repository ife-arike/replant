// ─────────────────────────────────────────────
// UndergroundQueue — deliverables 1, 2, 3, 5 (the Pending tab)
//
// Extends Underground.jsx: the read-only single table becomes the `Pending` tab
// of a 3-tab queue. PRESERVES the restricted-access banner, the client-side
// per-row name decryption, and the AAL2 + is_underground_admin parent gate.
//
//   1 · 3-tab bar (Pending / Verified / Deactivated) with counts
//   2 · pending rows: ref / region / submitted / SLA pill / state pill / tier
//   3 · SLA aggregate banner — tints to worst bucket; click a number → filter
//   5 · filter chips (Region / SLA / Proposer / Tier), collapsible
//
// Row click → navigate(`/underground/pending/${id}`) — NOT inline expand (#4).
// SlaPill renders compact (day only) in rows per Founder-final tweak.
// ─────────────────────────────────────────────

import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SlaPill, { slaBand } from './SlaPill'
import { REGION_LABELS } from '../lib/region-labels'

const STATE_PILL = {
  untouched: ['state-untouched', 'Untouched'],
  awaiting:  ['state-await', 'Awaiting confirm'],
  info:      ['state-info', 'Info requested'],
  locked:    ['state-locked', (name) => `Locked by ${name}`],
  stalled:   ['state-stalled', 'Stalled · clock paused'],
}

function StatePill({ row }) {
  const [cls, label] = STATE_PILL[row.queue_state] || STATE_PILL.untouched
  return (
    <span className={`state ${cls}`}>
      <span className="sd" />
      {typeof label === 'function' ? label(row.locked_by_name) : label}
    </span>
  )
}

function TierBadge({ tier }) {
  const map = { T1: ['tier-t1', 'T1 · referral'], T2: ['tier-t2', 'T2 · call'], T3: ['tier-t3', 'T3 · placeholder'] }
  const [cls, label] = map[tier] || map.T3
  return <span className={`tier ${cls}`}>{label}</span>
}

export default function UndergroundQueue({ rows, counts }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bucket, setBucket] = useState(null)   // aggregate-click SLA filter

  // SLA aggregate counts (deliverable 3). Banner tints to the worst non-zero.
  const agg = useMemo(() => ({
    past15: rows.filter(r => r.day > 15).length,
    past25: rows.filter(r => r.day > 25).length,
    past28: rows.filter(r => r.day > 28).length,
  }), [rows])
  const worst = agg.past25 ? 'red' : agg.past15 ? 'amber' : 'neutral'

  const visible = bucket ? rows.filter(r => r.day > bucket) : rows

  return (
    <>
      {/* 1 · tabs */}
      <div className="q-tabs">
        {[['pending', 'Pending'], ['verified', 'Verified'], ['deactivated', 'Deactivated']].map(([k, label]) => (
          <button key={k} className={`q-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {label} <span className="tcount">{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* 3 · SLA aggregate banner */}
      <div className={`sla-agg worst-${worst}`}>
        <svg className="ic agg-ico" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4" /><path d="M8 4.5V8l2.4 1.6" /></svg>
        <span className="agg-label">SLA · this queue</span>
        <div className="agg-stats">
          <button className="agg-stat is-amber" onClick={() => setBucket(b => b === 15 ? null : 15)}><b>{agg.past15}</b> churches past day 15</button>
          <button className="agg-stat is-red" onClick={() => setBucket(b => b === 25 ? null : 25)}><b>{agg.past25}</b> past day 25</button>
          <button className="agg-stat" onClick={() => setBucket(b => b === 28 ? null : 28)}><b>{agg.past28}</b> past day 28</button>
        </div>
        <span className="agg-foot">tints to worst bucket · click a number to filter</span>
      </div>

      {/* 5 · filter chips */}
      <div className={`q-filters ${filtersOpen ? '' : 'q-filters-collapsed'}`}>
        <button className="q-filters-toggle" onClick={() => setFiltersOpen(o => !o)}>
          <svg className="ic" viewBox="0 0 16 16"><path d="M2 4h12M4 8h8M6 12h4" /></svg>Filters
        </button>
        {['Region', 'SLA bucket', 'Proposer', 'Evidence tier'].map(c => (
          <button key={c} className="q-chip"><span className="ck">○</span>{c}<span className="chev">▾</span></button>
        ))}
      </div>

      {/* 2 · pending rows */}
      <div className="q-card">
        <table className="q-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Ref</th><th>Macro-region</th><th style={{ width: 104 }}>Submitted</th>
              <th style={{ width: 160 }}>SLA</th><th style={{ width: 170 }}>State</th><th style={{ width: 96 }}>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row.id} className="q-row" onClick={() => navigate(`/underground/pending/${row.id}`)}>
                <td><span className="q-ref">{`UG-${row.id.slice(0, 4).toUpperCase()}`}</span></td>
                <td className="q-region">{REGION_LABELS[row.region_admin_only] || '—'}</td>
                <td className="q-date">{row.submitted_at?.slice(5, 10)}</td>
                <td><SlaPill day={row.day} stalled={row.queue_state === 'stalled'} variant="compact" /></td>
                <td><StatePill row={row} /></td>
                <td><TierBadge tier={row.evidence_tier} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
