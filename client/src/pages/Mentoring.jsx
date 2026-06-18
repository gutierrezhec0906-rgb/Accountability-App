import { useState } from 'react';
import toast from 'react-hot-toast';

const sampleRelationships = [
  {
    id: 1,
    mentor: 'Dr. Patricia Wells',
    mentee: 'James Carter',
    startDate: '2024-01-15',
    focus: 'Executive Leadership',
    status: 'Active',
    sessions: 8,
    nextMeeting: '2024-08-05',
    progress: 72,
    milestones: [
      { text: 'Identify leadership blind spots', done: true },
      { text: 'Complete 360-degree assessment', done: true },
      { text: 'Develop personal leadership brand', done: true },
      { text: 'Lead cross-functional project', done: false },
      { text: 'Present to executive team', done: false },
    ],
  },
  {
    id: 2,
    mentor: 'You',
    mentee: 'Sofia Nguyen',
    startDate: '2024-03-01',
    focus: 'Technical & Process Improvement',
    status: 'Active',
    sessions: 5,
    nextMeeting: '2024-08-12',
    progress: 45,
    milestones: [
      { text: 'Learn Lean fundamentals', done: true },
      { text: 'Lead first 5S event', done: true },
      { text: 'Complete A3 problem-solving training', done: false },
      { text: 'Facilitate Kaizen workshop', done: false },
    ],
  },
];

export default function Mentoring() {
  const [relationships, setRelationships] = useState(sampleRelationships);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ mentor: '', mentee: '', focus: '', startDate: '', status: 'Active' });

  function addRelationship(e) {
    e.preventDefault();
    setRelationships(r => [...r, { ...form, id: Date.now(), sessions: 0, progress: 0, milestones: [] }]);
    setForm({ mentor: '', mentee: '', focus: '', startDate: '', status: 'Active' });
    setShowForm(false);
    toast.success('Mentoring relationship added');
  }

  function toggleMilestone(relId, mIdx) {
    setRelationships(rels => rels.map(r => {
      if (r.id !== relId) return r;
      const milestones = r.milestones.map((m, i) => i === mIdx ? { ...m, done: !m.done } : m);
      const progress = Math.round((milestones.filter(m => m.done).length / milestones.length) * 100);
      return { ...r, milestones, progress };
    }));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mentoring Tracker</h1>
          <p className="text-slate-500 text-sm">Manage mentor/mentee relationships and milestones</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Relationship</button>
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-700 mb-4">New Mentoring Relationship</h3>
          <form onSubmit={addRelationship} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Mentor</label>
              <input className="input" required value={form.mentor} onChange={e => setForm(f => ({ ...f, mentor: e.target.value }))} placeholder="Mentor name" />
            </div>
            <div>
              <label className="label">Mentee</label>
              <input className="input" required value={form.mentee} onChange={e => setForm(f => ({ ...f, mentee: e.target.value }))} placeholder="Mentee name" />
            </div>
            <div>
              <label className="label">Focus Area</label>
              <input className="input" value={form.focus} onChange={e => setForm(f => ({ ...f, focus: e.target.value }))} placeholder="e.g. Technical Leadership" />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button className="btn-primary" type="submit">Add Relationship</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {relationships.map(rel => (
          <div key={rel.id} className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: '#f0fdfa' }}>🤝</div>
                <div>
                  <h4 className="font-bold text-slate-800">{rel.mentor} → {rel.mentee}</h4>
                  <p className="text-xs text-slate-500">{rel.focus} · Since {rel.startDate}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-400">
                    <span>📅 {rel.sessions} sessions</span>
                    {rel.nextMeeting && <span>Next: {rel.nextMeeting}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="badge-green">{rel.status}</span>
                <button className="block text-xs text-teal-600 font-semibold mt-2 hover:underline" onClick={() => setSelected(selected === rel.id ? null : rel.id)}>
                  {selected === rel.id ? 'Collapse' : 'View Milestones'}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span className="font-bold" style={{ color: '#0d9488' }}>{rel.progress}%</span>
              </div>
              <div className="bg-slate-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${rel.progress}%`, background: '#0d9488' }} />
              </div>
            </div>

            {selected === rel.id && rel.milestones.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Milestones</p>
                <div className="space-y-2">
                  {rel.milestones.map((m, i) => (
                    <button key={i} className="flex items-center gap-3 w-full text-left" onClick={() => toggleMilestone(rel.id, i)}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${m.done ? 'text-white border-transparent' : 'border-slate-300'}`} style={m.done ? { background: '#0d9488' } : {}}>
                        {m.done && '✓'}
                      </div>
                      <span className={`text-sm ${m.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
