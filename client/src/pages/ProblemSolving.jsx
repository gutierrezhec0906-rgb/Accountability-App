import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { logPointEvent, calculateScore, weekMonday } from '../utils/scoring';

const PS_EVENT_LABELS = {
  '5whys':    { label: '5 Whys Analysis',      points: 5  },
  fishbone:   { label: 'Fishbone Diagram',      points: 5  },
  a3:         { label: 'A3 Problem Solving',    points: 10 },
};

const TOOLS = ['5 Whys', 'Fishbone Diagram', 'A3 Template'];

// ─── Shared: Saved panel ──────────────────────────────────────────────────────
function SavedPanel({ entries, onDelete, onLoad, printEntry }) {
  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0f2044', borderRadius: '12px 12px 0 0', padding: '0.75rem 1rem' }}>
        <p style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', margin: 0 }}>📋 Saved Templates</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', margin: '2px 0 0' }}>{entries.length} template{entries.length !== 1 ? 's' : ''}</p>
      </div>
      <div style={{ flex: 1, border: '1px solid #e8edf5', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: '#fafbfc' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>No saved templates yet. Fill out the form and click Save.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {entries.map((e, i) => (
              <div key={e.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid #e8edf5' : 'none', padding: '0.75rem 1rem', background: 'white' }}>
                <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', margin: '0 0 2px', lineHeight: 1.3 }}>{e.title}</p>
                {e.data?.problem && <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 4px', lineHeight: 1.3 }}>{e.data.problem}</p>}
                {e.createdAt && <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '0 0 8px' }}>{new Date(e.createdAt.seconds * 1000).toLocaleDateString()}</p>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onLoad(e)}
                    style={{ flex: 1, fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', background: 'none', border: '1px solid #0d9488', borderRadius: 6, padding: '3px 0', cursor: 'pointer' }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => printEntry(e)}
                    style={{ flex: 1, fontSize: '0.72rem', fontWeight: 700, color: '#0f2044', background: 'none', border: '1px solid #0f2044', borderRadius: 6, padding: '3px 0', cursor: 'pointer' }}>
                    🖨️ Print
                  </button>
                  <button onClick={() => onDelete(e.id)}
                    style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 5 Whys ──────────────────────────────────────────────────────────────────

const WHY_GUIDE = [
  {
    goal: 'Identify the immediate, visible cause — the thing you would see if you watched the problem happen.',
    prompts: [
      'What happened right before this problem occurred?',
      'What broke, was skipped, or was different than normal?',
      'If you were standing there when it happened, what would you have seen?',
    ],
    watchFor: 'Avoid restating the problem. "Why did the part fail inspection?" → "Because it didn\'t meet spec" is circular, not a cause.',
  },
  {
    goal: 'Move one layer back — from the event to the condition that made the event possible.',
    prompts: [
      'Why did that condition exist in the first place?',
      'Was this a one-time slip, or does it happen this way regularly?',
      'Was there a step, check, or barrier that should have caught this?',
    ],
    watchFor: 'Don\'t stop at "human error." If the answer is "the operator made a mistake," ask what allowed that mistake — training, fatigue, unclear instructions, no error-proofing.',
  },
  {
    goal: 'Start separating people from process. This is where the conversation shifts from what someone did to how the system is set up.',
    prompts: [
      'Is this caused by a missing procedure, an unclear one, or one that isn\'t followed?',
      'Was this condition designed in, or did it drift over time?',
      'Would a new person in this role make the same mistake? If yes, it\'s systemic.',
    ],
    watchFor: 'People often feel they\'ve found the root cause here because it feels satisfying. Push once more — ask "why does that condition exist" before stopping.',
  },
  {
    goal: 'Get to the organizational or design-level factor — training systems, resource allocation, priorities, or how work is actually managed.',
    prompts: [
      'Was this a resourcing issue (time, people, tools, budget)?',
      'Was there a decision made upstream that created this condition?',
      'Is this a gap in a standard, or a standard that exists but isn\'t enforced?',
    ],
    watchFor: 'Watch for blame language ("management doesn\'t prioritize this"). Reframe: what specific decision-making process led to that priority?',
  },
  {
    goal: 'Land on something specific enough that a fix is obvious, and structural enough that fixing it prevents recurrence — not just this one instance.',
    prompts: [
      'If we fixed only this, would the problem stop happening across the board — not just this one case?',
      'Is this something we can actually act on (a process, a standard, a design)?',
      'Have we reached a cause, or "that\'s just how it is here"? (The second usually means one more Why is needed.)',
    ],
    watchFor: 'Stop when the answer points to a process or standard you can act on. Keep going if the answer is still an event ("it broke") rather than a condition.',
  },
];

const BLAME_WORDS = /\b(human error|operator error|employee error|worker error|staff error|person|mistake by|negligence)\b/i;

function humanErrorNudge(text) {
  if (!text) return null;
  if (BLAME_WORDS.test(text)) return 'What allowed this to happen? Consider: training gaps, unclear instructions, no error-proofing, or time pressure.';
  return null;
}

function problemStatementWarning(text) {
  if (!text || text.trim().length < 10) return null;
  const hasMetric = /\d/.test(text);
  const hasBlame = /\b(don't care|doesn't care|won't|refuse|lazy|bad attitude)\b/i.test(text);
  if (hasBlame) return 'Try removing blame language. Restate as an observable fact: what happened, how often, where.';
  if (!hasMetric) return 'Tip: add a number to make this measurable — e.g. "12% of units failed" or "3 incidents in 30 days."';
  return null;
}

function GuidePanel({ whyIndex }) {
  const [open, setOpen] = useState(false);
  const g = WHY_GUIDE[whyIndex];
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        {open ? '▾' : '▸'} {open ? 'Hide guide' : 'Show guide for this step'}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: '0.76rem', color: '#475569', lineHeight: 1.6 }}>
          <p style={{ fontWeight: 700, color: '#0f2044', margin: '0 0 6px' }}>Goal</p>
          <p style={{ margin: '0 0 10px' }}>{g.goal}</p>
          <p style={{ fontWeight: 700, color: '#0f2044', margin: '0 0 6px' }}>Ask yourself</p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            {g.prompts.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
          </ul>
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '6px 10px', color: '#713f12' }}>
            <span style={{ fontWeight: 700 }}>Watch for: </span>{g.watchFor}
          </div>
        </div>
      )}
    </div>
  );
}

function fiveWhysPrintHTML(entry) {
  const { problem, whys, rootCause } = entry.data;
  const date = entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  const stepColors = ['#0d9488', '#0d9488', '#f59e0b', '#f59e0b', '#ef4444'];
  const whyRows = (whys || []).map((w, i) => `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
      <div style="width:28px;height:28px;border-radius:50%;background:${stepColors[i]};color:white;font-weight:900;font-size:0.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:0.82rem;color:${w ? '#1e293b' : '#cbd5e1'};font-style:${w ? 'normal' : 'italic'};min-height:36px">${w || 'Not answered'}</div>
    </div>`).join('');
  return `<div style="font-family:sans-serif;padding:24px;background:white">
    <div style="margin-bottom:14px;border-bottom:2px solid #0f2044;padding-bottom:10px">
      <h2 style="margin:0 0 4px;color:#0f2044;font-size:1.1rem;font-weight:900">5 Whys Analysis</h2>
      <p style="margin:0;font-size:0.8rem;color:#64748b"><strong>Title:</strong> ${entry.title || '—'} &nbsp;|&nbsp; <strong>Date:</strong> ${date}</p>
    </div>
    <p style="font-weight:700;color:#0f2044;margin:0 0 6px;font-size:0.85rem">Problem Statement</p>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:0.82rem;color:${problem ? '#1e293b' : '#cbd5e1'};margin-bottom:16px;min-height:40px">${problem || 'Not stated'}</div>
    <p style="font-weight:700;color:#0f2044;margin:0 0 10px;font-size:0.85rem">5 Whys</p>
    ${whyRows}
    <div style="background:#f0fdfa;border:1.5px solid #0d9488;border-radius:10px;padding:12px;margin-top:8px">
      <p style="font-weight:700;color:#0f766e;margin:0 0 6px;font-size:0.85rem">Root Cause Identified</p>
      <p style="margin:0;font-size:0.82rem;color:${rootCause ? '#1e293b' : '#cbd5e1'};font-style:${rootCause ? 'normal' : 'italic'}">${rootCause || 'Not identified'}</p>
    </div>
  </div>`;
}

const WHY_COLORS = ['#0d9488', '#0d9488', '#f59e0b', '#f59e0b', '#ef4444'];
const WHY_LABELS = ['Why #1', 'Why #2', 'Why #3', 'Why #4', 'Why #5'];

// ─── Next Step Recommendation ────────────────────────────────────────────────
function NextStepRecommendation({ title, problem, rootCause, onGoToA3 }) {
  const navigate = useNavigate();
  const [choice, setChoice] = useState(null); // 'action' | 'project'

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 100%)', borderRadius: 14, padding: '1.25rem', color: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '1.1rem' }}>🧭</span>
        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>What's your next step?</p>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 14px', lineHeight: 1.6 }}>
        You've identified a root cause. Now choose how complex the fix is — that determines which tool to use next.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: choice ? 14 : 0 }}>
        {/* Option A — simple action */}
        <button onClick={() => { setChoice('action'); localStorage.setItem('ps_quick_action_ts', Date.now().toString()); }}
          style={{ position: 'relative', background: choice === 'action' ? '#0d9488' : 'rgba(255,255,255,0.08)', border: `2px solid ${choice === 'action' ? '#0d9488' : 'rgba(255,255,255,0.18)'}`, borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', color: 'white', transition: 'all 0.15s' }}>
          {choice === 'action' && (
            <span style={{ position: 'absolute', top: 8, right: 10, background: '#fbbf24', color: '#1e3a6e', fontWeight: 900, fontSize: '0.7rem', borderRadius: 9999, padding: '2px 7px', letterSpacing: 0.5 }}>+1 pt</span>
          )}
          <p style={{ fontSize: '1.3rem', margin: '0 0 6px' }}>⚡</p>
          <p style={{ fontWeight: 800, fontSize: '0.85rem', margin: '0 0 4px' }}>Quick Action</p>
          <p style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>
            The fix is a single, clear task — one owner, one step, done in days or weeks.
          </p>
        </button>

        {/* Option B — complex project */}
        <button onClick={() => setChoice('project')}
          style={{ background: choice === 'project' ? '#7c3aed' : 'rgba(255,255,255,0.08)', border: `2px solid ${choice === 'project' ? '#7c3aed' : 'rgba(255,255,255,0.18)'}`, borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', color: 'white', transition: 'all 0.15s' }}>
          <p style={{ fontSize: '1.3rem', margin: '0 0 6px' }}>🗂️</p>
          <p style={{ fontWeight: 800, fontSize: '0.85rem', margin: '0 0 4px' }}>Complex Project</p>
          <p style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>
            The fix involves multiple people, phases, or unknowns — needs structured planning.
          </p>
        </button>
      </div>

      {/* Action path */}
      {choice === 'action' && (
        <div style={{ background: 'rgba(13,148,136,0.15)', border: '1.5px solid #0d9488', borderRadius: 12, padding: '1rem' }}>
          <p style={{ fontWeight: 700, color: '#5eead4', fontSize: '0.85rem', margin: '0 0 6px' }}>Go to Visual Management Board</p>
          <p style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.8)', margin: '0 0 12px', lineHeight: 1.6 }}>
            Create a new action card directly tied to your root cause. Set an owner, due date, and track it to completion on your board.
          </p>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: '0.74rem', color: 'rgba(255,255,255,0.65)', marginBottom: 12, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: '#5eead4' }}>Root cause to fix: </span>{rootCause}
          </div>
          <button onClick={() => navigate('/visual-board')}
            style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 9, padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}>
            Open Visual Management Board →
          </button>
        </div>
      )}

      {/* Project path */}
      {choice === 'project' && (
        <div style={{ background: 'rgba(124,58,237,0.15)', border: '1.5px solid #7c3aed', borderRadius: 12, padding: '1rem' }}>
          <p style={{ fontWeight: 700, color: '#c4b5fd', fontSize: '0.85rem', margin: '0 0 6px' }}>Go to A3 Problem-Solving Template</p>
          <p style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.8)', margin: '0 0 10px', lineHeight: 1.6 }}>
            The A3 is built for complex fixes. Your 5 Whys answers will pre-fill three sections automatically — you just complete the rest.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
            {[
              { label: 'Title', value: title },
              { label: '1. Background & Context', value: problem },
              { label: '4. Root Cause Analysis', value: rootCause },
            ].map(row => (
              <div key={row.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 7, padding: '6px 10px', fontSize: '0.73rem', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: '#c4b5fd' }}>{row.label}: </span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>{row.value || '—'}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onGoToA3({ title, background: problem, rootCause })}
            style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 9, padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}>
            Open A3 Template with my data pre-filled →
          </button>
        </div>
      )}
    </div>
  );
}

function FiveWhys({ onSave, savedEntries, onDelete, onGoToA3 }) {
  const [title,     setTitle]     = useState('');
  const [problem,   setProblem]   = useState('');
  const [whys,      setWhys]      = useState(['', '', '', '', '']);
  const [rootCause, setRootCause] = useState('');

  const problemReady = problem.trim().length >= 15;
  const problemWarn  = problemStatementWarning(problem);

  function loadEntry(e) {
    setTitle(e.title || '');
    setProblem(e.data.problem || '');
    setWhys(e.data.whys || ['', '', '', '', '']);
    setRootCause(e.data.rootCause || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function printEntry(e) {
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<html><head><title>${e.title}</title><style>body{margin:0}@media print{@page{margin:15mm}}</style></head><body>${fiveWhysPrintHTML(e)}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function handlePrintCurrent() {
    const fakeEntry = { id: 'cur', title: title || problem || 'Untitled', data: { problem, whys, rootCause }, createdAt: null };
    printEntry(fakeEntry);
  }

  // Build the context label shown above each Why input
  function chainContext(i) {
    if (i === 0) return problem.trim() || null;
    return whys[i - 1].trim() || null;
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Title */}
        <div>
          <label className="label">Analysis Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Line 2 Downtime — June 2026" />
        </div>

        {/* Problem Statement Gate */}
        <div style={{ background: '#f8fafc', border: `2px solid ${problemReady ? '#0d9488' : '#e2e8f0'}`, borderRadius: 12, padding: '1rem', transition: 'border-color 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '1rem' }}>🎯</span>
            <label className="label" style={{ margin: 0, color: '#0f2044' }}>Problem Statement</label>
            {problemReady && <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>Ready</span>}
          </div>
          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 8px', lineHeight: 1.5 }}>
            Be specific, factual, and observable. No blame, no assumptions.<br />
            <span style={{ color: '#ef4444' }}>✗</span> "Operators don't care about quality" &nbsp;→&nbsp;
            <span style={{ color: '#0d9488' }}>✓</span> "12% of Unit X failed final inspection in the last 30 days"
          </p>
          <textarea className="input" rows={2} value={problem}
            onChange={e => setProblem(e.target.value)}
            placeholder="What happened? How often? Where? Include a number if possible." />
          {problemWarn && (
            <div style={{ marginTop: 6, fontSize: '0.73rem', color: '#92400e', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '5px 10px' }}>
              💡 {problemWarn}
            </div>
          )}
          {!problemReady && problem.trim().length > 0 && (
            <p style={{ marginTop: 6, fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>Keep going — add more detail to unlock the Why chain below.</p>
          )}
        </div>

        {/* Why Chain */}
        {problemReady ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {whys.map((w, i) => {
              const ctx = chainContext(i);
              const nudge = humanErrorNudge(w);
              const color = WHY_COLORS[i];
              return (
                <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                  {/* Left connector line + badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
                    {i > 0 && <div style={{ width: 2, flex: '0 0 16px', background: '#e2e8f0' }} />}
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, color: 'white', fontWeight: 900, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>{i + 1}</div>
                    {i < 4 && <div style={{ width: 2, flex: 1, minHeight: 16, background: '#e2e8f0' }} />}
                  </div>

                  {/* Card */}
                  <div style={{ flex: 1, marginLeft: 10, marginBottom: i < 4 ? 0 : 0, paddingBottom: i < 4 ? 12 : 0 }}>
                    <div style={{ background: 'white', border: `1.5px solid ${color}22`, borderLeft: `3px solid ${color}`, borderRadius: '0 10px 10px 0', padding: '10px 14px', marginTop: i === 0 ? 0 : 0 }}>
                      <p style={{ fontWeight: 700, color, fontSize: '0.8rem', margin: '0 0 4px' }}>{WHY_LABELS[i]}</p>

                      {/* Chain context — shows what this Why is answering */}
                      {ctx && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 10px', fontSize: '0.73rem', color: '#64748b', marginBottom: 8, lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {i === 0 ? 'Why did this happen?' : 'Why did that happen?'}
                          </span><br />
                          <span style={{ color: '#1e293b', fontStyle: 'italic' }}>"{ctx}"</span>
                        </div>
                      )}

                      <textarea className="input" rows={2} value={w}
                        onChange={e => setWhys(ws => ws.map((x, j) => j === i ? e.target.value : x))}
                        placeholder={i === 0 ? 'What directly caused this? What would you have seen?' : 'What allowed that to happen?'}
                        style={{ marginBottom: nudge ? 6 : 0 }} />

                      {/* Human error nudge */}
                      {nudge && (
                        <div style={{ fontSize: '0.73rem', color: '#92400e', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '5px 10px' }}>
                          ⚠️ {nudge}
                        </div>
                      )}

                      <GuidePanel whyIndex={i} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
            <p style={{ margin: 0, fontSize: '1.5rem', marginBottom: 8 }}>🔒</p>
            <p style={{ margin: 0, fontWeight: 600 }}>Fill in the Problem Statement above to unlock the Why chain</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem' }}>A specific, measurable problem statement prevents drift in every Why that follows.</p>
          </div>
        )}

        {/* Root Cause */}
        <div style={{ background: '#f0fdfa', border: '1.5px solid #0d9488', borderRadius: 12, padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span>🎯</span>
            <label className="label" style={{ color: '#0f766e', margin: 0 }}>Root Cause Identified</label>
          </div>
          <p style={{ fontSize: '0.73rem', color: '#0f766e', margin: '0 0 8px', lineHeight: 1.5 }}>
            Stop here when the answer points to a process, standard, or system — something you can actually act on. If fixing this would prevent recurrence (not just patch this instance), you've found it.
          </p>
          <textarea className="input" rows={2} value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="State the root cause and proposed countermeasure..." />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" style={{ flex: 1 }}
            onClick={() => onSave({ type: '5whys', title: title || problem || 'Untitled 5 Whys', data: { problem, whys, rootCause }, onSaved: () => { setTitle(''); setProblem(''); setWhys(['','','','','']); setRootCause(''); } })}>
            💾 Save Analysis
          </button>
          <button onClick={handlePrintCurrent}
            style={{ flex: 1, background: '#0f2044', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            🖨️ Print / Save PDF
          </button>
        </div>

        {/* Next Step Recommendation */}
        {rootCause.trim().length > 0 && (
          <NextStepRecommendation
            title={title || problem || 'Untitled 5 Whys'}
            problem={problem}
            rootCause={rootCause}
            onGoToA3={onGoToA3}
          />
        )}
      </div>
      <SavedPanel entries={savedEntries} onDelete={onDelete} onLoad={loadEntry} printEntry={printEntry} />
    </div>
  );
}

// ─── Fishbone ─────────────────────────────────────────────────────────────────

const FISHBONE_GUIDE = {
  people: {
    goal: 'Surface causes related to skill, training, communication, or workload — without turning it into blame.',
    prompts: [
      'Was the person trained and qualified for this task?',
      'Was there enough time/staffing to do this correctly?',
      'Was there a communication gap between shifts, teams, or roles?',
      'Is this a skill gap, or a system that doesn\'t support the person doing it right?',
    ],
    watchFor: 'Avoid landing on a name. Redirect: "What about how this role is set up made the error possible?"',
  },
  process: {
    goal: 'Identify gaps in how the work is defined, documented, or sequenced.',
    prompts: [
      'Is there a documented procedure for this step? Is it followed?',
      'Has the process changed recently, or drifted from the original design?',
      'Are there unclear handoffs or steps open to interpretation?',
      'Would two different people doing this task get the same result?',
    ],
    watchFor: 'An undocumented process is almost always a cause, not a category to leave blank.',
  },
  materials: {
    goal: 'Identify input or raw material contributions to the problem.',
    prompts: [
      'Did the material meet specification when it arrived?',
      'Was there a supplier change, lot change, or storage condition change?',
      'Is there variability between suppliers or batches?',
      'Was the material handled/stored correctly before use?',
    ],
    watchFor: 'Check for recent supplier or batch changes — these often correlate with sudden defect spikes.',
  },
  machine: {
    goal: 'Identify equipment, tooling, or technology contributions.',
    prompts: [
      'Was the equipment calibrated, maintained, and in normal condition?',
      'Has there been a change in equipment, settings, or tooling recently?',
      'Is there a maintenance schedule, and was it followed?',
      'Could the equipment produce this result even when used correctly?',
    ],
    watchFor: 'Don\'t skip this if the equipment "seems fine" — run the prompts anyway. Intermittent issues often hide here.',
  },
  environment: {
    goal: 'Identify physical, organizational, or external conditions outside the immediate process.',
    prompts: [
      'Did temperature, humidity, noise, or lighting play a role?',
      'Is this tied to time of day, shift, or seasonal factors?',
      'Is there organizational pressure (e.g., rushing to hit a deadline) at play?',
      'Would this happen in a different location, or is it specific to this environment?',
    ],
    watchFor: 'Cultural or schedule pressure is a real cause — don\'t dismiss it. "End of quarter rush" is an environmental condition.',
  },
  measurement: {
    goal: 'Question whether the problem is real — or whether it\'s how it\'s being measured.',
    prompts: [
      'Is the measurement method/tool accurate and calibrated?',
      'Are different people or shifts measuring this the same way?',
      'Could this be a measurement error rather than an actual process problem?',
      'Is the data being collected at the right point in the process?',
    ],
    watchFor: 'Teams often skip this category — but it can dissolve the entire "problem" if the root cause turns out to be a bad gauge or inconsistent method.',
  },
};

// Matching "two Title-Case words" alone is far too broad — ordinary phrases like
// "External Circumstances" or "Software Update" false-positive as names. Instead,
// only flag it when the FIRST word is an actual common first name (English + Spanish),
// so generic capitalized phrases no longer trip the nudge.
const COMMON_FIRST_NAMES = new Set([
  'james','john','robert','michael','william','david','richard','joseph','thomas','charles',
  'daniel','matthew','anthony','mark','paul','steven','andrew','kenneth','joshua','kevin',
  'brian','george','edward','ronald','timothy','jason','jeffrey','ryan','jacob','gary',
  'nicholas','eric','stephen','jonathan','larry','justin','scott','brandon','benjamin','samuel',
  'mary','patricia','jennifer','linda','elizabeth','barbara','susan','jessica','sarah','karen',
  'lisa','nancy','betty','sandra','margaret','ashley','kimberly','emily','donna','michelle',
  'carol','amanda','melissa','deborah','stephanie','rebecca','laura','helen','sharon','cynthia',
  'jose','juan','carlos','luis','miguel','antonio','francisco','manuel','pedro','javier',
  'fernando','ricardo','eduardo','alberto','raul','oscar','sergio','victor','hector','jorge',
  'roberto','alejandro','diego','rafael','gabriel','angel','arturo','ivan','marco','mario',
  'maria','ana','laura','carmen','rosa','isabel','sofia','daniela','andrea','valentina',
  'gabriela','patricia','claudia','veronica','monica','adriana','alejandra','paola','lucia','elena',
]);
function looksLikePersonName(value) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const first = words[0].toLowerCase().replace(/[^a-z]/g, '');
  if (!COMMON_FIRST_NAMES.has(first)) return false;
  if (words.length === 1) return true; // a bare common first name, e.g. "Maria"
  return /^[A-Z][a-z]+$/.test(words[1]); // first name + capitalized second word looks like a surname
}

function fishboneCauseNudge(catId, value) {
  if (!value) return null;
  if (catId === 'people' && looksLikePersonName(value)) {
    return 'Looks like a name. Redirect: what about how this role is set up allowed the error to happen?';
  }
  return null;
}

function FishboneGuidePanel({ catId }) {
  const [open, setOpen] = useState(false);
  const g = FISHBONE_GUIDE[catId];
  if (!g) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#64748b', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        {open ? '▾' : '▸'} {open ? 'Hide guide' : 'Show guide for this category'}
      </button>
      {open && (
        <div style={{ marginTop: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.73rem', color: '#475569', lineHeight: 1.6 }}>
          <p style={{ fontWeight: 700, color: '#0f2044', margin: '0 0 4px' }}>Goal</p>
          <p style={{ margin: '0 0 8px' }}>{g.goal}</p>
          <p style={{ fontWeight: 700, color: '#0f2044', margin: '0 0 4px' }}>Ask yourself</p>
          <ul style={{ margin: '0 0 8px', paddingLeft: 16 }}>
            {g.prompts.map((p, i) => <li key={i} style={{ marginBottom: 2 }}>{p}</li>)}
          </ul>
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 6, padding: '5px 8px', color: '#713f12', fontSize: '0.71rem' }}>
            <span style={{ fontWeight: 700 }}>Watch for: </span>{g.watchFor}
          </div>
        </div>
      )}
    </div>
  );
}

function CatCard({ cat, position, causes, onUpdate, effectText }) {
  const clip = position === 'top'
    ? 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
    : 'polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%)';
  return (
    <div style={{ background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 6px rgba(15,32,68,0.08)', border: '1px solid #e8edf5' }}>
      <div style={{ padding: '5px 14px', background: cat.color, color: 'white', fontWeight: 700, fontSize: '0.78rem', clipPath: clip }}>
        {cat.label}
      </div>
      <div style={{ padding: '7px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {causes[cat.id].map((v, i) => {
          const nudge = fishboneCauseNudge(cat.id, v);
          // Warn if cause text repeats the effect statement
          const isSymptom = effectText && v.trim().length > 5 && effectText.trim().toLowerCase().includes(v.trim().toLowerCase().slice(0, 12));
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: cat.color, fontSize: '0.68rem', fontWeight: 900, flexShrink: 0 }}>→</span>
                <textarea
                  rows={1}
                  style={{ flex: 1, border: `1px solid ${nudge || isSymptom ? '#fde047' : '#e2e8f0'}`, borderRadius: 6, padding: '3px 7px', fontSize: '0.75rem', outline: 'none', color: '#475569', background: 'white', resize: 'vertical', minHeight: 24, overflowY: 'auto', fontFamily: 'inherit', lineHeight: 1.35 }}
                  value={v}
                  onChange={e => onUpdate(cat.id, i, e.target.value)}
                  placeholder={`Cause ${i + 1}...`}
                />
              </div>
              {nudge && (
                <p style={{ margin: '3px 0 0 14px', fontSize: '0.68rem', color: '#92400e', background: '#fef9c3', borderRadius: 5, padding: '2px 7px', lineHeight: 1.4 }}>⚠️ {nudge}</p>
              )}
              {!nudge && isSymptom && (
                <p style={{ margin: '3px 0 0 14px', fontSize: '0.68rem', color: '#92400e', background: '#fef9c3', borderRadius: 5, padding: '2px 7px', lineHeight: 1.4 }}>⚠️ This looks like a restatement of the effect. Ask "why" one more time — what caused this?</p>
              )}
            </div>
          );
        })}
        <FishboneGuidePanel catId={cat.id} />
      </div>
    </div>
  );
}

const TOP_CATS    = [
  { id: 'people',      label: 'People',      color: '#0d9488' },
  { id: 'process',     label: 'Process',     color: '#1e3a6e' },
  { id: 'materials',   label: 'Materials',   color: '#f59e0b' },
];
const BOTTOM_CATS = [
  { id: 'machine',     label: 'Machine',     color: '#0d9488' },
  { id: 'environment', label: 'Environment', color: '#1e3a6e' },
  { id: 'measurement', label: 'Measurement', color: '#f59e0b' },
];
const ALL_CATS = [...TOP_CATS, ...BOTTOM_CATS];
const FISHBONE_MIN_CATEGORIES = 4; // of 6 (People/Process/Materials/Machine/Environment/Measurement)

// A fishbone earns its points only when at least FISHBONE_MIN_CATEGORIES of the
// 6 categories each have at least one filled-in cause. Saving is always allowed —
// this only gates the +5 pts, per the "at least one cause per category, 4 of 6" rule.
function fishboneCategoriesFilled(causes = {}) {
  return ALL_CATS.filter(c => (causes[c.id] || []).some(v => (v || '').trim())).length;
}
const emptyCauses = () => Object.fromEntries(ALL_CATS.map(c => [c.id, ['', '', '']]));

function fishbonePrintHTML(entry) {
  const { name, problem, causes } = entry.data;
  const date = entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  function catHTML(cat) {
    const items = (causes[cat.id] || []).map(v =>
      `<p style="margin:3px 0;font-size:0.78rem;color:${v ? '#1e293b' : '#cbd5e1'};font-style:${v ? 'normal' : 'italic'}">${v || '—'}</p>`
    ).join('');
    return `<div style="border:2px solid ${cat.color};border-radius:8px;overflow:hidden">
      <div style="background:${cat.color};color:white;font-weight:700;font-size:0.8rem;padding:4px 10px">${cat.label}</div>
      <div style="padding:6px 10px">${items}</div>
    </div>`;
  }
  return `<div style="font-family:sans-serif;padding:24px;background:white">
    <div style="margin-bottom:14px;border-bottom:2px solid #0f2044;padding-bottom:10px">
      <h2 style="margin:0 0 4px;color:#0f2044;font-size:1.1rem;font-weight:900">Fishbone (Ishikawa) Diagram</h2>
      <p style="margin:0;font-size:0.8rem;color:#64748b"><strong>Name:</strong> ${name || entry.title || '—'} &nbsp;|&nbsp; <strong>Effect:</strong> ${problem || '—'} &nbsp;|&nbsp; <strong>Date:</strong> ${date}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:4px">${TOP_CATS.map(catHTML).join('')}</div>
    <div style="position:relative;height:48px;margin:2px 0">
      <svg width="100%" height="48" style="display:block">
        <defs><marker id="a" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#0f2044"/></marker></defs>
        <line x1="0" y1="24" x2="88%" y2="24" stroke="#0f2044" stroke-width="3" marker-end="url(#a)"/>
        <line x1="16.5%" y1="0" x2="24%" y2="24" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="49.5%" y1="0" x2="50%" y2="24" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="82.5%" y1="0" x2="73%" y2="24" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="24%" y1="24" x2="16.5%" y2="48" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="50%" y1="24" x2="49.5%" y2="48" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="73%" y1="24" x2="82.5%" y2="48" stroke="#94a3b8" stroke-width="1.5"/>
      </svg>
      <div style="position:absolute;right:0;top:50%;transform:translateY(-50%);background:#ef4444;color:white;padding:4px 8px;border-radius:0 6px 6px 0;font-weight:700;font-size:0.68rem;max-width:11%;text-align:center;word-break:break-word;line-height:1.3">${problem || 'Effect'}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px">${BOTTOM_CATS.map(catHTML).join('')}</div>
  </div>`;
}

function Fishbone({ onSave, savedEntries, onDelete }) {
  const [name,    setName]    = useState('');
  const [problem, setProblem] = useState('');
  const [causes,  setCauses]  = useState(emptyCauses);
  const [saving,  setSaving]  = useState(false);

  const effectReady = problem.trim().length >= 15;
  const effectWarn  = problemStatementWarning(problem);

  function updateCause(catId, idx, val) {
    setCauses(c => ({ ...c, [catId]: c[catId].map((v, i) => i === idx ? val : v) }));
  }

  function loadEntry(e) {
    setName(e.data.name || e.title || '');
    setProblem(e.data.problem || '');
    setCauses(e.data.causes || emptyCauses());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function printEntry(e) {
    const win = window.open('', '_blank', 'width=1000,height=750');
    win.document.write(`<html><head><title>${e.title}</title><style>body{margin:0}@media print{@page{size:landscape;margin:12mm}}</style></head><body>${fishbonePrintHTML(e)}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function handlePrintCurrent() {
    printEntry({ id: 'cur', title: name, data: { name, problem, causes }, createdAt: null });
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Please enter a diagram name before saving');
    setSaving(true);
    await onSave({ type: 'fishbone', title: name, data: { name, problem, causes }, onSaved: () => { setName(''); setProblem(''); setCauses(emptyCauses()); } });
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Name */}
        <div>
          <label className="label">Diagram Name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 Defect Analysis" />
        </div>

        {/* Effect Gate */}
        <div style={{ background: '#f8fafc', border: `2px solid ${effectReady ? '#ef4444' : '#e2e8f0'}`, borderRadius: 12, padding: '1rem', transition: 'border-color 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '1rem' }}>🐟</span>
            <label className="label" style={{ margin: 0, color: '#0f2044' }}>Effect / Problem (Fish Head)</label>
            {effectReady && <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#b91c1c', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>Ready</span>}
          </div>
          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 8px', lineHeight: 1.5 }}>
            Specific, factual, measurable — everything branches off this statement.<br />
            <span style={{ color: '#ef4444' }}>✗</span> "Quality is bad on Line 3" &nbsp;→&nbsp;
            <span style={{ color: '#0d9488' }}>✓</span> "Line 3 defect rate increased from 2% to 9% over the last two weeks"
          </p>
          <input className="input" value={problem} onChange={e => setProblem(e.target.value)}
            placeholder="What happened? How often? Include a number." />
          {effectWarn && (
            <div style={{ marginTop: 6, fontSize: '0.73rem', color: '#92400e', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '5px 10px' }}>
              💡 {effectWarn}
            </div>
          )}
          {!effectReady && problem.trim().length > 0 && (
            <p style={{ marginTop: 6, fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>Add more detail to unlock the cause categories below.</p>
          )}
        </div>

        {/* Diagram */}
        {effectReady ? (
          <>
            <div style={{ background: '#f8fafc', borderRadius: 16, padding: '12px', border: '1px solid #e8edf5' }}>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
                <strong style={{ color: '#0f2044' }}>How to brainstorm:</strong> Go category by category — don't jump around. Capture everything first, filter later. If a cause appears in more than one category, it's likely your highest-priority lead.
              </p>
              <div style={{ background: 'white', borderRadius: 12, padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {TOP_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="top" causes={causes} onUpdate={updateCause} effectText={problem} />)}
                </div>
                <div style={{ position: 'relative', height: 64, margin: '2px 0' }}>
                  <svg width="100%" height="64" style={{ display: 'block' }}>
                    <defs>
                      <marker id="fb-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#0f2044" />
                      </marker>
                    </defs>
                    <line x1="0" y1="32" x2="88%" y2="32" stroke="#0f2044" strokeWidth="4" strokeLinecap="round" markerEnd="url(#fb-arrow)" />
                    <line x1="16.5%" y1="0"   x2="24%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="49.5%" y1="0"   x2="50%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="82.5%" y1="0"   x2="73%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="24%"  y1="32" x2="16.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="50%"  y1="32" x2="49.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="73%"  y1="32" x2="82.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
                  </svg>
                  <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: '#ef4444', color: 'white', padding: '5px 10px', borderRadius: '0 10px 10px 0', fontWeight: 700, fontSize: '0.72rem', maxWidth: '11%', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {problem}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {BOTTOM_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="bottom" causes={causes} onUpdate={updateCause} effectText={problem} />)}
                </div>
              </div>
            </div>

            {/* Self-check */}
            <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12, padding: '0.9rem' }}>
              <p style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.8rem', margin: '0 0 6px' }}>✅ Before you save — quick self-check</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.74rem', color: '#0c4a6e', lineHeight: 1.8 }}>
                <li>At least {FISHBONE_MIN_CATEGORIES} of the 6 categories have an entry — that's the minimum to earn the +5 pts (a category left empty usually means the team didn't push hard enough, not that nothing is there)</li>
                <li>No cause is just a restatement of the effect in different words</li>
                <li>Any cause that appeared in more than one category is starred as a priority to investigate first</li>
                <li>Each starred cause has a clear next step: verify with data, then test a fix</li>
              </ul>
            </div>
          </>
        ) : (
          <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
            <p style={{ margin: 0, fontSize: '1.5rem', marginBottom: 8 }}>🔒</p>
            <p style={{ margin: 0, fontWeight: 600 }}>Fill in the Effect above to unlock the cause categories</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem' }}>A specific, measurable effect statement prevents every category from filling up with guesses.</p>
          </div>
        )}

        {(() => {
          const filledCats = fishboneCategoriesFilled(causes);
          const qualifies = filledCats >= FISHBONE_MIN_CATEGORIES;
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.875rem', borderRadius: 10,
              background: qualifies ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${qualifies ? '#86efac' : '#e2e8f0'}`,
            }}>
              <span style={{ fontSize: '0.95rem' }}>{qualifies ? '✅' : '🎯'}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: qualifies ? '#15803d' : '#475569' }}>
                {filledCats}/6 categories have a cause — {qualifies
                  ? 'you qualify for +5 pts on save'
                  : `fill in ${FISHBONE_MIN_CATEGORIES - filledCats} more to earn +5 pts`}
              </span>
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : '💾 Save Diagram'}
          </button>
          <button onClick={handlePrintCurrent}
            style={{ flex: 1, background: '#0f2044', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>
      <SavedPanel entries={savedEntries} onDelete={onDelete} onLoad={loadEntry} printEntry={printEntry} />
    </div>
  );
}

// ─── A3 Template ─────────────────────────────────────────────────────────────

const A3_GUIDE = {
  background: {
    label: '2. Background',
    goal: 'Give enough context that someone outside the team understands why this matters — business impact, not just technical detail.',
    prompts: [
      'Why does this problem matter to the business or customer?',
      'What\'s the cost of not solving it (cost, delivery, safety, quality)?',
      'What triggered this A3 — a complaint, an internal metric, an audit finding?',
    ],
    watchFor: null,
    placeholder: 'What is the business context? Why does this matter?',
  },
  currentState: {
    label: '3. Current Condition',
    goal: 'Show the facts as they are today — with data, not opinion.',
    prompts: [
      'What does the data show over time (trend, Pareto, run chart)?',
      'Where exactly does this happen (which line, shift, part, customer)?',
      'What is the gap between current performance and the target?',
    ],
    watchFor: 'Write facts, not conclusions. "The process is broken" is not a current condition — "Defect rate is 9%, up from 2%, concentrated on 2nd shift" is.',
    placeholder: 'Describe current performance with data. Numbers, location, trend.',
  },
  targetState: {
    label: '4. Goal / Target',
    goal: 'A specific, measurable, time-bound target — not "improve" or "reduce."',
    prompts: [
      'What number, by what date?',
      'Is this target realistic given the current condition, or is it aspirational?',
      'How will you know you\'ve hit it — what\'s the measurement?',
    ],
    watchFor: 'Vague targets ("improve quality") make it impossible to know if you succeeded. Every target needs a number and a date.',
    placeholder: 'e.g. Reduce defect rate from 9% to 2% by Sept 30, measured weekly.',
  },
  rootCause: {
    label: '5. Root Cause Analysis',
    goal: 'This is where 5 Whys and/or Fishbone live. The A3 just needs the summary of that work.',
    prompts: [
      'What tool did you use (5 Whys, Fishbone, both)?',
      'What\'s the root cause, in one sentence?',
      'Is this root cause verified by data, or still a hypothesis?',
    ],
    watchFor: null,
    placeholder: 'Summarize your root cause analysis. Reference your 5 Whys or Fishbone if completed.',
  },
  countermeasures: {
    label: '6. Countermeasures',
    goal: 'Actions that address the root cause — not the symptom.',
    prompts: [
      'Does each countermeasure map directly to a root cause identified above?',
      'Is this a permanent fix or a temporary containment? (Label it either way.)',
      'What\'s the smallest test of this countermeasure before rolling it out fully?',
    ],
    watchFor: 'Countermeasures that don\'t connect to the root cause are just workarounds — they\'ll need to be repeated.',
    placeholder: 'List each countermeasure. Note whether each is permanent (P) or containment (C).',
  },
  implementationPlan: {
    label: '7. Implementation Plan',
    goal: 'Who does what, by when — turn countermeasures into a real plan.',
    prompts: [
      'Who owns each action?',
      'What\'s the due date for each one?',
      'What could block this plan, and who removes that blocker?',
    ],
    watchFor: null,
    placeholder: 'Action | Owner | Due Date — one per line.',
  },
  followUp: {
    label: '8. Follow-up / Results',
    goal: 'Close the loop — did it work, and how do you know?',
    prompts: [
      'What does the data show after the countermeasure, compared to before?',
      'Did you hit the target from step 4?',
      'What\'s the plan to sustain this (standard work, audit, visual control)?',
    ],
    watchFor: null,
    placeholder: 'What happened after implementation? Did the data move? What sustains the fix?',
  },
};

function A3GuidePanel({ fieldKey }) {
  const [open, setOpen] = useState(false);
  const g = A3_GUIDE[fieldKey];
  if (!g) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        {open ? '▾' : '▸'} {open ? 'Hide guide' : 'Show guide for this section'}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: '0.76rem', color: '#475569', lineHeight: 1.6 }}>
          <p style={{ fontWeight: 700, color: '#0f2044', margin: '0 0 4px' }}>Goal</p>
          <p style={{ margin: '0 0 10px' }}>{g.goal}</p>
          <p style={{ fontWeight: 700, color: '#0f2044', margin: '0 0 4px' }}>Ask yourself</p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            {g.prompts.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
          </ul>
          {g.watchFor && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '6px 10px', color: '#713f12' }}>
              <span style={{ fontWeight: 700 }}>Watch for: </span>{g.watchFor}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_IMPL_ROW = () => ({ id: Date.now() + Math.random(), action: '', owner: '', dueDate: '' });
const EMPTY_A3 = { background: '', currentState: '', targetState: '', rootCause: '', countermeasures: '', implementationPlan: [EMPTY_IMPL_ROW()], followUp: '', followUpDate: '', followUpVerification: '' };
const A3_PRINT_FIELDS = [
  { key: 'background',         label: '2. Background' },
  { key: 'currentState',       label: '3. Current Condition' },
  { key: 'targetState',        label: '4. Goal / Target' },
  { key: 'rootCause',          label: '5. Root Cause Analysis' },
  { key: 'countermeasures',    label: '6. Countermeasures' },
  { key: 'implementationPlan', label: '7. Implementation Plan' },
  { key: 'followUp',           label: '8. Follow-up / Results' },
];

function nl2br(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function fmtPrintDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; }
}

function a3SectionHTML(num, label, content) {
  // Implementation plan — array of rows
  if (Array.isArray(content)) {
    const hasRows = content.some(r => r.action || r.owner || r.dueDate);
    const rowsHTML = hasRows
      ? content.filter(r => r.action || r.owner || r.dueDate).map((r, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
            <td style="padding:6px 10px;border-bottom:1px solid #e8edf5;font-size:12px;color:#1e293b;">${nl2br(r.action) || '—'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e8edf5;font-size:12px;color:#475569;">${nl2br(r.owner) || '—'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e8edf5;font-size:12px;color:#475569;white-space:nowrap;">${fmtPrintDate(r.dueDate)}</td>
          </tr>`).join('')
      : `<tr><td colspan="3" style="padding:10px;font-size:12px;color:#94a3b8;font-style:italic;">No actions entered</td></tr>`;
    return `
      <div style="border-bottom:1px solid #dde3ec;">
        <div style="background:#0f2044;padding:5px 14px;display:flex;align-items:center;gap:8px;">
          <span style="font-family:Georgia,serif;font-size:10px;color:#0d9488;font-weight:700;min-width:16px;">${num}</span>
          <span style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:white;">${label}</span>
        </div>
        <div style="padding:10px 14px;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #e8edf5;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #dde3ec;">Action</th>
                <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #dde3ec;width:120px;">Owner</th>
                <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #dde3ec;width:100px;">Due Date</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>`;
  }
  // Regular text section
  const filled = content && content.trim().length > 0;
  return `
    <div style="border-bottom:1px solid #dde3ec;">
      <div style="background:#0f2044;padding:5px 14px;display:flex;align-items:center;gap:8px;">
        <span style="font-family:Georgia,serif;font-size:10px;color:#0d9488;font-weight:700;min-width:16px;">${num}</span>
        <span style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:white;">${label}</span>
      </div>
      <div style="padding:12px 14px;font-size:12.5px;line-height:1.65;color:${filled ? '#1e293b' : '#94a3b8'};font-style:${filled ? 'normal' : 'italic'};min-height:52px;white-space:pre-wrap;">${filled ? nl2br(content) : 'Not filled in'}</div>
    </div>`;
}

function a3PrintHTML(entry) {
  const d = entry.data;
  const dateStr = entry.createdAt
    ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const leftSections = [
    { num: '01', label: 'Background',         key: 'background'   },
    { num: '02', label: 'Current Condition',  key: 'currentState' },
    { num: '03', label: 'Goal / Target',      key: 'targetState'  },
    { num: '04', label: 'Root Cause Analysis',key: 'rootCause'    },
  ];
  const followUpContent = d.followUp || '';
  const followUpExtra = (d.followUpDate || d.followUpVerification)
    ? `\n\n📅 Follow-up scheduled: ${d.followUpDate ? new Date(d.followUpDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : '—'}` +
      (d.followUpVerification ? `\nVerification: ${d.followUpVerification}` : '')
    : '';

  const rightSections = [
    { num: '05', label: 'Countermeasures',    key: 'countermeasures'    },
    { num: '06', label: 'Implementation Plan',key: 'implementationPlan' },
    { num: '07', label: 'Follow-up / Results',key: '_followUp'          },
  ];
  d._followUp = followUpContent + followUpExtra;

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>A3 — ${entry.title || 'Untitled'}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;background:#f8f9fb;padding:2rem;}
    .doc{max-width:1020px;margin:0 auto;background:#fff;border:1px solid #dde3ec;border-radius:4px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);}
    .hdr{background:#0f2044;color:white;}
    .hdr-top{display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.12);}
    .a3-badge{font-family:Georgia,serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.45);writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);padding:1rem 0.6rem;border-right:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.15);flex-shrink:0;}
    .hdr-body{flex:1;padding:1.25rem 1.5rem 1rem;}
    .doc-title{font-family:Georgia,serif;font-size:20px;font-weight:700;color:#fff;line-height:1.2;margin-bottom:0.5rem;}
    .teal-bar{width:36px;height:3px;background:#0d9488;border-radius:2px;margin-bottom:0.75rem;}
    .meta-row{display:flex;flex-wrap:wrap;gap:1.5rem;}
    .meta-item{display:flex;flex-direction:column;gap:2px;}
    .meta-label{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;}
    .meta-value{font-size:12px;color:rgba(255,255,255,0.9);font-weight:500;}
    .hdr-team{padding:0.6rem 1.5rem 0.6rem 2.8rem;font-size:11.5px;color:rgba(255,255,255,0.55);border-top:1px solid rgba(255,255,255,0.07);}
    .hdr-team strong{color:rgba(255,255,255,0.75);}
    .body{display:grid;grid-template-columns:1fr 1fr;border-top:3px solid #0d9488;}
    .col-l{border-right:1px solid #dde3ec;}
    .footer{background:#f1f5f9;border-top:1px solid #dde3ec;padding:0.55rem 1.5rem;display:flex;justify-content:space-between;font-size:10px;color:#64748b;}
    @media print{body{background:white;padding:0}.doc{box-shadow:none;border:none;border-radius:0;max-width:100%}@page{margin:0.45in;size:letter}}
  </style>
  </head><body>
  <div class="doc">
    <div class="hdr">
      <div class="hdr-top">
        <div class="a3-badge">A3 Report</div>
        <div class="hdr-body">
          <div class="doc-title">${nl2br(entry.title || 'Untitled A3')}</div>
          <div class="teal-bar"></div>
          <div class="meta-row">
            <div class="meta-item"><span class="meta-label">Owner</span><span class="meta-value">${d.owner || '—'}</span></div>
            <div class="meta-item"><span class="meta-label">Date Started</span><span class="meta-value">${d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : dateStr}</span></div>
            <div class="meta-item"><span class="meta-label">Printed</span><span class="meta-value">${dateStr}</span></div>
          </div>
        </div>
      </div>
      ${d.team ? `<div class="hdr-team"><strong>Team:</strong> ${nl2br(d.team)}</div>` : ''}
    </div>
    <div class="body">
      <div class="col-l">${leftSections.map(s => a3SectionHTML(s.num, s.label, d[s.key])).join('')}</div>
      <div>${rightSections.map(s => a3SectionHTML(s.num, s.label, d[s.key])).join('')}</div>
    </div>
    <div class="footer">
      <span>Accountability App · A3 Problem-Solving Report</span>
      <span>accountability-app.com</span>
    </div>
  </div>
  <script>setTimeout(()=>{window.print();},400);<\/script>
  </body></html>`;
}

function A3Template({ onSave, savedEntries, onDelete, prefill, onPrefillConsumed }) {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [team,  setTeam]  = useState('');
  const [date,  setDate]  = useState('');
  const [form,  setForm]  = useState(EMPTY_A3);

  useEffect(() => {
    if (!prefill) return;
    setTitle(prefill.title || '');
    setForm(f => ({ ...f, background: prefill.background || '', rootCause: prefill.rootCause || '' }));
    onPrefillConsumed?.();
    toast.success('A3 pre-filled from your 5 Whys analysis');
  }, [prefill]);

  function loadEntry(e) {
    setTitle(e.title || '');
    setOwner(e.data.owner || '');
    setTeam(e.data.team || '');
    setDate(e.data.date || '');
    // Migrate old string implementationPlan to array format
    const rawImpl = e.data.implementationPlan;
    const impl = Array.isArray(rawImpl)
      ? rawImpl
      : (rawImpl ? [{ id: Date.now(), action: rawImpl, owner: '', dueDate: '' }] : [EMPTY_IMPL_ROW()]);
    setForm({ ...EMPTY_A3, ...e.data, implementationPlan: impl, followUpDate: e.data.followUpDate || '', followUpVerification: e.data.followUpVerification || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function printEntry(e) {
    const win = window.open('', '_blank', 'width=1060,height=860');
    win.document.write(a3PrintHTML(e));
    win.document.close();
    win.focus();
  }

  function handlePrintCurrent() {
    printEntry({ id: 'cur', title: title || 'Untitled A3', data: { ...form, owner, team, date }, createdAt: null });
  }

  function openExample() {
    window.open('/a3-example.html', '_blank', 'width=1100,height=860');
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Example guide banner */}
        <div style={{ background: 'linear-gradient(90deg,#0f2044,#1e3a6e)', borderRadius: 12, padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', margin: '0 0 2px' }}>📋 New to A3? See a completed example.</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', margin: 0 }}>A filled-in A3 showing a real manufacturing defect reduction project — same format, same sections.</p>
          </div>
          <button onClick={openExample}
            style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 9, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            View Worked Example →
          </button>
        </div>

        {/* Section 1 — Title, Owner, Team, Date */}
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <span style={{ background: '#0f2044', color: 'white', fontWeight: 800, fontSize: '0.72rem', borderRadius: 6, padding: '2px 8px' }}>1</span>
            <p style={{ fontWeight: 700, color: '#0f2044', fontSize: '0.85rem', margin: 0 }}>Title, Owner, Team & Date</p>
          </div>
          <p style={{ fontSize: '0.73rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
            Frame accountability before anything else — who owns this, who's involved, and when it started.<br />
            Use the shortest possible title that describes the <em>problem</em>, not the solution.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label className="label">Title *</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Line 3 Defect Rate Increase — July 2026" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label className="label">Owner (single accountable person)</label>
                <input className="input" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Name" />
              </div>
              <div>
                <label className="label">Team / Others involved</label>
                <input className="input" value={team} onChange={e => setTeam(e.target.value)} placeholder="Names or roles" />
              </div>
              <div>
                <label className="label">Date started</label>
                <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Sections 2–8 */}
        {Object.entries(A3_GUIDE).map(([key, g], idx) => {
          const isImpl = key === 'implementationPlan';
          const implRows = form.implementationPlan || [EMPTY_IMPL_ROW()];
          const implFilled = implRows.some(r => r.action || r.owner || r.dueDate);
          const textFilled = !isImpl && typeof form[key] === 'string' && form[key].trim().length > 0;
          return (
            <div key={key} style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1rem', boxShadow: '0 1px 4px rgba(15,32,68,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ background: '#0f2044', color: 'white', fontWeight: 800, fontSize: '0.72rem', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{idx + 2}</span>
                <label className="label" style={{ margin: 0, color: '#0f2044', fontSize: '0.85rem' }}>{g.label.replace(/^\d+\.\s/, '')}</label>
                {(isImpl ? implFilled : textFilled) && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.68rem', background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>✓ Filled</span>
                )}
              </div>

              {key === 'followUp' ? (
                /* ── Follow-up / Results section ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.followUp}
                    onChange={e => setForm(f => ({ ...f, followUp: e.target.value }))}
                    placeholder={g.placeholder}
                  />

                  {/* Follow-up notification scheduler */}
                  <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 10, padding: '0.85rem 1rem' }}>
                    <p style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.8rem', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      🔔 Schedule a Follow-up Verification
                    </p>
                    <p style={{ fontSize: '0.72rem', color: '#0c4a6e', margin: '0 0 10px', lineHeight: 1.5 }}>
                      Set a reminder to verify the fix is holding. Choose a preset or pick a custom date.
                    </p>

                    {/* Quick-select buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {[30, 60, 90].map(days => {
                        const d = new Date(); d.setDate(d.getDate() + days);
                        const iso = d.toISOString().slice(0, 10);
                        const active = form.followUpDate === iso;
                        return (
                          <button key={days}
                            onClick={() => setForm(f => ({ ...f, followUpDate: iso }))}
                            style={{ padding: '0.4rem 1rem', borderRadius: 8, border: `1.5px solid ${active ? '#0369a1' : '#bae6fd'}`, background: active ? '#0369a1' : 'white', color: active ? 'white' : '#0369a1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                            {days} Days
                          </button>
                        );
                      })}
                      <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', margin: '0 4px' }}>or pick a date:</span>
                      <input
                        type="date"
                        className="input"
                        value={form.followUpDate}
                        onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))}
                        style={{ margin: 0, width: 'auto', flex: '0 0 160px' }}
                      />
                      {form.followUpDate && (
                        <button onClick={() => setForm(f => ({ ...f, followUpDate: '' }))}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px' }} title="Clear date">✕</button>
                      )}
                    </div>

                    {/* Verification action */}
                    <label className="label" style={{ marginBottom: 4 }}>Verification Action</label>
                    <input
                      className="input"
                      value={form.followUpVerification}
                      onChange={e => setForm(f => ({ ...f, followUpVerification: e.target.value }))}
                      placeholder="e.g. Review weekly defect rate for 3 consecutive weeks below 2.5%"
                      style={{ margin: 0 }}
                    />

                    {/* Confirmation chip if date is set */}
                    {form.followUpDate && (
                      <div style={{ marginTop: 10, background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 7, padding: '6px 10px', fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>
                        📅 Follow-up scheduled for {new Date(form.followUpDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                        {form.followUpVerification && <> — <em style={{ fontWeight: 400 }}>{form.followUpVerification}</em></>}
                      </div>
                    )}
                  </div>
                </div>
              ) : isImpl ? (
                /* ── Implementation Plan grid ── */
                <div>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 36px', gap: 6, marginBottom: 4 }}>
                    {['Action', 'Owner', 'Due Date', ''].map(h => (
                      <span key={h} style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px' }}>{h}</span>
                    ))}
                  </div>

                  {/* Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {implRows.map((row, ri) => (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 36px', gap: 6, alignItems: 'center' }}>
                        <input
                          className="input"
                          value={row.action}
                          onChange={e => setForm(f => ({ ...f, implementationPlan: f.implementationPlan.map((r, i) => i === ri ? { ...r, action: e.target.value } : r) }))}
                          placeholder="What needs to be done?"
                          style={{ margin: 0 }}
                        />
                        <input
                          className="input"
                          value={row.owner}
                          onChange={e => setForm(f => ({ ...f, implementationPlan: f.implementationPlan.map((r, i) => i === ri ? { ...r, owner: e.target.value } : r) }))}
                          placeholder="Name"
                          style={{ margin: 0 }}
                        />
                        <input
                          className="input"
                          type="date"
                          value={row.dueDate}
                          onChange={e => setForm(f => ({ ...f, implementationPlan: f.implementationPlan.map((r, i) => i === ri ? { ...r, dueDate: e.target.value } : r) }))}
                          style={{ margin: 0 }}
                        />
                        <button
                          onClick={() => setForm(f => ({ ...f, implementationPlan: f.implementationPlan.filter((_, i) => i !== ri) }))}
                          disabled={implRows.length === 1}
                          title="Remove row"
                          style={{ width: 32, height: 32, border: 'none', borderRadius: 7, background: implRows.length === 1 ? '#f1f5f9' : '#fee2e2', color: implRows.length === 1 ? '#cbd5e1' : '#ef4444', cursor: implRows.length === 1 ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add row */}
                  <button
                    onClick={() => setForm(f => ({ ...f, implementationPlan: [...f.implementationPlan, EMPTY_IMPL_ROW()] }))}
                    style={{ marginTop: 10, background: 'none', border: '1.5px dashed #0d9488', color: '#0d9488', borderRadius: 8, padding: '0.4rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', width: '100%' }}>
                    + Add Action Row
                  </button>
                </div>
              ) : (
                <textarea
                  className="input"
                  rows={3}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={g.placeholder}
                />
              )}

              <A3GuidePanel fieldKey={key} />
            </div>
          );
        })}

        {/* Self-check */}
        <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12, padding: '0.9rem' }}>
          <p style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.8rem', margin: '0 0 6px' }}>✅ Before you save — quick self-check</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.74rem', color: '#0c4a6e', lineHeight: 1.8 }}>
            <li>Current condition has data, not just opinion</li>
            <li>Target has a number and a date — not just "improve"</li>
            <li>Each countermeasure maps to a root cause (not a symptom)</li>
            <li>Implementation plan names one owner per action with a due date</li>
            <li>Follow-up section will be completed after implementation — not left blank forever</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" style={{ flex: 1 }}
            onClick={() => onSave({ type: 'a3', title: title || 'Untitled A3', data: { ...form, owner, team, date }, onSaved: () => { setTitle(''); setOwner(''); setTeam(''); setDate(''); setForm(EMPTY_A3); } })}>
            💾 Save A3
          </button>
          <button onClick={handlePrintCurrent}
            style={{ flex: 1, background: '#0f2044', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            🖨️ Print / Export PDF
          </button>
        </div>
      </div>
      <SavedPanel entries={savedEntries} onDelete={onDelete} onLoad={loadEntry} printEntry={printEntry} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProblemSolving() {
  const { currentUser } = useAuth();
  const [activeTool, setActiveTool] = useState('5 Whys');
  const [saved, setSaved]           = useState({ '5whys': [], fishbone: [], a3: [] });
  const [a3Prefill, setA3Prefill]   = useState(null);

  async function fetchSaved() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const all = snap.exists() ? (snap.data().problemSolving || []) : [];
      setSaved({
        '5whys':    all.filter(e => e.type === '5whys'),
        fishbone:   all.filter(e => e.type === 'fishbone'),
        a3:         all.filter(e => e.type === 'a3'),
      });
    } catch (e) { console.error('fetchSaved:', e); }
  }

  async function persist(updated) {
    await setDoc(doc(db, 'users', currentUser.uid), { problemSolving: updated }, { merge: true });
    setSaved({
      '5whys':    updated.filter(e => e.type === '5whys'),
      fishbone:   updated.filter(e => e.type === 'fishbone'),
      a3:         updated.filter(e => e.type === 'a3'),
    });
  }

  useEffect(() => { fetchSaved(); }, [currentUser]);

  async function maybeLogPSPoints(type) {
    const cfg = PS_EVENT_LABELS[type];
    if (!cfg) return false;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const events = snap.exists() ? (snap.data().pointEvents || []) : [];
      const thisWeek = weekMonday(new Date().toISOString().split('T')[0]);
      const alreadyEarned = events.some(
        e => e.toolLabel === cfg.label && weekMonday(e.date) === thisWeek
      );
      if (!alreadyEarned) {
        const { awarded, capReached } = await logPointEvent(currentUser.uid, {
          points: cfg.points,
          toolLabel: cfg.label,
          reason: `Completed ${cfg.label} this week`,
        });
        return awarded ? 'earned' : capReached ? 'capped' : false;
      }
    } catch {}
    return false;
  }

  async function handleSave({ type, title, data, onSaved }) {
    if (!currentUser) return toast.error('Not signed in');
    try {
      const all = [...saved['5whys'], ...saved.fishbone, ...saved.a3];
      const existing = saved[type]?.find(e => e.title.trim().toLowerCase() === title.trim().toLowerCase());
      let updated;
      if (existing) {
        updated = all.map(e => e.id === existing.id ? { ...e, title, data, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : e);
        toast.success('Template updated!');
        await persist(updated);
        return; // keep the form (and any manual textarea resizing) as-is — don't wipe an in-progress edit
      } else {
        const newEntry = {
          id: Date.now().toString(),
          uid: currentUser.uid,
          type,
          title,
          data,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        };
        updated = [newEntry, ...all];

        // Fishbone only qualifies for points once at least 4 of the 6 cause
        // categories each have a cause filled in — saving is always allowed either way.
        if (type === 'fishbone') {
          const filledCats = fishboneCategoriesFilled(data.causes);
          if (filledCats < FISHBONE_MIN_CATEGORIES) {
            toast.success(`Template saved. Fill in at least ${FISHBONE_MIN_CATEGORIES} of the 6 categories (currently ${filledCats}) to earn +5 pts.`, { duration: 6000 });
            await persist(updated);
            onSaved?.();
            return;
          }
        }

        const earned = await maybeLogPSPoints(type);
        calculateScore(currentUser.uid).catch(() => {});
        if (earned === 'earned') {
          const cfg = PS_EVENT_LABELS[type];
          toast.success(`⭐ Template saved — +${cfg.points} pts for ${cfg.label} this week!`, { duration: 6000, icon: '🌟' });
        } else if (earned === 'capped') {
          toast('Template saved. You\'ve reached your 25-pt daily limit — great work today! Come back tomorrow to keep scoring. 🗓', { duration: 6000, icon: '📅' });
        } else {
          toast.success('Template saved!');
        }
      }
      await persist(updated);
      onSaved?.();
    } catch (e) { toast.error('Save failed: ' + (e?.message || e)); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return;
    try {
      const all = [...saved['5whys'], ...saved.fishbone, ...saved.a3];
      await persist(all.filter(e => e.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader icon="🔍" title="Problem-Solving Tools" subtitle="5 Whys, Fishbone Diagram, and A3 Template" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {TOOLS.map(t => (
          <button key={t} onClick={() => setActiveTool(t)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTool === t ? '#0f2044' : '#f1f5f9', color: activeTool === t ? 'white' : '#475569' }}>
            {t}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', margin: '0 0 1.25rem' }}>{activeTool}</h3>
        {activeTool === '5 Whys' && (
          <FiveWhys
            onSave={handleSave}
            savedEntries={saved['5whys']}
            onDelete={handleDelete}
            onGoToA3={({ title, background, rootCause }) => {
              setA3Prefill({ title, background, rootCause });
              setActiveTool('A3 Template');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
        {activeTool === 'Fishbone Diagram' && <Fishbone   onSave={handleSave} savedEntries={saved.fishbone} onDelete={handleDelete} />}
        {activeTool === 'A3 Template'      && (
          <A3Template
            onSave={handleSave}
            savedEntries={saved.a3}
            onDelete={handleDelete}
            prefill={a3Prefill}
            onPrefillConsumed={() => setA3Prefill(null)}
          />
        )}
      </div>
    </div>
  );
}
