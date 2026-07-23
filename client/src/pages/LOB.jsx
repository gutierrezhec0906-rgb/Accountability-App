import { useState, useEffect, Fragment } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { logPointEvent, calculateScore } from '../utils/scoring';

const LOB_MIN_TASKS = 4;   // named task rows required for the setup point
const LOB_MIN_DATES = 4;   // date columns required for the setup point

// A row is "complete" once any of its cells reaches 100% (the ✓100% carry-forward).
function taskReaches100(task) {
  return (task.cells || []).some(c => parseFloat(c) >= 100);
}
// Structure done: at least 4 named tasks AND at least 4 dates set.
function lobStructureComplete(lob) {
  if (!lob) return false;
  const namedTasks = (lob.tasks || []).filter(t => (t.name || '').trim());
  const setDates = (lob.dates || []).filter(Boolean);
  return namedTasks.length >= LOB_MIN_TASKS && setDates.length >= LOB_MIN_DATES;
}
// Fully complete: every named task reaches 100% (all activities finished).
function lobFullyComplete(lob) {
  if (!lobStructureComplete(lob)) return false;
  const namedTasks = (lob.tasks || []).filter(t => (t.name || '').trim());
  return namedTasks.length > 0 && namedTasks.every(taskReaches100);
}
// A "red slip" = a task still incomplete at a date column that is already past due.
function lobHasRedSlip(lob) {
  if (!lob) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const t of (lob.tasks || [])) {
    if (!(t.name || '').trim()) continue;
    const doneIdx = (t.cells || []).findIndex(c => parseFloat(c) >= 100);
    for (let ci = 0; ci < (lob.dates || []).length; ci++) {
      const d = lob.dates[ci];
      if (!d) continue;
      const due = new Date(d + 'T00:00:00');
      // past-due column: red if this task hadn't reached 100% by here
      if (due < today && (doneIdx === -1 || ci < doneIdx)) return true;
    }
  }
  return false;
}

function blankLOB(name) {
  return {
    id: Date.now(),
    name: name || 'New Line of Balance',
    createdAt: new Date().toISOString(),
    dates: Array(8).fill(''),
    tasks: [],
  };
}

function blankTask(numCols) {
  return { id: Date.now(), name: '', owner: '', cells: Array(numCols).fill('') };
}

function dateCellStyle(dateStr, cellVal) {
  if (!dateStr || cellVal === '') return { bg: '#f1f5f9', text: '#94a3b8' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { bg: '#fee2e2', text: '#dc2626' };
  if (diffDays <= 4) return { bg: '#fef9c3', text: '#b45309' };
  return { bg: '#dcfce7', text: '#15803d' };
}

function colHeaderStyle(dateStr) {
  if (!dateStr) return { bg: '#1e3a6e', text: 'rgba(255,255,255,0.6)' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { bg: '#dc2626', text: 'white' };
  if (diffDays <= 4) return { bg: '#b45309', text: 'white' };
  return { bg: '#15803d', text: 'white' };
}

function fmt(dateStr) {
  if (!dateStr) return 'Set date';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── LOB Guide ────────────────────────────────────────────────────────────────

const LOB_STEPS = [
  {
    id: 'before',
    icon: '📋',
    title: 'Before You Start',
    color: '#0f2044',
    content: `LOB is a planning tool for work that repeats across multiple units — houses in a development, floors in a building, aircraft in a production line, stations on an assembly line. It shows whether each activity is keeping pace with the others, so you can spot a bottleneck before it happens.`,
    checks: [
      'The repeating unit — what\'s being repeated (house, floor, aircraft, station)',
      'The activity sequence — the fixed order of operations on every unit',
      'The production rate — how many units per time period you need to deliver to hit the deadline',
    ],
    prompts: [
      'What is the unit of repetition, and how many units are there total?',
      'What is the required delivery rate (units/week, units/day)?',
      'Is the sequence of activities truly identical unit to unit, or does it vary?',
    ],
    watchFor: 'If the work isn\'t actually repetitive (each unit is different), LOB isn\'t the right tool.',
  },
  {
    id: 'sequence',
    icon: '1️⃣',
    title: 'Step 1 — Confirm the Activity Sequence',
    color: '#0d9488',
    content: 'Lock in the fixed order every unit goes through. Each row in your LOB table is one activity — enter them top-to-bottom in the order they happen on a single unit.',
    prompts: [
      'What are the major activities/trades in order?',
      'Is there a hard dependency between each (can\'t start B until A finishes on that unit), or can they overlap?',
      'Are there any activities that only apply to some units (exceptions)?',
    ],
  },
  {
    id: 'rate',
    icon: '2️⃣',
    title: 'Step 2 — Set the Required Delivery Rate',
    color: '#0d9488',
    content: 'Establish the "master" slope everything else has to match or beat. Your date columns represent checkpoints in time — the spacing between columns should reflect your planned production rate.',
    prompts: [
      'What\'s the contractual or business deadline for the last unit?',
      'Working backward, how many units per week/day does that require?',
      'Is there a required handover rate too (e.g. 2 units/week to the customer), separate from the production rate?',
    ],
  },
  {
    id: 'rates',
    icon: '3️⃣',
    title: 'Step 3 — Determine Each Activity\'s Rate & Duration',
    color: '#f59e0b',
    content: 'Find out how fast each trade/activity can actually go, based on crew size and real productivity — not wishful thinking. Enter this as a % complete per date column.',
    prompts: [
      'How long does this activity take on one unit, with the planned crew size?',
      'How many crews are available, and does adding a crew actually speed up the rate?',
      'Is this rate based on real historical data, or an estimate?',
    ],
    watchFor: 'Estimates are fine to start — but flag them. An overconfident rate assumption is the most common cause of LOB collisions.',
  },
  {
    id: 'collisions',
    icon: '4️⃣',
    title: 'Step 4 — Check for Collisions',
    color: '#dc2626',
    content: 'Identify where a faster activity behind will catch up to a slower one ahead. In this table: if a later row\'s % completion is reaching or exceeding an earlier row\'s at the same date column, you have a collision.',
    prompts: [
      'Does any activity\'s progress reach the activity before it at the same date?',
      'If two activities are converging, which needs a buffer, a faster rate, or a later start?',
      'Is the gap ("buffer") between activities big enough to absorb normal variation (weather, material delay, rework)?',
    ],
    watchFor: 'Converging lines are a warning — not a failure yet. Act on convergence before the lines cross.',
  },
  {
    id: 'track',
    icon: '5️⃣',
    title: 'Step 5 — Track Actual vs. Planned',
    color: '#7c3aed',
    content: 'Update your % complete cells as actual progress comes in. LOB is a living tracking tool — not a one-time plan. Red cells mean that activity is past its planned date and needs attention.',
    prompts: [
      'Where is each activity\'s actual progress diverging from planned?',
      'Is the gap between activities shrinking — heading toward a future collision — even if no collision has happened yet?',
      'What\'s the corrective action if an activity is falling behind its planned rate?',
    ],
    watchFor: 'Teams that build the chart once and never update it lose all the value. Schedule a weekly update — 10 minutes is enough.',
  },
];

function LOBGuide() {
  const [open, setOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Header toggle */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ background: 'linear-gradient(90deg,#0f2044,#1e3a6e)', borderRadius: open ? '12px 12px 0 0' : 12, padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>📘</span>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>LOB Guide — How to Build a Line of Balance</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', margin: '2px 0 0' }}>
              What it's for · 5 steps · Prompt questions · What to watch for
            </p>
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </div>

      {open && (
        <div style={{ border: '1px solid #dde3ec', borderTop: 'none', borderRadius: '0 0 12px 12px', background: '#fafbfc', overflow: 'hidden' }}>

          {/* What LOB is for */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e8edf5', background: 'white' }}>
            <p style={{ fontWeight: 700, color: '#0f2044', fontSize: '0.82rem', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#0f2044', color: 'white', padding: '2px 7px', borderRadius: 5, fontSize: '0.7rem', letterSpacing: '0.05em' }}>WHAT IT IS</span>
            </p>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 8px', lineHeight: 1.65 }}>
              Line of Balance is a <strong>planning and scheduling tool</strong> — used when the <em>same sequence of work repeats</em> across multiple units (houses, floors, aircraft, stations). It shows whether each activity is keeping pace with the others, so you can spot where one will bottleneck the whole schedule before it happens.
            </p>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontSize: '0.72rem', color: '#0f2044', lineHeight: 1.8, overflowX: 'auto', whiteSpace: 'pre' }}>{`Units
 20 |                    /──Finishes
    |                 /──/──Electrical
 15 |              /──/──/──Framing
    |           /──/──/──/──Foundation
 10 |        /──/──/──/
    |     /──/──/──/
  5 |  /──/──/──/
    |/──/──/──/
  0 +──────────────────────────── Time
    Wk1  Wk4  Wk8  Wk12  Wk16`}</div>
            <p style={{ fontSize: '0.73rem', color: '#64748b', margin: '8px 0 0', lineHeight: 1.5 }}>
              Each activity is a diagonal line — its slope is the production rate. <strong>Parallel lines = smooth flow. Converging lines = collision ahead.</strong>
            </p>
          </div>

          {/* Steps */}
          {LOB_STEPS.map((step, si) => {
            const isEx = expandedStep === step.id;
            return (
              <div key={step.id} style={{ borderBottom: si < LOB_STEPS.length - 1 ? '1px solid #e8edf5' : 'none' }}>
                <button
                  onClick={() => setExpandedStep(isEx ? null : step.id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{step.icon}</span>
                  <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.82rem', flex: 1 }}>{step.title}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', transition: 'transform 0.15s', display: 'inline-block', transform: isEx ? 'rotate(90deg)' : 'none' }}>›</span>
                </button>

                {isEx && (
                  <div style={{ padding: '0 1.25rem 1rem 2.75rem', background: 'white' }}>
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 10px', lineHeight: 1.65 }}>{step.content}</p>

                    {step.checks && (
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f2044', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>You need these 3 things before starting:</p>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {step.checks.map((c, i) => (
                            <li key={i} style={{ fontSize: '0.78rem', color: '#1e293b', marginBottom: 3, lineHeight: 1.5 }}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{ marginBottom: step.watchFor ? 10 : 0 }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f2044', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ask yourself</p>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {step.prompts.map((p, i) => (
                          <li key={i} style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 3, lineHeight: 1.5 }}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    {step.watchFor && (
                      <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '6px 10px', fontSize: '0.75rem', color: '#713f12', lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700 }}>⚠️ Watch for: </span>{step.watchFor}
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
  );
}

export default function LOB() {
  const { currentUser } = useAuth();
  const [lobs, setLobs] = useState([]);
  const [activeLobId, setActiveLobId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLobName, setNewLobName] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ name: '', owner: '' });
  const [editing, setEditing] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // { id, name, owner }
  const [saving, setSaving] = useState(false);
  const [pastDueConfirm, setPastDueConfirm] = useState(null); // { col, val }

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const data = snap.data() || {};
      const saved = data.lobRecords || [];
      if (saved.length) {
        setLobs(saved);
        setActiveLobId(saved[0].id);
      } else {
        const first = blankLOB('My First LOB');
        setLobs([first]);
        setActiveLobId(first.id);
      }
    })();
  }, [currentUser]);

  async function persist(updatedLobs) {
    if (!currentUser) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { lobRecords: updatedLobs }, { merge: true });
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  }

  function updateLobs(updater) {
    setLobs(prev => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }

  const activeLob = lobs.find(l => l.id === activeLobId) || lobs[0];

  function patchActive(patch) {
    updateLobs(prev => prev.map(l => l.id === activeLob.id ? { ...l, ...patch } : l));
  }

  // ── LOB scoring ──────────────────────────────────────────────────────────
  // +1  setup: >=4 named tasks AND >=4 dates set
  // +5  completion: every named task reaches 100%
  // +2  on-time bonus: completed with no red slip ever recorded on this LOB
  // Each award fires once per LOB (guarded by flags stored on the record). A red
  // slip seen at any point sets everRed=true permanently, which blocks the bonus.
  useEffect(() => {
    if (!currentUser || !activeLob) return;
    (async () => {
      const patch = {};
      let awarded = false;

      // Track whether this LOB ever had a red slip (checked on every load/edit).
      if (!activeLob.everRed && lobHasRedSlip(activeLob)) {
        patch.everRed = true;
      }
      const everRed = activeLob.everRed || patch.everRed;

      // +1 setup point
      if (!activeLob.scoredSetup && lobStructureComplete(activeLob)) {
        const r = await logPointEvent(currentUser.uid, {
          points: 1, toolLabel: 'Line of Balance Setup',
          reason: `${activeLob.name}: 4+ tasks and 4+ dates set`,
        });
        if (r?.awarded) { patch.scoredSetup = true; awarded = true; toast.success('⭐ +1 pt — Line of Balance set up (4+ tasks & dates)!', { duration: 5000 }); }
      }

      // +5 completion (and +2 on-time bonus)
      if (!activeLob.scoredComplete && lobFullyComplete(activeLob)) {
        const r = await logPointEvent(currentUser.uid, {
          points: 5, toolLabel: 'Line of Balance Completed',
          reason: `${activeLob.name}: all activities reached 100%`,
        });
        if (r?.awarded) {
          patch.scoredComplete = true; awarded = true;
          if (!everRed) {
            const b = await logPointEvent(currentUser.uid, {
              points: 2, toolLabel: 'Line of Balance On-Time Bonus',
              reason: `${activeLob.name}: completed with no past-due slips`,
            });
            if (b?.awarded) toast.success('🏆 +5 pts complete + 2 pts on-time bonus — flawless LOB!', { duration: 6000 });
            else toast.success('🏆 +5 pts — Line of Balance completed!', { duration: 6000 });
          } else {
            toast('🏆 +5 pts — LOB completed. (No on-time bonus — an activity slipped past its date.)', { duration: 6000, icon: '✅' });
          }
        }
      }

      if (Object.keys(patch).length) patchActive(patch);
      if (awarded) calculateScore(currentUser.uid).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLob, currentUser]);

  function createLOB(e) {
    e.preventDefault();
    const lob = blankLOB(newLobName.trim() || 'New Line of Balance');
    updateLobs(prev => [lob, ...prev]);
    setActiveLobId(lob.id);
    setNewLobName('');
    setShowNewForm(false);
    toast.success('Line of Balance created');
  }

  function addTask(e) {
    e.preventDefault();
    const numCols = activeLob.dates.length;
    const task = { ...blankTask(numCols), name: taskForm.name, owner: taskForm.owner };
    patchActive({ tasks: [...(activeLob.tasks || []), task] });
    setTaskForm({ name: '', owner: '' });
    setShowTaskForm(false);
    toast.success('Task row added');
  }

  function saveTaskEdit() {
    if (!editingTask) return;
    const tasks = activeLob.tasks.map(t =>
      t.id !== editingTask.id ? t : { ...t, name: editingTask.name, owner: editingTask.owner }
    );
    patchActive({ tasks });
    setEditingTask(null);
    toast.success('Task updated');
  }

  function updateCell(taskId, col, val) {
    // Cells only accept a percentage from 0 to 100. Blank clears the cell;
    // anything else is parsed to a number and clamped into the 0–100 range.
    let clean = '';
    if (val !== '' && val != null) {
      let n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
      if (isNaN(n)) { toast.error('Enter a number from 0 to 100'); return; }
      if (n > 100) { n = 100; toast('Progress is capped at 100%', { icon: '⚠️' }); }
      if (n < 0) n = 0;
      clean = String(Math.round(n));
    }
    const tasks = activeLob.tasks.map(t =>
      t.id !== taskId ? t : { ...t, cells: t.cells.map((c, i) => i === col ? clean : c) }
    );
    patchActive({ tasks });
  }

  function updateNote(taskId, note) {
    const tasks = activeLob.tasks.map(t => t.id !== taskId ? t : { ...t, note });
    patchActive({ tasks });
  }

  function updateNoteHeight(taskId, height) {
    const tasks = activeLob.tasks.map(t => t.id !== taskId ? t : { ...t, noteHeight: height });
    patchActive({ tasks });
  }

  function toggleNoteCollapsed(taskId) {
    const tasks = activeLob.tasks.map(t => t.id !== taskId ? t : { ...t, noteCollapsed: !t.noteCollapsed });
    patchActive({ tasks });
  }

  function applyDate(col, val) {
    const dates = activeLob.dates.map((d, i) => i === col ? val : d);
    patchActive({ dates });
  }

  function updateDate(col, val) {
    if (!val) { applyDate(col, val); return; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const chosen = new Date(val + 'T00:00:00');

    // For any column, date must be after all previous set dates
    const prevDate = activeLob.dates.slice(0, col).filter(Boolean).slice(-1)[0];
    if (prevDate) {
      const prev = new Date(prevDate + 'T00:00:00');
      if (chosen <= prev) {
        toast.error(`Date must be after ${fmt(prevDate)} — LOB columns must be in ascending order.`);
        return;
      }
    }

    // For any column, date must be before all subsequent set dates
    const nextDate = activeLob.dates.slice(col + 1).filter(Boolean)[0];
    if (nextDate) {
      const next = new Date(nextDate + 'T00:00:00');
      if (chosen >= next) {
        toast.error(`Date must be before ${fmt(nextDate)} — LOB columns must be in ascending order.`);
        return;
      }
    }

    // First column: allow past date but confirm with user
    if (col === 0 && chosen < today) {
      setPastDueConfirm({ col, val });
      return;
    }

    // Non-first columns: block past dates
    if (col > 0 && chosen < today) {
      toast.error('Only the first column can be set to a past date.');
      return;
    }

    applyDate(col, val);
  }

  function addDateColumn() {
    const dates = [...activeLob.dates, ''];
    const tasks = activeLob.tasks.map(t => ({ ...t, cells: [...t.cells, ''] }));
    patchActive({ dates, tasks });
  }

  function removeDateColumn(col) {
    if (activeLob.dates.length <= 1) return;
    const dates = activeLob.dates.filter((_, i) => i !== col);
    const tasks = activeLob.tasks.map(t => ({ ...t, cells: t.cells.filter((_, i) => i !== col) }));
    patchActive({ dates, tasks });
  }

  function deleteTask(taskId) {
    patchActive({ tasks: activeLob.tasks.filter(t => t.id !== taskId) });
  }

  if (!activeLob) return null;

  const numCols = activeLob.dates.length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        icon="📈"
        title="Line of Balance — Track to the detail when you cannot fail"
        subtitle="Visual production planning and schedule tracking"
        action={
          <button className="btn-primary" onClick={() => setShowNewForm(s => !s)}>
            + New Line of Balance
          </button>
        }
      />

      <LOBGuide />

      {/* New LOB form */}
      {showNewForm && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <form onSubmit={createLOB} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="label">Line of Balance Name</label>
              <input className="input" autoFocus value={newLobName}
                onChange={e => setNewLobName(e.target.value)}
                placeholder="e.g. Building A — Phase 2" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" type="submit">Create</button>
              <button className="btn-secondary" type="button" onClick={() => setShowNewForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* LOB Selector */}
      {lobs.length > 1 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
            Records — {lobs.length} Lines of Balance
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lobs.map(lob => (
              <div key={lob.id} style={{ display: 'flex', alignItems: 'center', borderRadius: 9999, overflow: 'hidden',
                background: lob.id === activeLobId ? '#0f2044' : '#f1f5f9', transition: 'all 0.15s' }}>
                <button onClick={() => setActiveLobId(lob.id)}
                  style={{
                    padding: '0.4rem 0.75rem 0.4rem 1rem', border: 'none', cursor: 'pointer', fontWeight: 600,
                    fontSize: '0.82rem', background: 'transparent',
                    color: lob.id === activeLobId ? 'white' : 'var(--text-secondary)',
                  }}>
                  {lob.name}
                  <span style={{ marginLeft: 6, opacity: 0.55, fontWeight: 400, fontSize: '0.72rem' }}>
                    {new Date(lob.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                </button>
                <button
                  title="Delete this record"
                  onClick={() => {
                    if (!window.confirm(`Delete "${lob.name}"? This cannot be undone.`)) return;
                    const next = lobs.filter(l => l.id !== lob.id);
                    if (next.length === 0) {
                      const fresh = blankLOB('My First LOB');
                      updateLobs(() => [fresh]);
                      setActiveLobId(fresh.id);
                    } else {
                      updateLobs(() => next);
                      if (activeLobId === lob.id) setActiveLobId(next[0].id);
                    }
                    toast.success('Record deleted');
                  }}
                  style={{
                    border: 'none', cursor: 'pointer', padding: '0.4rem 0.6rem',
                    background: 'transparent', fontSize: '0.65rem', lineHeight: 1,
                    color: lob.id === activeLobId ? 'rgba(255,255,255,0.5)' : '#94a3b8',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = lob.id === activeLobId ? 'rgba(255,255,255,0.5)' : '#94a3b8'}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active LOB header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
        {editingName ? (
          <input autoFocus className="input" value={activeLob.name}
            style={{ fontWeight: 700, fontSize: '1rem', maxWidth: 380 }}
            onChange={e => patchActive({ name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingName(false)} />
        ) : (
          <h2 onClick={() => setEditingName(true)} style={{
            fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0,
            cursor: 'pointer', borderBottom: '1px dashed var(--border)', paddingBottom: 2,
          }} title="Click to rename">{activeLob.name}</h2>
        )}
        {saving && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saving…</span>}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {[
          ['Past Due', '#fee2e2', '#dc2626'],
          ['Due < 5 days', '#fef9c3', '#b45309'],
          ['Due > 6 days', '#dcfce7', '#15803d'],
          ['No date set', '#f1f5f9', '#94a3b8'],
        ].map(([label, bg, text]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: bg, border: `1px solid ${text}40` }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: '1.75rem' }}>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>Edit Task</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Task Name</label>
              <input className="input" autoFocus value={editingTask.name}
                onChange={e => setEditingTask(t => ({ ...t, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveTaskEdit()} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label">Owner / Team</label>
              <input className="input" value={editingTask.owner}
                onChange={e => setEditingTask(t => ({ ...t, owner: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveTaskEdit()} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setEditingTask(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveTaskEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Past-due confirmation dialog */}
      {pastDueConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.75rem' }}>⚠️</div>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem', textAlign: 'center' }}>
              Past Due Date
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              You selected <strong>{fmt(pastDueConfirm.val)}</strong>, which is in the past.
              Are you sure you want to use this as the start date?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setPastDueConfirm(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => {
                applyDate(pastDueConfirm.col, pastDueConfirm.val);
                setPastDueConfirm(null);
              }}>OK, Use This Date</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg,#0f2044,#1e3a6e)' }}>
                <th style={{ textAlign: 'left', padding: '0.875rem 1.25rem', color: 'white', fontWeight: 700, fontSize: '0.8rem', minWidth: 180 }}>Task / Activity</th>
                <th style={{ textAlign: 'left', padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.75rem', minWidth: 110 }}>Owner</th>
                {activeLob.dates.map((d, i) => {
                  const s = colHeaderStyle(d);
                  return (
                    <th key={i} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', minWidth: 90 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {editing === `date-${i}` ? (
                          <input type="date" autoFocus defaultValue={d}
                            style={{ fontSize: '0.7rem', border: 'none', borderRadius: 6, padding: '3px 4px', outline: 'none', width: 82, background: 'white', color: '#0f172a' }}
                            onBlur={e => { updateDate(i, e.target.value); setEditing(null); }}
                            onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                        ) : (
                          <button onClick={() => setEditing(`date-${i}`)}
                            style={{
                              background: s.bg, color: s.text, border: 'none', borderRadius: 7,
                              padding: '4px 6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                              width: 80, transition: 'all 0.15s',
                            }}>
                            📅 {fmt(d)}
                          </button>
                        )}
                        {numCols > 1 && (
                          <button onClick={() => removeDateColumn(i)}
                            title="Remove this column"
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1, padding: '1px 4px' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
                {/* Add column button */}
                <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center', minWidth: 48 }}>
                  <button onClick={addDateColumn} title="Add date column"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px dashed rgba(255,255,255,0.35)', color: 'white', borderRadius: 7, padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}>
                    + Col
                  </button>
                </th>
                <th style={{ padding: '0.875rem 0.5rem', minWidth: 64 }}></th>
              </tr>
            </thead>
            <tbody>
              {(activeLob.tasks || []).map((task, ti) => (
                <Fragment key={task.id}>
                <tr style={{ borderBottom: 'none', background: ti % 2 === 0 ? '#fff' : '#fafbfd' }}>
                  <td style={{ padding: '0.75rem 1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{task.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{task.owner}</td>
                  {(() => {
                    // Once an activity reaches 100% in a column, it is complete: every
                    // LATER column for that row is grayed out and shown as done (green ✓).
                    const doneIdx = task.cells.findIndex(c => parseFloat(c) >= 100);
                    return task.cells.map((cell, ci) => {
                    const s = dateCellStyle(activeLob.dates[ci], cell);
                    const key = `${task.id}-${ci}`;
                    const isCompleted = doneIdx !== -1 && ci > doneIdx;
                    if (isCompleted) {
                      // Completed (post-100%) cell: muted grayed-green, non-editable.
                      return (
                        <td key={ci} style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>
                          <div title="Activity already completed 100%" style={{
                            width: 72, minHeight: 30, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                            background: '#e8f2ec', color: '#5a9d78', border: '1px dashed #b6d8c4',
                            fontWeight: 700, fontSize: '0.72rem', margin: '0 auto', lineHeight: 1.2,
                          }}>
                            ✓ 100%
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={ci} style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>
                        {editing === key ? (
                          <input autoFocus defaultValue={cell}
                            type="number" min="0" max="100" step="1" inputMode="numeric"
                            style={{ width: 72, textAlign: 'center', border: '2px solid #0d9488', borderRadius: 7, padding: '4px', fontSize: '0.78rem', outline: 'none' }}
                            onBlur={e => { updateCell(task.id, ci, e.target.value); setEditing(null); }}
                            onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                        ) : (
                          <button onClick={() => setEditing(key)}
                            style={{
                              width: 72, minHeight: 30, borderRadius: 8, border: 'none', fontWeight: 600,
                              fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.15s',
                              background: cell !== '' ? s.bg : '#f1f5f9',
                              color: cell !== '' ? s.text : '#94a3b8',
                              padding: '3px 4px', wordBreak: 'break-word', lineHeight: 1.2,
                            }}>
                            {cell !== '' ? `${cell}%` : '—'}
                          </button>
                        )}
                      </td>
                    );
                    });
                  })()}
                  {/* Empty cell for + Col column */}
                  <td></td>
                  {/* Note toggle + Edit + Delete */}
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => toggleNoteCollapsed(task.id)}
                      title={task.noteCollapsed ? 'Show note' : 'Hide note'}
                      style={{ background: 'none', border: 'none', color: task.note ? '#b45309' : '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', marginRight: 6 }}>
                      {task.noteCollapsed ? '🗒️' : '📝'}
                    </button>
                    <button
                      onClick={() => setEditingTask({ id: task.id, name: task.name, owner: task.owner })}
                      title="Edit task"
                      style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: '0.8rem', marginRight: 6 }}>
                      ✏️
                    </button>
                    <button onClick={() => deleteTask(task.id)} title="Remove row"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7 }}>
                      ✕
                    </button>
                  </td>
                </tr>

                {/* Notes / issues row — aligned under the progress columns, collapsible */}
                {!task.noteCollapsed && (
                  <tr style={{ borderBottom: '1px solid var(--border)', background: ti % 2 === 0 ? '#fff' : '#fafbfd' }}>
                    {/* empty cells so the box starts under the % columns, not the task title */}
                    <td /><td />
                    <td colSpan={numCols + 2} style={{ padding: '0 1rem 0.6rem 0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: '#fffdf5', border: '1px solid #fde68a', borderRadius: 7, padding: '5px 8px' }}>
                        <span style={{ fontSize: '0.78rem', flexShrink: 0, marginTop: 1 }} title="Notes / issues">📝</span>
                        <textarea
                          defaultValue={task.note || ''}
                          placeholder={`Notes / issues for "${task.name || 'this task'}"…`}
                          onBlur={e => updateNote(task.id, e.target.value)}
                          onMouseUp={e => {
                            // Persist a manual drag-resize so the height survives reloads
                            const h = e.currentTarget.style.height;
                            if (h && h !== task.noteHeight) updateNoteHeight(task.id, h);
                          }}
                          rows={1}
                          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', resize: 'vertical', overflowY: 'auto', fontSize: '0.78rem', color: '#475569', lineHeight: 1.35, fontFamily: 'inherit', minHeight: 26, height: task.noteHeight || undefined }}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {(activeLob.tasks || []).length === 0 && (
                <tr>
                  <td colSpan={numCols + 4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No tasks yet — click "+ Add Task Row" below to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collision warning — placed right under the table so it's always visible */}
      {(activeLob.tasks || []).length > 1 && (() => {
        // Collision detector: warn if any row's latest filled % >= the row above it at the same column
        const tasks = activeLob.tasks;
        let collisionWarning = false;
        for (let ci = 0; ci < activeLob.dates.length; ci++) {
          for (let ti = 1; ti < tasks.length; ti++) {
            const above = parseFloat(tasks[ti - 1].cells[ci]);
            const below = parseFloat(tasks[ti].cells[ci]);
            if (!isNaN(above) && !isNaN(below) && below >= above && above > 0) {
              collisionWarning = true;
            }
          }
        }
        return collisionWarning ? (
          <div style={{ marginBottom: '1rem', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
            <div>
              <p style={{ fontWeight: 700, color: '#b91c1c', fontSize: '0.82rem', margin: '0 0 3px' }}>Possible Collision Detected</p>
              <p style={{ fontSize: '0.75rem', color: '#7f1d1d', margin: 0, lineHeight: 1.55 }}>
                At least one activity's % complete is reaching or exceeding the activity above it at the same date column — a sign that a faster activity is catching up to a slower one. Consider adding buffer, adjusting the start date, or increasing the upstream activity's rate.
              </p>
            </div>
          </div>
        ) : null;
      })()}

      {/* Add task row */}
      {showTaskForm ? (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <form onSubmit={addTask} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="label">Task Name</label>
              <input className="input" required autoFocus value={taskForm.name}
                onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Painting" />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="label">Owner / Team</label>
              <input className="input" value={taskForm.owner}
                onChange={e => setTaskForm(f => ({ ...f, owner: e.target.value }))}
                placeholder="e.g. Team F" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" type="submit">Add Row</button>
              <button className="btn-secondary" type="button" onClick={() => setShowTaskForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setShowTaskForm(true)}
          style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          + Add Task Row
        </button>
      )}

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        Click any date header to set a due date · Click "+ Col" to add more date columns · Click ✏️ to edit a task · Click the LOB name above to rename
      </p>
    </div>
  );
}
