import { useState } from 'react';
import toast from 'react-hot-toast';

const sampleTrainings = [
  { id: 1, title: 'Lean Manufacturing Fundamentals', category: 'Lean', duration: '4h', dueDate: '2024-08-31', completed: true, completedDate: '2024-07-20', mandatory: true },
  { id: 2, title: 'Effective Coaching Skills', category: 'Leadership', duration: '2h', dueDate: '2024-09-15', completed: false, mandatory: true },
  { id: 3, title: 'Safety & OSHA Compliance', category: 'Safety', duration: '3h', dueDate: '2024-08-01', completed: true, completedDate: '2024-07-10', mandatory: true },
  { id: 4, title: 'Emotional Intelligence for Leaders', category: 'Soft Skills', duration: '1.5h', dueDate: '2024-10-01', completed: false, mandatory: false },
  { id: 5, title: 'Data-Driven Decision Making', category: 'Analytics', duration: '3h', dueDate: '2024-09-30', completed: false, mandatory: false },
  { id: 6, title: 'Root Cause Analysis Techniques', category: 'Quality', duration: '2h', dueDate: '2024-08-15', completed: false, mandatory: true },
  { id: 7, title: 'DISC Personality Profiling', category: 'Soft Skills', duration: '1h', dueDate: '2024-10-15', completed: false, mandatory: false },
  { id: 8, title: 'Visual Management Principles', category: 'Lean', duration: '2h', dueDate: '2024-09-01', completed: true, completedDate: '2024-07-25', mandatory: false },
];

const categories = ['All', 'Lean', 'Leadership', 'Safety', 'Soft Skills', 'Analytics', 'Quality'];

export default function Training() {
  const [trainings, setTrainings] = useState(sampleTrainings);
  const [filter, setFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Leadership', duration: '', dueDate: '', mandatory: false });

  function toggleComplete(id) {
    setTrainings(t => t.map(x => x.id === id ? {
      ...x, completed: !x.completed,
      completedDate: !x.completed ? new Date().toISOString().split('T')[0] : null
    } : x));
    toast.success('Training status updated');
  }

  function addTraining(e) {
    e.preventDefault();
    setTrainings(t => [...t, { ...form, id: Date.now(), completed: false }]);
    setForm({ title: '', category: 'Leadership', duration: '', dueDate: '', mandatory: false });
    setShowForm(false);
    toast.success('Training added');
  }

  const filtered = filter === 'All' ? trainings : trainings.filter(t => t.category === filter);
  const completedCount = trainings.filter(t => t.completed).length;
  const pct = Math.round((completedCount / trainings.length) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Training Center</h1>
          <p className="text-slate-500 text-sm">Track learning progress and certifications</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Training</button>
      </div>

      {/* Progress Bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-700">Overall Completion</span>
          <span className="font-bold text-2xl" style={{ color: '#0d9488' }}>{pct}%</span>
        </div>
        <div className="bg-slate-100 rounded-full h-4">
          <div className="h-4 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0d9488, #14b8a6)' }} />
        </div>
        <p className="text-sm text-slate-500 mt-2">{completedCount} of {trainings.length} trainings completed</p>
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-700 mb-4">Add Training</h3>
          <form onSubmit={addTraining} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Training Title</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Six Sigma Green Belt" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Duration</label>
              <input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 2h" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="mandatory" checked={form.mandatory} onChange={e => setForm(f => ({ ...f, mandatory: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="mandatory" className="text-sm font-medium text-slate-700">Mandatory Training</label>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button className="btn-primary" type="submit">Add Training</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === c ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={filter === c ? { background: '#0f2044' } : {}}>
            {c}
          </button>
        ))}
      </div>

      {/* Training List */}
      <div className="space-y-3">
        {filtered.map(t => (
          <div key={t.id} className="card p-4 flex items-center gap-4">
            <button onClick={() => toggleComplete(t.id)}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all"
              style={t.completed ? { background: '#0d9488', borderColor: '#0d9488', color: 'white' } : { borderColor: '#cbd5e1', color: 'transparent' }}>
              ✓
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={`font-bold ${t.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</h4>
                {t.mandatory && <span className="badge-red">Required</span>}
              </div>
              <div className="flex gap-4 mt-1 text-xs text-slate-400">
                <span>📂 {t.category}</span>
                {t.duration && <span>⏱ {t.duration}</span>}
                {t.dueDate && <span>📅 Due: {t.dueDate}</span>}
                {t.completedDate && <span className="text-green-600">✅ Completed: {t.completedDate}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
