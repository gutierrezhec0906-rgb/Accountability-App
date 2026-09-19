import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore, localDateStr, weekMonday } from '../utils/scoring';
import { compressImage, withTimeout } from '../utils/image';
import { generateKaizenPDF } from '../utils/moduleReports';
import NameField from '../components/NameField';
import { useSavedNames } from '../utils/savedNames';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_OPP_WORDS = 4;   // an "area of opportunity" must be described in ≥4 words
const MIN_OPPS = 3;        // need at least 3 described areas to earn the weekly 5 pts

function oppWordCount(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const fiveSItems = [
  { key: 'sort',       category: 'Sort (Seiri)',          items: ['Remove all unnecessary items from the work area','Red-tag items not needed in the next 30 days','Dispose of or relocate red-tagged items','Document what was removed and why'] },
  { key: 'setInOrder', category: 'Set in Order (Seiton)', items: ['Designate a specific place for every item','Label all locations clearly','Arrange items for ergonomic ease of use','Implement visual controls (shadow boards, floor tape)'] },
  { key: 'shine',      category: 'Shine (Seiso)',         items: ['Clean all equipment and work surfaces','Identify and fix sources of contamination','Assign cleaning responsibilities','Create daily cleaning schedule'] },
  { key: 'standardize',category: 'Standardize (Seiketsu)',items: ['Create standard operating procedures for first 3S','Post visual standards in the area','Implement color-coding system','Train all team members on standards'] },
  { key: 'sustain',    category: 'Sustain (Shitsuke)',    items: ['Conduct weekly 5S audits','Review audit scores with team','Recognize top performers','Track 5S score trends over time'] },
];
function trFiveSCategory(t, cat) { return t(`lean.fiveS.${cat.key}.category`, cat.category); }
function trFiveSItem(t, cat, i) { return t(`lean.fiveS.${cat.key}.items.${i}`, cat.items[i]); }

// Step-by-step guideline content (bullets + Pro Tip + Checkpoint) and a
// "what good looks like" reference photo per 5S step. Keyed to fiveSItems'
// `category` strings so the guide renders right above that category's audit
// checklist. Photos are static files served from client/public/5s-guides/
// (not Firestore/Storage — appConfig write is restricted to the master
// admin, and these are fixed reference images, not per-user data); the 5
// files live at sort.png / set-in-order.png / shine.png / standardize.png /
// sustain.png — a placeholder shows if one is ever missing.
const STEP_GUIDES = [
  {
    key: 'sort',
    category: 'Sort (Seiri)',
    step: 1, title: 'Sort', photo: '/5s-guides/sort.png',
    desc: 'Remove unnecessary items from the work area and separate what is needed from what is not.',
    bullets: [
      'Remove unused tools, materials, fixtures, documents and supplies.',
      'Use red tags for questionable, obsolete, damaged or unidentified items.',
      'Create a clearly marked red-tag zone with a defined review date and owner.',
      'Disposition items through approved processes; do not allow the red-tag area to become storage.',
    ],
    proTip: 'If an item has not been used in the defined review period, challenge whether it belongs at the point of use.',
    checkpoint: 'Only necessary items remain. Red-tag items have an owner, disposition date and documented decision.',
  },
  {
    key: 'setInOrder',
    category: 'Set in Order (Seiton)',
    step: 2, title: 'Set in Order', photo: '/5s-guides/set-in-order.png',
    desc: 'Arrange necessary items so they are easy to identify, retrieve, use and return.',
    bullets: [
      'Assign a designated location for tools, material, WIP, supplies and equipment.',
      'Use labels, shadow boards, rack IDs, floor tape and visual boundaries.',
      'Place frequently used items closest to the point of use.',
      'Define locations for calibrated tools, nonconforming material and controlled items.',
      'Keep aisles, exits, electrical access and emergency equipment unobstructed.',
    ],
    proTip: 'Use visual controls so a missing, misplaced or abnormal item can be recognized at a glance.',
    checkpoint: 'Every item has a labeled home and can be retrieved and returned quickly without searching.',
  },
  {
    key: 'shine',
    category: 'Shine (Seiso)',
    step: 3, title: 'Shine', photo: '/5s-guides/shine.png',
    desc: 'Clean the workplace while inspecting equipment, tooling and the surrounding area for abnormalities.',
    bullets: [
      'Schedule routine cleaning for each work area.',
      'Provide clear cleaning standards and accessible supplies.',
      'Assign ownership for zones, equipment and common areas.',
      'Inspect for leaks, wear, damage, contamination, loose hardware and unsafe conditions.',
      'Correct or report abnormalities immediately through the appropriate process.',
    ],
    proTip: 'Shine is preventive inspection in disguise — not simply housekeeping.',
    checkpoint: 'Work areas are clean, inspection findings are visible, and abnormalities are documented and addressed.',
  },
  {
    key: 'standardize',
    category: 'Standardize (Seiketsu)',
    step: 4, title: 'Standardize', photo: '/5s-guides/standardize.png',
    desc: 'Create repeatable visual standards so the best known method is consistently followed.',
    bullets: [
      'Use standardized 5S checklists across departments and shifts.',
      'Apply consistent labels, color codes, floor markings and storage identification.',
      'Post visual standards at the point of use.',
      'Document expected conditions with photos, diagrams or simple SOPs.',
      'Update standards when improvements are validated and adopted.',
    ],
    proTip: 'A standard should make the normal condition obvious and make deviations easy to see.',
    checkpoint: 'Standards are visible, understood, current and consistently followed by employees across shifts.',
  },
  {
    key: 'sustain',
    category: 'Sustain (Shitsuke)',
    step: 5, title: 'Sustain', photo: '/5s-guides/sustain.png',
    desc: 'Make 5S part of daily work through ownership, audits, coaching and continuous improvement.',
    bullets: [
      'Conduct routine 5S audits using standardized checklists.',
      'Assign area owners and define responsibilities.',
      'Review results and open actions during regular team meetings.',
      'Display audit scores, trends and improvement actions on visual boards.',
      'Recognize improvements and reinforce good practices.',
      'Correct recurring findings with documented actions and follow-up.',
    ],
    proTip: '5S is not a one-time cleanup event. Discipline and leadership follow-through make the system sustainable.',
    checkpoint: 'Audits are current, responsibilities are clear, corrective actions are tracked, and improvements remain in place.',
  },
];
const STEP_GUIDE_BY_CATEGORY = Object.fromEntries(STEP_GUIDES.map(g => [g.category, g]));

function trGuideTitle(t, g) { return t(`lean.stepGuides.${g.key}.title`, g.title); }
function trGuideDesc(t, g) { return t(`lean.stepGuides.${g.key}.desc`, g.desc); }
function trGuideBullet(t, g, i) { return t(`lean.stepGuides.${g.key}.bullets.${i}`, g.bullets[i]); }
function trGuideProTip(t, g) { return t(`lean.stepGuides.${g.key}.proTip`, g.proTip); }
function trGuideCheckpoint(t, g) { return t(`lean.stepGuides.${g.key}.checkpoint`, g.checkpoint); }

// Full-size "what good looks like" photo viewer for a 5S step.
function StepPhotoLightbox({ guide, onClose }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  if (!guide) return null;
  const title = trGuideTitle(t, guide);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', maxWidth: 720, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
          <p style={{ margin: 0, fontWeight: 800, color: '#0f2044', fontSize: '0.9rem' }}>{t('lean.stepLightboxTitle', 'Step {{step}}: {{title}} — what good looks like', { step: guide.step, title })}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflow: 'auto', background: '#f8fafc' }}>
          {!failed ? (
            <img src={guide.photo} alt={t('lean.stepExampleAlt', '{{title}} example', { title })} onError={() => setFailed(true)} style={{ width: '100%', display: 'block' }} />
          ) : (
            <p style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{t('lean.stepPhotoComingSoon', '📷 Reference photo coming soon for this step.')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// 1–5 maturity rating applied to each 5S audit item. The audit SCORE is the
// average of all rated items (1–5). The percentage shown separately is just
// completion — how many of the items have been rated.
const RATING_SCALE = [
  { key: 'notPracticed', value: 1, label: 'Not Practiced', color: '#ef4444', desc: 'No evidence the practice is in place or being followed.' },
  { key: 'emerging',     value: 2, label: 'Emerging',      color: '#f97316', desc: 'Attempted occasionally and inconsistently; major gaps remain.' },
  { key: 'developing',   value: 3, label: 'Developing',    color: '#f59e0b', desc: 'Practiced regularly but not yet standardized or sustained.' },
  { key: 'proficient',   value: 4, label: 'Proficient',    color: '#22c55e', desc: 'Consistently practiced and standardized; only minor gaps.' },
  { key: 'excellence',   value: 5, label: 'Excellence',    color: '#0d9488', desc: 'Fully embedded, sustained, and continuously improved — a model example.' },
];
function trRatingLabel(t, r) { return t(`lean.ratingScale.${r.key}.label`, r.label); }
function trRatingDesc(t, r) { return t(`lean.ratingScale.${r.key}.desc`, r.desc); }
// Color for an average 5S score (1–5 scale).
const auditScoreColor = (v) => v >= 4 ? '#0d9488' : v >= 3 ? '#f59e0b' : v >= 1 ? '#ef4444' : '#94a3b8';

const wasteTypes = [
  { key: 'defects',        type: 'Defects',         icon: '❌', desc: 'Work requiring rework or scrap',                    example: 'Parts failing inspection, customer returns' },
  { key: 'overproduction', type: 'Overproduction',  icon: '⚙️', desc: 'Producing more than customer demand',               example: 'Making parts before they are needed' },
  { key: 'waiting',        type: 'Waiting',         icon: '⏳', desc: 'Idle time when value is not being added',            example: 'Machine downtime, waiting for approvals' },
  { key: 'nonUtilizedTalent', type: 'Non-Utilized Talent', icon: '💡', desc: "Underutilizing people's knowledge and creativity", example: 'Not involving operators in improvement' },
  { key: 'transportation', type: 'Transportation',  icon: '🚚', desc: 'Unnecessary movement of materials or products',     example: 'Moving parts between distant workstations' },
  { key: 'inventory',      type: 'Inventory',       icon: '📦', desc: 'Excess materials, WIP, or finished goods',           example: 'Large batch sizes sitting idle' },
  { key: 'motion',         type: 'Motion',          icon: '🏃', desc: 'Unnecessary movement of people',                    example: 'Searching for tools or walking for supplies' },
  { key: 'extraProcessing',type: 'Extra-Processing',icon: '🔄', desc: 'More work or quality than required',                example: 'Extra steps not adding customer value' },
];
// NOTE: `type` stays in English — it is stored as Firestore data (wasteLogs[].type),
// compared with === throughout, and used as a React key/dict key. Only desc/example are displayed+translated.
function trWasteDesc(t, w) { return t(`lean.wasteTypes.${w.key}.desc`, w.desc); }
function trWasteExample(t, w) { return t(`lean.wasteTypes.${w.key}.example`, w.example); }

const PHASES = [
  { key: 'prepare',    label: 'Phase 1: Prepare',    icon: '📋' },
  { key: 'event',      label: 'Phase 2: Event',       icon: '⚡' },
  { key: 'sustain',    label: 'Phase 3: Sustain',     icon: '📈' },
];
function trPhaseLabel(t, p) { return t(`lean.phases.${p.key}`, p.label); }

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
// `status` values are stored data (kaizenLog[].status) compared with statusColors/statusOptions,
// so they stay in English; only the displayed label is translated.
const statusKeys = { Preparing: 'preparing', 'In Progress': 'inProgress', 'Report-Out': 'reportOut', Sustaining: 'sustaining', Complete: 'complete' };
function trStatus(t, s) { return t(`lean.status.${statusKeys[s] || s}`, s); }

const WASTES = ['Defects','Overproduction','Waiting','Non-Utilized Talent','Transportation','Inventory','Motion','Extra-Processing'];
// WASTES values are stored on kaizenLog[].wastesIdentified and compared with ===, so kept in
// English; translate the displayed pill text via trWasteName (maps back through wasteTypes).
const WASTE_KEY_BY_NAME = Object.fromEntries(wasteTypes.map(w => [w.type, w.key]));
function trWasteName(t, w) { return t(`lean.wasteTypes.${WASTE_KEY_BY_NAME[w] || w}.name`, w); }

const tabs = [{ id: '5s', label: '5S Audit' }, { id: 'waste', label: 'Waste Walk' }, { id: 'kaizen', label: 'Kaizen Log' }];
function trTabLabel(t, tab) { return t(`lean.tabs.${tab.id}`, tab.label); }

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
  const { t } = useTranslation();
  const [form, setForm]       = useState({
    ...emptyKaizen,
    ...initial,
    wastesIdentified: Array.isArray(initial?.wastesIdentified) ? initial.wastesIdentified : [],
    followUpActions: normalizeFollowUps(initial),
    auditDates: { d30: '', d60: '', d90: '', ...(initial?.auditDates || {}) },
  });
  const [phase, setPhase]     = useState('prepare');
  const { names: savedNames, remember: rememberName } = useSavedNames();

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
          <label className="label" style={{ margin: 0 }}>{t('lean.kaizen.statusLabel', 'Status:')}</label>
          <select className="input" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
            value={form.status} onChange={e => set('status', e.target.value)}>
            {statusOptions.map(s => <option key={s} value={s}>{trStatus(t, s)}</option>)}
          </select>
        </div>
      </div>

      {/* Event title */}
      <div style={{ marginBottom: '1rem' }}>
        <label className="label">{t('lean.kaizen.eventTitle', 'Kaizen Event Title')}</label>
        <input className="input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('lean.kaizen.eventTitlePlaceholder', 'e.g. Reduce changeover time on Line 3')} />
      </div>

      {/* Phase tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {PHASES.map((p, i) => (
          <button key={p.key} onClick={() => setPhase(p.key)} type="button"
            style={{ padding: '0.5rem 1rem', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: '0.78rem', border: 'none', cursor: 'pointer',
              background: phase === p.key ? '#0f2044' : '#f1f5f9', color: phase === p.key ? 'white' : '#64748b',
              borderBottom: phase === p.key ? '2px solid #0f2044' : 'none', marginBottom: phase === p.key ? -2 : 0 }}>
            {p.icon} {trPhaseLabel(t, p)}
          </button>
        ))}
      </div>

      {/* Phase 1: Prepare */}
      {phase === 'prepare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '0.75rem 1rem', borderLeft: '4px solid #16a34a' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', margin: '0 0 4px', textTransform: 'uppercase' }}>{t('lean.kaizen.phase1.header', 'Phase 1 — Before the Event')}</p>
            <p style={{ fontSize: '0.78rem', color: '#374151', margin: 0 }}>{t('lean.kaizen.phase1.desc', 'Define scope, goal, team, and gather baseline data before the event begins.')}</p>
          </div>
          <div>
            <label className="label">{t('lean.kaizen.scopeLabel', '1. Scope — Specific process or area')}</label>
            <textarea className="input" rows={2} value={form.scope} onChange={e => set('scope', e.target.value)} placeholder={t('lean.kaizen.scopePlaceholder', "e.g. Reduce changeover time on Line 3 (not 'fix all of manufacturing')")} />
          </div>
          <div>
            <label className="label">{t('lean.kaizen.goalLabel', '2. Goal — Measurable target')}</label>
            <textarea className="input" rows={2} value={form.goal} onChange={e => set('goal', e.target.value)} placeholder={t('lean.kaizen.goalPlaceholder', 'e.g. Cut cycle time by 30%, reduce defects by 50%')} />
          </div>
          <div>
            <label className="label">{t('lean.kaizen.teamLabel', '3. Team — Cross-functional members, facilitator, sponsor')}</label>
            <textarea className="input" rows={3} value={form.team} onChange={e => set('team', e.target.value)} placeholder={t('lean.kaizen.teamPlaceholder', 'List team members, roles, and the sponsor with authority to approve changes...')} />
          </div>
          <div>
            <label className="label">{t('lean.kaizen.baselineLabel', '4. Baseline Data — Current-state metrics')}</label>
            <textarea className="input" rows={3} value={form.baselineData} onChange={e => set('baselineData', e.target.value)} placeholder={t('lean.kaizen.baselinePlaceholder', 'Current metrics, process maps, time studies, defect rates...')} />
          </div>
        </div>
      )}

      {/* Phase 2: Event */}
      {phase === 'event' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: '0.75rem 1rem', borderLeft: '4px solid #2563eb' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', margin: '0 0 4px', textTransform: 'uppercase' }}>{t('lean.kaizen.phase2.header', 'Phase 2 — The Kaizen Event')}</p>
            <p style={{ fontSize: '0.78rem', color: '#374151', margin: 0 }}>{t('lean.kaizen.phase2.desc', 'Understand current state, analyze root causes, design and implement the future state.')}</p>
          </div>

          {/* 2a Current State */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>{t('lean.kaizen.currentState.header', 'A. Understand Current State')}</p>
            <div style={{ marginBottom: 12 }}>
              <label className="label">{t('lean.kaizen.gembaLabel', 'Gemba Walk & Process Map Findings')}</label>
              <textarea className="input" rows={3} value={form.gembaFindings} onChange={e => set('gembaFindings', e.target.value)} placeholder={t('lean.kaizen.gembaPlaceholder', 'What did you observe walking the process? Value stream findings...')} />
            </div>
            <div>
              <label className="label">{t('lean.kaizen.wastesLabel', 'Wastes Identified (DOWNTIME)')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {WASTES.map(w => (
                  <button key={w} type="button" onClick={() => toggleWaste(w)}
                    style={{ padding: '4px 12px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                      background: (form.wastesIdentified || []).includes(w) ? '#0f2044' : 'white',
                      color:      (form.wastesIdentified || []).includes(w) ? 'white'   : '#475569',
                      borderColor: (form.wastesIdentified || []).includes(w) ? '#0f2044' : '#e2e8f0' }}>
                    {trWasteName(t, w)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2b Root Cause */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>{t('lean.kaizen.rootCause.header', 'B. Root Cause Analysis')}</p>
            <label className="label">{t('lean.kaizen.rootCauseLabel', 'Findings — 5 Whys, Fishbone, Pareto')}</label>
            <textarea className="input" rows={4} value={form.rootCauses} onChange={e => set('rootCauses', e.target.value)} placeholder={t('lean.kaizen.rootCausePlaceholder', 'Root causes identified (not just symptoms). Reference 5 Whys or fishbone results...')} />
          </div>

          {/* 2c Future State */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>{t('lean.kaizen.futureState.header', 'C. Future State Design')}</p>
            <label className="label">{t('lean.kaizen.futureStateLabel', 'Solutions, Future-State Process Map & Priorities')}</label>
            <textarea className="input" rows={4} value={form.futureState} onChange={e => set('futureState', e.target.value)} placeholder={t('lean.kaizen.futureStatePlaceholder', 'Brainstormed solutions, future-state map, prioritized by impact vs. effort...')} />
          </div>

          {/* 2d Implement */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>{t('lean.kaizen.implement.header', 'D. Implement & Test')}</p>
            <label className="label">{t('lean.kaizen.implementLabel', 'Changes Made, Test Results & Adjustments')}</label>
            <textarea className="input" rows={3} value={form.implementationNotes} onChange={e => set('implementationNotes', e.target.value)} placeholder={t('lean.kaizen.implementPlaceholder', 'Physical/process changes made on the spot, small-scale tests, adjustments...')} />
          </div>

          {/* 2e Standardize */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', margin: '0 0 10px' }}>{t('lean.kaizen.standardize.header', 'E. Standardize & Report-Out')}</p>
            <label className="label">{t('lean.kaizen.standardizeLabel', 'Standard Work Documentation & Leadership Presentation Notes')}</label>
            <textarea className="input" rows={3} value={form.standardWork} onChange={e => set('standardWork', e.target.value)} placeholder={t('lean.kaizen.standardizePlaceholder', 'New standard work, training completed, results presented to leadership...')} />
          </div>
        </div>
      )}

      {/* Phase 3: Sustain */}
      {phase === 'sustain' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fdf4ff', borderRadius: 10, padding: '0.75rem 1rem', borderLeft: '4px solid #9333ea' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9333ea', margin: '0 0 4px', textTransform: 'uppercase' }}>{t('lean.kaizen.phase3.header', 'Phase 3 — After the Event')}</p>
            <p style={{ fontSize: '0.78rem', color: '#374151', margin: 0 }}>{t('lean.kaizen.phase3.desc', 'Monitor results, assign follow-up owners, audit, and celebrate wins.')}</p>
          </div>
          <div>
            <label className="label">{t('lean.kaizen.resultsLabel', '1. Results Tracking — Daily/weekly metrics vs. target')}</label>
            <textarea className="input" rows={3} value={form.resultsTracking} onChange={e => set('resultsTracking', e.target.value)} placeholder={t('lean.kaizen.resultsPlaceholder', 'How are results being tracked? Current metrics vs. baseline target...')} />
          </div>
          <div>
            <label className="label">{t('lean.kaizen.followUpLabel', '2. Follow-Up Owners — Open action items with owners & deadlines')}</label>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 32px', gap: 6, marginBottom: 6, marginTop: 4 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>{t('lean.kaizen.grid.action', 'Action')}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>{t('lean.kaizen.grid.owner', 'Owner')}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>{t('lean.kaizen.grid.deadline', 'Deadline')}</span>
              <span />
            </div>
            {/* Data rows */}
            {form.followUpActions.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 32px', gap: 6, marginBottom: 6 }}>
                <input className="input" style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                  placeholder={t('lean.kaizen.grid.actionPlaceholder', 'Describe the action…')} value={row.action}
                  onChange={e => updateFollowUp(i, 'action', e.target.value)} />
                <NameField inputStyle={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }} names={savedNames}
                  placeholder={t('lean.kaizen.grid.ownerPlaceholder', 'Owner name')} value={row.owner}
                  onChange={e => updateFollowUp(i, 'owner', e.target.value)} />
                <input className="input" type="date" style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                  value={row.deadline}
                  onChange={e => updateFollowUp(i, 'deadline', e.target.value)} />
                <button type="button" onClick={() => removeFollowUp(i)} title={t('lean.kaizen.grid.removeRow', 'Remove row')}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={addFollowUp}
              style={{ marginTop: 4, background: '#f0fdfa', border: '1.5px dashed #0d9488', borderRadius: 8, color: '#0d9488', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 1rem', cursor: 'pointer' }}>
              {t('lean.kaizen.grid.addRow', '+ Add Row')}
            </button>
          </div>
          <div>
            <label className="label">{t('lean.kaizen.auditScheduleLabel', '3. Audit Schedule — 30 / 60 / 90 day checks')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 4 }}>
              {[
                { key: 'd30', label: t('lean.kaizen.audit30', '30-Day Audit') },
                { key: 'd60', label: t('lean.kaizen.audit60', '60-Day Audit') },
                { key: 'd90', label: t('lean.kaizen.audit90', '90-Day Audit') },
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
            <label className="label">{t('lean.kaizen.winsLabel', '4. Wins — Results & momentum to share with the team')}</label>
            <textarea className="input" rows={3} value={form.wins} onChange={e => set('wins', e.target.value)} placeholder={t('lean.kaizen.winsPlaceholder', 'Quantified improvements, team recognition, communication plan...')} />
          </div>
        </div>
      )}

      {/* Phase navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {phaseIdx > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setPhase(PHASES[phaseIdx - 1].key)}>{t('lean.kaizen.prevPhase', '← Previous Phase')}</button>
          )}
          {phaseIdx < PHASES.length - 1 && (
            <button type="button" className="btn-primary" onClick={() => setPhase(PHASES[phaseIdx + 1].key)}>{t('lean.kaizen.nextPhase', 'Next Phase →')}</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t('lean.kaizen.cancel', 'Cancel')}</button>
          <button type="button" className="btn-primary" onClick={() => {
            form.followUpActions.forEach(r => rememberName(r.owner));
            onSave({
              ...form,
              followUpActions: form.followUpActions.filter(r => r.action.trim() || r.owner.trim() || r.deadline),
            });
          }}>{t('lean.kaizen.saveKaizen', '💾 Save Kaizen')}</button>
        </div>
      </div>
    </div>
  );
}

function KaizenCard({ k, onEdit }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const color = statusColors[k.status] || '#64748b';

  const phases2Check = [
    { label: t('lean.kaizen.grid.scope', 'Scope'),                    val: k.scope },
    { label: t('lean.kaizen.goalWord', 'Goal'),                       val: k.goal },
    { label: t('lean.kaizen.teamWord', 'Team'),                       val: k.team },
    { label: t('lean.kaizen.baselineWord', 'Baseline'),                val: k.baselineData },
    { label: t('lean.kaizen.gembaWord', 'Gemba Findings'),             val: k.gembaFindings },
    { label: t('lean.kaizen.rootCausesWord', 'Root Causes'),           val: k.rootCauses },
    { label: t('lean.kaizen.futureStateWord', 'Future State'),         val: k.futureState },
    { label: t('lean.kaizen.implementationWord', 'Implementation'),    val: k.implementationNotes },
    { label: t('lean.kaizen.standardWorkWord', 'Standard Work'),       val: k.standardWork },
    { label: t('lean.kaizen.resultsWord', 'Results Tracking'),         val: k.resultsTracking },
    { label: t('lean.kaizen.followUpWord', 'Follow-Up Owners'),        val: (k.followUpActions?.length ? 'y' : '') || k.followUpOwners },
    { label: t('lean.kaizen.winsWord', 'Wins'),                        val: k.wins },
  ];
  const filled = phases2Check.filter(p => p.val).length;
  const pct    = Math.round((filled / phases2Check.length) * 100);

  return (
    <div className="card" style={{ padding: '1.125rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{k.title}</h4>
            <span style={{ background: color + '18', color, borderRadius: 9999, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${color}44` }}>{trStatus(t, k.status)}</span>
          </div>
          {k.goal && <p style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: 600, margin: '0 0 4px' }}>🎯 {k.goal}</p>}
          <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: 8 }}>
            {k.scope && <span>📂 {k.scope}</span>}
            <span>📅 {k.date}</span>
            {k.wastesIdentified?.length > 0 && <span>⚠️ {t('lean.kaizen.wastesIdentifiedCount', '{{count}} waste identified', { count: k.wastesIdentified.length })}</span>}
          </div>
          {/* Completion progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 5, maxWidth: 160 }}>
              <div style={{ height: 5, borderRadius: 9999, background: '#0d9488', width: `${pct}%`, transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('lean.kaizen.pctComplete', '{{pct}}% complete', { pct })}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => onEdit(k)}
            style={{ background: 'none', border: '1px solid #0d9488', borderRadius: 8, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#0d9488', cursor: 'pointer' }}>
            {t('lean.kaizen.edit', '✏️ Edit')}
          </button>
          <button onClick={() => generateKaizenPDF(k)}
            style={{ background: 'none', border: '1px solid #64748b', borderRadius: 8, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
            {t('lean.kaizen.pdf', '🖨️ PDF')}
          </button>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
            {expanded ? t('lean.kaizen.collapse', '▲ Collapse') : t('lean.kaizen.details', '▼ Details')}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Phase 1 */}
          {(k.scope || k.goal || k.team || k.baselineData) && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>{t('lean.kaizen.phase1Short', '📋 Phase 1: Prepare')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[[t('lean.kaizen.grid.scope', 'Scope'), k.scope], [t('lean.kaizen.goalWord', 'Goal'), k.goal], [t('lean.kaizen.teamWord', 'Team'), k.team], [t('lean.kaizen.baselineDataWord', 'Baseline Data'), k.baselineData]].map(([lbl, val]) => val && (
                  <div key={lbl}><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{lbl}: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{val}</span></div>
                ))}
              </div>
            </div>
          )}
          {/* Phase 2 */}
          {(k.gembaFindings || k.wastesIdentified?.length || k.rootCauses || k.futureState || k.implementationNotes || k.standardWork) && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>{t('lean.kaizen.phase2Short', '⚡ Phase 2: Event')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {k.wastesIdentified?.length > 0 && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('lean.kaizen.wastesWord', 'Wastes:')} </span>
                    {k.wastesIdentified.map(w => <span key={w} style={{ fontSize: '0.68rem', background: '#0f204418', color: '#0f2044', borderRadius: 9999, padding: '1px 8px', marginLeft: 4, fontWeight: 700 }}>{trWasteName(t, w)}</span>)}
                  </div>
                )}
                {[[t('lean.kaizen.gembaWord', 'Gemba Findings'), k.gembaFindings], [t('lean.kaizen.rootCausesWord', 'Root Causes'), k.rootCauses], [t('lean.kaizen.futureStateWord', 'Future State'), k.futureState], [t('lean.kaizen.implementationWord', 'Implementation'), k.implementationNotes], [t('lean.kaizen.standardWorkWord', 'Standard Work'), k.standardWork]].map(([lbl, val]) => val && (
                  <div key={lbl}><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{lbl}: </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{val}</span></div>
                ))}
              </div>
            </div>
          )}
          {/* Phase 3 */}
          {(k.resultsTracking || k.followUpOwners || k.followUpActions?.length || k.auditSchedule || k.auditDates?.d30 || k.auditDates?.d60 || k.auditDates?.d90 || k.wins) && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>{t('lean.kaizen.phase3Short', '📈 Phase 3: Sustain')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {k.resultsTracking && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('lean.kaizen.resultsWordColon', 'Results:')} </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.resultsTracking}</span></div>
                )}
                {/* Follow-up action grid */}
                {k.followUpActions?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('lean.kaizen.followUpWordColon', 'Follow-Up Owners:')}</span>
                    <div style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: 0, background: '#f8fafc', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        <span style={{ padding: '4px 8px' }}>{t('lean.kaizen.grid.action', 'Action')}</span>
                        <span style={{ padding: '4px 8px' }}>{t('lean.kaizen.grid.owner', 'Owner')}</span>
                        <span style={{ padding: '4px 8px' }}>{t('lean.kaizen.grid.deadline', 'Deadline')}</span>
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
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('lean.kaizen.followUpLegacyColon', 'Follow-Up:')} </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.followUpOwners}</span></div>
                )}
                {(k.auditDates?.d30 || k.auditDates?.d60 || k.auditDates?.d90) ? (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('lean.kaizen.auditScheduleColon', 'Audit Schedule:')} </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {[[t('lean.kaizen.day30', '30-day'), k.auditDates.d30], [t('lean.kaizen.day60', '60-day'), k.auditDates.d60], [t('lean.kaizen.day90', '90-day'), k.auditDates.d90]]
                        .filter(([, v]) => v).map(([lbl, v]) => `${lbl}: ${v}`).join('  ·  ')}
                    </span>
                  </div>
                ) : k.auditSchedule && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('lean.kaizen.auditScheduleColon', 'Audit Schedule:')} </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.auditSchedule}</span></div>
                )}
                {k.wins && (
                  <div><span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('lean.kaizen.winsWordColon', 'Wins:')} </span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.wins}</span></div>
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

const PERIODS = [
  { key: 'weekly',    label: 'Weekly' },
  { key: 'monthly',   label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
];
function trPeriodLabel(t, p) { return t(`lean.periods.${p.key}`, p.label); }

function bucketKeyAndLabel(dateStr, period) {
  const d = new Date(dateStr + 'T12:00:00');
  if (period === 'weekly') {
    const key = weekMonday(dateStr);
    const kd = new Date(key + 'T12:00:00');
    return { key, label: kd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
  }
  if (period === 'monthly') {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) };
  }
  // quarterly
  const q = Math.floor(d.getMonth() / 3) + 1;
  const key = `${d.getFullYear()}-Q${q}`;
  return { key, label: `Q${q} ${d.getFullYear()}` };
}

// Bucket an area's audits by period, averaging avgScore within each bucket.
function buildTrendPoints(audits, period) {
  const buckets = new Map();
  for (const a of audits) {
    if (typeof a.avgScore !== 'number' || !a.date) continue;
    const dateOnly = a.date.split('T')[0];
    const { key, label } = bucketKeyAndLabel(dateOnly, period);
    if (!buckets.has(key)) buckets.set(key, { key, label, sum: 0, count: 0 });
    const b = buckets.get(key);
    b.sum += a.avgScore;
    b.count += 1;
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(b => ({ key: b.key, label: b.label, avg: b.sum / b.count }));
}

// 0–5 scale line chart matching ScoreLineChart's visual language.
function FiveSTrendChart({ points }) {
  const W = 480, H = 160, PAD_L = 30, PAD_R = 16, PAD_T = 12, PAD_B = 32;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (points.length === 0) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center', padding: '0 1rem' }}>
        No audits logged for this area yet
      </div>
    );
  }

  if (points.length === 1) {
    return (
      <div style={{ height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="22" fill="#f0fdfa" stroke="#0d9488" strokeWidth="3" />
          <text x="30" y="34" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0d9488">{points[0].avg.toFixed(1)}</text>
        </svg>
        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>{points[0].label} — audit again to see the trend</p>
      </div>
    );
  }

  function px(i) { return PAD_L + (i / (points.length - 1)) * chartW; }
  function py(v) { return PAD_T + chartH - (v / 5) * chartH; }

  const pts = points.map((p, i) => [px(i), py(p.avg)]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
    d += ` C ${cpx} ${pts[i - 1][1]}, ${cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`;
  }
  const fillD = d + ` L ${pts[pts.length - 1][0]} ${PAD_T + chartH} L ${pts[0][0]} ${PAD_T + chartH} Z`;

  const step = Math.ceil(points.length / 4);
  const xLabels = points.filter((_, i) => i % step === 0 || i === points.length - 1);

  const delta = points[points.length - 1].avg - points[points.length - 2].avg;
  const deltaColor = delta > 0 ? '#15803d' : delta < 0 ? '#dc2626' : '#94a3b8';
  const deltaArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="fiveSTrendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
          </linearGradient>
          <clipPath id="fiveSTrendClip">
            <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {[0, 1, 2, 3, 4, 5].map(tick => {
          const y = py(tick);
          return (
            <g key={tick}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{tick}</text>
            </g>
          );
        })}

        <path d={fillD} fill="url(#fiveSTrendGrad)" clipPath="url(#fiveSTrendClip)" />
        <path d={d} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#fiveSTrendClip)" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke="#0d9488" strokeWidth="2" clipPath="url(#fiveSTrendClip)" />
        ))}

        {xLabels.map((p) => {
          const idx = points.indexOf(p);
          return (
            <text key={p.key} x={px(idx)} y={H - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
          );
        })}

        <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="#e2e8f0" strokeWidth="1" />
      </svg>
      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: deltaColor, textAlign: 'center', margin: '4px 0 0' }}>
        {deltaArrow} {delta > 0 ? '+' : ''}{delta.toFixed(1)} vs last period
      </p>
    </div>
  );
}

// Bar chart of the last 8 individual audit records for one area — date +
// raw score per audit, distinct from FiveSTrendChart's period-bucketed
// average line above it.
function FiveSRecordsBarChart({ records }) {
  const W = 480, H = 160, PAD_L = 30, PAD_R = 16, PAD_T = 18, PAD_B = 32;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (records.length === 0) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center', padding: '0 1rem' }}>
        No audits logged for this area yet
      </div>
    );
  }

  const n = records.length;
  const slot = chartW / n;
  const barW = Math.min(36, slot * 0.6);
  function cx(i) { return PAD_L + slot * (i + 0.5); }
  function py(v) { return PAD_T + chartH - (v / 5) * chartH; }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 1, 2, 3, 4, 5].map(tick => {
        const y = py(tick);
        return (
          <g key={tick}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{tick}</text>
          </g>
        );
      })}
      {records.map((r, i) => {
        const x = cx(i);
        const y = py(r.avgScore);
        const barH = PAD_T + chartH - y;
        const color = auditScoreColor(r.avgScore);
        const label = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <g key={r.id}>
            <rect x={x - barW / 2} y={y} width={barW} height={barH} fill={color} rx="3" />
            <text x={x} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{r.avgScore.toFixed(1)}</text>
            <text x={x} y={H - 4} textAnchor="middle" fontSize="9.5" fill="#94a3b8">{label}</text>
          </g>
        );
      })}
      <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function Lean() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('5s');
  const [fiveSSubTab, setFiveSSubTab] = useState('checklist'); // 'checklist' | 'history' | 'progress'
  const [checks, setChecks]       = useState({});
  const [auditAreaId, setAuditAreaId] = useState('');
  const [findings, setFindings]   = useState({});
  const [opportunities, setOpportunities] = useState(['', '', '']);
  const [expandedItem, setExpandedItem] = useState(null);
  const [lightboxGuide, setLightboxGuide] = useState(null);
  const [openGuides, setOpenGuides] = useState({}); // { [category]: bool } — step guideline collapse state
  const [auditHistory, setAuditHistory] = useState([]);
  const [expandedAudit, setExpandedAudit] = useState(null);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(true);
  const [weekPtsEarned, setWeekPtsEarned] = useState(false);
  const [fiveSAreas, setFiveSAreas] = useState([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [progressPeriod, setProgressPeriod] = useState('weekly');
  const [progressAreaId, setProgressAreaId] = useState('');
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

  async function handleImageUpload(key, e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error(t('lean.toast.imageTooLarge', 'Image is too large (max 25 MB)')); return; }
    try {
      const { preview } = await compressImage(file);
      setFinding(key, 'image', preview);
    } catch {
      if (file.size > 5 * 1024 * 1024) { toast.error(t('lean.toast.photoProcessFailed', "Couldn't process this photo. Try a smaller one.")); return; }
      const reader = new FileReader();
      reader.onload = ev => setFinding(key, 'image', ev.target.result);
      reader.readAsDataURL(file);
    }
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
        setFiveSAreas(data.fiveSAreas || []);
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

  // Pick a waste photo. We compress it in the browser first so the upload is small
  // and fast on mobile. Stores a ready-to-upload JPEG blob + a preview data URL.
  async function pickWastePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error(t('lean.toast.chooseImageFile', 'Please choose an image file'));
    if (file.size > 25 * 1024 * 1024) return toast.error(t('lean.toast.imageTooLarge', 'Image is too large (max 25 MB)'));
    try {
      const { blob, preview } = await compressImage(file);
      setWasteForm(f => ({ ...f, imageBlob: blob, imagePreview: preview }));
    } catch (err) {
      // Browser couldn't decode/resize (rare) — fall back to the original file,
      // but only if it's small enough to upload reliably.
      console.error('image compress failed, using original', err);
      if (file.size > 5 * 1024 * 1024) return toast.error(t('lean.toast.photoProcessFailed', "Couldn't process this photo. Try a smaller one."));
      const reader = new FileReader();
      reader.onload = () => setWasteForm(f => ({ ...f, imageBlob: file, imagePreview: reader.result }));
      reader.readAsDataURL(file);
    }
  }

  async function saveWasteLog() {
    if (!wasteForm || !currentUser) return;
    if (!wasteForm.location.trim() || !wasteForm.description.trim()) {
      return toast.error(t('lean.toast.fillLocationDescription', 'Please fill in the location and what you observed'));
    }
    setSavingWaste(true);
    try {
      const now = new Date();
      const id = now.getTime().toString();
      // Upload the optional photo to Storage and keep only the URL on the log
      // entry (wasteLogs is an array on the user doc — base64 would blow the 1 MB
      // document limit, so the image lives in Storage, not Firestore).
      let photoUrl = '';
      if (wasteForm.imageBlob) {
        try {
          const sref = ref(storage, `wasteWalk/${currentUser.uid}/${id}.jpg`);
          // Time-box the upload so a stalled mobile connection can't hang "Saving…".
          await withTimeout(uploadBytes(sref, wasteForm.imageBlob, { contentType: 'image/jpeg' }), 45000, 'Photo upload');
          photoUrl = await withTimeout(getDownloadURL(sref), 15000, 'Photo link');
        } catch (imgErr) {
          console.error('waste photo upload failed', imgErr);
          toast.error(t('lean.toast.photoUploadFailed', 'Photo upload failed or timed out — saving the log without it.'));
        }
      }
      const entry = {
        id,
        type: wasteForm.type,
        location: wasteForm.location.trim(),
        description: wasteForm.description.trim(),
        impact: (wasteForm.impact || '').trim(),
        countermeasure: (wasteForm.countermeasure || '').trim(),
        photoUrl,
        date: localDateStr(now),
        savedAt: now.toISOString(),
      };
      // Is this a NEW distinct category for the current 7-day window? (drives the +1 point)
      const isNewCategoryThisWeek = !wasteLogs.some(l => l.type === entry.type && (l.date || '') >= wasteCutoff);
      const updated = [entry, ...wasteLogs].slice(0, 200);
      await setDoc(doc(db, 'users', currentUser.uid), { wasteLogs: updated }, { merge: true });
      setWasteLogs(updated);
      setWasteForm(null);

      const trType = trWasteName(t, entry.type);
      if (isNewCategoryThisWeek && wastePtsThisWeek < 5) {
        await logPointEvent(currentUser.uid, {
          points: 1,
          toolLabel: 'Waste Walk Log',
          reason: `Logged ${entry.type} waste at ${entry.location}`,
        });
        await calculateScore(currentUser.uid);
        toast.success(t('lean.toast.wasteLoggedWithPoint', '{{type}} logged! +1 pt — {{count}}/5 categories this week.', { type: trType, count: Math.min(5, wasteTypesThisWeek.size + 1) }), { duration: 4000 });
      } else {
        await calculateScore(currentUser.uid);
        toast.success(t('lean.toast.wasteLogged', '{{type}} logged. (Log a different waste type to earn more points this week.)', { type: trType }));
      }
    } catch (e) { console.error(e); toast.error(t('lean.toast.saveFailed', 'Save failed')); }
    setSavingWaste(false);
  }

  async function deleteWasteLog(id) {
    const updated = wasteLogs.filter(l => l.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { wasteLogs: updated }, { merge: true });
    setWasteLogs(updated);
    toast.success(t('lean.toast.wasteLogDeleted', 'Waste log deleted'));
  }

  async function addArea() {
    const name = newAreaName.trim();
    if (!name) return toast.error(t('lean.toast.enterAreaName', 'Please enter an area name'));
    if (fiveSAreas.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      return toast.error(t('lean.toast.areaAlreadyExists', '"{{name}}" is already in your areas list', { name }));
    }
    if (!currentUser) return toast.error(t('lean.toast.notLoggedIn', 'Not logged in'));
    const area = { id: Date.now().toString(), name, createdAt: new Date().toISOString() };
    const updated = [...fiveSAreas, area];
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { fiveSAreas: updated }, { merge: true });
      setFiveSAreas(updated);
      setNewAreaName('');
      toast.success(t('lean.toast.addedArea', 'Added area "{{name}}"', { name }));
    } catch (e) { toast.error(t('lean.toast.saveFailedWithMsg', 'Save failed: {{msg}}', { msg: e.message })); }
  }

  async function removeArea(id) {
    const area = fiveSAreas.find(a => a.id === id);
    if (!area) return;
    if (!window.confirm(t('lean.confirm.removeArea', 'Remove "{{name}}" from your areas list? Past audit history for this area is kept.', { name: area.name }))) return;
    const updated = fiveSAreas.filter(a => a.id !== id);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { fiveSAreas: updated }, { merge: true });
      setFiveSAreas(updated);
      if (auditAreaId === id) setAuditAreaId('');
      toast.success(t('lean.toast.removedArea', 'Removed "{{name}}"', { name: area.name }));
    } catch (e) { toast.error(t('lean.toast.saveFailedWithMsg', 'Save failed: {{msg}}', { msg: e.message })); }
  }

  const selectedArea = fiveSAreas.find(a => a.id === auditAreaId);

  async function saveAudit() {
    if (!selectedArea) return toast.error(t('lean.toast.selectArea', 'Please select the area being audited'));
    if (ratedItems < totalItems) {
      return toast.error(t('lean.toast.rateAllItems', 'Rate all {{total}} items across the 5 areas before saving — {{remaining}} still unrated.', { total: totalItems, remaining: totalItems - ratedItems }));
    }
    if (!currentUser) return toast.error(t('lean.toast.notLoggedIn', 'Not logged in'));
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
        areaId: selectedArea.id,
        area: selectedArea.name,
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
          reason: `Weekly 5S audit of "${selectedArea.name}" with ${describedOpps} areas of opportunity`,
        });
        if (awarded) {
          await calculateScore(currentUser.uid);
          setWeekPtsEarned(true);
          toast.success(t('lean.toast.auditSavedPts', "Audit saved — score {{score}}. +5 pts for this week's 5S audit!", { score: scoreStr }), { duration: 4000 });
        } else {
          toast.success(t('lean.toast.auditSavedFor', 'Audit saved — score {{score}} for "{{name}}"', { score: scoreStr, name: selectedArea.name }));
        }
      } else if (oppsQualified && weekPtsEarned) {
        toast.success(t('lean.toast.auditSavedAlreadyEarned', "Audit saved — score {{score}}. (This week's +5 pts already earned.)", { score: scoreStr }));
      } else {
        toast.success(t('lean.toast.auditSavedDescribeMore', 'Audit saved — score {{score}}. Describe {{min}}+ areas of opportunity to earn +5 pts.', { score: scoreStr, min: MIN_OPPS }));
      }
    } catch (e) { toast.error(t('lean.toast.saveFailedWithMsg', 'Save failed: {{msg}}', { msg: e.message })); }
  }

  function loadAudit(record) {
    setChecks(record.checks || {});
    setFindings(record.findings || {});
    setAuditAreaId(record.areaId && fiveSAreas.some(a => a.id === record.areaId) ? record.areaId : '');
    const opps = record.opportunities && record.opportunities.length ? record.opportunities : ['', '', ''];
    setOpportunities(opps.length < MIN_OPPS ? [...opps, ...Array(MIN_OPPS - opps.length).fill('')] : opps);
    setExpandedItem(null);
    setFiveSSubTab('checklist');
    toast.success(t('lean.toast.loadedAudit', 'Loaded audit: {{area}}', { area: record.area }));
  }

  async function deleteAudit(id) {
    const updated = auditHistory.filter(a => a.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { fiveSAudits: updated }, { merge: true });
    setAuditHistory(updated);
    toast.success(t('lean.toast.auditDeleted', 'Audit deleted'));
  }

  function resetAudit() {
    setChecks({});
    setFindings({});
    setAuditAreaId('');
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

  useEffect(() => {
    if (!progressAreaId && fiveSAreas.length) setProgressAreaId(fiveSAreas[0].id);
  }, [fiveSAreas, progressAreaId]);

  async function handleSaveNew(form) {
    if (!form.title.trim()) return toast.error(t('lean.toast.enterKaizenTitle', 'Please enter a Kaizen event title'));
    if (!currentUser) return toast.error(t('lean.toast.notLoggedIn', 'Not logged in'));
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
      toast.success(t('lean.toast.kaizenLogged', 'Kaizen event logged'));
    } catch (e) { toast.error(t('lean.toast.saveFailedWithMsg', 'Save failed: {{msg}}', { msg: e.message })); }
  }

  async function handleSaveEdit(form) {
    if (!form.title.trim()) return toast.error(t('lean.toast.enterKaizenTitle', 'Please enter a Kaizen event title'));
    try {
      const { id, createdAt, uid, ...rest } = { ...editingEntry, ...form };
      await persistKaizen(kaizen.map(k => k.id === editingEntry.id ? { ...k, ...rest } : k));
      setEditingEntry(null);
      toast.success(t('lean.toast.kaizenUpdated', 'Kaizen updated'));
    } catch (e) { toast.error(t('lean.toast.updateFailedWithMsg', 'Update failed: {{msg}}', { msg: e.message })); }
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader icon="🏭" title={t('lean.pageTitle', 'Lean Toolkit — Accountability Without Waste')} subtitle={t('lean.pageSubtitle', '5S checklist, waste identification, and Kaizen event log')} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === tab.id ? '#0f2044' : '#f1f5f9', color: activeTab === tab.id ? 'white' : '#475569' }}>
            {trTabLabel(t, tab)}
          </button>
        ))}
      </div>

      {/* 5S Tab */}
      {activeTab === '5s' && (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start', width: '100%' }}>
          {/* ── Left: checklist ── */}
          <div style={{ flex: isMobile ? '0 0 100%' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Step 1: Areas management */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>{t('lean.step1.title', 'Step 1 — Areas to Audit')}</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
              {t('lean.step1.desc', "Define the areas/locations in your company you want audited. You'll pick one below each time you perform an audit.")}
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: fiveSAreas.length ? 10 : 0, flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: 1, minWidth: 160 }} value={newAreaName}
                onChange={e => setNewAreaName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addArea(); }}
                placeholder={t('lean.step1.placeholder', 'e.g. Assembly Line 3, Warehouse Zone B…')} />
              <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.875rem' }} onClick={addArea}>{t('lean.step1.addArea', '+ Add Area')}</button>
            </div>
            {fiveSAreas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {fiveSAreas.map(a => (
                  <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0d9488', borderRadius: 9999, padding: '4px 6px 4px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                    {a.name}
                    <button onClick={() => removeArea(a.id)} title={t('lean.step1.removeArea', 'Remove area')}
                      style={{ background: '#0d9488', border: 'none', borderRadius: '50%', width: 18, height: 18, color: 'white', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Area picker + score */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ marginBottom: 12 }}>
              <label className="label">{t('lean.step2.title', 'Step 2 — Area / Location Being Audited')}</label>
              {fiveSAreas.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#b45309', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '0.6rem 0.875rem', margin: 0 }}>
                  {t('lean.step2.addAreaFirst', 'Add an area above first, then come back here to start an audit.')}
                </p>
              ) : (
                <select className="input" value={auditAreaId} onChange={e => setAuditAreaId(e.target.value)}>
                  <option value="">{t('lean.step2.selectArea', 'Select an area…')}</option>
                  {fiveSAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
              <div>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t('lean.step2.scoreLabel', '5S Audit Score')}</span>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{t('lean.step2.scoreDesc', 'Average of all rated items (1–5)')}</p>
              </div>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: auditScoreColor(avgScore) }}>
                {ratedItems ? avgScore.toFixed(1) : '—'}<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 700 }}> / 5</span>
              </span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 10, marginBottom: 6 }}>
              <div style={{ height: 10, borderRadius: 9999, transition: 'width 0.6s ease', width: `${(avgScore / 5) * 100}%`, background: auditScoreColor(avgScore) }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ fontSize: '0.75rem', color: ratedItems < totalItems ? '#b45309' : 'var(--text-muted)', margin: 0 }}>
                <strong style={{ color: ratedItems < totalItems ? '#b45309' : 'var(--text-secondary)' }}>{t('lean.step2.pctComplete', '{{pct}}% complete', { pct })}</strong> · {t('lean.step2.itemsRated', '{{rated}} of {{total}} items rated', { rated: ratedItems, total: totalItems })}
                {ratedItems < totalItems && ` · ${t('lean.step2.rateAllToSave', 'rate all {{total}} to save', { total: totalItems })}`}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }} onClick={resetAudit}>{t('lean.step2.reset', '↺ Reset')}</button>
                <button className="btn-primary" disabled={ratedItems < totalItems || !selectedArea}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem', opacity: (ratedItems < totalItems || !selectedArea) ? 0.5 : 1, cursor: (ratedItems < totalItems || !selectedArea) ? 'not-allowed' : 'pointer' }}
                  onClick={saveAudit}>{t('lean.step2.saveAudit', '💾 Save Audit')}</button>
                {(auditAreaId || checkedItems > 0) && (
                  <button
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem', borderRadius: 9999, fontWeight: 700, border: '1.5px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }}
                    onClick={resetAudit}>
                    {t('lean.step2.newAudit', '＋ New Audit')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rating scale key */}
          <div className="card" style={{ padding: '0.875rem 1.125rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{t('lean.ratingScaleTitle', 'Rating Scale — score each item 1 to 5')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {RATING_SCALE.map(r => (
                <div key={r.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, background: r.color, color: 'white', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.value}</span>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{trRatingLabel(t, r)}</strong> — {trRatingDesc(t, r)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {fiveSItems.map(cat => {
            const guide = STEP_GUIDE_BY_CATEGORY[cat.category];
            const guideOpen = !!openGuides[cat.category];
            return (
            <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.25rem', background: '#0f2044', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{trFiveSCategory(t, cat)}</span>
                {guide && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setOpenGuides(o => ({ ...o, [cat.category]: !o[cat.category] }))}
                      style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.3)', background: guideOpen ? 'white' : 'rgba(255,255,255,0.1)', color: guideOpen ? '#0f2044' : 'white', cursor: 'pointer' }}>
                      {t('lean.guideline', '📋 Guideline')} {guideOpen ? '▲' : '▼'}
                    </button>
                    <button onClick={() => setLightboxGuide(guide)}
                      style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}>
                      {t('lean.seeExample', '📷 See Example')}
                    </button>
                  </div>
                )}
              </div>

              {guide && guideOpen && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.4fr) minmax(0, 1fr)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ padding: '1rem 1.25rem', background: '#e6f7f2' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5 }}>{trGuideDesc(t, guide)}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {guide.bullets.map((b, bi) => (
                        <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0, marginTop: 6, width: 6, height: 6, borderRadius: '50%', background: '#0d9488' }} />
                          <span style={{ fontSize: '0.8rem', color: '#1e293b', lineHeight: 1.45 }}>{trGuideBullet(t, guide, bi)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 14, borderTop: isMobile ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('lean.proTip', 'Pro Tip')}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', lineHeight: 1.55 }}>{trGuideProTip(t, guide)}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('lean.checkpoint', 'Checkpoint')}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', lineHeight: 1.55 }}>{trGuideCheckpoint(t, guide)}</p>
                    </div>
                  </div>
                </div>
              )}

              {cat.items.map((item, i) => {
                const key = `${cat.category}-${i}`;
                const isExpanded = expandedItem === key;
                const finding = findings[key] || {};
                const hasFinding = finding.note || finding.image;
                return (
                  <div key={i} style={{ borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {/* Rating row */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 8 : 10, padding: '0.75rem 1.25rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flex: isMobile ? '0 0 100%' : 1, minWidth: isMobile ? 0 : 150 }}>{trFiveSItem(t, cat, i)}</span>
                      {/* 1–5 rating buttons */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'nowrap' }}>
                        {RATING_SCALE.map(r => {
                          const active = Number(checks[key]) === r.value;
                          return (
                            <button key={r.value} onClick={() => setRating(cat.category, i, r.value)}
                              title={`${r.value} — ${trRatingLabel(t, r)}: ${trRatingDesc(t, r)}`}
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
                          {finding.image ? t('lean.photoTag', '📎 Photo') : t('lean.noteTag', '📝 Note')}
                        </span>
                      )}
                      {/* Expand toggle */}
                      <button onClick={() => setExpandedItem(isExpanded ? null : key)}
                        title={isExpanded ? t('lean.collapse', 'Collapse') : t('lean.addFindingPhoto', 'Add finding / photo')}
                        style={{ background: isExpanded ? '#f1f5f9' : 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
                        {isExpanded ? '▲' : '📎'}
                      </button>
                    </div>

                    {/* Expanded finding panel */}
                    {isExpanded && (
                      <div style={{ margin: '0 1.25rem 0.875rem', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{t('lean.findingDetails', 'Finding Details')}</p>

                        {/* Description */}
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('lean.descriptionFinding', 'Description / Finding')}</label>
                          <textarea
                            className="input"
                            rows={3}
                            style={{ fontSize: '0.825rem', resize: 'vertical' }}
                            placeholder={t('lean.describeFindingPlaceholder', 'Describe what was found, the condition, or the non-conformance…')}
                            value={finding.note || ''}
                            onChange={e => setFinding(key, 'note', e.target.value)}
                          />
                        </div>

                        {/* Image upload */}
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('lean.photoEvidence', 'Photo Evidence (PNG, JPG, GIF — max 5 MB)')}</label>
                          {finding.image ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img src={finding.image} alt={t('lean.findingAlt', 'Finding')} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                              <button onClick={() => removeImage(key)}
                                style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                            </div>
                          ) : (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px dashed #cbd5e1', cursor: 'pointer', background: 'white', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                              {t('lean.clickAttachPhoto', '📷 Click to attach photo')}
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
            );
          })}
          {/* Areas of Opportunity — required for weekly 5S points */}
          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0d9488' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem' }}>{t('lean.opportunities.title', 'Areas of Opportunity')}</h3>
              <span style={{
                padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700,
                background: weekPtsEarned ? '#f0fdf4' : oppsQualified ? '#eff6ff' : '#f1f5f9',
                color: weekPtsEarned ? '#15803d' : oppsQualified ? '#1d4ed8' : '#94a3b8',
                border: `1px solid ${weekPtsEarned ? '#86efac' : oppsQualified ? '#bfdbfe' : '#e2e8f0'}`,
              }}>
                {weekPtsEarned ? t('lean.opportunities.ptsEarned', '✓ +5 pts earned this week') : t('lean.opportunities.describedProgress', '{{count}}/{{min}} described → +5 pts', { count: describedOpps, min: MIN_OPPS })}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {t('lean.opportunities.instructions', 'Describe at least {{min}} areas of opportunity found during this audit (min {{minWords}} words each). A weekly audit with {{min}}+ described areas earns +5 pts — the points reset each week, so run a fresh audit weekly to keep them.', { min: MIN_OPPS, minWords: MIN_OPP_WORDS })}
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
                        placeholder={t('lean.opportunities.placeholder', 'Area of opportunity {{n}} — what needs improvement and where?', { n: idx + 1 })}
                        value={opp} onChange={e => updateOpportunity(idx, e.target.value)} />
                      <span style={{ fontSize: '0.65rem', color: ok ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                        {t('lean.opportunities.wordCount', '{{count}}/{{min}} words', { count: wc, min: MIN_OPP_WORDS })} {ok ? '✓' : ''}
                      </span>
                    </div>
                    <button onClick={() => removeOpportunity(idx)} title={t('lean.remove', 'Remove')}
                      style={{ flexShrink: 0, marginTop: 6, background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                  </div>
                );
              })}
            </div>
            <button onClick={addOpportunity} className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem', marginTop: 10 }}>
              {t('lean.opportunities.addAnother', '＋ Add another area')}
            </button>
          </div>

          {/* Step 3: Progress — score trend by area, over a selectable period */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>{t('lean.progress.title', '📈 Progress — Score Trend by Area')}</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              {t('lean.progress.desc', "Track how an area's 5S score is trending over time, bucketed by the period you choose.")}
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ flex: '1 1 160px', minWidth: 160 }}>
                <label className="label" style={{ fontSize: '0.7rem' }}>{t('lean.progress.area', 'Area')}</label>
                {fiveSAreas.length === 0 ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{t('lean.progress.noAreasYet', 'No areas yet — add one above.')}</p>
                ) : (
                  <select className="input" value={progressAreaId} onChange={e => setProgressAreaId(e.target.value)}>
                    {fiveSAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 200 }}>
                <label className="label" style={{ fontSize: '0.7rem' }}>{t('lean.progress.period', 'Period')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setProgressPeriod(p.key)}
                      style={{ padding: '0.4rem 0.9rem', borderRadius: 9999, fontWeight: 700, fontSize: '0.75rem', border: 'none', cursor: 'pointer',
                        background: progressPeriod === p.key ? '#0f2044' : '#f1f5f9', color: progressPeriod === p.key ? 'white' : '#475569' }}>
                      {trPeriodLabel(t, p)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {fiveSAreas.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center' }}>
                {t('lean.progress.addAreaToTrack', 'Add an area above to start tracking its audit trend.')}
              </div>
            ) : (
              <FiveSTrendChart points={buildTrendPoints(auditHistory.filter(a => a.areaId === progressAreaId), progressPeriod)} />
            )}
          </div>

          {/* Last 8 individual audit records for the selected area — raw scores, not period-averaged */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>{t('lean.last8.title', '📊 Last 8 Audits — Score by Date')}</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              {fiveSAreas.find(a => a.id === progressAreaId)?.name || t('lean.last8.selectedArea', 'Selected area')} — {t('lean.last8.desc', 'each bar is one audit record, oldest to newest.')}
            </p>
            <FiveSRecordsBarChart
              records={auditHistory
                .filter(a => a.areaId === progressAreaId)
                .slice(0, 8)
                .reverse()}
            />
          </div>

          </div>{/* end left checklist */}

          {/* ── Right: audit history ── */}
          <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '1.125rem' }}>
              <button onClick={() => setAuditHistoryOpen(o => !o)}
                style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: auditHistoryOpen ? 12 : 0 }}>
                <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9rem' }}>{t('lean.history.title', '📋 Audit History')}{auditHistory.length > 0 && ` (${auditHistory.length})`}</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{auditHistoryOpen ? '▲' : '▼'}</span>
              </button>
              {auditHistoryOpen && (auditHistory.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1.5rem 0' }}>{t('lean.history.empty', 'No audits saved yet. Complete the checklist and click Save Audit.')}</p>
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
                            {t('lean.history.load', '📂 Load')}
                          </button>
                          <button onClick={() => setExpandedAudit(isExp ? null : record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#64748b' }}>
                            {isExp ? '▲' : '▼'} {t('lean.history.details', 'Details')}
                          </button>
                          <button onClick={() => deleteAudit(record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            🗑
                          </button>
                        </div>
                        {isExp && (
                          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: '#f8fafc', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>
                              {hasAvg && <>{t('lean.history.scoreOf5', 'Score {{score}}/5', { score: record.avgScore.toFixed(1) })} · </>}{t('lean.history.itemsRated', '{{checked}} / {{total}} items rated', { checked: record.checked, total: record.total })}
                            </p>
                            {Object.keys(record.findings || {}).length > 0 && (
                              <p style={{ margin: '0 0 6px', color: '#b45309' }}>{t('lean.history.notesRecorded', '📝 {{count}} note(s) recorded', { count: Object.keys(record.findings).length })}</p>
                            )}
                            {record.opportunities && record.opportunities.length > 0 && (
                              <div>
                                <p style={{ margin: '0 0 3px', fontWeight: 700, color: '#0d9488' }}>{t('lean.history.opportunitiesCount', 'Areas of Opportunity ({{count}})', { count: record.opportunities.length })}</p>
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
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Waste Types Tab — Waste Walk */}
      {activeTab === 'waste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Waste Walk instructions */}
          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #0f2044' }}>
            <p style={{ fontWeight: 800, margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t('lean.waste.howTo.title', '🚶 How to do a Waste Walk')}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              {t('lean.waste.howTo.desc', "Allocate 15 minutes minimum a day to walk your production floor, warehouse, or the area where you work, and look for opportunities to identify the eight wastes. Describe them below — doing it yourself is okay, but it's even better if you do it with your team.")}
            </p>
          </div>

          {/* Weekly points reminder */}
          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #0d9488', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1, color: wastePtsThisWeek === 5 ? '#15803d' : '#0f2044' }}>{wastePtsThisWeek}<span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>/5</span></div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('lean.waste.ptsThisWeek', 'pts this week')}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontWeight: 800, margin: '0 0 2px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {wastePtsThisWeek === 5 ? t('lean.waste.allEarned', '🏆 All 5 waste-walk points earned this week!') : t('lean.waste.logToEarn', 'Log 5 different wastes this week to earn 5 points')}
              </p>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {t('lean.waste.ptPerCategory', 'Earn +1 pt per distinct waste category you log. Points reset every week — re-log fresh wastes to keep them.')}
                {wasteTypesThisWeek.size < 5 && <> {t('lean.waste.stillToLog', 'Still to log:')} <strong>{wasteTypes.filter(w => !wasteTypesThisWeek.has(w.type)).map(w => trWasteName(t, w.type)).join(', ')}</strong>.</>}
              </p>
            </div>
          </div>

          {/* Pareto chart + 80/20 lesson */}
          {wasteLogs.length > 0 && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '1rem' }}>{t('lean.waste.pareto.title', '📊 Waste Pareto Chart')}</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                {t('lean.waste.pareto.desc', 'Auto-built from your logs — the tallest bars on the left are where most of your waste is coming from.')}
              </p>
              <WasteParetoChart tally={wasteTally} />
              <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.875rem 1rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f2044', margin: '0 0 4px' }}>{t('lean.waste.pareto.ruleTitle', '💡 The 80/20 Rule (Pareto Principle)')}</p>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                  {t('lean.waste.pareto.ruleDesc', 'Vilfredo Pareto observed that roughly 80% of results come from 20% of causes. In Lean, that means a small number of waste types usually drive most of your losses. The teal line shows the cumulative %; the tools/wastes to the left of where it crosses the red 80% line are your "vital few" — fix those first for the biggest impact, instead of spreading effort thin across every problem equally.')}
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
                        <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: 0 }}>{trWasteName(t, w.type)}</h4>
                        {loggedThisWeek && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 9999, padding: '1px 7px' }}>{t('lean.waste.plusOneThisWeek', '✓ +1 this week')}</span>}
                        {total > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b' }}>{t('lean.waste.loggedAllTime', '{{count}} logged all-time', { count: total })}</span>}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 4px', lineHeight: 1.5 }}>{trWasteDesc(t, w)}</p>
                      <p style={{ fontSize: '0.76rem', color: '#0d9488', fontStyle: 'italic', margin: 0 }}>{t('lean.waste.exampleLabel', 'Example:')} {trWasteExample(t, w)}</p>
                    </div>
                  </div>
                  <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem', alignSelf: 'flex-start' }}
                    onClick={() => setWasteForm({ type: w.type, location: '', description: '', impact: '', countermeasure: '' })}>
                    {t('lean.waste.logThisWaste', '+ Log this waste')}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Recent logs */}
          {wasteLogs.length > 0 && (
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.9rem' }}>{t('lean.waste.logTitle', 'Waste Walk Log ({{count}})', { count: wasteLogs.length })}</h4>
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
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{trWasteName(t, l.type)}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}> · {l.location} · {l.date}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ padding: '0.75rem 0.875rem', background: 'white', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#0f2044' }}>{t('lean.waste.whatWasSeen', 'What was seen:')}</strong> {l.description}</p>
                          {l.impact && <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#0f2044' }}>{t('lean.waste.impactLabel', 'Impact:')}</strong> {l.impact}</p>}
                          {l.countermeasure && <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#0f2044' }}>{t('lean.waste.countermeasureLabel', 'Countermeasure:')}</strong> {l.countermeasure}</p>}
                          {l.photoUrl && (
                            <a href={l.photoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', margin: '2px 0 8px' }}>
                              <img src={l.photoUrl} alt={t('lean.waste.observationAlt', 'Observation')} style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                              <span style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 700 }}>{t('lean.waste.openPhoto', '📎 Open photo ↗')}</span>
                            </a>
                          )}
                          <div>
                            <button onClick={() => deleteWasteLog(l.id)} style={{ background: 'none', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>{t('lean.waste.delete', '🗑 Delete')}</button>
                          </div>
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
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1rem' }}>{t('lean.waste.modalTitle', 'Log {{type}} Waste', { type: trWasteName(t, wasteForm.type) })}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">{t('lean.waste.locationLabel', 'Area / Location *')}</label>
                <input className="input" value={wasteForm.location} onChange={e => setWasteForm(f => ({ ...f, location: e.target.value }))} placeholder={t('lean.waste.locationPlaceholder', 'e.g. Assembly Line 3, Shipping dock…')} />
              </div>
              <div>
                <label className="label">{t('lean.waste.observedLabel', 'What did you observe? *')}</label>
                <textarea className="input" rows={2} value={wasteForm.description} onChange={e => setWasteForm(f => ({ ...f, description: e.target.value }))} placeholder={t('lean.waste.observedPlaceholder', 'Describe the waste you saw…')} />
              </div>
              <div>
                <label className="label">{t('lean.waste.impactOptLabel', 'Estimated impact (optional)')}</label>
                <input className="input" value={wasteForm.impact} onChange={e => setWasteForm(f => ({ ...f, impact: e.target.value }))} placeholder={t('lean.waste.impactPlaceholder', 'e.g. ~30 min/day, 5% scrap, delays shipments')} />
              </div>
              <div>
                <label className="label">{t('lean.waste.countermeasureOptLabel', 'Countermeasure idea (optional)')}</label>
                <textarea className="input" rows={2} value={wasteForm.countermeasure} onChange={e => setWasteForm(f => ({ ...f, countermeasure: e.target.value }))} placeholder={t('lean.waste.countermeasurePlaceholder', 'What could reduce or eliminate it?')} />
              </div>
              <div>
                <label className="label">{t('lean.waste.photoOptLabel', 'Photo of the observation (optional)')}</label>
                {wasteForm.imagePreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={wasteForm.imagePreview} alt={t('lean.waste.observationAlt', 'Observation')} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                    <button onClick={() => setWasteForm(f => ({ ...f, imageBlob: null, imagePreview: null }))}
                      style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px dashed #cbd5e1', cursor: 'pointer', background: 'white', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                    {t('lean.waste.clickAttachPhoto', '📷 Click to attach a photo (JPG/PNG, max 5 MB)')}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickWastePhoto} />
                  </label>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-primary" onClick={saveWasteLog} disabled={savingWaste} style={{ flex: 1 }}>
                {savingWaste ? t('lean.waste.saving', 'Saving…') : t('lean.waste.saveWasteLog', '💾 Save Waste Log')}
              </button>
              <button className="btn-secondary" onClick={() => setWasteForm(null)}>{t('lean.kaizen.cancel', 'Cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Kaizen Log Tab */}
      {activeTab === 'kaizen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => { setShowForm(s => !s); setEditingEntry(null); }}>
              {showForm ? t('lean.kaizenTab.cancel', '✕ Cancel') : t('lean.kaizenTab.logEvent', '+ Log Kaizen Event')}
            </button>
          </div>

          {showForm && !editingEntry && (
            <KaizenForm
              initial={emptyKaizen}
              title={t('lean.kaizenTab.newEvent', 'New Kaizen Event')}
              onSave={handleSaveNew}
              onCancel={() => setShowForm(false)}
            />
          )}

          {editingEntry && (
            <KaizenForm
              initial={editingEntry}
              title={t('lean.kaizenTab.editing', 'Editing: {{title}}', { title: editingEntry.title })}
              onSave={handleSaveEdit}
              onCancel={() => setEditingEntry(null)}
            />
          )}

          {kaizen.length === 0 && !showForm && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>🏭</p>
              <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{t('lean.kaizenTab.emptyTitle', 'No Kaizen events logged yet.')}</p>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>{t('lean.kaizenTab.emptyDesc', 'Click "+ Log Kaizen Event" to document your first improvement event.')}</p>
            </div>
          )}

          {kaizen.map(k => (
            <KaizenCard key={k.id} k={k} onEdit={entry => { setEditingEntry(entry); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          ))}
        </div>
      )}

      {lightboxGuide && <StepPhotoLightbox guide={lightboxGuide} onClose={() => setLightboxGuide(null)} />}
    </div>
  );
}
