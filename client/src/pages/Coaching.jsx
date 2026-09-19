import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus from '../components/DateStatus';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import CoachingPractice from '../components/CoachingPractice';
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
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const g = GUIDES[guideKey];
  if (!g) return null;
  const goal = t(`coaching.guides.${guideKey}.goal`, g.goal);
  const questions = t(`coaching.guides.${guideKey}.questions`, { returnObjects: true, defaultValue: g.questions });
  const watch = g.watch ? t(`coaching.guides.${guideKey}.watch`, g.watch) : null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: '#0d9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '0.65rem' }}>▼</span>
        {open ? t('coaching.hideGuide', 'Hide guide') : t('coaching.showGuide', 'Show guide')}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.875rem 1rem', fontSize: '0.82rem', lineHeight: 1.65 }}>
          <p style={{ fontWeight: 800, color: '#0f2044', margin: '0 0 6px' }}>{t('coaching.guideGoal', 'Goal')}</p>
          <p style={{ color: '#0d9488', margin: '0 0 10px' }}>{goal}</p>
          <p style={{ fontWeight: 800, color: '#0f2044', margin: '0 0 6px' }}>{t('coaching.askYourself', 'Ask yourself')}</p>
          <ul style={{ margin: '0 0 10px', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {questions.map((q, i) => (
              <li key={i} style={{ color: '#0d9488' }}>{q}</li>
            ))}
          </ul>
          {watch && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
              <span style={{ fontWeight: 700, color: '#92400e' }}>{t('coaching.watchFor', 'Watch for:')} </span>
              <span style={{ color: '#92400e' }}>{watch}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionItemsGrid({ rows, onChange }) {
  const { t, i18n } = useTranslation();
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
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>{t('coaching.grid.action', 'Action')}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>{t('coaching.grid.responsible', 'Responsible')}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>{t('coaching.grid.dueDate', 'Due Date')}</span>
        <span />
      </div>
      {/* Data rows */}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 32px', gap: 6, marginBottom: 6 }}>
          <input
            className="input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            placeholder={t('coaching.grid.describeAction', 'Describe the action...')}
            value={row.action}
            onChange={e => updateRow(i, 'action', e.target.value)}
          />
          <input
            className="input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            placeholder={t('coaching.grid.name', 'Name')}
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
            title={t('coaching.grid.removeRow', 'Remove row')}
          >✕</button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{ marginTop: 4, background: '#f0fdfa', border: '1.5px dashed #0d9488', borderRadius: 8, color: '#0d9488', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
      >{t('coaching.grid.addRow', '+ Add Row')}</button>
    </div>
  );
}

function trSessionType(t, type) {
  const map = {
    Performance: t('coaching.types.performance', 'Performance'),
    Development: t('coaching.types.development', 'Development'),
    Disciplinary: t('coaching.types.disciplinary', 'Disciplinary'),
    Recognition: t('coaching.types.recognition', 'Recognition'),
    Career: t('coaching.types.career', 'Career'),
    General: t('coaching.types.general', 'General'),
  };
  return map[type] || type;
}

export default function Coaching() {
  const { t, i18n } = useTranslation();
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
  const [showPractice, setShowPractice]   = useState(false);

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
    if (!currentUser) return toast.error(t('coaching.toast.notLoggedIn', 'Not logged in'));
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
        toast.success(t('coaching.toast.sessionLoggedEarned', '⭐ Session logged — +5 pts for your Coaching Log this week!'), { duration: 6000, icon: '🌟' });
      } else if (earned === 'capped') {
        toast(t('coaching.toast.sessionLoggedCapped', "Session logged. You've reached your 25-pt daily limit — come back tomorrow to keep scoring! 🗓"), { duration: 6000, icon: '📅' });
      } else {
        toast.success(t('coaching.toast.sessionLogged', 'Session logged'));
      }
    } catch (e) {
      toast.error(t('coaching.toast.saveFailed', 'Save failed: {{error}}', { error: e.message }));
    }
  }

  // AI assistant (coachingAiAssist Cloud Function) — suggest coaching questions
  // from a goal, or draft an outcome summary from notes + action items.
  async function suggestQuestions(goal) {
    if (!(goal || '').trim()) return toast.error(t('coaching.toast.enterGoalFirst', 'Enter a coaching goal first'));
    setSuggestingQuestions(true);
    setSuggestedQuestions([]);
    try {
      const fn = httpsCallable(getFunctions(), 'coachingAiAssist');
      const res = await fn({ mode: 'questions', goal, language: i18n.language });
      setSuggestedQuestions(res.data?.questions || []);
    } catch (e) {
      toast.error(e?.message || t('coaching.toast.aiSuggestionFailed', 'AI suggestion failed'));
    }
    setSuggestingQuestions(false);
  }

  async function suggestOutcome(session) {
    if (!(session?.notes || '').trim()) return toast.error(t('coaching.toast.noNotesToSummarize', 'This session has no notes to summarize'));
    setSuggestingOutcome(true);
    try {
      const fn = httpsCallable(getFunctions(), 'coachingAiAssist');
      const res = await fn({ mode: 'outcome', notes: session.notes, actionItems: session.actionItems, language: i18n.language });
      if (res.data?.outcome) setCloseForm(f => ({ ...f, outcome: res.data.outcome }));
    } catch (e) {
      toast.error(e?.message || t('coaching.toast.aiSuggestionFailed', 'AI suggestion failed'));
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
    if (!closeForm.outcome.trim()) return toast.error(t('coaching.toast.describeOutcomeFirst', 'Please describe the outcome before closing'));
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
        toast.success(t('coaching.toast.sessionClosedEarned', '⭐ Session closed — +5 pts!'), { duration: 6000, icon: '🌟' });
      } else if (capReached) {
        toast(t('coaching.toast.sessionClosedCapped', 'Session closed. Daily 25-pt cap reached — come back tomorrow! 🗓'), { duration: 6000, icon: '📅' });
      } else {
        toast.success(t('coaching.toast.sessionClosed', 'Session closed'));
      }
    } catch (e) {
      toast.error(t('coaching.toast.closeFailed', 'Failed to close session: {{error}}', { error: e.message }));
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
      toast.success(t('coaching.toast.sessionUpdated', 'Session updated'));
    } catch (e) {
      toast.error(t('coaching.toast.updateFailed', 'Update failed: {{error}}', { error: e.message }));
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

  const STATUS_LABELS = { open: t('coaching.status.open', 'Open'), closed: t('coaching.status.closed', 'Closed') };
  const filteredSessions = sessions.filter(s => {
    if (!statusFilter) return true;
    return statusFilter === 'closed' ? !!s.closed : !s.closed;
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="📝" title={t('coaching.pageTitle', 'Coaching Log — Accountability that Supports')} subtitle={t('coaching.pageSubtitle', 'Document sessions, notes, and action items')}
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>{t('coaching.logSession', '+ Log Session')}</button>} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '0.75rem' }}>
        {[
          { label: t('coaching.stats.totalSessions', 'Total Sessions'), value: sessions.length, icon: '📝', color: '#0d9488' },
          { label: t('coaching.stats.coachees', 'Coachees'),        value: coachees,        icon: '👥', color: '#0f2044' },
          { label: t('coaching.stats.actionItems', 'Action Items'),    value: actions,          icon: '✅', color: '#f59e0b' },
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
          { key: 'open',   label: t('coaching.status.openSessions', 'Open Sessions'),   value: openCount,   icon: '🟡', color: '#b45309' },
          { key: 'closed', label: t('coaching.status.closedSessions', 'Closed Sessions'), value: closedCount, icon: '✅', color: '#15803d' },
        ].map(s => (
          <button key={s.key} className="stat-tile" onClick={() => setStatusFilter(f => f === s.key ? null : s.key)}
            style={{ textAlign: 'center', cursor: 'pointer', border: 'none', outline: statusFilter === s.key ? `2px solid ${s.color}` : 'none', outlineOffset: -2 }}>
            <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: '4px 0 0', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </button>
        ))}
      </div>

      {statusFilter && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '-0.75rem 0 1rem' }}>
          {t('coaching.showingOnly', 'Showing only')} <strong style={{ color: 'var(--text-primary)' }}>{STATUS_LABELS[statusFilter]}</strong> {t('coaching.sessionsWord', 'sessions')}
          <button onClick={() => setStatusFilter(null)}
            style={{ marginLeft: 10, background: 'none', border: 'none', color: '#0d9488', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
            {t('coaching.clearFilter', 'Clear filter')}
          </button>
        </p>
      )}

      {/* Worked example banner */}
      <div style={{ background: 'linear-gradient(90deg,#0f2044,#1e3a6e)', borderRadius: 12, padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <p style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', margin: '0 0 2px' }}>{t('coaching.banner.title', '💬 New to coaching? See how a real conversation flows.')}</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', margin: 0 }}>{t('coaching.banner.subtitle', 'A full manager–coachee dialogue showing questions-first coaching — every action owned by the coachee.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowPractice(true)}
            style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 9, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('coaching.banner.practiceWithAi', '🎙️ Practice with AI →')}
          </button>
          <button onClick={() => window.open('/coaching-example.html', '_blank', 'width=860,height=800')}
            style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 9, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('coaching.banner.workedExample', 'Worked Example →')}
          </button>
        </div>
      </div>

      {showPractice && <CoachingPractice onClose={() => setShowPractice(false)} />}

      {/* New session form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>{t('coaching.newSession', 'New Coaching Session')}</h3>
          <form onSubmit={addSession} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">{t('coaching.coacheeName', 'Coachee Name')}</label><NameField required value={form.coachee} names={savedNames} onChange={e => setForm(f => ({ ...f, coachee: e.target.value }))} placeholder={t('coaching.teamMemberName', 'Team member name')} /></div>
            <div>
              <label className="label">{t('coaching.sessionType', 'Session Type')}</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(st => <option key={st} value={st}>{trSessionType(t, st)}</option>)}</select>
              <FieldGuide guideKey="sessionType" />
            </div>
            <div><label className="label">{t('coaching.date', 'Date')}</label><input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">{t('coaching.duration', 'Duration')}</label><input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder={t('coaching.durationPlaceholder', 'e.g. 45 min')} /></div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">{t('coaching.coachingGoal', 'Coaching Goal')}</label>
              <textarea className="input" rows={2} value={form.coachingGoal} onChange={e => setForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder={t('coaching.coachingGoalPlaceholder', 'What is the specific outcome you want from this session?')} />
              <FieldGuide guideKey="coachingGoal" />
              <button type="button" onClick={() => suggestQuestions(form.coachingGoal)} disabled={suggestingQuestions}
                style={{ marginTop: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, color: '#6d28d9', fontWeight: 700, fontSize: '0.75rem', padding: '4px 10px', cursor: 'pointer' }}>
                {suggestingQuestions ? t('coaching.thinking', 'Thinking…') : t('coaching.suggestQuestionsAi', '✨ Suggest Coaching Questions (AI)')}
              </button>
              {suggestedQuestions.length > 0 && (
                <div style={{ marginTop: 8, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '0.6rem 0.875rem' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>{t('coaching.aiSuggestedQuestions', 'AI-Suggested Questions')}</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {suggestedQuestions.map((q, i) => (
                      <li key={i} style={{ fontSize: '0.82rem', color: '#4c1d95', marginBottom: 4 }}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">{t('coaching.sessionNotes', 'Session Notes')}</label>
              <textarea className="input" required rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('coaching.sessionNotesPlaceholder', 'Key discussion points, observations, commitments...')} />
              <FieldGuide guideKey="notes" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label" style={{ marginBottom: 8, display: 'block' }}>{t('coaching.actionItems', 'Action Items')}</label>
              <ActionItemsGrid rows={form.actionItems} onChange={rows => setForm(f => ({ ...f, actionItems: rows }))} />
              <FieldGuide guideKey="actionItems" />
            </div>
            <div>
              <label className="label">{t('coaching.nextSessionDate', 'Next Session Date')}</label>
              <input className="input" type="date" value={form.nextSession} onChange={e => setForm(f => ({ ...f, nextSession: e.target.value }))} />
              <FieldGuide guideKey="nextSession" />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">{t('coaching.saveSession', 'Save Session')}</button>
              <button className="btn-secondary" type="button" onClick={() => { setShowForm(false); setSuggestedQuestions([]); }}>{t('coaching.cancel', 'Cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>{t('coaching.loadingSessions', 'Loading sessions...')}</p>}

      {!loading && sessions.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>📝</p>
          <p style={{ fontWeight: 700, margin: 0 }}>{t('coaching.noSessionsYet', 'No sessions logged yet. Click "+ Log Session" to get started.')}</p>
        </div>
      )}

      {!loading && sessions.length > 0 && filteredSessions.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontWeight: 700, margin: 0 }}>{t('coaching.noFilteredSessions', 'No {{status}} sessions.', { status: STATUS_LABELS[statusFilter]?.toLowerCase() })}</p>
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
                    <span style={{ background: typeColors[s.type] || '#0d9488', color: 'white', borderRadius: 9999, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700 }}>{trSessionType(t, s.type)}</span>
                    {s.closed && <span className="badge-green" style={{ fontSize: '0.68rem' }}>{t('coaching.closedOn', '✅ Closed {{date}}', { date: s.closedAt })}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>📅 {s.date} · ⏱ {s.duration}</p>
                    {!s.closed && s.nextSession && <span><DateStatus date={s.nextSession} prefix={t('coaching.nextPrefix', 'Next · ')} /></span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { startEdit(s); setSelectedSession(null); setClosingId(null); }}
                  style={{ background: 'none', border: '1px solid #0d9488', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', cursor: 'pointer' }}>
                  {t('coaching.edit', '✏️ Edit')}
                </button>
                <button onClick={() => { setSelectedSession(selectedSession?.id === s.id ? null : s); setEditingId(null); setClosingId(null); }}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
                  {selectedSession?.id === s.id ? t('coaching.collapse', 'Collapse') : t('coaching.viewDetails', 'View Details')}
                </button>
              </div>
            </div>

            {/* Edit form */}
            {editingId === s.id && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>{t('coaching.editSession', 'Edit Session')}</h4>
                <form onSubmit={saveEdit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div><label className="label">{t('coaching.coacheeName', 'Coachee Name')}</label><NameField required value={editForm.coachee} names={savedNames} onChange={e => setEditForm(f => ({ ...f, coachee: e.target.value }))} /></div>
                  <div>
                    <label className="label">{t('coaching.sessionType', 'Session Type')}</label>
                    <select className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>{sessionTypes.map(st => <option key={st} value={st}>{trSessionType(t, st)}</option>)}</select>
                    <FieldGuide guideKey="sessionType" />
                  </div>
                  <div><label className="label">{t('coaching.date', 'Date')}</label><input className="input" type="date" required value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
                  <div><label className="label">{t('coaching.duration', 'Duration')}</label><input className="input" value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} /></div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">{t('coaching.coachingGoal', 'Coaching Goal')}</label>
                    <textarea className="input" rows={2} value={editForm.coachingGoal || ''} onChange={e => setEditForm(f => ({ ...f, coachingGoal: e.target.value }))} placeholder={t('coaching.coachingGoalPlaceholder', 'What is the specific outcome you want from this session?')} />
                    <FieldGuide guideKey="coachingGoal" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">{t('coaching.sessionNotes', 'Session Notes')}</label>
                    <textarea className="input" rows={4} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                    <FieldGuide guideKey="notes" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label" style={{ marginBottom: 8, display: 'block' }}>{t('coaching.actionItems', 'Action Items')}</label>
                    <ActionItemsGrid rows={editForm.actionItems} onChange={rows => setEditForm(f => ({ ...f, actionItems: rows }))} />
                    <FieldGuide guideKey="actionItems" />
                  </div>
                  <div>
                    <label className="label">{t('coaching.nextSessionDate', 'Next Session Date')}</label>
                    <input className="input" type="date" value={editForm.nextSession} onChange={e => setEditForm(f => ({ ...f, nextSession: e.target.value }))} />
                    <FieldGuide guideKey="nextSession" />
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                    <button className="btn-primary" type="submit">{t('coaching.saveChanges', 'Save Changes')}</button>
                    <button className="btn-secondary" type="button" onClick={cancelEdit}>{t('coaching.cancel', 'Cancel')}</button>
                  </div>
                </form>
              </div>
            )}

            {/* View details */}
            {selectedSession?.id === s.id && editingId !== s.id && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                {s.coachingGoal && (
                  <div style={{ marginBottom: '0.875rem' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{t('coaching.coachingGoal', 'Coaching Goal')}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.coachingGoal}</p>
                  </div>
                )}
                <div style={{ marginBottom: '0.875rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{t('coaching.sessionNotes', 'Session Notes')}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.notes}</p>
                </div>
                {s.actionItems?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>{t('coaching.actionItems', 'Action Items')}</p>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', gap: 8, padding: '0.4rem 0.6rem', background: '#f1f5f9', borderRadius: '8px 8px 0 0' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('coaching.grid.action', 'Action')}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('coaching.grid.responsible', 'Responsible')}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('coaching.grid.dueDate', 'Due Date')}</span>
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
                {!s.closed && s.nextSession && <div style={{ marginTop: 10 }}><DateStatus date={s.nextSession} prefix={t('coaching.nextSessionPrefix', 'Next session · ')} /></div>}

                {/* Close Session — the very last thing in the details view */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                  {s.closed ? (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.875rem 1rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{t('coaching.sessionClosedOn', '✅ Session Closed — {{date}}', { date: s.closedAt })}</p>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', margin: '0 0 2px' }}>{t('coaching.outcome', 'Outcome')}</p>
                      <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, margin: '0 0 8px' }}>{s.outcome}</p>
                      {s.closingComments && (
                        <>
                          <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', margin: '0 0 2px' }}>{t('coaching.additionalComments', 'Additional Comments')}</p>
                          <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, margin: 0 }}>{s.closingComments}</p>
                        </>
                      )}
                    </div>
                  ) : closingId === s.id ? (
                    <form onSubmit={closeSession}>
                      <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{t('coaching.closeSession', 'Close Session')}</h4>
                      <div style={{ marginBottom: 10 }}>
                        <label className="label">{t('coaching.outcome', 'Outcome')}</label>
                        <textarea className="input" rows={2} required value={closeForm.outcome}
                          onChange={e => setCloseForm(f => ({ ...f, outcome: e.target.value }))}
                          placeholder={t('coaching.outcomePlaceholder', 'What was the result of this coaching session?')} />
                        <button type="button" onClick={() => suggestOutcome(s)} disabled={suggestingOutcome}
                          style={{ marginTop: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, color: '#6d28d9', fontWeight: 700, fontSize: '0.75rem', padding: '4px 10px', cursor: 'pointer' }}>
                          {suggestingOutcome ? t('coaching.thinking', 'Thinking…') : t('coaching.draftOutcomeAi', '✨ Draft Outcome from Notes (AI)')}
                        </button>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label className="label">{t('coaching.additionalCommentsOptional', 'Additional Comments (optional)')}</label>
                        <textarea className="input" rows={2} value={closeForm.comments}
                          onChange={e => setCloseForm(f => ({ ...f, comments: e.target.value }))}
                          placeholder={t('coaching.additionalCommentsPlaceholder', 'Anything else worth noting before closing this session...')} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn-primary" type="submit" disabled={closing}>{closing ? t('coaching.closing', 'Closing...') : t('coaching.closeSessionPts', '✅ Close Session (+5 pts)')}</button>
                        <button className="btn-secondary" type="button" onClick={() => setClosingId(null)}>{t('coaching.cancel', 'Cancel')}</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => startClose(s)}
                      style={{ background: '#0d9488', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', color: 'white', cursor: 'pointer' }}>
                      {t('coaching.closeSession2', '✅ Close Session')}
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
