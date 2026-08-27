import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus from '../components/DateStatus';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { calculateScore, logPointEvent, isCompleteCoachingSession, weekMonday } from '../utils/scoring';
import NameField from '../components/NameField';
import { useSavedNames } from '../utils/savedNames';

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

// Grows with its content so a long action item is never clipped to one line —
// matches the pattern used for Visual Board actions and SMART goal titles.
function AutoGrowTextarea({ value, style, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} style={{ ...style, overflow: 'hidden', resize: 'vertical' }} {...props} />;
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
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 32px', gap: 6, marginBottom: 6, alignItems: 'start' }}>
          <AutoGrowTextarea
            className="input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem', minHeight: 34 }}
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
  const { names: savedNames, remember: rememberName } = useSavedNames();
  const [sessions, setSessions]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [editingId, setEditingId]         = useState(null);
  const [editForm, setEditForm]           = useState(null);
  const [form, setForm]                   = useState(emptyForm);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [suggestingQuestions, setSuggestingQuestions] = useState(false);
  const [suggestingOutcome, setSuggestingOutcome]     = useState(false);
  const [closingId, setClosingId]         = useState(null);
  const [closeForm, setCloseForm]         = useState({ comments: '', outcome: '' });
  const [closing, setClosing]             = useState(false);
  const [statusFilter, setStatusFilter]   = useState(null); // clicking a stat tile filters the list to that status

  // Log 5 pts the first time a complete coaching session is saved in a given week
  async function maybeLogCoachingPoints(session) {
    if (!isCompleteCoachingSession(session)) return false;
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    const events = snap.exists() ? (snap.data().pointEvents || []) : [];
    const thisWeek = weekMonday(new Date().toISOString().split('T')[0]);
    const alreadyEarned = events.some(
      e => e.toolLabel === 'Coaching Log' && weekMonday(e.date) === thisWeek
    );
    if (!alreadyEarned) {
      const { awarded } = await logPointEvent(currentUser.uid, {
        points: 5,
        toolLabel: 'Coaching Log',
        reason: `Complete coaching session with ${session.coachee}`,
      });
      return awarded ? 'earned' : 'capped';
    }
    return false;
  }

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
      rememberName(form.coachee);
      setForm(emptyForm);
      setSuggestedQuestions([]);
      setShowForm(false);
      const earned = await maybeLogCoachingPoints(newSession);
      calculateScore(currentUser.uid).catch(() => {});
      if (earned === 'earned') {
        toast.success('⭐ Session logged — +5 pts for your Coaching Log this week!', { duration: 6000, icon: '🌟' });
      } else if (earned === 'capped') {
        toast('Session logged. You\'ve reached your 25-pt daily limit — come back tomorrow to keep scoring! 🗓', { duration: 6000, icon: '📅' });
      } else {
        toast.success('Session logged');
      }
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    }
  }

  // AI assistant (coachingAiAssist Cloud Function) — suggest coaching questions
  // from a goal, or draft an outcome summary from notes + action items.
  async function suggestQuestions(goal) {
    if (!(goal || '').trim()) return toast.error('Enter a coaching goal first');
    setSuggestingQuestions(true);
    setSuggestedQuestions([]);
    try {
      const fn = httpsCallable(getFunctions(), 'coachingAiAssist');
      const res = await fn({ mode: 'questions', goal });
      setSuggestedQuestions(res.data?.questions || []);
    } catch (e) {
      toast.error(e?.message || 'AI suggestion failed');
    }
    setSuggestingQuestions(false);
  }

  async function suggestOutcome(session) {
    if (!(session?.notes || '').trim()) return toast.error('This session has no notes to summarize');
    setSuggestingOutcome(true);
    try {
      const fn = httpsCallable(getFunctions(), 'coachingAiAssist');
      const res = await fn({ mode: 'outcome', notes: session.notes, actionItems: session.actionItems });
      if (res.data?.outcome) setCloseForm(f => ({ ...f, outcome: res.data.outcome }));
    } catch (e) {
      toast.error(e?.message || 'AI suggestion failed');
    }
    setSuggestingOutcome(false);
  }

  function startClose(s) {
    setClosingId(s.id);
    setCloseForm({ comments: s.closingComments || '', outcome: s.outcome || '' });
  }

  async function closeSession(e) {
    e.preventDefault();
    if (!currentUser) return;
    if (!closeForm.outcome.trim()) return toast.error('Please describe the outcome before closing');
    setClosing(true);
    try {
      const s = sessions.find(x => x.id === closingId);
      const now = new Date().toISOString().split('T')[0];
      const updated = sessions.map(x => x.id === closingId
        ? { ...x, closed: true, closedAt: now, closingComments: closeForm.comments.trim(), outcome: closeForm.outcome.trim() }
        : x);
      await persist(updated);
      setSelectedSession(updated.find(x => x.id === closingId) || null);
      setClosingId(null);
      const { awarded, capReached } = await logPointEvent(currentUser.uid, {
        points: 5,
        toolLabel: 'Coaching Session Closed',
        reason: `Closed coaching session with ${s?.coachee || 'coachee'}`,
      });
      if (awarded) {
        await updateDoc(doc(db, 'users', currentUser.uid), { bonusPoints: increment(5) });
      }
      calculateScore(currentUser.uid).catch(() => {});
      if (awarded) {
        toast.success('⭐ Session closed — +5 pts!', { duration: 6000, icon: '🌟' });
      } else if (capReached) {
        toast('Session closed. Daily 25-pt cap reached — come back tomorrow! 🗓', { duration: 6000, icon: '📅' });
      } else {
        toast.success('Session closed');
      }
    } catch (e) {
      toast.error('Failed to close session: ' + e.message);
    }
    setClosing(false);
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
      rememberName(editForm.coachee);
      setSelectedSession(updated.find(s => s.id === editingId) || null);
      setEditingId(null);
      setEditForm(null);
      const saved = updated.find(s => s.id === editingId);
      if (saved) await maybeLogCoachingPoints(saved);
      calculateScore(currentUser.uid).catch(() => {});
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
  const openCount   = sessions.filter(s => !s.closed).length;
  const closedCount = sessions.filter(s => s.closed).length;

  const STATUS_LABELS = { open: 'Open', closed: 'Closed' };
  const filteredSessions = sessions.filter(s => {
    if (!statusFilter) return true;
    return statusFilter === 'closed' ? !!s.closed : !s.closed;
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="📝" title="Coaching Log — Accountability that Supports" subtitle="Document sessions, notes, and action items"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Log Session</button>} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '0.75rem' }}>
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

      {/* Status filter tiles — click to show only Open or Closed sessions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { key: 'open',   label: 'Open',   value: openCount,   icon: '🟡', color: '#b45309' },
          { key: 'closed', label: 'Closed', value: closedCount, icon: '✅', color: '#15803d' },
        ].map(s => (
          <button key={s.key} className="stat-tile" onClick={() => setStatusFilter(f => f === s.key ? null : s.key)}
            style={{ textAlign: 'center', cursor: 'pointer', border: 'none', outline: statusFilter === s.key ? `2px solid ${s.color}` : 'none', outlineOffset: -2 }}>
            <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: '4px 0 0', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label} Sessions</p>
          </button>
        ))}
      </div>

      {statusFilter && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '-0.75rem 0 1rem' }}>
          Showing only <strong style={{ color: 'var(--text-primary)' }}>{STATUS_LABELS[statusFilter]}</strong> sessions
          <button onClick={() => setStatusFilter(null)}
            style={{ marginLeft: 10, background: 'none', border: 'none', color: '#0d9488', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
            Clear filter
          </button>
        </p>
      )}

      {/* Worked example banner */}
      <div style={{ background: 'linear-gradient(90deg,#0f2044,#1e3a6e)', borderRadius: 12, padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <p style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', margin: '0 0 2px' }}>💬 New to coaching? See how a real conversation flows.</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', margin: 0 }}>A full manager–coachee dialogue showing questions-first coaching — every action owned by the coachee.</p>
        </div>
        <button onClick={() => window.open('/coaching-example.html', '_blank', 'width=860,height=800')}
          style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 9, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Worked Example →
        </button>
      </div>

      {/* New session form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>New Coaching Session</h3>
          <form onSubmit={addSession} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Coachee Name</label><NameField required value={form.coachee} names={savedNames} onChange={e => setForm(f => ({ ...f, coachee: e.target.value }))} placeholder="Team member name" /></div>
            <div>
              <label className="label">Session Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(t => <option key={t}>{t}</option>)}</select>
              <FieldGuide guideKey="sessionType" />
            </div>
            <div><label className="label">Date</label><input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Duration</label><input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 45 min" /></div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Coaching Goal</label>
              <textarea className="input" rows={2} value={form.coachingGoal} onChange={e => setForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder="What is the specific outcome you want from this session?" />
              <FieldGuide guideKey="coachingGoal" />
              <button type="button" onClick={() => suggestQuestions(form.coachingGoal)} disabled={suggestingQuestions}
                style={{ marginTop: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, color: '#6d28d9', fontWeight: 700, fontSize: '0.75rem', padding: '4px 10px', cursor: 'pointer' }}>
                {suggestingQuestions ? 'Thinking…' : '✨ Suggest Coaching Questions (AI)'}
              </button>
              {suggestedQuestions.length > 0 && (
                <div style={{ marginTop: 8, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '0.6rem 0.875rem' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>AI-Suggested Questions</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {suggestedQuestions.map((q, i) => (
                      <li key={i} style={{ fontSize: '0.82rem', color: '#4c1d95', marginBottom: 4 }}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
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
              <button className="btn-secondary" type="button" onClick={() => { setShowForm(false); setSuggestedQuestions([]); }}>Cancel</button>
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

      {!loading && sessions.length > 0 && filteredSessions.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontWeight: 700, margin: 0 }}>No {STATUS_LABELS[statusFilter]?.toLowerCase()} sessions.</p>
        </div>
      )}

      {/* Session cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredSessions.map(s => (
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
                    {s.closed && <span className="badge-green" style={{ fontSize: '0.68rem' }}>✅ Closed {s.closedAt}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>📅 {s.date} · ⏱ {s.duration}</p>
                    {!s.closed && s.nextSession && <span><DateStatus date={s.nextSession} prefix="Next · " /></span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { startEdit(s); setSelectedSession(null); setClosingId(null); }}
                  style={{ background: 'none', border: '1px solid #0d9488', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', cursor: 'pointer' }}>
                  ✏️ Edit
                </button>
                <button onClick={() => { setSelectedSession(selectedSession?.id === s.id ? null : s); setEditingId(null); setClosingId(null); }}
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
                  <div><label className="label">Coachee Name</label><NameField required value={editForm.coachee} names={savedNames} onChange={e => setEditForm(f => ({ ...f, coachee: e.target.value }))} /></div>
                  <div>
                    <label className="label">Session Type</label>
                    <select className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(t => <option key={t}>{t}</option>)}</select>
                    <FieldGuide guideKey="sessionType" />
                  </div>
                  <div><label className="label">Date</label><input className="input" type="date" required value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
                  <div><label className="label">Duration</label><input className="input" value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} /></div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Coaching Goal</label>
                    <textarea className="input" rows={2} value={editForm.coachingGoal || ''} onChange={e => setEditForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder="What is the specific outcome you want from this session?" />
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
                {!s.closed && s.nextSession && <div style={{ marginTop: 10 }}><DateStatus date={s.nextSession} prefix="Next session · " /></div>}

                {/* Close Session — the very last thing in the details view */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                  {s.closed ? (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.875rem 1rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>✅ Session Closed — {s.closedAt}</p>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', margin: '0 0 2px' }}>Outcome</p>
                      <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, margin: '0 0 8px' }}>{s.outcome}</p>
                      {s.closingComments && (
                        <>
                          <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', margin: '0 0 2px' }}>Additional Comments</p>
                          <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, margin: 0 }}>{s.closingComments}</p>
                        </>
                      )}
                    </div>
                  ) : closingId === s.id ? (
                    <form onSubmit={closeSession}>
                      <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>Close Session</h4>
                      <div style={{ marginBottom: 10 }}>
                        <label className="label">Outcome</label>
                        <textarea className="input" rows={2} required value={closeForm.outcome}
                          onChange={e => setCloseForm(f => ({ ...f, outcome: e.target.value }))}
                          placeholder="What was the result of this coaching session?" />
                        <button type="button" onClick={() => suggestOutcome(s)} disabled={suggestingOutcome}
                          style={{ marginTop: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, color: '#6d28d9', fontWeight: 700, fontSize: '0.75rem', padding: '4px 10px', cursor: 'pointer' }}>
                          {suggestingOutcome ? 'Thinking…' : '✨ Draft Outcome from Notes (AI)'}
                        </button>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label className="label">Additional Comments (optional)</label>
                        <textarea className="input" rows={2} value={closeForm.comments}
                          onChange={e => setCloseForm(f => ({ ...f, comments: e.target.value }))}
                          placeholder="Anything else worth noting before closing this session..." />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn-primary" type="submit" disabled={closing}>{closing ? 'Closing...' : '✅ Close Session (+5 pts)'}</button>
                        <button className="btn-secondary" type="button" onClick={() => setClosingId(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => startClose(s)}
                      style={{ background: '#0d9488', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', color: 'white', cursor: 'pointer' }}>
                      ✅ Close Session
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
