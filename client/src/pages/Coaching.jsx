import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus from '../components/DateStatus';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const sessionTypes = ['Performance', 'Development', 'Disciplinary', 'Recognition', 'Career', 'General'];
const typeColors   = { Performance: '#0d9488', Development: '#0f2044', Disciplinary: '#ef4444', Recognition: '#f59e0b', Career: '#8b5cf6', General: '#64748b' };

const emptyActionRow = () => ({ action: '', responsible: '', date: '' });
const emptyForm = { date: '', coachee: '', type: 'Performance', duration: '', coachingGoal: '', notes: '', actionItems: [emptyActionRow()], nextSession: '' };

const GUIDES = {
  sessionType: {
    goal: 'Select the primary purpose of this conversation so sessions are filed correctly and patterns become visible over time.',
    questions: [
      'Performance — addressing a gap between current output and expectation.',
      'Development — building a skill or expanding capability.',
      'Disciplinary — a documented conversation about conduct or repeated failure. Every word matters.',
      'Recognition — reinforcing specific behavior. Name exactly what they did and why it mattered.',
      'Career — goals, growth path, next role aspirations.',
      'General — catch-all check-in when no single type fits.',
    ],
    watch: null,
  },
  coachingGoal: {
    goal: 'Write the specific outcome you want this conversation to produce — not what you\'ll talk about, but what will be different by the end. This anchors you when the conversation drifts.',
    questions: [
      'What do I want the coachee to realize or commit to by the end of this session?',
      'How will I know the session succeeded?',
      'What\'s the one thing that must not leave unsaid?',
    ],
    watch: 'Vague goals ("talk about delegation") produce vague sessions. "Help Sandra identify the exact moment she takes over and commit to a concrete habit to stop it" is specific enough to coach against.',
  },
  notes: {
    goal: 'Capture the key moments of the conversation across three stages — Identify, Trigger, Sustain — so the pattern is visible over time.',
    questions: [
      'IDENTIFY: What was the real issue beneath the presenting complaint? What did they say about their own role in it?',
      'TRIGGER: What was the exact moment of choice? What did they tell themselves right before the behavior?',
      'SUSTAIN: What specific commitment did they make? What was their 1–10 commitment score, and what moved it?',
    ],
    watch: 'If notes only describe what others did ("he was late," "she didn\'t communicate"), redirect — get their behavior on the record. "That\'s what they did. What did you do, or not do, in response?"',
  },
  actionItems: {
    goal: 'Every row is a specific commitment with a name and a date. This is the record you open at the next session — it\'s where accountability is made visible.',
    questions: [
      'Action: Write a verb — what will physically happen? Not "communicate better" but "give direct feedback within 24 hours of a missed deadline."',
      'Responsible: Almost always the coachee. If blank, no one owns it.',
      'Due Date: A real date. If they say "soon," ask: "What\'s the latest this could happen and still make a difference?"',
    ],
    watch: '"I\'ll try to do better" is not a commitment. If the Action column can\'t be read aloud as a specific thing that either happened or didn\'t — rewrite it.',
  },
  nextSession: {
    goal: 'Set this before the person leaves. A commitment without a review date evaporates.',
    questions: [
      'Performance / Disciplinary → weekly follow-up.',
      'Development → every 2 weeks.',
      'Career / General → monthly is usually fine.',
      'Recognition → no follow-up needed unless reinforcing further.',
    ],
    watch: 'Open the next session by reviewing action items first: "Last week you committed to X by Y — what happened?" Get the fact before coaching what comes next.',
  },
};

function FieldGuide({ guideKey }) {
  const [open, setOpen] = useState(false);
  const g = GUIDES[guideKey];
  if (!g) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: '#0d9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '0.65rem' }}>▼</span>
        {open ? 'Hide guide' : 'Show guide'}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.875rem 1rem', fontSize: '0.82rem', lineHeight: 1.65 }}>
          <p style={{ fontWeight: 800, color: '#0f2044', margin: '0 0 6px' }}>Goal</p>
          <p style={{ color: '#0d9488', margin: '0 0 10px' }}>{g.goal}</p>
          <p style={{ fontWeight: 800, color: '#0f2044', margin: '0 0 6px' }}>Ask yourself</p>
          <ul style={{ margin: '0 0 10px', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.questions.map((q, i) => (
              <li key={i} style={{ color: '#0d9488' }}>{q}</li>
            ))}
          </ul>
          {g.watch && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
              <span style={{ fontWeight: 700, color: '#92400e' }}>Watch for: </span>
              <span style={{ color: '#92400e' }}>{g.watch}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionItemsGrid({ rows, onChange }) {
  function updateRow(i, field, value) {
    const updated = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    onChange(updated);
  }
  function addRow() { onChange([...rows, emptyActionRow()]); }
  function removeRow(i) {
    const updated = rows.filter((_, idx) => idx !== i);
    onChange(updated.length ? updated : [emptyActionRow()]);
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 32px', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>Action</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>Responsible</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>Due Date</span>
        <span />
      </div>
      {/* Data rows */}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 32px', gap: 6, marginBottom: 6 }}>
          <input
            className="input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            placeholder="Describe the action..."
            value={row.action}
            onChange={e => updateRow(i, 'action', e.target.value)}
          />
          <input
            className="input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            placeholder="Name"
            value={row.responsible}
            onChange={e => updateRow(i, 'responsible', e.target.value)}
          />
          <input
            className="input"
            type="date"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            value={row.date}
            onChange={e => updateRow(i, 'date', e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Remove row"
          >✕</button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{ marginTop: 4, background: '#f0fdfa', border: '1.5px dashed #0d9488', borderRadius: 8, color: '#0d9488', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
      >+ Add Row</button>
    </div>
  );
}

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
      // Migrate old string-array action items to new object format
      const migrated = data.map(s => ({
        ...s,
        actionItems: Array.isArray(s.actionItems)
          ? s.actionItems.map(item =>
              typeof item === 'string' ? { action: item, responsible: '', date: '' } : item
            )
          : [emptyActionRow()],
      }));
      setSessions(migrated);
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
        actionItems: form.actionItems.filter(r => r.action.trim()),
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
    const items = Array.isArray(s.actionItems) && s.actionItems.length
      ? s.actionItems.map(item =>
          typeof item === 'string' ? { action: item, responsible: '', date: '' } : item
        )
      : [emptyActionRow()];
    setEditForm({ ...s, actionItems: items });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const updated = sessions.map(s =>
        s.id === editingId
          ? { ...s, ...editForm, actionItems: editForm.actionItems.filter(r => r.action.trim()) }
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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => window.open('/coaching-guide.html', '_blank', 'width=860,height=800')}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 9, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Field Guide
          </button>
          <button onClick={() => window.open('/coaching-example.html', '_blank', 'width=860,height=800')}
            style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 9, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Worked Example →
          </button>
        </div>
      </div>

      {/* New session form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>New Coaching Session</h3>
          <form onSubmit={addSession} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Coachee Name</label><input className="input" required value={form.coachee} onChange={e => setForm(f => ({ ...f, coachee: e.target.value }))} placeholder="Team member name" /></div>
            <div>
              <label className="label">Session Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(t => <option key={t}>{t}</option>)}</select>
              <FieldGuide guideKey="sessionType" />
            </div>
            <div><label className="label">Date</label><input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Duration</label><input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 45 min" /></div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Coaching Goal</label>
              <input className="input" value={form.coachingGoal} onChange={e => setForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder="What is the specific outcome you want from this session?" />
              <FieldGuide guideKey="coachingGoal" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Session Notes</label>
              <textarea className="input" required rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Key discussion points, observations, commitments..." />
              <FieldGuide guideKey="notes" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label" style={{ marginBottom: 8, display: 'block' }}>Action Items</label>
              <ActionItemsGrid rows={form.actionItems} onChange={rows => setForm(f => ({ ...f, actionItems: rows }))} />
              <FieldGuide guideKey="actionItems" />
            </div>
            <div>
              <label className="label">Next Session Date</label>
              <input className="input" type="date" value={form.nextSession} onChange={e => setForm(f => ({ ...f, nextSession: e.target.value }))} />
              <FieldGuide guideKey="nextSession" />
            </div>
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
        {sessions.map(s => (
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
                    {s.nextSession && <span><DateStatus date={s.nextSession} prefix="Next · " /></span>}
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
                  <div>
                    <label className="label">Session Type</label>
                    <select className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(t => <option key={t}>{t}</option>)}</select>
                    <FieldGuide guideKey="sessionType" />
                  </div>
                  <div><label className="label">Date</label><input className="input" type="date" required value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
                  <div><label className="label">Duration</label><input className="input" value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} /></div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Coaching Goal</label>
                    <input className="input" value={editForm.coachingGoal || ''} onChange={e => setEditForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder="What is the specific outcome you want from this session?" />
                    <FieldGuide guideKey="coachingGoal" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Session Notes</label>
                    <textarea className="input" rows={4} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                    <FieldGuide guideKey="notes" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label" style={{ marginBottom: 8, display: 'block' }}>Action Items</label>
                    <ActionItemsGrid rows={editForm.actionItems} onChange={rows => setEditForm(f => ({ ...f, actionItems: rows }))} />
                    <FieldGuide guideKey="actionItems" />
                  </div>
                  <div>
                    <label className="label">Next Session Date</label>
                    <input className="input" type="date" value={editForm.nextSession} onChange={e => setEditForm(f => ({ ...f, nextSession: e.target.value }))} />
                    <FieldGuide guideKey="nextSession" />
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
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', gap: 8, padding: '0.4rem 0.6rem', background: '#f1f5f9', borderRadius: '8px 8px 0 0' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsible</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</span>
                    </div>
                    {s.actionItems.map((item, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', gap: 8, padding: '0.5rem 0.6rem', borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <span style={{ fontSize: '0.85rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#0d9488', fontWeight: 700 }}>→</span>
                          {typeof item === 'string' ? item : item.action}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{typeof item === 'object' ? item.responsible : ''}</span>
                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{typeof item === 'object' && item.date ? item.date : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.nextSession && <div style={{ marginTop: 10 }}><DateStatus date={s.nextSession} prefix="Next session · " /></div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
