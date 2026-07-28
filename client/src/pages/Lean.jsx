import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore, localDateStr } from '../utils/scoring';
import { generateKaizenPDF } from '../utils/moduleReports';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_OPP_WORDS = 4;   // an "area of opportunity" must be described in ≥4 words
const MIN_OPPS = 3;        // need at least 3 described areas to earn the weekly 5 pts

function oppWordCount(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const fiveSItems = [
  { category: 'Sort (Seiri)',          items: ['Remove all unnecessary items from the work area','Red-tag items not needed in the next 30 days','Dispose of or relocate red-tagged items','Document what was removed and why'] },
  { category: 'Set in Order (Seiton)', items: ['Designate a specific place for every item','Label all locations clearly','Arrange items for ergonomic ease of use','Implement visual controls (shadow boards, floor tape)'] },
  { category: 'Shine (Seiso)',         items: ['Clean all equipment and work surfaces','Identify and fix sources of contamination','Assign cleaning responsibilities','Create daily cleaning schedule'] },
  { category: 'Standardize (Seiketsu)',items: ['Create standard operating procedures for first 3S','Post visual standards in the area','Implement color-coding system','Train all team members on standards'] },
  { category: 'Sustain (Shitsuke)',    items: ['Conduct weekly 5S audits','Review audit scores with team','Recognize top performers','Track 5S score trends over time'] },
];

// 1–5 maturity rating applied to each 5S audit item. The audit SCORE is the
// average of all rated items (1–5). The percentage shown separately is just
// completion — how many of the items have been rated.
const RATING_SCALE = [
  { value: 1, label: 'Not Practiced', color: '#ef4444', desc: 'No evidence the practice is in place or being followed.' },
  { value: 2, label: 'Emerging',      color: '#f97316', desc: 'Attempted occasionally and inconsistently; major gaps remain.' },
  { value: 3, label: 'Developing',    color: '#f59e0b', desc: 'Practiced regularly but not yet standardized or sustained.' },
  { value: 4, label: 'Proficient',    color: '#22c55e', desc: 'Consistently practiced and standardized; only minor gaps.' },
  { value: 5, label: 'Excellence',    color: '#0d9488', desc: 'Fully embedded, sustained, and continuously improved — a model example.' },
];
// Color for an average 5S score (1–5 scale).
const auditScoreColor = (v) => v >= 4 ? '#0d9488' : v >= 3 ? '#f59e0b' : v >= 1 ? '#ef4444' : '#94a3b8';

const wasteTypes = [
  { type: 'Defects',         icon: '❌', desc: 'Work requiring rework or scrap',                    example: 'Parts failing inspection, customer returns' },
  { type: 'Overproduction',  icon: '⚙️', desc: 'Producing more than customer demand',               example: 'Making parts before they are needed' },
  { type: 'Waiting',         icon: '⏳', desc: 'Idle time when value is not being added',            example: 'Machine downtime, waiting for approvals' },
  { type: 'Non-Utilized Talent', icon: '💡', desc: "Underutilizing people's knowledge and creativity", example: 'Not involving operators in improvement' },
  { type: 'Transportation',  icon: '🚚', desc: 'Unnecessary movement of materials or products',     example: 'Moving parts between distant workstations' },
  { type: 'Inventory',       icon: '📦', desc: 'Excess materials, WIP, or finished goods',           example: 'Large batch sizes sitting idle' },
  { type: 'Motion',          icon: '🏃', desc: 'Unnecessary movement of people',                    example: 'Searching for tools or walking for supplies' },
  { type: 'Extra-Processing',icon: '🔄', desc: 'More work or quality than required',                example: 'Extra steps not adding customer value' },
];

const PHASES = [
  { key: 'prepare',    label: 'Phase 1: Prepare',    icon: '📋' },
  { key: 'event',      label: 'Phase 2: Event',       icon: '⚡' },
  { key: 'sustain',    label: 'Phase 3: Sustain',     icon: '📈' },
];

const emptyKaizen = {
  title: '',
  status: 'Preparing',
  // Phase 1
  scope: '', goal: '', team: '', baselineData: '',
  // Phase 2
  gembaFindings: '', wastesIdentified: [], rootCauses: '', futureState: '', implementationNotes: '', standardWork: '',
  // Phase 3
  resultsTracking: '', followUpOwners: '', followUpActions: [], auditSchedule: '', auditDates: { d30: '', d60: '', d90: '' }, wins: '',
};

const statusOptions = ['Preparing', 'In Progress', 'Report-Out', 'Sustaining', 'Complete'];
const statusColors  = { Preparing: '#f59e0b', 'In Progress': '#0d9488', 'Report-Out': '#8b5cf6', Sustaining: '#0f2044', Complete: '#16a34a' };

const WASTES = ['Defects','Overproduction','Waiting','Non-Utilized Talent','Transportation','Inventory','Motion','Extra-Processing'];

const tabs = [{ id: '5s', label: '5S Checklist' }, { id: 'waste', label: 'Waste Types' }, { id: 'kaizen', label: 'Kaizen Log' }];

const emptyFollowUpRow = () => ({ action: '', owner: '', deadline: '' });

// Normalize follow-up actions from a record: prefer the new grid array; if only
// the legacy free-text `followUpOwners` string exists, start with one empty row.
function normalizeFollowUps(initial) {
  if (Array.isArray(initial?.followUpActions) && initial.followUpActions.length) {
    return initial.followUpActions.map(r => ({ action: r.action || '', owner: r.owner || '', deadline: r.deadline || '' }));
  }
  return [emptyFollowUpRow()];
}

function KaizenForm({ initial, onSave, onCancel, title: formTitle }) {
  const [form, setForm]       = useState({
    ...emptyKaizen,
    ...initial,
    wastesIdentified: Array.isArray(initial?.wastesIdentified) ? initial.wastesIdentified : [],
    followUpActions: normalizeFollowUps(initial),
    auditDates: { d30: '', d60: '', d90: '', ...(initial?.auditDates || {}) },
  });
  const [phase, setPhase]     = useState('prepare');

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }
  function setAuditDate(key, val) { setForm(f => ({ ...f, auditDates: { ...f.auditDates, [key]: val } })); }

  function updateFollowUp(i, field, val) {
    setForm(f => ({ ...f, followUpActions: f.followUpActions.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));
  }
  function addFollowUp() {
    setForm(f => ({ ...f, followUpActions: [...f.followUpActions, emptyFollowUpRow()] }));
  }
  function removeFollowUp(i) {
    setForm(f => {
      const updated = f.followUpActions.filter((_, idx) => idx !== i);
      return { ...f, followUpActions: updated.length ? updated : [emptyFollowUpRow()] };
    });
  }
  function toggleWaste(w) {
    setForm(f => {
      const current = Array.isArray(f.wastesIdentified) ? f.wastesIdentified : [];
      return {
        ...f,
        wastesIdentified: current.includes(w) ? current.filter(x => x !== w) : [...current, w],
      };
    });
  }

  const phaseIdx = PHASES.findIndex(p => p.key === phase);

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>{formTitle}</h4>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="label" style={{ margin: 0 }}>Status:</label>
          <select className="input" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
            value={form.status} onChange={e => set('status', e.target.value)}>
            {statusOptions.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Event title */}
      <div style={{ marginBottom: '1rem' }}>
        <label className="label">Kaizen Event Title</label>
        <input className="input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Reduce changeover time on Line 3" />
      </div>

      {/* Phase tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {PHASES.map((p, i) => (
          <button key={p.key} onClick={() => setPhase(p.key)} type="button"
            style={{ padding: '0.5rem 1rem', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: '0.78rem', border: 'none', cursor: 'pointer',
              background: phase === p.key ? '#0f2044' : '#f1f5f9', color: phase === p.key ? 'white' : '#64748b',
              borderBottom: phase === p.key ? '2px solid #0f2044' : 'none', marginBottom: phase === p.key ? -2 : 0 }}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Phase 1: Prepare */}
      {phase === 'prepare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '0.75rem 1rem', borderLeft: '4px solid #16a34a' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', margin: '0 0 4px', textTransform: 'uppercase' }}>Phase 1 — Before the Event</p>
            <p style={{ fontSize: '0.78rem', color: '#374151', margin: 0 }}>Define scope, goal, team, and gather baseline data before the event begins.</p>
          </div>
          <div>
            <label className="label">1. Scope — Specific process or area</label>
            <textarea className="input" rows={2} value={form.scope} onChange={e => set('scope', e.target.value)} placeholder="e.g. Reduce changeover time on Line 3 (not 'fix all of manufacturing')" />
          </div>
          <div>
            <label className="label">2. Goal — Measurable target</label>
            <textarea className="input" rows={2} value={form.goal} onChange={e => set('goal', e.target.value)} placeholder="e.g. Cut cycle time by 30%, reduce defects by 50%" />
          </div>
          <div>
            <label className="label">3. Team — Cross-functional members, facilitator, sponsor</label>
            <textarea className="input" rows={3} value={form.team} onChange={e => set('team', e.target.value)} placeholder="List team members, roles, and the sponsor with authority to approve changes..." />
          </div>
          <div>
            <label className="label">4. Baseline Data — Current-state metrics</label>
            <textarea className="input" rows={3} value={form.baselineData} onChange={e => set('baselineData', e.target.value)} placeholder="Current metrics, process maps, time studies, defect rates..." />
          </div>
        </div>
      )}

      {/* Phase 2: Event */}
      {phase === 'event' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: '0.75rem 1rem', borderLeft: '4px solid #2563eb' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', margin: '0 0 4px', textTransform: 'uppercase' }}>Phase 2 — The Kaizen Event</p>
            <p style={{ fontSize: '0.78rem', color: '#374151', margin: 0 }}>Understand current state, analyze root causes, design and implement the future state.</p>
          </div>

          {/* 2a Current State */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>A. Understand Current State</p>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Gemba Walk & Process Map Findings</label>
              <textarea className="input" rows={3} value={form.gembaFindings} onChange={e => set('gembaFindings', e.target.value)} placeholder="What did you observe walking the process? Value stream findings..." />
            </div>
            <div>
              <label className="label">Wastes Identified (DOWNTIME)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {WASTES.map(w => (
                  <button key={w} type="button" onClick={() => toggleWaste(w)}
                    style={{ padding: '4px 12px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                      background: (form.wastesIdentified || []).includes(w) ? '#0f2044' : 'white',
                      color:      (form.wastesIdentified || []).includes(w) ? 'white'   : '#475569',
                      borderColor: (form.wastesIdentified || []).includes(w) ? '#0f2044' : '#e2e8f0' }}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2b Root Cause */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>B. Root Cause Analysis</p>
            <label className="label">Findings — 5 Whys, Fishbone, Pareto</label>
            <textarea className="input" rows={4} value={form.rootCauses} onChange={e => set('rootCauses', e.target.value)} placeholder="Root causes identified (not just symptoms). Reference 5 Whys or fishbone results..." />
          </div>

          {/* 2c Future State */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>C. Future State Design</p>
            <label className="label">Solutions, Future-State Process Map & Priorities</label>
            <textarea className="input" rows={4} value={form.futureState} onChange={e => set('futureState', e.target.value)} placeholder="Brainstormed solutions, future-state map, prioritized by impact vs. effort..." />
          </div>

          {/* 2d Implement */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>D. Implement & Test</p>
            <label className="label">Changes Made, Test Results & Adjustments</label>
            <textarea className="input" rows={3} value={form.implementationNotes} onChange={e => set('implementationNotes', e.target.value)} placeholder="Physical/process changes made on the spot, small-scale tests, adjustments..." />
          </div>

          {/* 2e Standardize */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>E. Standardize & Report-Out</p>
            <label className="label">Standard Work Documentation & Leadership Presentation Notes</label>
            <textarea className="input" rows={3} value={form.standardWork} onChange={e => set('standardWork', e.target.value)} placeholder="New standard work, training completed, results presented to leadership..." />
          </div>
        </div>
      )}

      {/* Phase 3: Sustain */}
      {phase === 'sustain' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fdf4ff', borderRadius: 10, padding: '0.75rem 1rem', borderLeft: '4px solid #9333ea' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9333ea', margin: '0 0 4px', textTransform: 'uppercase' }}>Phase 3 — After the Event</p>
            <p style={{ fontSize: '0.78rem', color: '#374151', margin: 0 }}>Monitor results, assign follow-up owners, audit, and celebrate wins.</p>
          </div>
          <div>
            <label className="label">1. Results Tracking — Daily/weekly metrics vs. target</label>
            <textarea className="input" rows={3} value={form.resultsTracking} onChange={e => set('resultsTracking', e.target.value)} placeholder="How are results being tracked? Current metrics vs. baseline target..." />
          </div>
          <div>
            <label className="label">2. Follow-Up Owners — Open action items with owners & deadlines</label>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 32px', gap: 6, marginBottom: 6, marginTop: 4 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>Action</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>Owner</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>Deadline</span>
              <span />
            </div>
            {/* Data rows */}
            {form.followUpActions.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 32px', gap: 6, marginBottom: 6 }}>
                <input className="input" style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                  placeholder="Describe the action…" value={row.action}
                  onChange={e => updateFollowUp(i, 'action', e.target.value)} />
                <input className="input" style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                  placeholder="Owner name" value={row.owner}
                  onChange={e => updateFollowUp(i, 'owner', e.target.value)} />
                <input className="input" type="date" style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                  value={row.deadline}
                  onChange={e => updateFollowUp(i, 'deadline', e.target.value)} />
                <button type="button" onClick={() => removeFollowUp(i)} title="Remove row"
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={addFollowUp}
              style={{ marginTop: 4, background: '#f0fdfa', border: '1.5px dashed #0d9488', borderRadius: 8, color: '#0d9488', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 1rem', cursor: 'pointer' }}>
              + Add Row
            </button>
          </div>
          <div>
            <label className="label">3. Audit Schedule — 30 / 60 / 90 day checks</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 4 }}>
              {[
                { key: 'd30', label: '30-Day Audit' },
                { key: 'd60', label: '60-Day Audit' },
                { key: 'd90', label: '90-Day Audit' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</span>
                  <input className="input" type="date" style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                    value={form.auditDates[key]} onChange={e => setAuditDate(key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="label">4. Wins — Results & momentum to share with the team</label>
            <textarea className="input" rows={3} value={form.wins} onChange={e => set('wins', e.target.value)} placeholder="Quantified improvements, team recognition, communication plan..." />
          </div>
        </div>
      )}

      {/* Phase navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {phaseIdx > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setPhase(PHASES[phaseIdx - 1].key)}>← Previous Phase</button>
          )}
          {phaseIdx < PHASES.length - 1 && (
            <button type="button" className="btn-primary" onClick={() => setPhase(PHASES[phaseIdx + 1].key)}>Next Phase →</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => onSave({
            ...form,
            followUpActions: form.followUpActions.filter(r => r.action.trim() || r.owner.trim() || r.deadline),
          })}>💾 Save Kaizen</button>
        </div>
      </div>
    </div>
  );
}

function KaizenCard({ k, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const color = statusColors[k.status] || '#64748b';

  const phases2Check = [
    { label: 'Scope',            val: k.scope },
    { label: 'Goal',             val: k.goal },
    { label: 'Team',             val: k.team },
    { label: 'Baseline',         val: k.baselineData },
    { label: 'Gemba Findings',   val: k.gembaFindings },
    { label: 'Root Causes',      val: k.rootCauses },
    { label: 'Future State',     val: k.futureState },
    { label: 'Implementation',   val: k.implementationNotes },
    { label: 'Standard Work',    val: k.standardWork },
    { label: 'Results Tracking', val: k.resultsTracking },
    { label: 'Follow-Up Owners', val: (k.followUpActions?.length ? 'y' : '') || k.followUpOwners },
    { label: 'Wins',             val: k.wins },
  ];
  const filled = phases2Check.filter(p => p.val).length;
  const pct    = Math.round((filled / phases2Check.length) * 100);

  return (
    <div className="card" style={{ padding: '1.125rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{k.title}</h4>
            <span style={{ background: color + '18', color, borderRadius: 9999, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${color}44` }}>{k.status}</span>
          </div>
          {k.goal && <p style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: 600, margin: '0 0 4px' }}>🎯 {k.goal}</p>}
          <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: 8 }}>
            {k.scope && <span>📂 {k.scope}</span>}
            <span>📅 {k.date}</span>
            {k.wastesIdentified?.length > 0 && <span>⚠️ {k.wastesIdentified.length} waste{k.wastesIdentified.length > 1 ? 's' : ''} identified</span>}
          </div>
          {/* Completion progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 5, maxWidth: 160 }}>
              <div style={{ height: 5, borderRadius: 9999, background: '#0d9488', width: `${pct}%`, transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{pct}% complete</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => onEdit(k)}
            style={{ background: 'none', border: '1px solid #0d9488', borderRadius: 8, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#0d9488', cursor: 'pointer' }}>
            ✏️ Edit
          </button>
          <button onClick={() => generateKaizenPDF(k)}
            style={{ background: 'none', border: '1px solid #64748b', borderRadius: 8, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
            🖨️ PDF
          </button>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
            {expanded ? '▲ Collapse' : '▼ Details'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Phase 1 */}
          {(k.scope || k.goal || k.team || k.baselineData) && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>📋 Phase 1: Prepare</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[['Scope', k.scope], ['Goal', k.goal], ['Team', k.team], ['Baseline Data', k.baselineData]].map(([lbl, val]) => val && (
                  <div key={lbl}><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{lbl}: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{val}</span></div>
                ))}
              </div>
            </div>
          )}
          {/* Phase 2 */}
          {(k.gembaFindings || k.wastesIdentified?.length || k.rootCauses || k.futureState || k.implementationNotes || k.standardWork) && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>⚡ Phase 2: Event</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {k.wastesIdentified?.length > 0 && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Wastes: </span>
                    {k.wastesIdentified.map(w => <span key={w} style={{ fontSize: '0.68rem', background: '#0f204418', color: '#0f2044', borderRadius: 9999, padding: '1px 8px', marginLeft: 4, fontWeight: 700 }}>{w}</span>)}
                  </div>
                )}
                {[['Gemba Findings', k.gembaFindings], ['Root Causes', k.rootCauses], ['Future State', k.futureState], ['Implementation', k.implementationNotes], ['Standard Work', k.standardWork]].map(([lbl, val]) => val && (
                  <div key={lbl}><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{lbl}: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{val}</span></div>
                ))}
              </div>
            </div>
          )}
          {/* Phase 3 */}
          {(k.resultsTracking || k.followUpOwners || k.followUpActions?.length || k.auditSchedule || k.auditDates?.d30 || k.auditDates?.d60 || k.auditDates?.d90 || k.wins) && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>📈 Phase 3: Sustain</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {k.resultsTracking && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Results: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.resultsTracking}</span></div>
                )}
                {/* Follow-up action grid */}
                {k.followUpActions?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Follow-Up Owners:</span>
                    <div style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: 0, background: '#f8fafc', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        <span style={{ padding: '4px 8px' }}>Action</span>
                        <span style={{ padding: '4px 8px' }}>Owner</span>
                        <span style={{ padding: '4px 8px' }}>Deadline</span>
                      </div>
                      {k.followUpActions.map((r, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', borderTop: '1px solid #f1f5f9' }}>
                          <span style={{ padding: '4px 8px' }}>{r.action || '—'}</span>
                          <span style={{ padding: '4px 8px' }}>{r.owner || '—'}</span>
                          <span style={{ padding: '4px 8px' }}>{r.deadline || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Legacy free-text follow-up (older records) */}
                {!k.followUpActions?.length && k.followUpOwners && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Follow-Up: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.followUpOwners}</span></div>
                )}
                {(k.auditDates?.d30 || k.auditDates?.d60 || k.auditDates?.d90) ? (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Audit Schedule: </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {[['30-day', k.auditDates.d30], ['60-day', k.auditDates.d60], ['90-day', k.auditDates.d90]]
                        .filter(([, v]) => v).map(([lbl, v]) => `${lbl}: ${v}`).join('  ·  ')}
                    </span>
                  </div>
                ) : k.auditSchedule && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Audit Schedule: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.auditSchedule}</span></div>
                )}
                {k.wins && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Wins: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.wins}</span></div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Pareto chart — bars sorted high→low + cumulative % line + 80% reference line.
// Teaches the 80/20 rule: the few waste types on the left drive most of the problems.
function WasteParetoChart({ tally }) {
  const data = tally.filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const W = 640, H = 300, padL = 40, padR = 44, padT = 20, padB = 70;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const maxCount = Math.max(...data.map(d => d.count));
  const bw = chartW / data.length;

  let cum = 0;
  const pts = data.map((d, i) => {
    cum += d.count;
    const cumPct = (cum / total) * 100;
    return { ...d, cumPct, x: padL + bw * i + bw / 2, cy: padT + chartH - (cumPct / 100) * chartH };
  });
  const y80 = padT + chartH - 0.8 * chartH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Y gridlines */}
      {[0, 25, 50, 75, 100].map(p => {
        const gy = padT + chartH - (p / 100) * chartH;
        return <g key={p}>
          <line x1={padL} y1={gy} x2={padL + chartW} y2={gy} stroke="#e2e8f0" strokeWidth="1" />
          <text x={padL + chartW + 6} y={gy + 3} fontSize="9" fill="#94a3b8">{p}%</text>
        </g>;
      })}
      {/* 80% reference line */}
      <line x1={padL} y1={y80} x2={padL + chartW} y2={y80} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={padL + 2} y={y80 - 4} fontSize="9" fontWeight="700" fill="#ef4444">80% line — focus here ↑</text>
      {/* Bars */}
      {pts.map((d, i) => {
        const bh = (d.count / maxCount) * chartH;
        const withinVital = d.cumPct <= 80 || i === 0;
        return <g key={d.type}>
          <rect x={d.x - bw * 0.35} y={padT + chartH - bh} width={bw * 0.7} height={bh}
            fill={withinVital ? '#0f2044' : '#94a3b8'} rx="2" />
          <text x={d.x} y={padT + chartH - bh - 4} fontSize="9" fontWeight="700" fill="#0f2044" textAnchor="middle">{d.count}</text>
          <text x={d.x} y={padT + chartH + 14} fontSize="12" textAnchor="middle">{d.icon}</text>
          <text x={d.x} y={padT + chartH + 30} fontSize="7.5" fill="#64748b" textAnchor="middle">
            {d.type.length > 12 ? d.type.slice(0, 11) + '…' : d.type}
          </text>
        </g>;
      })}
      {/* Cumulative line */}
      <polyline points={pts.map(d => `${d.x},${d.cy}`).join(' ')} fill="none" stroke="#0d9488" strokeWidth="2.5" />
      {pts.map(d => <circle key={d.type} cx={d.x} cy={d.cy} r="3.5" fill="#0d9488" />)}
    </svg>
  );
}

export default function Lean() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('5s');
  const [checks, setChecks]       = useState({});
  const [auditArea, setAuditArea] = useState('');
  const [findings, setFindings]   = useState({});
  const [opportunities, setOpportunities] = useState(['', '', '']);
  const [expandedItem, setExpandedItem] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [expandedAudit, setExpandedAudit] = useState(null);
  const [weekPtsEarned, setWeekPtsEarned] = useState(false);
  const [kaizen, setKaizen]       = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Waste Walk
  const [wasteLogs, setWasteLogs] = useState([]);
  const [wasteForm, setWasteForm] = useState(null); // { type, location, description, impact, countermeasure }
  const [savingWaste, setSavingWaste] = useState(false);
  const [expandedWaste, setExpandedWaste] = useState(null);

  // Set a 1–5 rating for an item; clicking the same value again clears it.
  function setRating(cat, idx, value) {
    const k = `${cat}-${idx}`;
    setChecks(c => ({ ...c, [k]: Number(c[k]) === value ? 0 : value }));
  }

  function setFinding(key, field, value) {
    setFindings(f => ({ ...f, [key]: { ...(f[key] || {}), [field]: value } }));
  }

  function handleImageUpload(key, e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setFinding(key, 'image', ev.target.result);
    reader.readAsDataURL(file);
  }

  function removeImage(key) {
    setFindings(f => ({ ...f, [key]: { ...(f[key] || {}), image: null } }));
  }

  function updateOpportunity(idx, val) {
    setOpportunities(o => o.map((x, i) => i === idx ? val : x));
  }
  function addOpportunity() {
    setOpportunities(o => [...o, '']);
  }
  function removeOpportunity(idx) {
    setOpportunities(o => o.length <= MIN_OPPS ? o.map((x, i) => i === idx ? '' : x) : o.filter((_, i) => i !== idx));
  }

  const describedOpps = opportunities.filter(o => oppWordCount(o) >= MIN_OPP_WORDS).length;
  const oppsQualified = describedOpps >= MIN_OPPS;

  const totalItems   = fiveSItems.reduce((a, c) => a + c.items.length, 0);
  // Ratings are 1–5 (0 / falsy = not yet rated). Legacy audits stored booleans;
  // Number(true) === 1 keeps them countable.
  const ratedValues  = Object.values(checks).map(Number).filter(v => v >= 1);
  const ratedItems   = ratedValues.length;
  const checkedItems = ratedItems; // alias kept for existing references
  const avgScore     = ratedItems ? ratedValues.reduce((a, b) => a + b, 0) / ratedItems : 0;
  const pct          = Math.round((ratedItems / totalItems) * 100); // completion, not score

  async function loadAuditHistory() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setAuditHistory(data.fiveSAudits || []);
        setWasteLogs(data.wasteLogs || []);
        const cutoff = localDateStr(new Date(Date.now() - SEVEN_DAYS_MS));
        setWeekPtsEarned((data.pointEvents || []).some(
          e => e.toolLabel === 'Lean 5S Audit' && e.date >= cutoff && e.points > 0
        ));
      }
    } catch {}
  }

  const wasteCutoff = localDateStr(new Date(Date.now() - SEVEN_DAYS_MS));
  // Distinct waste categories logged this week (each = 1 pt, max 5)
  const wasteTypesThisWeek = new Set(wasteLogs.filter(l => (l.date || '') >= wasteCutoff && l.type).map(l => l.type));
  const wastePtsThisWeek = Math.min(5, wasteTypesThisWeek.size);
  // All-time tally per waste type for the Pareto chart
  const wasteTally = wasteTypes.map(w => ({
    type: w.type, icon: w.icon,
    count: wasteLogs.filter(l => l.type === w.type).length,
  }));

  async function saveWasteLog() {
    if (!wasteForm || !currentUser) return;
    if (!wasteForm.location.trim() || !wasteForm.description.trim()) {
      return toast.error('Please fill in the location and what you observed');
    }
    setSavingWaste(true);
    try {
      const now = new Date();
      const entry = {
        id: now.getTime().toString(),
        type: wasteForm.type,
        location: wasteForm.location.trim(),
        description: wasteForm.description.trim(),
        impact: (wasteForm.impact || '').trim(),
        countermeasure: (wasteForm.countermeasure || '').trim(),
        date: localDateStr(now),
        savedAt: now.toISOString(),
      };
      // Is this a NEW distinct category for the current 7-day window? (drives the +1 point)
      const isNewCategoryThisWeek = !wasteLogs.some(l => l.type === entry.type && (l.date || '') >= wasteCutoff);
      const updated = [entry, ...wasteLogs].slice(0, 200);
      await setDoc(doc(db, 'users', currentUser.uid), { wasteLogs: updated }, { merge: true });
      setWasteLogs(updated);
      setWasteForm(null);

      if (isNewCategoryThisWeek && wastePtsThisWeek < 5) {
        await logPointEvent(currentUser.uid, {
          points: 1,
          toolLabel: 'Waste Walk Log',
          reason: `Logged ${entry.type} waste at ${entry.location}`,
        });
        await calculateScore(currentUser.uid);
        toast.success(`${entry.type} logged! +1 pt — ${Math.min(5, wasteTypesThisWeek.size + 1)}/5 categories this week.`, { duration: 4000 });
      } else {
        await calculateScore(currentUser.uid);
        toast.success(`${entry.type} logged. (Log a different waste type to earn more points this week.)`);
      }
    } catch (e) { console.error(e); toast.error('Save failed'); }
    setSavingWaste(false);
  }

  async function deleteWasteLog(id) {
    const updated = wasteLogs.filter(l => l.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { wasteLogs: updated }, { merge: true });
    setWasteLogs(updated);
    toast.success('Waste log deleted');
  }

  async function saveAudit() {
    if (!auditArea.trim()) return toast.error('Please enter the area being audited');
    if (ratedItems === 0) return toast.error('Rate at least one item (1–5) before saving');
    if (!currentUser) return toast.error('Not logged in');
    const dupName = auditArea.trim().toLowerCase();
    if (auditHistory.some(a => a.area.toLowerCase() === dupName)) {
      return toast.error(`An audit for "${auditArea.trim()}" already exists. Use a different name or delete the existing one first.`);
    }
    try {
      // Strip base64 images before saving — Firestore has a 1 MB document limit
      const findingsNoImages = Object.fromEntries(
        Object.entries(findings)
          .filter(([, v]) => v.note)
          .map(([k, v]) => [k, { note: v.note }])
      );
      const cleanOpps = opportunities.map(o => o.trim()).filter(Boolean);
      const record = {
        id: Date.now().toString(),
        area: auditArea.trim(),
        avgScore: Number(avgScore.toFixed(2)), // audit score = average of 1–5 ratings
        completion: pct,                        // % of items rated
        score: pct,                             // legacy field kept for old readers
        checked: ratedItems,
        total: totalItems,
        checks: { ...checks },
        findings: findingsNoImages,
        opportunities: cleanOpps,
        date: new Date().toISOString(),
      };
      const scoreStr = `${avgScore.toFixed(1)}/5`;
      const updated = [record, ...auditHistory].slice(0, 50);
      await setDoc(doc(db, 'users', currentUser.uid), { fiveSAudits: updated }, { merge: true });
      setAuditHistory(updated);

      // Weekly 5S scoring: +5 pts for an audit describing 3+ areas of opportunity,
      // once per rolling 7 days. Points expire after a week (handled in scoring.js).
      if (oppsQualified && !weekPtsEarned) {
        const { awarded } = await logPointEvent(currentUser.uid, {
          points: 5,
          toolLabel: 'Lean 5S Audit',
          reason: `Weekly 5S audit of "${auditArea.trim()}" with ${describedOpps} areas of opportunity`,
        });
        if (awarded) {
          await calculateScore(currentUser.uid);
          setWeekPtsEarned(true);
          toast.success(`Audit saved — score ${scoreStr}. +5 pts for this week's 5S audit!`, { duration: 4000 });
        } else {
          toast.success(`Audit saved — score ${scoreStr} for "${auditArea}"`);
        }
      } else if (oppsQualified && weekPtsEarned) {
        toast.success(`Audit saved — score ${scoreStr}. (This week's +5 pts already earned.)`);
      } else {
        toast.success(`Audit saved — score ${scoreStr}. Describe ${MIN_OPPS}+ areas of opportunity to earn +5 pts.`);
      }
    } catch (e) { toast.error('Save failed: ' + e.message); }
  }

  function loadAudit(record) {
    setChecks(record.checks || {});
    setFindings(record.findings || {});
    setAuditArea(record.area || '');
    const opps = record.opportunities && record.opportunities.length ? record.opportunities : ['', '', ''];
    setOpportunities(opps.length < MIN_OPPS ? [...opps, ...Array(MIN_OPPS - opps.length).fill('')] : opps);
    setExpandedItem(null);
    toast.success(`Loaded audit: ${record.area}`);
  }

  async function deleteAudit(id) {
    const updated = auditHistory.filter(a => a.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { fiveSAudits: updated }, { merge: true });
    setAuditHistory(updated);
    toast.success('Audit deleted');
  }

  function resetAudit() {
    setChecks({});
    setFindings({});
    setAuditArea('');
    setOpportunities(['', '', '']);
    setExpandedItem(null);
  }

  async function fetchKaizen() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const data = snap.exists() ? (snap.data().kaizenLog || []) : [];
      setKaizen(data);
    } catch (e) { console.error(e); }
  }

  async function persistKaizen(updated) {
    await setDoc(doc(db, 'users', currentUser.uid), { kaizenLog: updated }, { merge: true });
    setKaizen(updated);
  }

  useEffect(() => { fetchKaizen(); loadAuditHistory(); }, [currentUser]);

  async function handleSaveNew(form) {
    if (!form.title.trim()) return toast.error('Please enter a Kaizen event title');
    if (!currentUser) return toast.error('Not logged in');
    try {
      const entry = {
        id: Date.now().toString(),
        uid: currentUser.uid,
        ...form,
        date: new Date().toISOString().split('T')[0],
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      };
      await persistKaizen([entry, ...kaizen]);
      setShowForm(false);
      toast.success('Kaizen event logged');
    } catch (e) { toast.error('Save failed: ' + e.message); }
  }

  async function handleSaveEdit(form) {
    if (!form.title.trim()) return toast.error('Please enter a Kaizen event title');
    try {
      const { id, createdAt, uid, ...rest } = { ...editingEntry, ...form };
      await persistKaizen(kaizen.map(k => k.id === editingEntry.id ? { ...k, ...rest } : k));
      setEditingEntry(null);
      toast.success('Kaizen updated');
    } catch (e) { toast.error('Update failed: ' + e.message); }
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader icon="🏭" title="Lean Toolkit — Accountability Without Waste" subtitle="5S checklist, waste identification, and Kaizen event log" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === t.id ? '#0f2044' : '#f1f5f9', color: activeTab === t.id ? 'white' : '#475569' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 5S Tab */}
      {activeTab === '5s' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* ── Left: checklist ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Area input + score */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Area / Location Being Audited</label>
              <input className="input" value={auditArea} onChange={e => setAuditArea(e.target.value)}
                placeholder="e.g. Assembly Line 3, Warehouse Zone B, Office Floor 2…" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
              <div>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>5S Audit Score</span>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Average of all rated items (1–5)</p>
              </div>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: auditScoreColor(avgScore) }}>
                {ratedItems ? avgScore.toFixed(1) : '—'}<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 700 }}> / 5</span>
              </span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 10, marginBottom: 6 }}>
              <div style={{ height: 10, borderRadius: 9999, transition: 'width 0.6s ease', width: `${(avgScore / 5) * 100}%`, background: auditScoreColor(avgScore) }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>{pct}% complete</strong> · {ratedItems} of {totalItems} items rated
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }} onClick={resetAudit}>↺ Reset</button>
                <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem' }} onClick={saveAudit}>💾 Save Audit</button>
                {(auditArea.trim() || checkedItems > 0) && (
                  <button
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem', borderRadius: 9999, fontWeight: 700, border: '1.5px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }}
                    onClick={resetAudit}>
                    ＋ New Audit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rating scale key */}
          <div className="card" style={{ padding: '0.875rem 1.125rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Rating Scale — score each item 1 to 5</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {RATING_SCALE.map(r => (
                <div key={r.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, background: r.color, color: 'white', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.value}</span>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{r.label}</strong> — {r.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {fiveSItems.map(cat => (
            <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.25rem', background: '#0f2044' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{cat.category}</span>
              </div>
              {cat.items.map((item, i) => {
                const key = `${cat.category}-${i}`;
                const isExpanded = expandedItem === key;
                const finding = findings[key] || {};
                const hasFinding = finding.note || finding.image;
                return (
                  <div key={i} style={{ borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {/* Rating row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flex: 1, minWidth: 150 }}>{item}</span>
                      {/* 1–5 rating buttons */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {RATING_SCALE.map(r => {
                          const active = Number(checks[key]) === r.value;
                          return (
                            <button key={r.value} onClick={() => setRating(cat.category, i, r.value)}
                              title={`${r.value} — ${r.label}: ${r.desc}`}
                              style={{ width: 30, height: 30, borderRadius: 7, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                                border: active ? `2px solid ${r.color}` : '1.5px solid #e2e8f0',
                                background: active ? r.color : 'white', color: active ? 'white' : '#94a3b8', transition: 'all 0.15s' }}>
                              {r.value}
                            </button>
                          );
                        })}
                      </div>
                      {/* Finding indicator */}
                      {hasFinding && !isExpanded && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fef9c3', color: '#b45309', border: '1px solid #fde68a', borderRadius: 9999, padding: '1px 7px', flexShrink: 0 }}>
                          {finding.image ? '📎 Photo' : '📝 Note'}
                        </span>
                      )}
                      {/* Expand toggle */}
                      <button onClick={() => setExpandedItem(isExpanded ? null : key)}
                        title={isExpanded ? 'Collapse' : 'Add finding / photo'}
                        style={{ background: isExpanded ? '#f1f5f9' : 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
                        {isExpanded ? '▲' : '📎'}
                      </button>
                    </div>

                    {/* Expanded finding panel */}
                    {isExpanded && (
                      <div style={{ margin: '0 1.25rem 0.875rem', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Finding Details</p>

                        {/* Description */}
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description / Finding</label>
                          <textarea
                            className="input"
                            rows={3}
                            style={{ fontSize: '0.825rem', resize: 'vertical' }}
                            placeholder="Describe what was found, the condition, or the non-conformance…"
                            value={finding.note || ''}
                            onChange={e => setFinding(key, 'note', e.target.value)}
                          />
                        </div>

                        {/* Image upload */}
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Photo Evidence (PNG, JPG, GIF — max 5 MB)</label>
                          {finding.image ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img src={finding.image} alt="Finding" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                              <button onClick={() => removeImage(key)}
                                style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                            </div>
                          ) : (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px dashed #cbd5e1', cursor: 'pointer', background: 'white', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                              📷 Click to attach photo
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(key, e)} />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {/* Areas of Opportunity — required for weekly 5S points */}
          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0d9488' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem' }}>Areas of Opportunity</h3>
              <span style={{
                padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700,
                background: weekPtsEarned ? '#f0fdf4' : oppsQualified ? '#eff6ff' : '#f1f5f9',
                color: weekPtsEarned ? '#15803d' : oppsQualified ? '#1d4ed8' : '#94a3b8',
                border: `1px solid ${weekPtsEarned ? '#86efac' : oppsQualified ? '#bfdbfe' : '#e2e8f0'}`,
              }}>
                {weekPtsEarned ? '✓ +5 pts earned this week' : `${describedOpps}/${MIN_OPPS} described → +5 pts`}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Describe at least {MIN_OPPS} areas of opportunity found during this audit (min {MIN_OPP_WORDS} words each).
              A weekly audit with {MIN_OPPS}+ described areas earns <strong>+5 pts</strong> — the points reset each week, so run a fresh audit weekly to keep them.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {opportunities.map((opp, idx) => {
                const wc = oppWordCount(opp);
                const ok = wc >= MIN_OPP_WORDS;
                return (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, marginTop: 9, width: 20, height: 20, borderRadius: '50%', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: ok ? '#0d9488' : '#e2e8f0', color: ok ? 'white' : '#94a3b8' }}>
                      {ok ? '✓' : idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <textarea className="input" rows={2} style={{ fontSize: '0.825rem', resize: 'vertical' }}
                        placeholder={`Area of opportunity ${idx + 1} — what needs improvement and where?`}
                        value={opp} onChange={e => updateOpportunity(idx, e.target.value)} />
                      <span style={{ fontSize: '0.65rem', color: ok ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                        {wc}/{MIN_OPP_WORDS} words {ok ? '✓' : ''}
                      </span>
                    </div>
                    <button onClick={() => removeOpportunity(idx)} title="Remove"
                      style={{ flexShrink: 0, marginTop: 6, background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                  </div>
                );
              })}
            </div>
            <button onClick={addOpportunity} className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem', marginTop: 10 }}>
              ＋ Add another area
            </button>
          </div>

          </div>{/* end left checklist */}

          {/* ── Right: audit history ── */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '1.125rem' }}>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '0.9rem' }}>📋 Audit History</h4>
              {auditHistory.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1.5rem 0' }}>No audits saved yet. Complete the checklist and click Save Audit.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {auditHistory.map(record => {
                    // Older audits only stored a completion % as `score`; new ones store avgScore (1–5).
                    const hasAvg = typeof record.avgScore === 'number';
                    const scoreColor = hasAvg
                      ? auditScoreColor(record.avgScore)
                      : (record.score >= 80 ? '#0d9488' : record.score >= 60 ? '#f59e0b' : '#ef4444');
                    const scoreBg = scoreColor === '#0d9488' ? '#f0fdfa' : scoreColor === '#f59e0b' ? '#fffbeb' : '#fef2f2';
                    const isExp = expandedAudit === record.id;
                    const d = new Date(record.date);
                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div key={record.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.area}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{dateStr}</p>
                          </div>
                          <span style={{ background: scoreBg, color: scoreColor, fontWeight: 800, fontSize: '0.875rem', borderRadius: 8, padding: '2px 10px', border: `1px solid ${scoreColor}33`, flexShrink: 0 }}>{hasAvg ? `${record.avgScore.toFixed(1)}/5` : `${record.score}%`}</span>
                        </div>
                        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                          <button onClick={() => loadAudit(record)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#0d9488' }}>
                            📂 Load
                          </button>
                          <button onClick={() => setExpandedAudit(isExp ? null : record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#64748b' }}>
                            {isExp ? '▲' : '▼'} Details
                          </button>
                          <button onClick={() => deleteAudit(record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            🗑
                          </button>
                        </div>
                        {isExp && (
                          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: '#f8fafc', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>
                              {hasAvg && <>Score {record.avgScore.toFixed(1)}/5 · </>}{record.checked} / {record.total} items rated
                            </p>
                            {Object.keys(record.findings || {}).length > 0 && (
                              <p style={{ margin: '0 0 6px', color: '#b45309' }}>📝 {Object.keys(record.findings).length} note(s) recorded</p>
                            )}
                            {record.opportunities && record.opportunities.length > 0 && (
                              <div>
                                <p style={{ margin: '0 0 3px', fontWeight: 700, color: '#0d9488' }}>Areas of Opportunity ({record.opportunities.length})</p>
                                <ul style={{ margin: 0, paddingLeft: 16 }}>
                                  {record.opportunities.map((o, oi) => (
                                    <li key={oi} style={{ marginBottom: 2, lineHeight: 1.4 }}>{o}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waste Types Tab — Waste Walk */}
      {activeTab === 'waste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Weekly points reminder */}
          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #0d9488', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1, color: wastePtsThisWeek === 5 ? '#15803d' : '#0f2044' }}>{wastePtsThisWeek}<span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>/5</span></div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>pts this week</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontWeight: 800, margin: '0 0 2px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {wastePtsThisWeek === 5 ? '🏆 All 5 waste-walk points earned this week!' : 'Log 5 different wastes this week to earn 5 points'}
              </p>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                +1 pt per <strong>distinct</strong> waste category you log. Points reset every week — re-log fresh wastes to keep them.
                {wasteTypesThisWeek.size < 5 && <> Still to log: <strong>{wasteTypes.filter(w => !wasteTypesThisWeek.has(w.type)).map(w => w.type).join(', ')}</strong>.</>}
              </p>
            </div>
          </div>

          {/* Pareto chart + 80/20 lesson */}
          {wasteLogs.length > 0 && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '1rem' }}>📊 Waste Pareto Chart</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Auto-built from your logs — the tallest bars on the left are where most of your waste is coming from.
              </p>
              <WasteParetoChart tally={wasteTally} />
              <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.875rem 1rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f2044', margin: '0 0 4px' }}>💡 The 80/20 Rule (Pareto Principle)</p>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                  Vilfredo Pareto observed that roughly <strong>80% of results come from 20% of causes</strong>. In Lean, that means a small number of waste
                  types usually drive most of your losses. The teal line shows the <strong>cumulative %</strong>; the tools/wastes to the left of where it
                  crosses the red <strong>80% line</strong> are your "vital few" — fix those first for the biggest impact, instead of spreading effort thin
                  across every problem equally.
                </p>
              </div>
            </div>
          )}

          {/* Waste cards with Log buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '0.875rem' }}>
            {wasteTypes.map(w => {
              const loggedThisWeek = wasteTypesThisWeek.has(w.type);
              const total = wasteLogs.filter(l => l.type === w.type).length;
              return (
                <div key={w.type} className="card" style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{w.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: 0 }}>{w.type}</h4>
                        {loggedThisWeek && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 9999, padding: '1px 7px' }}>✓ +1 this week</span>}
                        {total > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b' }}>{total} logged all-time</span>}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 4px', lineHeight: 1.5 }}>{w.desc}</p>
                      <p style={{ fontSize: '0.76rem', color: '#0d9488', fontStyle: 'italic', margin: 0 }}>Example: {w.example}</p>
                    </div>
                  </div>
                  <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem', alignSelf: 'flex-start' }}
                    onClick={() => setWasteForm({ type: w.type, location: '', description: '', impact: '', countermeasure: '' })}>
                    + Log this waste
                  </button>
                </div>
              );
            })}
          </div>

          {/* Recent logs */}
          {wasteLogs.length > 0 && (
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.9rem' }}>Waste Walk Log ({wasteLogs.length})</h4>
              <style>{`
                .waste-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
                .waste-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
                .waste-scroll::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; }
              `}</style>
              <div className="waste-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'scroll', paddingRight: 6, scrollbarWidth: 'thin', scrollbarColor: '#64748b #e2e8f0' }}>
                {wasteLogs.map(l => {
                  const wt = wasteTypes.find(w => w.type === l.type);
                  const open = expandedWaste === l.id;
                  return (
                    <div key={l.id} style={{ borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                      <button onClick={() => setExpandedWaste(open ? null : l.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.875rem', background: '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: '1.1rem' }}>{wt?.icon || '🗑️'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{l.type}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}> · {l.location} · {l.date}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ padding: '0.75rem 0.875rem', background: 'white', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#0f2044' }}>What was seen:</strong> {l.description}</p>
                          {l.impact && <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#0f2044' }}>Impact:</strong> {l.impact}</p>}
                          {l.countermeasure && <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#0f2044' }}>Countermeasure:</strong> {l.countermeasure}</p>}
                          <button onClick={() => deleteWasteLog(l.id)} style={{ background: 'none', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>🗑 Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Waste log entry modal */}
      {wasteForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setWasteForm(null)}>
          <div className="card" style={{ maxWidth: 460, width: '100%', padding: '1.5rem', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: '1.5rem' }}>{wasteTypes.find(w => w.type === wasteForm.type)?.icon}</span>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1rem' }}>Log {wasteForm.type} Waste</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">Area / Location *</label>
                <input className="input" value={wasteForm.location} onChange={e => setWasteForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Assembly Line 3, Shipping dock…" />
              </div>
              <div>
                <label className="label">What did you observe? *</label>
                <textarea className="input" rows={2} value={wasteForm.description} onChange={e => setWasteForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the waste you saw…" />
              </div>
              <div>
                <label className="label">Estimated impact (optional)</label>
                <input className="input" value={wasteForm.impact} onChange={e => setWasteForm(f => ({ ...f, impact: e.target.value }))} placeholder="e.g. ~30 min/day, 5% scrap, delays shipments" />
              </div>
              <div>
                <label className="label">Countermeasure idea (optional)</label>
                <textarea className="input" rows={2} value={wasteForm.countermeasure} onChange={e => setWasteForm(f => ({ ...f, countermeasure: e.target.value }))} placeholder="What could reduce or eliminate it?" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-primary" onClick={saveWasteLog} disabled={savingWaste} style={{ flex: 1 }}>
                {savingWaste ? 'Saving…' : '💾 Save Waste Log'}
              </button>
              <button className="btn-secondary" onClick={() => setWasteForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Kaizen Log Tab */}
      {activeTab === 'kaizen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => { setShowForm(s => !s); setEditingEntry(null); }}>
              {showForm ? '✕ Cancel' : '+ Log Kaizen Event'}
            </button>
          </div>

          {showForm && !editingEntry && (
            <KaizenForm
              initial={emptyKaizen}
              title="New Kaizen Event"
              onSave={handleSaveNew}
              onCancel={() => setShowForm(false)}
            />
          )}

          {editingEntry && (
            <KaizenForm
              initial={editingEntry}
              title={`Editing: ${editingEntry.title}`}
              onSave={handleSaveEdit}
              onCancel={() => setEditingEntry(null)}
            />
          )}

          {kaizen.length === 0 && !showForm && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>🏭</p>
              <p style={{ fontWeight: 700, margin: '0 0 4px' }}>No Kaizen events logged yet.</p>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>Click "+ Log Kaizen Event" to document your first improvement event.</p>
            </div>
          )}

          {kaizen.map(k => (
            <KaizenCard key={k.id} k={k} onEdit={entry => { setEditingEntry(entry); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          ))}
        </div>
      )}
    </div>
  );
}
