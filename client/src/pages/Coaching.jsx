import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const sampleSessions = [
  { id: 1, date: '2024-07-15', coachee: 'Marcus Johnson', type: 'Performance', duration: '45 min',
    notes: 'Discussed Q2 performance gaps. Marcus needs support with prioritization and delegation.',
    actionItems: ['Complete time-management worksheet by 7/22', 'Shadow Sara in daily stand-ups', 'Read "The One Thing" chapter 3'],
    nextSession: '2024-07-29' },
  { id: 2, date: '2024-07-10', coachee: 'Elena Martinez', type: 'Development', duration: '30 min',
    notes: 'Career growth conversation. Elena is interested in transitioning to a project lead role.',
    actionItems: ['Complete PMP prep course', 'Lead next Kaizen event', 'Present at team meeting 7/18'],
    nextSession: '2024-07-24' },
];

const sessionTypes = ['Performance', 'Development', 'Disciplinary', 'Recognition', 'Career', 'General'];
const typeColors = { Performance: '#0d9488', Development: '#0f2044', Disciplinary: '#ef4444', Recognition: '#f59e0b', Career: '#8b5cf6', General: '#64748b' };

export default function Coaching() {
  const [sessions, setSessions] = useState(sampleSessions);
  const [showForm, setShowForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [form, setForm] = useState({ date: '', coachee: '', type: 'Performance', duration: '', notes: '', actionItems: '', nextSession: '' });

  function addSession(e) {
    e.preventDefault();
    setSessions(s => [{ ...form, id: Date.now(), actionItems: form.actionItems.split('\n').filter(Boolean) }, ...s]);
    setForm({ date: '', coachee: '', type: 'Performance', duration: '', notes: '', actionItems: '', nextSession: '' });
    setShowForm(false);
    toast.success('Session logged');
  }

  const coachees = new Set(sessions.map(s => s.coachee)).size;
  const actions = sessions.reduce((a, s) => a + (s.actionItems?.length || 0), 0);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="📝" title="Coaching Log" subtitle="Document sessions, notes, and action items"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Log Session</button>} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Sessions', value: sessions.length, icon: '📝', color: '#0d9488' },
          { label: 'Coachees',        value: coachees,        icon: '👥', color: '#0f2044' },
          { label: 'Action Items',    value: actions,          icon: '✅', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: '4px 0 0', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>New Coaching Session</h3>
          <form onSubmit={addSession} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Coachee Name</label><input className="input" required value={form.coachee} onChange={e => setForm(f => ({ ...f, coachee: e.target.value }))} placeholder="Team member name" /></div>
            <div><label className="label">Session Type</label><select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="label">Date</label><input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Duration</label><input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 45 min" /></div>
            <div style={{ gridColumn: '1/-1' }}><label className="label">Session Notes</label><textarea className="input" required rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Key discussion points, observations, commitments..." /></div>
            <div style={{ gridColumn: '1/-1' }}><label className="label">Action Items (one per line)</label><textarea className="input" rows={3} value={form.actionItems} onChange={e => setForm(f => ({ ...f, actionItems: e.target.value }))} placeholder="Complete worksheet by date&#10;Read chapter 3" /></div>
            <div><label className="label">Next Session Date</label><input className="input" type="date" value={form.nextSession} onChange={e => setForm(f => ({ ...f, nextSession: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Save Session</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sessions.map(s => (
          <div key={s.id} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: (typeColors[s.type] || '#0d9488') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '1.25rem' }}>👤</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{s.coachee}</h4>
                    <span style={{ background: typeColors[s.type] || '#0d9488', color: 'white', borderRadius: 9999, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700 }}>{s.type}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>📅 {s.date} · ⏱ {s.duration}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', cursor: 'pointer' }}>
                {selectedSession?.id === s.id ? 'Collapse' : 'View Details'}
              </button>
            </div>

            {selectedSession?.id === s.id && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Session Notes</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.notes}</p>
                </div>
                {s.actionItems?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Action Items</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {s.actionItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: '#0d9488', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {s.nextSession && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>📅 Next session: <strong>{s.nextSession}</strong></p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
