import { useState } from 'react';
import toast from 'react-hot-toast';

const skillCategories = [
  {
    category: 'Leadership',
    skills: [
      { name: 'Strategic Thinking', self: 3, peer: 4 },
      { name: 'Team Development', self: 4, peer: 3 },
      { name: 'Decision Making', self: 3, peer: 3 },
      { name: 'Communication', self: 5, peer: 4 },
    ],
  },
  {
    category: 'Technical',
    skills: [
      { name: 'Lean Principles', self: 4, peer: 4 },
      { name: 'Data Analysis', self: 2, peer: 3 },
      { name: 'Root Cause Analysis', self: 4, peer: 4 },
      { name: 'Project Management', self: 3, peer: 3 },
    ],
  },
  {
    category: 'Interpersonal',
    skills: [
      { name: 'Conflict Resolution', self: 3, peer: 3 },
      { name: 'Coaching & Mentoring', self: 4, peer: 5 },
      { name: 'Emotional Intelligence', self: 4, peer: 4 },
      { name: 'Active Listening', self: 5, peer: 4 },
    ],
  },
];

const levels = ['', '1 - Novice', '2 - Developing', '3 - Proficient', '4 - Advanced', '5 - Expert'];
const levelColors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#0d9488', '#0f2044'];

function RatingDots({ value, onChange, color }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange && onChange(n)}
          className="w-7 h-7 rounded-full border-2 transition-all text-xs font-bold"
          style={n <= value
            ? { background: color, borderColor: color, color: 'white' }
            : { borderColor: '#e2e8f0', color: '#cbd5e1' }}>
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Skills() {
  const [matrix, setMatrix] = useState(skillCategories);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSkill, setNewSkill] = useState({ category: 'Leadership', name: '', self: 3 });

  function updateSelf(catIdx, skillIdx, val) {
    setMatrix(m => m.map((cat, ci) => ci !== catIdx ? cat : {
      ...cat,
      skills: cat.skills.map((s, si) => si !== skillIdx ? s : { ...s, self: val }),
    }));
  }

  function addSkill(e) {
    e.preventDefault();
    setMatrix(m => m.map(cat => cat.category !== newSkill.category ? cat : {
      ...cat,
      skills: [...cat.skills, { name: newSkill.name, self: newSkill.self, peer: 0 }],
    }));
    setNewSkill({ category: 'Leadership', name: '', self: 3 });
    setShowAdd(false);
    toast.success('Skill added');
  }

  const allSkills = matrix.flatMap(c => c.skills);
  const avgSelf = +(allSkills.reduce((a, s) => a + s.self, 0) / allSkills.length).toFixed(1);
  const avgPeer = +(allSkills.filter(s => s.peer).reduce((a, s) => a + s.peer, 0) / allSkills.filter(s => s.peer).length).toFixed(1);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Skills Development Matrix</h1>
          <p className="text-slate-500 text-sm">Self-assessment and peer ratings across skill domains</p>
        </div>
        <div className="flex gap-2">
          <button className={editMode ? 'btn-primary' : 'btn-secondary'} onClick={() => { setEditMode(e => !e); if (editMode) toast.success('Ratings saved'); }}>
            {editMode ? '✓ Save Ratings' : '✏️ Edit Ratings'}
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(s => !s)}>+ Add Skill</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Avg Self-Assessment</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#0d9488' }}>{avgSelf}<span className="text-lg text-slate-400">/5</span></p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Avg Peer Rating</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#1e3a6e' }}>{avgPeer}<span className="text-lg text-slate-400">/5</span></p>
        </div>
      </div>

      {showAdd && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-700 mb-4">Add New Skill</h3>
          <form onSubmit={addSkill} className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={newSkill.category} onChange={e => setNewSkill(f => ({ ...f, category: e.target.value }))}>
                {matrix.map(c => <option key={c.category}>{c.category}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Skill Name</label>
              <input className="input" required value={newSkill.name} onChange={e => setNewSkill(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Agile Methodology" />
            </div>
            <div>
              <label className="label">Initial Self Rating (1-5)</label>
              <input className="input" type="number" min={1} max={5} value={newSkill.self} onChange={e => setNewSkill(f => ({ ...f, self: +e.target.value }))} />
            </div>
            <div className="sm:col-span-3 flex gap-3">
              <button className="btn-primary" type="submit">Add Skill</button>
              <button className="btn-secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {matrix.map((cat, ci) => (
        <div key={cat.category} className="card overflow-hidden">
          <div className="px-5 py-3 font-bold text-white text-sm" style={{ background: '#0f2044' }}>{cat.category}</div>
          <div className="divide-y divide-slate-100">
            {cat.skills.map((skill, si) => (
              <div key={skill.name} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-40">
                  <p className="font-semibold text-sm text-slate-700">{skill.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{levels[skill.self]}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Self</p>
                    <RatingDots value={skill.self} onChange={editMode ? val => updateSelf(ci, si, val) : null} color="#0d9488" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Peer Avg</p>
                    <RatingDots value={skill.peer} color="#1e3a6e" />
                  </div>
                  {skill.self > skill.peer && skill.peer > 0 && <span className="badge-yellow">Gap</span>}
                  {skill.self < 3 && <span className="badge-red">Develop</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
