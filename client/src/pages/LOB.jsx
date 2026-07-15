import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

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
    const tasks = activeLob.tasks.map(t =>
      t.id !== taskId ? t : { ...t, cells: t.cells.map((c, i) => i === col ? val : c) }
    );
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
        title="Line of Balance"
        subtitle="Visual production planning and schedule tracking"
        action={
          <button className="btn-primary" onClick={() => setShowNewForm(s => !s)}>
            + New Line of Balance
          </button>
        }
      />

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
                <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', background: ti % 2 === 0 ? '#fff' : '#fafbfd' }}>
                  <td style={{ padding: '0.75rem 1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{task.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{task.owner}</td>
                  {task.cells.map((cell, ci) => {
                    const s = dateCellStyle(activeLob.dates[ci], cell);
                    const key = `${task.id}-${ci}`;
                    return (
                      <td key={ci} style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>
                        {editing === key ? (
                          <input autoFocus defaultValue={cell}
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
                  })}
                  {/* Empty cell for + Col column */}
                  <td></td>
                  {/* Edit + Delete */}
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
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
