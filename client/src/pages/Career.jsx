import { useState } from 'react';
import toast from 'react-hot-toast';

const sampleGoals = [
  {
    id: 1, title: 'Earn PMP Certification', category: 'Certification', priority: 'High',
    targetDate: '2024-12-31', progress: 60,
    milestones: [
      { text: 'Register for PMP prep course', done: true, date: '2024-06-01' },
      { text: 'Complete 35 hours of PM education', done: true, date: '2024-07-15' },
      { text: 'Submit PMP application', done: false, date: '2024-09-01' },
      { text: 'Pass PMP exam', done: false, date: '2024-12-01' },
    ],
  },
  {
    id: 2, title: 'Develop Executive Presence', category: 'Leadership', priority: 'High',
    targetDate: '2025-06-01', progress: 30,
    milestones: [
      { text: 'Complete executive coaching assessment', done: true, date: '2024-07-01' },
      { text: 'Present at quarterly leadership meeting', done: false, date: '2024-09-15' },
      { text: 'Lead company-wide initiative', done: false, date: '2025-03-01' },
    ],
  },
  {
    id: 3, title: 'Build Data Analytics Skills', category: 'Technical', priority: 'Medium',
    targetDate: '2025-03-31', progress: 20,
    milestones: [
      { text: 'Complete Power BI fundamentals course', done: true, date: '2024-07-20' },
      { text: 'Build first departmental dashboard', done: false, date: '2024-10-01' },
    ],
  },
];

const categories = ['Leadership', 'Technical', 'Certification', 'Soft Skills', 'Education', 'Networking'];

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

  const priorityBadge = { High: 'badge-red', Medium: 'badge-yellow', Low: 'badge-green' };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Career Development Plan</h1>
          <p className="text-slate-500 text-sm">Goals, milestones, and timelines for professional growth</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Goal</button>
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-700 mb-4">New Career Goal</h3>
          <form onSubmit={addGoal} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
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
            <div className="sm:col-span-2 flex gap-3">
              <button className="btn-primary" type="submit">Add Goal</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(goal => (
          <div key={goal.id} className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-bold text-slate-800">{goal.title}</h4>
                  <span className={priorityBadge[goal.priority]}>{goal.priority}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{goal.category}</span>
                </div>
                {goal.targetDate && <p className="text-xs text-slate-400">🎯 Target: {goal.targetDate}</p>}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${goal.progress}%`, background: '#0d9488' }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: '#0d9488' }}>{goal.progress}%</span>
                </div>
              </div>
              <button className="text-xs font-semibold hover:underline" style={{ color: '#0d9488' }} onClick={() => setSelected(selected === goal.id ? null : goal.id)}>
                {selected === goal.id ? 'Collapse' : 'View Milestones'}
              </button>
            </div>

            {selected === goal.id && goal.milestones.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                {goal.milestones.map((m, i) => (
                  <button key={i} className="flex items-center gap-3 w-full text-left" onClick={() => toggleMilestone(goal.id, i)}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${m.done ? 'text-white border-transparent' : 'border-slate-300'}`}
                      style={m.done ? { background: '#0d9488' } : {}}>
                      {m.done && '✓'}
                    </div>
                    <span className={`text-sm flex-1 ${m.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.text}</span>
                    {m.date && <span className="text-xs text-slate-400">{m.date}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
