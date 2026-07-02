import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus from '../components/DateStatus';

const categories = ['Leadership', 'Technical', 'Certification', 'Soft Skills', 'Education', 'Networking'];
const priorityColors = { High: { bg: '#fee2e2', text: '#dc2626' }, Medium: { bg: '#fef9c3', text: '#b45309' }, Low: { bg: '#dcfce7', text: '#15803d' } };
const emptyForm = { title: '', category: 'Leadership', priority: 'High', targetDate: '' };

export default function Career() {
  const { currentUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [milestoneInputs, setMilestoneInputs] = useState({});

  // Goal editing
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editGoalForm, setEditGoalForm] = useState({});

  // Milestone editing
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [editMilestoneForm, setEditMilestoneForm] = useState({ text: '', date: '' });

  useEffect(() => { if (currentUser) loadGoals(); }, [currentUser]);

  async function loadGoals() {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      setGoals(snap.exists() ? (snap.data().careerGoals || []) : []);
    } catch { toast.error('Could not load goals'); }
  }

  async function persist(updated) {
    await setDoc(doc(db, 'users', currentUser.uid), { careerGoals: updated }, { merge: true });
    setGoals(updated);
  }

  async function addGoal(e) {
    e.preventDefault();
    try {
      const newGoal = { ...form, id: Date.now().toString(), progress: 0, milestones: [], createdAt: new Date().toISOString() };
      await persist([newGoal, ...goals]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success('Career goal added');
    } catch { toast.error('Could not save goal'); }
  }

  async function updateGoal(goalId, changes) {
    try {
      const updated = goals.map(g => g.id === goalId ? { ...g, ...changes } : g);
      await persist(updated);
    } catch { toast.error('Could not save changes'); }
  }

  function startEditGoal(goal) {
    setEditingGoalId(goal.id);
    setEditGoalForm({ title: goal.title, category: goal.category, priority: goal.priority, targetDate: goal.targetDate || '' });
    setSelected(null);
  }

  async function saveEditGoal(e) {
    e.preventDefault();
    await updateGoal(editingGoalId, editGoalForm);
    setEditingGoalId(null);
    toast.success('Goal updated');
  }

  async function deleteGoal(goalId) {
    if (!window.confirm('Delete this goal and all its milestones?')) return;
    try {
      await persist(goals.filter(g => g.id !== goalId));
      if (selected === goalId) setSelected(null);
      toast.success('Goal deleted');
    } catch { toast.error('Could not delete goal'); }
  }

  async function addMilestone(goalId) {
    const input = milestoneInputs[goalId] || { text: '', date: '' };
    if (!input.text.trim()) return;
    const goal = goals.find(g => g.id === goalId);
    const milestones = [...(goal.milestones || []), { text: input.text.trim(), date: input.date, done: false }];
    const progress = Math.round((milestones.filter(m => m.done).length / milestones.length) * 100);
    await updateGoal(goalId, { milestones, progress });
    setMilestoneInputs(s => ({ ...s, [goalId]: { text: '', date: '' } }));
  }

  function startEditMilestone(goalId, mIdx, m) {
    setEditingMilestone(`${goalId}-${mIdx}`);
    setEditMilestoneForm({ text: m.text, date: m.date || '' });
  }

  async function saveEditMilestone(goalId, mIdx) {
    if (!editMilestoneForm.text.trim()) return;
    const goal = goals.find(g => g.id === goalId);
    const milestones = goal.milestones.map((m, i) => i === mIdx ? { ...m, text: editMilestoneForm.text.trim(), date: editMilestoneForm.date } : m);
    await updateGoal(goalId, { milestones });
    setEditingMilestone(null);
    toast.success('Milestone updated');
  }

  async function deleteMilestone(goalId, mIdx) {
    const goal = goals.find(g => g.id === goalId);
    const milestones = goal.milestones.filter((_, i) => i !== mIdx);
    const progress = milestones.length ? Math.round((milestones.filter(m => m.done).length / milestones.length) * 100) : 0;
    await updateGoal(goalId, { milestones, progress });
  }

  async function toggleMilestone(goalId, mIdx) {
    const goal = goals.find(g => g.id === goalId);
    const milestones = goal.milestones.map((m, i) => i === mIdx ? { ...m, done: !m.done } : m);
    const progress = milestones.length ? Math.round((milestones.filter(m => m.done).length / milestones.length) * 100) : 0;
    await updateGoal(goalId, { milestones, progress });
  }

  const totalGoals = goals.length;
  const highPriority = goals.filter(g => g.priority === 'High').length;
  const avgProgress = totalGoals ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / totalGoals) : 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="🚀" title="Career Development Plan" subtitle="Goals, milestones, and timelines for professional growth"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Goal</button>} />

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Goals', value: totalGoals, color: '#0f2044' },
          { label: 'High Priority', value: highPriority, color: '#ef4444' },
          { label: 'Avg Progress', value: `${avgProgress}%`, color: '#0d9488' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add goal form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem', fontSize: '1rem' }}>New Career Goal</h3>
          <form onSubmit={addGoal} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Goal Title</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Become Senior Director by 2026" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Target Date</label>
              <input className="input" type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add Goal</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {goals.map(goal => {
          const pc = priorityColors[goal.priority] || priorityColors.Medium;
          const isEditingGoal = editingGoalId === goal.id;

          return (
            <div key={goal.id} className="card" style={{ padding: '1.25rem' }}>

              {/* Inline goal edit form */}
              {isEditingGoal ? (
                <form onSubmit={saveEditGoal} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Goal Title</label>
                    <input className="input" required value={editGoalForm.title} onChange={e => setEditGoalForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="input" value={editGoalForm.category} onChange={e => setEditGoalForm(f => ({ ...f, category: e.target.value }))}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select className="input" value={editGoalForm.priority} onChange={e => setEditGoalForm(f => ({ ...f, priority: e.target.value }))}>
                      {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Target Date</label>
                    <input className="input" type="date" value={editGoalForm.targetDate} onChange={e => setEditGoalForm(f => ({ ...f, targetDate: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                    <button className="btn-primary" type="submit">Save Changes</button>
                    <button className="btn-secondary" type="button" onClick={() => setEditingGoalId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                /* Normal goal view */
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{goal.title}</h4>
                      <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, background: pc.bg, color: pc.text }}>{goal.priority}</span>
                      <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>{goal.category}</span>
                    </div>
                    {goal.targetDate && <div style={{ marginBottom: 10 }}><DateStatus date={goal.targetDate} prefix="Target · " /></div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
                        <div style={{ height: 8, borderRadius: 9999, background: '#0d9488', width: `${goal.progress}%`, transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0d9488', minWidth: 36 }}>{goal.progress}%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEditGoal(goal)}
                      style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f2044', background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => deleteGoal(goal.id)}
                      style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', background: 'none', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
                      🗑
                    </button>
                    <button onClick={() => setSelected(selected === goal.id ? null : goal.id)}
                      style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', background: 'none', border: '1px solid #0d9488', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
                      {selected === goal.id ? 'Collapse' : `${(goal.milestones || []).length} Milestones`}
                    </button>
                  </div>
                </div>
              )}

              {/* Milestone panel */}
              {!isEditingGoal && selected === goal.id && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(goal.milestones || []).length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px', fontStyle: 'italic' }}>No milestones yet — add one below.</p>
                  )}
                  {(goal.milestones || []).map((m, i) => {
                    const milestoneKey = `${goal.id}-${i}`;
                    const isEditingM = editingMilestone === milestoneKey;

                    return (
                      <div key={i}>
                        {isEditingM ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
                            <input
                              className="input"
                              style={{ flex: 2, minWidth: 160, fontSize: '0.825rem' }}
                              value={editMilestoneForm.text}
                              onChange={e => setEditMilestoneForm(f => ({ ...f, text: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && saveEditMilestone(goal.id, i)}
                              autoFocus
                            />
                            <input
                              className="input"
                              type="date"
                              style={{ flex: 1, minWidth: 120, fontSize: '0.825rem' }}
                              value={editMilestoneForm.date}
                              onChange={e => setEditMilestoneForm(f => ({ ...f, date: e.target.value }))}
                            />
                            <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }} onClick={() => saveEditMilestone(goal.id, i)}>Save</button>
                            <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }} onClick={() => setEditingMilestone(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button onClick={() => toggleMilestone(goal.id, i)}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0' }}>
                              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${m.done ? '#0d9488' : '#e2e8f0'}`, background: m.done ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.2s' }}>
                                {m.done && '✓'}
                              </div>
                              <span style={{ flex: 1, fontSize: '0.875rem', color: m.done ? '#94a3b8' : 'var(--text-secondary)', textDecoration: m.done ? 'line-through' : 'none' }}>{m.text}</span>
                              {m.date && !m.done && <DateStatus date={m.date} />}
                              {m.date && m.done && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.date}</span>}
                            </button>
                            <button onClick={() => startEditMilestone(goal.id, i, m)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.8rem', padding: '0 4px', flexShrink: 0 }} title="Edit milestone">✏️</button>
                            <button onClick={() => deleteMilestone(goal.id, i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.85rem', padding: '0 4px', flexShrink: 0 }} title="Delete milestone">✕</button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add milestone input */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      style={{ flex: 2, minWidth: 160, fontSize: '0.825rem' }}
                      placeholder="Milestone description…"
                      value={milestoneInputs[goal.id]?.text || ''}
                      onChange={e => setMilestoneInputs(s => ({ ...s, [goal.id]: { ...s[goal.id], text: e.target.value } }))}
                      onKeyDown={e => e.key === 'Enter' && addMilestone(goal.id)}
                    />
                    <input
                      className="input"
                      type="date"
                      style={{ flex: 1, minWidth: 120, fontSize: '0.825rem' }}
                      value={milestoneInputs[goal.id]?.date || ''}
                      onChange={e => setMilestoneInputs(s => ({ ...s, [goal.id]: { ...s[goal.id], date: e.target.value } }))}
                    />
                    <button className="btn-primary" style={{ fontSize: '0.825rem', padding: '0.4rem 0.9rem' }} onClick={() => addMilestone(goal.id)}>+ Add</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
