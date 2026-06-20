import { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  query, where, getDocs, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  draft:     { bg: '#f1f5f9', text: '#64748b', label: 'Draft' },
  active:    { bg: '#eff6ff', text: '#1d4ed8', label: 'Active' },
  completed: { bg: '#f0fdf4', text: '#15803d', label: 'Completed' },
  paused:    { bg: '#fff7ed', text: '#c2410c', label: 'Paused' },
};

const SMART = [
  {
    key: 'specific',
    letter: 'S',
    label: 'Specific',
    placeholder: 'What exactly will you accomplish? Who is involved? Where will it happen? Be precise and clear.',
    color: '#0f2044',
  },
  {
    key: 'measurable',
    letter: 'M',
    label: 'Measurable',
    placeholder: 'How will you measure progress? What numbers, metrics, or milestones will confirm success?',
    color: '#0d9488',
  },
  {
    key: 'achievable',
    letter: 'A',
    label: 'Achievable',
    placeholder: 'What resources, skills, or steps are needed? Is this realistic given your current situation?',
    color: '#7c3aed',
  },
  {
    key: 'relevant',
    letter: 'R',
    label: 'Relevant',
    placeholder: 'Why does this goal matter? How does it align with your team\'s priorities and your leadership purpose?',
    color: '#be185d',
  },
  {
    key: 'timeBound',
    letter: 'T',
    label: 'Time-Bound',
    placeholder: 'What is your target deadline? What are the key milestones along the way?',
    color: '#b45309',
  },
];

function wordCount(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fieldQualityPct(text = '') {
  const w = wordCount(text);
  if (w === 0)  return 0;
  if (w < 5)    return 20;
  if (w < 15)   return 50;
  if (w < 30)   return 80;
  return 100;
}

function goalQualityPct(goal) {
  const fields = SMART.map(s => fieldQualityPct(goal[s.key] || ''));
  return Math.round(fields.reduce((a, b) => a + b, 0) / fields.length);
}

function QualityBadge({ pct }) {
  const color = pct >= 80 ? '#0d9488' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const label = pct >= 80 ? 'High Quality' : pct >= 50 ? 'Developing' : 'Incomplete';
  return (
    <span style={{ background: color + '18', color, border: `1px solid ${color}40`, padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>
      {label} {pct}%
    </span>
  );
}

const emptyForm = { title: '', specific: '', measurable: '', achievable: '', relevant: '', timeBound: '', dueDate: '', status: 'draft' };

export default function SmartGoals() {
  const { currentUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);

  async function fetchGoals() {
    try {
      const snap = await getDocs(query(collection(db, 'smartGoals'), where('uid', '==', currentUser.uid)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setGoals(data);
    } catch { toast.error('Could not load goals'); }
    setLoading(false);
  }

  useEffect(() => { fetchGoals(); }, []);

  function openCreate() { setForm(emptyForm); setEditing(null); setShowForm(true); }
  function openEdit(goal) {
    setForm({ title: goal.title, specific: goal.specific, measurable: goal.measurable, achievable: goal.achievable, relevant: goal.relevant, timeBound: goal.timeBound, dueDate: goal.dueDate || '', status: goal.status });
    setEditing(goal.id);
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Goal title is required');
    setSaving(true);
    try {
      const payload = { ...form, uid: currentUser.uid, updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, 'smartGoals', editing), payload);
        toast.success('Goal updated');
      } else {
        await addDoc(collection(db, 'smartGoals'), { ...payload, createdAt: serverTimestamp() });
        toast.success('Goal created');
      }
      setShowForm(false);
      fetchGoals();
    } catch { toast.error('Save failed'); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this goal?')) return;
    await deleteDoc(doc(db, 'smartGoals', id));
    toast.success('Goal deleted');
    fetchGoals();
  }

  async function changeStatus(id, status) {
    await updateDoc(doc(db, 'smartGoals', id), { status, updatedAt: serverTimestamp() });
    fetchGoals();
  }

  const counts = { draft: 0, active: 0, completed: 0, paused: 0 };
  goals.forEach(g => { if (counts[g.status] !== undefined) counts[g.status]++; });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>SMART Goals</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
            Set purposeful goals that drive accountability. Each goal contributes to your Accountability Score.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New SMART Goal</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {Object.entries(STATUS_STYLES).map(([key, s]) => (
          <div key={key} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.text }}>{counts[key]}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Goals list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎯</div>
          <p style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>No SMART goals yet</p>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 20 }}>Create your first goal to start building your Accountability Score.</p>
          <button className="btn-primary" onClick={openCreate}>Create First Goal</button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const st = STATUS_STYLES[goal.status] || STATUS_STYLES.draft;
            const qpct = goalQualityPct(goal);
            const isOpen = expanded === goal.id;
            return (
              <div key={goal.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Goal header row */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : goal.id)}>
                  <span style={{ fontSize: '1.25rem' }}>🎯</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: '#1e293b', margin: 0, fontSize: '0.95rem' }}>{goal.title}</p>
                    {goal.dueDate && <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '2px 0 0' }}>Due: {goal.dueDate}</p>}
                  </div>
                  <QualityBadge pct={qpct} />
                  <span style={{ background: st.bg, color: st.text, padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>{st.label}</span>
                  <span style={{ color: '#94a3b8', fontSize: '1rem' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded SMART fields */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '1.25rem' }}>
                    <div className="space-y-4">
                      {SMART.map(s => (
                        <div key={s.key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, color: 'white', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.letter}</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem' }}>{s.label}</span>
                            <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.72rem' }}>{wordCount(goal[s.key])} words</span>
                          </div>
                          <p style={{ color: goal[s.key] ? '#475569' : '#cbd5e1', fontSize: '0.875rem', margin: 0, paddingLeft: 32, fontStyle: goal[s.key] ? 'normal' : 'italic' }}>
                            {goal[s.key] || 'Not filled in yet.'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => openEdit(goal)}>✏️ Edit</button>
                      {goal.status !== 'active'    && <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => changeStatus(goal.id, 'active')}>▶ Set Active</button>}
                      {goal.status !== 'completed' && <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => changeStatus(goal.id, 'completed')}>✅ Complete</button>}
                      {goal.status !== 'paused'    && <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => changeStatus(goal.id, 'paused')}>⏸ Pause</button>}
                      <button style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.4rem 0.875rem', background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 8, cursor: 'pointer' }} onClick={() => handleDelete(goal.id)}>🗑 Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 680, padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{editing ? 'Edit SMART Goal' : 'New SMART Goal'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Title + Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <div>
                  <label className="label">Goal Title *</label>
                  <input className="input" placeholder="e.g. Improve team coaching frequency by Q3" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>

              {/* SMART fields */}
              {SMART.map(s => (
                <div key={s.key}>
                  <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: s.color, color: 'white', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.letter}</span>
                    {s.label}
                    <span style={{ marginLeft: 'auto', fontWeight: 400, color: '#94a3b8', fontSize: '0.72rem' }}>{wordCount(form[s.key])} words</span>
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder={s.placeholder}
                    value={form[s.key]}
                    onChange={e => setForm(f => ({ ...f, [s.key]: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                  {/* Quality bar */}
                  <div style={{ marginTop: 4, height: 3, background: '#e2e8f0', borderRadius: 9999 }}>
                    <div style={{ height: 3, borderRadius: 9999, background: s.color, width: `${fieldQualityPct(form[s.key])}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}

              {/* Status */}
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(STATUS_STYLES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </div>

              {/* Overall quality preview */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Entry Quality:</span>
                <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
                  <div style={{ height: 8, borderRadius: 9999, background: '#0d9488', width: `${goalQualityPct(form)}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0d9488' }}>{goalQualityPct(form)}%</span>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Goal' : 'Create Goal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
