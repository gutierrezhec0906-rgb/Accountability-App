import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus from '../components/DateStatus';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const sessionTypes = ['Performance', 'Development', 'Disciplinary', 'Recognition', 'Career', 'General'];
const typeColors   = { Performance: '#0d9488', Development: '#0f2044', Disciplinary: '#ef4444', Recognition: '#f59e0b', Career: '#8b5cf6', General: '#64748b' };
const emptyForm    = { date: '', coachee: '', type: 'Performance', duration: '', coachingGoal: '', notes: '', actionItems: '', nextSession: '' };


export default function Coaching() {
  const { currentUser } = useAuth();
  const [sessions, setSessions]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [editingId, setEditingId]         = useState(null);
  const [editForm, setEditForm]           = useState(null);
  const [form, setForm]                   = useState(emptyForm);

  async function fetchSessions() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const data = snap.exists() ? (snap.data().coachingSessions || []) : [];
      setSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function persist(updated) {
    if (!currentUser) throw new Error('Not logged in');
    const ref = doc(db, 'users', currentUser.uid);
    await setDoc(ref, { coachingSessions: updated }, { merge: true });
    setSessions(updated);
  }

  useEffect(() => { fetchSessions(); }, [currentUser]);

  async function addSession(e) {
    e.preventDefault();
    if (!currentUser) return toast.error('Not logged in');
    try {
      const newSession = {
        id: Date.now().toString(),
        ...form,
        actionItems: form.actionItems.split('\n').filter(Boolean),
        createdAt: new Date().toISOString(),
      };
      const updated = [newSession, ...sessions];
      await persist(updated);
      setForm(emptyForm);
      setShowForm(false);
      toast.success('Session logged');
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditForm({ ...s, actionItems: (s.actionItems || []).join('\n') });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const updated = sessions.map(s =>
        s.id === editingId
          ? { ...s, ...editForm, actionItems: editForm.actionItems.split('\n').filter(Boolean) }
          : s
      );
      await persist(updated);
      setSelectedSession(updated.find(s => s.id === editingId) || null);
      setEditingId(null);
      setEditForm(null);
      toast.success('Session updated');
    } catch (e) {
      toast.error('Update failed: ' + e.message);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  const coachees = new Set(sessions.map(s => s.coachee)).size;
  const actions  = sessions.reduce((a, s) => a + (s.actionItems?.length || 0), 0);

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

      {/* Worked example banner */}
      <div style={{ background: 'linear-gradient(90deg,#0f2044,#1e3a6e)', borderRadius: 12, padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <p style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', margin: '0 0 2px' }}>💬 New to coaching? See how a real conversation flows.</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', margin: 0 }}>A full manager–coachee dialogue showing questions-first coaching — every action owned by the coachee.</p>
        </div>
        <button onClick={() => window.open('/coaching-example.html', '_blank', 'width=860,height=800')}
          style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 9, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          View Worked Example →
        </button>
      </div>

      {/* New session form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>New Coaching Session</h3>
          <form onSubmit={addSession} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Coachee Name</label><input className="input" required value={form.coachee} onChange={e => setForm(f => ({ ...f, coachee: e.target.value }))} placeholder="Team member name" /></div>
            <div><label className="label">Session Type</label><select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="label">Date</label><input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Duration</label><input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 45 min" /></div>
            <div style={{ gridColumn: '1/-1' }}><label className="label">Coaching Goal</label><input className="input" value={form.coachingGoal} onChange={e => setForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder="What is the goal for this coaching relationship?" /></div>
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

      {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading sessions...</p>}

      {!loading && sessions.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>📝</p>
          <p style={{ fontWeight: 700, margin: 0 }}>No sessions logged yet. Click "+ Log Session" to get started.</p>
        </div>
      )}

      {/* Session cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sessions.map(s => {
          return (
            <div key={s.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: (typeColors[s.type] || '#0d9488') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '1.25rem' }}>👤</span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{s.coachee}</h4>
                      <span style={{ background: typeColors[s.type] || '#0d9488', color: 'white', borderRadius: 9999, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700 }}>{s.type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>📅 {s.date} · ⏱ {s.duration}</p>
                      {s.nextSession && (
                        <span>
                          <DateStatus date={s.nextSession} prefix="Next · " />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { startEdit(s); setSelectedSession(null); }}
                    style={{ background: 'none', border: '1px solid #0d9488', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', cursor: 'pointer' }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
                    {selectedSession?.id === s.id ? 'Collapse' : 'View Details'}
                  </button>
                </div>
              </div>

              {/* Edit form */}
              {editingId === s.id && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>Edit Session</h4>
                  <form onSubmit={saveEdit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div><label className="label">Coachee Name</label><input className="input" required value={editForm.coachee} onChange={e => setEditForm(f => ({ ...f, coachee: e.target.value }))} /></div>
                    <div><label className="label">Session Type</label><select className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(t => <option key={t}>{t}</option>)}</select></div>
                    <div><label className="label">Date</label><input className="input" type="date" required value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
                    <div><label className="label">Duration</label><input className="input" value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} /></div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="label">Coaching Goal</label>
                      <input className="input" value={editForm.coachingGoal || ''} onChange={e => setEditForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder="What is the goal for this coaching relationship?" />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="label">Session Notes</label>
                      <textarea className="input" rows={4} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="label">Action Items (one per line)</label>
                      <textarea className="input" rows={3} value={editForm.actionItems} onChange={e => setEditForm(f => ({ ...f, actionItems: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Next Session Date</label>
                      <input className="input" type="date" value={editForm.nextSession} onChange={e => setEditForm(f => ({ ...f, nextSession: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                      <button className="btn-primary" type="submit">Save Changes</button>
                      <button className="btn-secondary" type="button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {/* View details */}
              {selectedSession?.id === s.id && editingId !== s.id && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  {s.coachingGoal && (
                    <div style={{ marginBottom: '0.875rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Coaching Goal</p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.coachingGoal}</p>
                    </div>
                  )}
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
                  {s.nextSession && <div style={{ marginTop: 10 }}><DateStatus date={s.nextSession} prefix="Next session · " /></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
