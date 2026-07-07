import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const sampleRelationships = [
  { id: 1, mentor: 'Dr. Patricia Wells', mentee: 'James Carter', startDate: '2024-01-15', focus: 'Executive Leadership', status: 'Active', sessions: 8, nextMeeting: '2024-08-05', progress: 72,
    milestones: [{ text: 'Identify leadership blind spots', done: true },{ text: 'Complete 360-degree assessment', done: true },{ text: 'Develop personal leadership brand', done: true },{ text: 'Lead cross-functional project', done: false },{ text: 'Present to executive team', done: false }] },
  { id: 2, mentor: 'You', mentee: 'Sofia Nguyen', startDate: '2024-03-01', focus: 'Technical & Process Improvement', status: 'Active', sessions: 5, nextMeeting: '2024-08-12', progress: 45,
    milestones: [{ text: 'Learn Lean fundamentals', done: true },{ text: 'Lead first 5S event', done: true },{ text: 'Complete A3 problem-solving training', done: false },{ text: 'Facilitate Kaizen workshop', done: false }] },
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
      const progress = milestones.length ? Math.round((milestones.filter(m => m.done).length / milestones.length) * 100) : 0;
      return { ...r, milestones, progress };
    }));
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="🤝" title="Mentoring Tracker" subtitle="Manage mentor/mentee relationships and milestones"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Session</button>} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Active Pairs',   value: relationships.filter(r => r.status === 'Active').length, color: '#0d9488' },
          { label: 'Total Sessions', value: relationships.reduce((a, r) => a + r.sessions, 0),        color: '#0f2044' },
          { label: 'Avg Progress',   value: relationships.length ? Math.round(relationships.reduce((a, r) => a + r.progress, 0) / relationships.length) + '%' : '0%', color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>New Mentoring Relationship</h3>
          <form onSubmit={addRelationship} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Mentor</label><input className="input" required value={form.mentor} onChange={e => setForm(f => ({ ...f, mentor: e.target.value }))} placeholder="Mentor name" /></div>
            <div><label className="label">Mentee</label><input className="input" required value={form.mentee} onChange={e => setForm(f => ({ ...f, mentee: e.target.value }))} placeholder="Mentee name" /></div>
            <div><label className="label">Focus Area</label><input className="input" value={form.focus} onChange={e => setForm(f => ({ ...f, focus: e.target.value }))} placeholder="e.g. Technical Leadership" /></div>
            <div><label className="label">Start Date</label><input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add Session</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {relationships.map(rel => (
          <div key={rel.id} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', flexShrink: 0 }}>🤝</div>
                <div>
                  <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '0.9375rem' }}>{rel.mentor} → {rel.mentee}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>{rel.focus} · Since {rel.startDate}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>📅 {rel.sessions} sessions</span>
                    {rel.nextMeeting && <span>Next: {rel.nextMeeting}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className="badge-green">{rel.status}</span>
                <button onClick={() => setSelected(selected === rel.id ? null : rel.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.275rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#0d9488', cursor: 'pointer' }}>
                  {selected === rel.id ? 'Collapse' : 'Milestones'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>Progress</span><span style={{ color: '#0d9488', fontWeight: 700 }}>{rel.progress}%</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 7 }}>
                <div style={{ height: 7, borderRadius: 9999, background: 'linear-gradient(90deg,#0d9488,#14b8a6)', width: `${rel.progress}%`, transition: 'width 0.6s ease' }} />
              </div>
            </div>

            {selected === rel.id && rel.milestones.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Milestones</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rel.milestones.map((m, i) => (
                    <button key={i} onClick={() => toggleMilestone(rel.id, i)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${m.done ? '#0d9488' : '#e2e8f0'}`, background: m.done ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s' }}>
                        {m.done && '✓'}
                      </div>
                      <span style={{ fontSize: '0.875rem', color: m.done ? '#94a3b8' : 'var(--text-secondary)', textDecoration: m.done ? 'line-through' : 'none' }}>{m.text}</span>
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
