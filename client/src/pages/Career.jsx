import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const sampleGoals = [
  {
    id: 1, title: 'Earn PMP Certification', category: 'Certification', priority: 'High',
    targetDate: '2024-12-31', progress: 60,
    milestones: [
      { text: 'Register for PMP prep course',          done: true,  date: '2024-06-01' },
      { text: 'Complete 35 hours of PM education',     done: true,  date: '2024-07-15' },
      { text: 'Submit PMP application',                done: false, date: '2024-09-01' },
      { text: 'Pass PMP exam',                         done: false, date: '2024-12-01' },
    ],
  },
  {
    id: 2, title: 'Develop Executive Presence', category: 'Leadership', priority: 'High',
    targetDate: '2025-06-01', progress: 30,
    milestones: [
      { text: 'Complete executive coaching assessment', done: true,  date: '2024-07-01' },
      { text: 'Present at quarterly leadership meeting',done: false, date: '2024-09-15' },
      { text: 'Lead company-wide initiative',           done: false, date: '2025-03-01' },
    ],
  },
  {
    id: 3, title: 'Build Data Analytics Skills', category: 'Technical', priority: 'Medium',
    targetDate: '2025-03-31', progress: 20,
    milestones: [
      { text: 'Complete Power BI fundamentals course',  done: true,  date: '2024-07-20' },
      { text: 'Build first departmental dashboard',     done: false, date: '2024-10-01' },
    ],
  },
];

const categories = ['Leadership', 'Technical', 'Certification', 'Soft Skills', 'Education', 'Networking'];
const priorityColors = { High: { bg: '#fee2e2', text: '#dc2626' }, Medium: { bg: '#fef9c3', text: '#b45309' }, Low: { bg: '#dcfce7', text: '#15803d' } };

export default function Career() {
  const [goals, setGoals] = useState(sampleGoals);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Leadership', priority: 'High', targetDate: '' });

  function addGoal(e) {
    e.preventDefault();
    setGoals(g => [...g, { ...form, id: Date.now(), progress: 0, milestones: [] }]);
    setForm({ title: '', category: 'Leadership', priority: 'High', targetDate: '' });
    setShowForm(false);
    toast.success('Career goal added');
  }

  function toggleMilestone(goalId, mIdx) {
    setGoals(goals => goals.map(g => {
      if (g.id !== goalId) return g;
      const milestones = g.milestones.map((m, i) => i === mIdx ? { ...m, done: !m.done } : m);
      const progress = milestones.length ? Math.round((milestones.filter(m => m.done).length / milestones.length) * 100) : g.progress;
      return { ...g, milestones, progress };
    }));
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
          return (
            <div key={goal.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{goal.title}</h4>
                    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, background: pc.bg, color: pc.text }}>{goal.priority}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>{goal.category}</span>
                  </div>
                  {goal.targetDate && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>🎯 Target: {goal.targetDate}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
                      <div style={{ height: 8, borderRadius: 9999, background: '#0d9488', width: `${goal.progress}%`, transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0d9488', minWidth: 36 }}>{goal.progress}%</span>
                  </div>
                </div>
                <button onClick={() => setSelected(selected === goal.id ? null : goal.id)}
                  style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', background: 'none', border: '1px solid #0d9488', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                  {selected === goal.id ? 'Collapse' : `${goal.milestones.length} Milestones`}
                </button>
              </div>

              {selected === goal.id && goal.milestones.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {goal.milestones.map((m, i) => (
                    <button key={i} onClick={() => toggleMilestone(goal.id, i)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${m.done ? '#0d9488' : '#e2e8f0'}`, background: m.done ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.2s' }}>
                        {m.done && '✓'}
                      </div>
                      <span style={{ flex: 1, fontSize: '0.875rem', color: m.done ? '#94a3b8' : 'var(--text-secondary)', textDecoration: m.done ? 'line-through' : 'none' }}>{m.text}</span>
                      {m.date && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.date}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
