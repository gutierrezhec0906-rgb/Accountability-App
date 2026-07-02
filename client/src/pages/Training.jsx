import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus from '../components/DateStatus';

const sampleTrainings = [
  { id: 1, title: 'Lean Manufacturing Fundamentals', category: 'Lean',       duration: '4h',   dueDate: '2024-08-31', completed: true,  completedDate: '2024-07-20', mandatory: true  },
  { id: 2, title: 'Effective Coaching Skills',        category: 'Leadership', duration: '2h',   dueDate: '2024-09-15', completed: false, mandatory: true  },
  { id: 3, title: 'Safety & OSHA Compliance',         category: 'Safety',     duration: '3h',   dueDate: '2024-08-01', completed: true,  completedDate: '2024-07-10', mandatory: true  },
  { id: 4, title: 'Emotional Intelligence for Leaders',category: 'Soft Skills',duration: '1.5h', dueDate: '2024-10-01', completed: false, mandatory: false },
  { id: 5, title: 'Data-Driven Decision Making',      category: 'Analytics',  duration: '3h',   dueDate: '2024-09-30', completed: false, mandatory: false },
  { id: 6, title: 'Root Cause Analysis Techniques',   category: 'Quality',    duration: '2h',   dueDate: '2024-08-15', completed: false, mandatory: true  },
  { id: 7, title: 'DISC Personality Profiling',       category: 'Soft Skills',duration: '1h',   dueDate: '2024-10-15', completed: false, mandatory: false },
  { id: 8, title: 'Visual Management Principles',     category: 'Lean',       duration: '2h',   dueDate: '2024-09-01', completed: true,  completedDate: '2024-07-25', mandatory: false },
];

const categories = ['All', 'Lean', 'Leadership', 'Safety', 'Soft Skills', 'Analytics', 'Quality'];
const catColors = { Lean: '#0d9488', Leadership: '#0f2044', Safety: '#ef4444', 'Soft Skills': '#8b5cf6', Analytics: '#0891b2', Quality: '#f59e0b' };

export default function Training() {
  const [trainings, setTrainings] = useState(sampleTrainings);
  const [filter, setFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Leadership', duration: '', dueDate: '', mandatory: false });

  function toggleComplete(id) {
    setTrainings(t => t.map(x => x.id === id ? { ...x, completed: !x.completed, completedDate: !x.completed ? new Date().toISOString().split('T')[0] : null } : x));
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
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="🎓" title="Training Center" subtitle="Track learning progress and certifications"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Training</button>} />

      {/* Progress hero */}
      <div style={{ background: 'linear-gradient(135deg,#0f2044,#1e3a6e)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Overall Completion</p>
            <p style={{ color: '#99f6e4', fontSize: '2.25rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{pct}%</p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', margin: 0 }}>{completedCount} of {trainings.length} complete</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 9999, height: 8 }}>
          <div style={{ height: 8, borderRadius: 9999, background: 'linear-gradient(90deg,#0d9488,#14b8a6)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total',     value: trainings.length,                                 color: '#0f2044' },
          { label: 'Mandatory', value: trainings.filter(t => t.mandatory).length,        color: '#ef4444' },
          { label: 'Completed', value: completedCount,                                   color: '#0d9488' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Add Training</h3>
          <form onSubmit={addTraining} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}><label className="label">Training Title</label><input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Six Sigma Green Belt" /></div>
            <div><label className="label">Category</label><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Duration</label><input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 2h" /></div>
            <div><label className="label">Due Date</label><input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="mandatory" checked={form.mandatory} onChange={e => setForm(f => ({ ...f, mandatory: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <label htmlFor="mandatory" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mandatory</label>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add Training</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            style={{ padding: '0.375rem 1rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: filter === c ? (catColors[c] || '#0f2044') : '#f1f5f9', color: filter === c ? '#fff' : '#475569' }}>
            {c}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(t => (
          <div key={t.id} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => toggleComplete(t.id)}
              style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, border: `2px solid ${t.completed ? '#0d9488' : '#e2e8f0'}`, background: t.completed ? '#0d9488' : 'transparent', color: t.completed ? 'white' : 'transparent', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              ✓
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <h4 style={{ fontWeight: 700, color: t.completed ? '#94a3b8' : 'var(--text-primary)', margin: 0, textDecoration: t.completed ? 'line-through' : 'none', fontSize: '0.9375rem' }}>{t.title}</h4>
                {t.mandatory && <span className="badge-red">Required</span>}
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span style={{ background: catColors[t.category] ? catColors[t.category] + '18' : '#f1f5f9', color: catColors[t.category] || '#475569', padding: '1px 8px', borderRadius: 9999, fontWeight: 700, fontSize: '0.7rem' }}>{t.category}</span>
                {t.duration && <span>⏱ {t.duration}</span>}
                {t.dueDate && !t.completed && <DateStatus date={t.dueDate} />}
                {t.dueDate && t.completed && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>📅 {t.dueDate}</span>}
                {t.completedDate && <span style={{ color: '#0d9488', fontWeight: 600 }}>✅ {t.completedDate}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
