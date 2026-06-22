import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const skillCategories = [
  { category: 'Leadership',    skills: [{ name: 'Strategic Thinking', self: 3, peer: 4 },{ name: 'Team Development', self: 4, peer: 3 },{ name: 'Decision Making', self: 3, peer: 3 },{ name: 'Communication', self: 5, peer: 4 }] },
  { category: 'Technical',     skills: [{ name: 'Lean Principles', self: 4, peer: 4 },{ name: 'Data Analysis', self: 2, peer: 3 },{ name: 'Root Cause Analysis', self: 4, peer: 4 },{ name: 'Project Management', self: 3, peer: 3 }] },
  { category: 'Interpersonal', skills: [{ name: 'Conflict Resolution', self: 3, peer: 3 },{ name: 'Coaching & Mentoring', self: 4, peer: 5 },{ name: 'Emotional Intelligence', self: 4, peer: 4 },{ name: 'Active Listening', self: 5, peer: 4 }] },
];

const levelLabels = ['','Novice','Developing','Proficient','Advanced','Expert'];
const catColors = { Leadership: '#0f2044', Technical: '#0891b2', Interpersonal: '#8b5cf6' };

function RatingDots({ value, onChange, color }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange && onChange(n)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${n <= value ? color : '#e2e8f0'}`, background: n <= value ? color : 'transparent', color: n <= value ? 'white' : '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: onChange ? 'pointer' : 'default', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    setMatrix(m => m.map((cat, ci) => ci !== catIdx ? cat : { ...cat, skills: cat.skills.map((s, si) => si !== skillIdx ? s : { ...s, self: val }) }));
  }

  function addSkill(e) {
    e.preventDefault();
    setMatrix(m => m.map(cat => cat.category !== newSkill.category ? cat : { ...cat, skills: [...cat.skills, { name: newSkill.name, self: newSkill.self, peer: 0 }] }));
    setNewSkill({ category: 'Leadership', name: '', self: 3 });
    setShowAdd(false);
    toast.success('Skill added');
  }

  const allSkills = matrix.flatMap(c => c.skills);
  const avgSelf = +(allSkills.reduce((a, s) => a + s.self, 0) / allSkills.length).toFixed(1);
  const avgPeer = +(allSkills.filter(s => s.peer).reduce((a, s) => a + s.peer, 0) / allSkills.filter(s => s.peer).length).toFixed(1);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="⭐" title="Skills Development Matrix" subtitle="Self-assessment and peer ratings across skill domains"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={editMode ? 'btn-primary' : 'btn-secondary'} onClick={() => { setEditMode(e => !e); if (editMode) toast.success('Ratings saved'); }}>
              {editMode ? '✓ Save' : '✏️ Edit'}
            </button>
            <button className="btn-primary" onClick={() => setShowAdd(s => !s)}>+ Add Skill</button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div className="stat-tile" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Avg Self-Assessment</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0d9488', margin: 0 }}>{avgSelf}<span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
        </div>
        <div className="stat-tile" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Avg Peer Rating</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f2044', margin: 0 }}>{avgPeer}<span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Add New Skill</h3>
          <form onSubmit={addSkill} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div><label className="label">Category</label><select className="input" value={newSkill.category} onChange={e => setNewSkill(f => ({ ...f, category: e.target.value }))}>{matrix.map(c => <option key={c.category}>{c.category}</option>)}</select></div>
            <div><label className="label">Skill Name</label><input className="input" required value={newSkill.name} onChange={e => setNewSkill(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Agile Methodology" /></div>
            <div><label className="label">Initial Rating</label><input className="input" type="number" min={1} max={5} value={newSkill.self} onChange={e => setNewSkill(f => ({ ...f, self: +e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add Skill</button>
              <button className="btn-secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {matrix.map((cat, ci) => (
          <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1.25rem', background: catColors[cat.category] || '#0f2044', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{cat.category}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{cat.skills.length} skills</span>
            </div>
            <div>
              {cat.skills.map((skill, si) => (
                <div key={skill.name} style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: si < cat.skills.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 2px' }}>{skill.name}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{levelLabels[skill.self]}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self</p>
                      <RatingDots value={skill.self} onChange={editMode ? val => updateSelf(ci, si, val) : null} color="#0d9488" />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peer</p>
                      <RatingDots value={skill.peer} color="#0f2044" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {skill.self > skill.peer && skill.peer > 0 && <span className="badge-yellow">Gap</span>}
                      {skill.self < 3 && <span className="badge-red">Develop</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
