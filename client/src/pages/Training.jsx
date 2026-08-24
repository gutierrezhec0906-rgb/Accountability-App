import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus, { getDateStatus, RecommitBadge } from '../components/DateStatus';
import { logPointEvent, calculateScore } from '../utils/scoring';

// Sample trainings seeded for brand-new accounts. Dates are computed relative
// to "today" at seed time (not hardcoded) — a fixed past date (e.g. 2024-08-31)
// would already be hundreds of days overdue by the time a new account signs
// up, immediately spamming a new user with false past-due penalties and the
// app-wide recommitment popup on their very first login.
function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function buildSampleTrainings() {
  return [
    { id: 1, title: 'Lean Manufacturing Fundamentals',    category: 'Lean',        duration: '4h',   dueDate: daysFromToday(-40), completed: true,  completedDate: daysFromToday(-60), mandatory: true  },
    { id: 2, title: 'Effective Coaching Skills',          category: 'Leadership',  duration: '2h',   dueDate: daysFromToday(20),  completed: false, mandatory: true  },
    { id: 3, title: 'Safety & OSHA Compliance',           category: 'Safety',      duration: '3h',   dueDate: daysFromToday(-50), completed: true,  completedDate: daysFromToday(-70), mandatory: true  },
    { id: 4, title: 'Emotional Intelligence for Leaders', category: 'Soft Skills', duration: '1.5h', dueDate: daysFromToday(45),  completed: false, mandatory: false },
    { id: 5, title: 'Data-Driven Decision Making',        category: 'Analytics',   duration: '3h',   dueDate: daysFromToday(35),  completed: false, mandatory: false },
    { id: 6, title: 'Root Cause Analysis Techniques',     category: 'Quality',     duration: '2h',   dueDate: daysFromToday(10),  completed: false, mandatory: true  },
    { id: 7, title: 'DISC Personality Profiling',         category: 'Soft Skills', duration: '1h',   dueDate: daysFromToday(50),  completed: false, mandatory: false },
    { id: 8, title: 'Visual Management Principles',       category: 'Lean',        duration: '2h',   dueDate: daysFromToday(-35), completed: true,  completedDate: daysFromToday(-55), mandatory: false },
  ];
}

const categories = ['All', 'Lean', 'Leadership', 'Safety', 'Soft Skills', 'Analytics', 'Quality'];
const catColors = { Lean: '#0d9488', Leadership: '#0f2044', Safety: '#ef4444', 'Soft Skills': '#8b5cf6', Analytics: '#0891b2', Quality: '#f59e0b' };

const emptyForm = { title: '', category: 'Leadership', duration: '', dueDate: '', mandatory: false };

export default function Training() {
  const { currentUser } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [filter, setFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('all'); // all | completed | ontrack | warning | overdue

  // Load saved trainings; first-time users are seeded with the sample list.
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const saved = snap.exists() ? snap.data().trainings : null;
        if (Array.isArray(saved)) {
          // One-time repair for accounts seeded before the hardcoded-2024-date bug
          // was fixed: those sample trainings are still stuck on 2024 due dates,
          // showing as hundreds of days past due. Detect the untouched seed items
          // (matching title + a stale 2024-* dueDate) and re-baseline them relative
          // to today, refunding any false "past due" penalty already charged.
          const freshSample = buildSampleTrainings();
          const staleIds = [];
          const repaired = saved.map(t => {
            const fresh = freshSample.find(f => f.id === t.id && f.title === t.title);
            if (fresh && typeof t.dueDate === 'string' && t.dueDate.startsWith('2024-')) {
              staleIds.push(t.id);
              return { ...fresh, recommitmentCount: t.recommitmentCount || 0 };
            }
            return t;
          });
          if (staleIds.length) {
            const refunded = saved.filter(t => staleIds.includes(t.id) && t.pastDuePenaltyApplied);
            try {
              await setDoc(doc(db, 'users', currentUser.uid), { trainings: repaired }, { merge: true });
              if (refunded.length) {
                await updateDoc(doc(db, 'users', currentUser.uid), { penaltyPoints: increment(-refunded.length) });
                for (const t of refunded) {
                  await logPointEvent(currentUser.uid, {
                    points: 1,
                    toolLabel: 'Training Past Due Penalty Refunded',
                    reason: `Refunded false past-due penalty for "${t.title}" (stale seed data bug)`,
                  });
                }
                calculateScore(currentUser.uid).catch(() => {});
              }
              toast.success('Training due dates refreshed — some sample trainings had stale dates.', { duration: 5000 });
            } catch { /* ignore */ }
            setTrainings(repaired);
          } else {
            setTrainings(saved);
          }
        } else {
          // First-time users: seed the sample list AND persist it, so other
          // features (e.g. the app-wide past-due reminder) can read the trainings.
          const sampleTrainings = buildSampleTrainings();
          setTrainings(sampleTrainings);
          try { await setDoc(doc(db, 'users', currentUser.uid), { trainings: sampleTrainings }, { merge: true }); } catch { /* ignore */ }
        }
      } catch {
        setTrainings(buildSampleTrainings());
      }
    })();
  }, [currentUser]);

  async function persist(next) {
    setTrainings(next);
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { trainings: next }, { merge: true });
    } catch {
      toast.error('Could not save changes');
    }
  }

  async function toggleComplete(id) {
    const t = trainings.find(x => x.id === id);
    const completingNow = t && !t.completed;
    const onTime = completingNow && (!t.dueDate || getDateStatus(t.dueDate)?.level !== 'overdue');
    await persist(trainings.map(x => x.id === id
      ? { ...x, completed: !x.completed, completedDate: !x.completed ? new Date().toISOString().split('T')[0] : null }
      : x));

    if (onTime && currentUser) {
      const { awarded, capReached } = await logPointEvent(currentUser.uid, {
        points: 1,
        toolLabel: 'Training Completed On Time',
        reason: `Completed "${t.title}" on time`,
      });
      if (awarded) {
        calculateScore(currentUser.uid).catch(() => {});
        toast.success('+1 pt — training completed on time!', { duration: 4000 });
      } else if (capReached) {
        toast('Training completed! Daily 25-pt cap reached today.', { icon: '📅', duration: 4000 });
      }
    }
  }

  // Deduct 1 pt (once) for any training that's gone past due without being
  // completed — flagged per-item so it isn't charged twice; the flag resets
  // on recommit (GlobalPastDueModal) so a future miss can deduct again.
  useEffect(() => {
    if (!currentUser || !trainings.length) return;
    const overdue = trainings.filter(t =>
      !t.completed && t.dueDate && getDateStatus(t.dueDate)?.level === 'overdue' && !t.pastDuePenaltyApplied
    );
    if (!overdue.length) return;
    (async () => {
      try {
        const updated = trainings.map(t =>
          overdue.some(o => o.id === t.id) ? { ...t, pastDuePenaltyApplied: true } : t
        );
        await setDoc(doc(db, 'users', currentUser.uid), { trainings: updated }, { merge: true });
        setTrainings(updated);
        await updateDoc(doc(db, 'users', currentUser.uid), { penaltyPoints: increment(overdue.length) });
        for (const t of overdue) {
          await logPointEvent(currentUser.uid, {
            points: -1,
            toolLabel: 'Training Past Due',
            reason: `Training went past due: "${t.title}"`,
          });
        }
        calculateScore(currentUser.uid).catch(() => {});
      } catch { /* ignore */ }
    })();
  }, [currentUser, trainings]);

  function startEdit(t) {
    setEditingId(t.id);
    setForm({ title: t.title, category: t.category, duration: t.duration || '', dueDate: t.dueDate || '', mandatory: !!t.mandatory });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteTraining(id) {
    const t = trainings.find(x => x.id === id);
    if (!window.confirm(`Delete "${t?.title || 'this training'}"? This cannot be undone.`)) return;
    persist(trainings.filter(x => x.id !== id));
    toast.success('Training deleted');
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function submitTraining(e) {
    e.preventDefault();
    if (editingId != null) {
      persist(trainings.map(x => x.id === editingId ? { ...x, ...form } : x));
      toast.success('Training updated');
    } else {
      persist([...trainings, { ...form, id: Date.now(), completed: false }]);
      toast.success('Training added');
    }
    cancelForm();
  }

  // Status level of a still-open training (no due date = on track).
  function trainingLevel(t) {
    return t.dueDate ? getDateStatus(t.dueDate).level : 'ontrack';
  }
  function matchesStatus(t) {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'completed') return !!t.completed;
    if (t.completed) return false; // completed shows only under Completed
    return trainingLevel(t) === statusFilter;
  }

  const filtered = trainings
    .filter(t => filter === 'All' || t.category === filter)
    .filter(matchesStatus);
  const completedCount = trainings.filter(t => t.completed).length;
  const pct = trainings.length ? Math.round((completedCount / trainings.length) * 100) : 0;

  // Accountability status counts (app-wide convention: red past-due / yellow due-soon / green on-track).
  // A completed training, or one with no due date, counts as On Track.
  // Completed trainings are counted ONLY under "Completed" — the status windows
  // (On Track / Due Soon / Past Due) describe the still-open trainings.
  const status = { ontrack: 0, warning: 0, overdue: 0 };
  trainings.forEach(t => {
    if (t.completed) return;
    const s = t.dueDate ? getDateStatus(t.dueDate) : null;
    if (!s) { status.ontrack++; return; }
    status[s.level]++;
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="🎓" title="Training Center — Accountability Continuous Learning" subtitle="Track learning progress and certifications"
        action={<button className="btn-primary" onClick={() => { if (showForm) { cancelForm(); } else { setEditingId(null); setForm(emptyForm); setShowForm(true); } }}>+ Add Training</button>} />

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

      {/* Accountability windows: Completed · On Track (green) · Due Soon (yellow) · Past Due (red) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { key: 'completed', label: 'Completed', sub: 'finished trainings',       value: completedCount, icon: '🎓', color: '#0f766e', bg: '#ccfbf1', border: '#5eead4' },
          { key: 'ontrack',   label: 'On Track',  sub: 'open, >2 weeks out',        value: status.ontrack, icon: '✅', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
          { key: 'warning',   label: 'Due Soon',  sub: 'within 2 weeks',           value: status.warning, icon: '⚠️', color: '#b45309', bg: '#fef9c3', border: '#fde68a' },
          { key: 'overdue',   label: 'Past Due',  sub: 'deadline passed',          value: status.overdue, icon: '🚨', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
        ].map(s => {
          const active = statusFilter === s.key;
          return (
            <button key={s.label}
              onClick={() => setStatusFilter(active ? 'all' : s.key)}
              title={active ? 'Show all trainings' : `Show ${s.label} trainings`}
              style={{
                textAlign: 'center', background: s.bg, borderRadius: 14, padding: '1rem 0.75rem', cursor: 'pointer',
                border: `2px solid ${active ? s.color : s.border}`,
                boxShadow: active ? `0 0 0 3px ${s.border}` : 'none',
                transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: '1.1rem', lineHeight: 1 }}>{s.icon}</div>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: '4px 0 0', lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '0.8rem', color: s.color, margin: '4px 0 0', fontWeight: 800 }}>{s.label}</p>
              <p style={{ fontSize: '0.68rem', color: s.color, opacity: 0.8, margin: '2px 0 0', fontWeight: 600 }}>{active ? 'tap to clear' : s.sub}</p>
            </button>
          );
        })}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>{editingId != null ? 'Edit Training' : 'Add Training'}</h3>
          <form onSubmit={submitTraining} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}><label className="label">Training Title</label><input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Six Sigma Green Belt" /></div>
            <div><label className="label">Category</label><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Duration</label><input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 2h" /></div>
            <div><label className="label">Due Date</label><input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="mandatory" checked={form.mandatory} onChange={e => setForm(f => ({ ...f, mandatory: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <label htmlFor="mandatory" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mandatory</label>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">{editingId != null ? 'Save Changes' : 'Add Training'}</button>
              <button className="btn-secondary" type="button" onClick={cancelForm}>Cancel</button>
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
      <style>{`
        .training-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
        .training-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
        .training-scroll::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; }
      `}</style>
      <div className="training-scroll" style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        maxHeight: 'clamp(260px, calc(100dvh - 470px), 560px)',
        overflowY: 'scroll', paddingRight: 6, paddingBottom: 8,
        scrollbarWidth: 'thin', scrollbarColor: '#64748b #e2e8f0',
      }}>
        {filtered.map(t => (
          <div key={t.id} className="card" style={{ flexShrink: 0, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
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
                <RecommitBadge count={t.recommitmentCount} />
              </div>
            </div>
            {/* Edit + Delete */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => startEdit(t)} title="Edit training"
                style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px' }}>
                ✏️
              </button>
              <button onClick={() => deleteTraining(t.id)} title="Delete training"
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px' }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No trainings{filter !== 'All' ? ` in "${filter}"` : ''} yet — click "+ Add Training" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
