import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { generateMentoringPDF } from '../utils/mentoringReport';
import { logPointEvent, calculateScore, isCompleteMentoringSession } from '../utils/scoring';

const PILLARS = ['Leadership', 'Technical', 'Interpersonal'];
const PILLAR_COLORS = { Leadership: '#0f2044', Technical: '#0891b2', Interpersonal: '#8b5cf6' };

// Flexible mentor selection — not limited to the direct manager.
const MENTOR_TYPES = [
  { value: 'Traditional', desc: 'A senior leader mentors the future leader' },
  { value: 'Peer',        desc: 'A colleague at the same level with a specific strength' },
  { value: 'Cross-functional', desc: 'A leader from a different department or function' },
  { value: 'Reverse',     desc: 'The future leader mentors a senior leader on technology or fresh perspective' },
  { value: 'Subject Matter Expert', desc: 'The best technical person on a specific skill' },
  { value: 'External',    desc: 'An outside coach, consultant, or industry peer' },
];

const GOAL_TIMELINES = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
];

const CADENCES = ['Weekly', 'Bi-weekly (recommended)', 'Monthly'];
const CADENCE_DAYS = { 'Weekly': 7, 'Bi-weekly (recommended)': 14, 'Monthly': 30 };

const CYCLE_LENGTHS = [
  { value: '3', label: '90 days (minimum)' },
  { value: '6', label: '6 months (recommended)' },
  { value: '12', label: '12 months (maximum)' },
];

const RECOMMENDATIONS = [
  { value: 'continue', label: 'Continue — extend this cycle', color: '#0d9488' },
  { value: 'graduate', label: 'Graduate — goals met, mentee is ready to move on', color: '#15803d' },
  { value: 'reassign', label: 'Reassign — pair with a different mentor', color: '#b45309' },
];

function emptyGoal() { return { pillar: 'Leadership', goal: '', timeline: '90', measure: '' }; }
function emptyPlan() {
  return {
    mentor: { name: '', role: '', type: '', focus: 'Leadership', committed: false },
    goals: [emptyGoal()],
    cadence: 'Bi-weekly (recommended)',
    cycle: { lengthMonths: '6', startDate: '', endDate: '' },
    sessions: [],
    closeOut: null,
    startedAt: null, updatedAt: null,
  };
}
function hydratePlan(saved) {
  const base = emptyPlan();
  if (!saved) return base;
  return {
    ...base, ...saved,
    mentor: { ...base.mentor, ...(saved.mentor || {}) },
    goals: saved.goals && saved.goals.length ? saved.goals.map(g => ({ ...emptyGoal(), ...g })) : [emptyGoal()],
    cycle: { ...base.cycle, ...(saved.cycle || {}) },
    sessions: saved.sessions || [],
  };
}

function pillarSummary(skillsMatrix) {
  const out = {};
  PILLARS.forEach(p => { out[p] = null; });
  (skillsMatrix || []).forEach(cat => {
    if (!(cat.category in out)) return;
    const skills = cat.skills || [];
    if (!skills.length) return;
    out[cat.category] = +(skills.reduce((a, s) => a + (s.self || 0), 0) / skills.length).toFixed(1);
  });
  return out;
}

function SectionCard({ n, title, subtitle, children, accent = '#0d9488' }) {
  return (
    <div className="card" style={{ padding: '1.25rem', borderTop: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: accent, color: 'white', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
        <div>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1rem' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
const labelStyle = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

export default function Mentoring() {
  const { currentUser } = useAuth();
  const [plan, setPlan] = useState(emptyPlan());
  const [skillsMatrix, setSkillsMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionForm, setSessionForm] = useState(null);
  const [savingSession, setSavingSession] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null);
  const [closeForm, setCloseForm] = useState(null);
  const [savingClose, setSavingClose] = useState(false);

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  async function load() {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setPlan(hydratePlan(data.mentoringPlan));
        setSkillsMatrix(data.skillsMatrix || null);
      }
    } catch { toast.error('Could not load your mentoring plan'); }
    setLoading(false);
  }

  function setField(path, value) {
    setPlan(p => {
      const next = { ...p };
      if (path.length === 1) next[path[0]] = value;
      else if (path.length === 2) next[path[0]] = { ...next[path[0]], [path[1]]: value };
      return next;
    });
  }
  function setGoal(idx, field, value) {
    setPlan(p => ({ ...p, goals: p.goals.map((g, i) => i === idx ? { ...g, [field]: value } : g) }));
  }
  function addGoal() {
    if (plan.goals.length >= 3) return toast.error('Maximum 3 goals per mentoring cycle');
    setPlan(p => ({ ...p, goals: [...p.goals, emptyGoal()] }));
  }
  function removeGoal(idx) {
    setPlan(p => ({ ...p, goals: p.goals.length > 1 ? p.goals.filter((_, i) => i !== idx) : p.goals }));
  }

  const matchComplete = plan.mentor.name.trim() && plan.mentor.type && plan.mentor.committed;
  const goalsComplete = plan.goals.some(g => g.goal.trim());
  const pillarsCovered = new Set(plan.goals.filter(g => g.goal.trim()).map(g => g.pillar));
  const planStarted = !!plan.startedAt;

  async function savePlan() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const startedAt = plan.startedAt || (matchComplete && goalsComplete ? now : null);
      let cycle = plan.cycle;
      if (startedAt && !plan.startedAt) {
        const start = new Date();
        const end = new Date(start);
        end.setMonth(end.getMonth() + Number(cycle.lengthMonths || 6));
        cycle = { ...cycle, startDate: cycle.startDate || start.toISOString().split('T')[0], endDate: cycle.endDate || end.toISOString().split('T')[0] };
      }
      const toSave = { ...plan, cycle, startedAt, updatedAt: now };
      await setDoc(doc(db, 'users', currentUser.uid), { mentoringPlan: toSave }, { merge: true });
      setPlan(toSave);
      toast.success(!plan.startedAt && startedAt ? 'Mentoring cycle started!' : 'Mentoring plan saved');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  }

  async function saveSession() {
    if (!sessionForm) return;
    if (!sessionForm.date) return toast.error('Please set the session date');
    setSavingSession(true);
    try {
      const entry = { id: Date.now().toString(), ...sessionForm, loggedAt: new Date().toISOString() };
      const sessions = [entry, ...plan.sessions];
      // Logging the first session starts the cycle automatically — no separate
      // "start" step required before sessions can be logged.
      let startedAt = plan.startedAt;
      let cycle = plan.cycle;
      if (!startedAt) {
        const now = new Date().toISOString();
        startedAt = now;
        const start = new Date();
        const end = new Date(start);
        end.setMonth(end.getMonth() + Number(cycle.lengthMonths || 6));
        cycle = { ...cycle, startDate: cycle.startDate || start.toISOString().split('T')[0], endDate: cycle.endDate || end.toISOString().split('T')[0] };
      }
      const toSave = { ...plan, sessions, startedAt, cycle };
      await setDoc(doc(db, 'users', currentUser.uid), { mentoringPlan: toSave }, { merge: true });
      setPlan(toSave);
      setSessionForm(null);

      // +5 pts every time a session is logged in its totality — date, progress
      // review, challenge, and action item all filled in. No decay, no cap per
      // session (the overall mentoring score caps for display, not per-award).
      if (isCompleteMentoringSession(entry)) {
        const { awarded } = await logPointEvent(currentUser.uid, {
          points: 5,
          toolLabel: 'Mentoring Session Logged',
          reason: `Logged mentoring session on ${entry.date}`,
        });
        if (awarded) {
          await calculateScore(currentUser.uid);
          toast.success('Session logged! +5 pts earned.', { duration: 4000 });
        } else {
          toast.success('Session logged.');
        }
      } else {
        toast.success('Session logged — fill in progress review, challenge, and action item next time to earn +5 pts.', { duration: 5000 });
      }
    } catch { toast.error('Save failed'); }
    setSavingSession(false);
  }

  async function deleteSession(id) {
    const sessions = plan.sessions.filter(s => s.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { mentoringPlan: { ...plan, sessions } }, { merge: true });
    setPlan(p => ({ ...p, sessions }));
    toast.success('Session deleted');
  }

  function openSessionForm() {
    const goalProgress = {};
    plan.goals.forEach((g, i) => { goalProgress[i] = plan.sessions[0]?.goalProgress?.[i] ?? 0; });
    setSessionForm({ date: new Date().toISOString().split('T')[0], progressReview: '', challenge: '', actionItem: '', notes: '', goalProgress });
  }

  const plannedSessions = plan.startedAt && plan.cycle.startDate
    ? Math.max(1, Math.round((Date.now() - new Date(plan.cycle.startDate).getTime()) / 86400000 / (CADENCE_DAYS[plan.cadence] || 14)))
    : 0;
  const latestProgress = plan.sessions[0]?.goalProgress || {};
  const avgGoalCompletion = plan.goals.length
    ? Math.round(plan.goals.reduce((s, _, i) => s + (latestProgress[i] || 0), 0) / plan.goals.length) : 0;
  const goalsAchieved = plan.goals.filter((_, i) => (latestProgress[i] || 0) >= 100).length;
  const challenges = plan.sessions.filter(s => s.challenge?.trim()).map(s => ({ date: s.date, text: s.challenge }));
  const summary = pillarSummary(skillsMatrix);

  async function saveCloseOut() {
    if (!closeForm) return;
    setSavingClose(true);
    try {
      const closeOut = { ...closeForm, closedAt: new Date().toISOString(), sessionsCompleted: plan.sessions.length, sessionsPlanned: plannedSessions, goalsAchieved, goalsSet: plan.goals.length };
      await setDoc(doc(db, 'users', currentUser.uid), { mentoringPlan: { ...plan, closeOut } }, { merge: true });
      setPlan(p => ({ ...p, closeOut }));
      setCloseForm(null);
      toast.success('Mentoring cycle closed out');
    } catch { toast.error('Save failed'); }
    setSavingClose(false);
  }

  function downloadPDF() {
    try {
      generateMentoringPDF(plan, { userName: currentUser?.displayName || '', skillsSummary: skillsMatrix ? summary : null, plannedSessions, avgGoalCompletion, goalsAchieved, challenges });
    } catch (e) { console.error(e); toast.error('Could not generate PDF'); }
  }

  if (loading) return <div style={{ maxWidth: 860, margin: '0 auto' }}><PageHeader icon="🤝" title="Mentoring" subtitle="Loading…" /></div>;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader icon="🤝" title="Mentoring — Accountability, Multiplied" subtitle="Mentee-owned, mentor-guided. Pick who helps you grow, set goals across all three pillars, and track the journey." />

      {/* Status + actions banner */}
      <div style={{ borderRadius: 12, padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: planStarted ? '#f0fdf4' : '#eff6ff', border: `1px solid ${planStarted ? '#86efac' : '#bfdbfe'}` }}>
        <span style={{ fontSize: '1.25rem' }}>{planStarted ? '🤝' : '🧭'}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontWeight: 800, margin: 0, fontSize: '0.85rem', color: planStarted ? '#15803d' : '#1e40af' }}>
            {planStarted ? `Cycle active — ${plan.cycle.startDate} → ${plan.cycle.endDate}` : 'Match with a mentor and set your goals to start the cycle'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
            {planStarted
              ? `${plan.sessions.length} session${plan.sessions.length === 1 ? '' : 's'} logged · ${avgGoalCompletion}% avg goal completion · pillars covered: ${[...pillarsCovered].join(', ') || 'none yet'}`
              : 'Complete Sections 1 & 2 below, then Save Plan.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn-secondary" onClick={downloadPDF}>🖨️ PDF</button>
          <button className="btn-primary" onClick={savePlan} disabled={saving}>{saving ? 'Saving…' : '💾 Save Plan'}</button>
        </div>
      </div>

      {/* Main template (left) + Session Log sidebar (right) */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 480px', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* SECTION 1 — Match & Commit */}
      <SectionCard n="1" title="Match & Commit" accent="#7c3aed"
        subtitle="You choose your mentor — not assigned. Research shows letting the mentee pick is the single biggest predictor of mentoring success.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Mentor Name</label>
            <input className="input" value={plan.mentor.name} onChange={e => setField(['mentor', 'name'], e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label style={labelStyle}>Mentor Role</label>
            <input className="input" value={plan.mentor.role} onChange={e => setField(['mentor', 'role'], e.target.value)} placeholder="e.g. Plant Manager" />
          </div>
          <div>
            <label style={labelStyle}>Focus Area</label>
            <select className="input" value={plan.mentor.focus} onChange={e => setField(['mentor', 'focus'], e.target.value)}>
              {PILLARS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <label style={labelStyle}>Type of Mentoring Relationship</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 14 }}>
          {MENTOR_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setField(['mentor', 'type'], t.value)}
              style={{ textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 10, cursor: 'pointer', border: '1.5px solid',
                background: plan.mentor.type === t.value ? '#faf5ff' : 'white',
                borderColor: plan.mentor.type === t.value ? '#7c3aed' : '#e2e8f0' }}>
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: plan.mentor.type === t.value ? '#7c3aed' : 'var(--text-primary)', display: 'block' }}>{t.value}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.desc}</span>
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={plan.mentor.committed} onChange={e => setField(['mentor', 'committed'], e.target.checked)} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: plan.mentor.committed ? '#15803d' : 'var(--text-secondary)' }}>
            {plan.mentor.committed ? '✅ Commitment confirmed from both parties' : 'Commitment confirmed from both parties'}
          </span>
        </label>
      </SectionCard>

      {/* SECTION 2 — Set the Goals */}
      <SectionCard n="2" title="Set the Goals" accent="#0891b2"
        subtitle="1–3 goals for this cycle, starting with what you want. Written, specific, measurable goals create accountability.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plan.goals.map((g, i) => (
            <div key={i} style={{ border: `1px solid ${PILLAR_COLORS[g.pillar]}30`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: PILLAR_COLORS[g.pillar], padding: '0.5rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <select value={g.pillar} onChange={e => setGoal(i, 'pillar', e.target.value)}
                  style={{ background: 'transparent', color: 'white', fontWeight: 800, fontSize: '0.82rem', border: 'none', cursor: 'pointer' }}>
                  {PILLARS.map(p => <option key={p} value={p} style={{ color: '#0f2044' }}>{p}</option>)}
                </select>
                {plan.goals.length > 1 && <button onClick={() => removeGoal(i)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: 'white', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>}
              </div>
              <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Goal</label>
                  <textarea className="input" rows={2} value={g.goal} onChange={e => setGoal(i, 'goal', e.target.value)} placeholder="What will you develop?" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>How success will be measured</label>
                    <input className="input" value={g.measure} onChange={e => setGoal(i, 'measure', e.target.value)} placeholder="e.g. Lead 2 Kaizen events independently" />
                  </div>
                  <div>
                    <label style={labelStyle}>Timeline</label>
                    <select className="input" value={g.timeline} onChange={e => setGoal(i, 'timeline', e.target.value)}>
                      {GOAL_TIMELINES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {plan.goals.length < 3 && (
          <button onClick={addGoal} className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem', marginTop: 10 }}>＋ Add another goal</button>
        )}
      </SectionCard>

      {/* SECTION 3 — Session Cadence */}
      <SectionCard n="3" title="Session Cadence" accent="#be185d"
        subtitle="Consistency beats intensity — regular, predictable sessions outperform sporadic marathon conversations.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Session Cadence</label>
            <select className="input" value={plan.cadence} onChange={e => setField(['cadence'], e.target.value)}>
              {CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cycle Length</label>
            <select className="input" value={plan.cycle.lengthMonths} onChange={e => setField(['cycle', 'lengthMonths'], e.target.value)}>
              {CYCLE_LENGTHS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>Session Log</p>
          <button className="btn-primary" onClick={openSessionForm}>+ Log Session</button>
        </div>
        {!planStarted && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 10px' }}>Logging your first session starts the cycle automatically.</p>}
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
          Every fully-logged session (date, progress review, challenge, and action item all filled) earns <strong>+5 pts</strong>. Sessions are listed in the sidebar →
        </p>
      </SectionCard>

      {/* SECTION 4 — Track Progress */}
      <SectionCard n="4" title="Track Progress" accent="#0d9488"
        subtitle="Goal completion, skill growth across the three pillars, and challenges encountered — updated after every session.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {plan.goals.map((g, i) => {
            const pct = latestProgress[i] || 0;
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{g.goal || `Goal ${i + 1}`}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: PILLAR_COLORS[g.pillar] }}>{pct}%</span>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 7 }}>
                  <div style={{ height: 7, borderRadius: 9999, background: PILLAR_COLORS[g.pillar], width: `${pct}%`, transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {skillsMatrix && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            {PILLARS.map(p => (
              <div key={p} style={{ border: `1px solid ${PILLAR_COLORS[p]}30`, borderRadius: 10, padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: PILLAR_COLORS[p], margin: '0 0 2px', textTransform: 'uppercase' }}>{p}</p>
                <p style={{ fontSize: '1.3rem', fontWeight: 900, color: PILLAR_COLORS[p], margin: 0 }}>{summary[p] ?? '—'}<span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>/5</span></p>
              </div>
            ))}
          </div>
        )}

        {challenges.length > 0 && (
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase' }}>Challenges Encountered</p>
            {challenges.slice(0, 5).map((c, i) => (
              <p key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>• <strong>{c.date}:</strong> {c.text}</p>
            ))}
          </div>
        )}
      </SectionCard>

      {/* SECTION 5 — Measure & Close */}
      <SectionCard n="5" title="Measure & Close" accent="#b45309"
        subtitle="At the end of the cycle: sessions vs. planned, goals achieved vs. set, self vs. mentor rating, and a recommendation.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Sessions', value: `${plan.sessions.length} / ${plannedSessions || '—'}` },
            { label: 'Goals Achieved', value: `${goalsAchieved} / ${plan.goals.length}` },
            { label: 'Avg Completion', value: `${avgGoalCompletion}%` },
          ].map(s => (
            <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#b45309', margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '3px 0 0', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {plan.closeOut ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '0.875rem 1rem' }}>
            <p style={{ fontWeight: 800, color: '#15803d', margin: '0 0 4px', fontSize: '0.85rem' }}>✓ Cycle closed on {plan.closeOut.closedAt.slice(0, 10)}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Recommendation: <strong>{RECOMMENDATIONS.find(r => r.value === plan.closeOut.recommendation)?.label}</strong>
            </p>
          </div>
        ) : planStarted ? (
          <button className="btn-secondary" onClick={() => setCloseForm({ menteeSelf: { Leadership: 3, Technical: 3, Interpersonal: 3 }, mentorAssessment: { Leadership: 3, Technical: 3, Interpersonal: 3 }, recommendation: 'continue', notes: '' })}>
            📋 Close Out This Cycle
          </button>
        ) : (
          <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Start the cycle above to unlock close-out.</p>
        )}
      </SectionCard>

      </div>{/* end main column */}

      {/* ── Sidebar: Session Log ── */}
      <div style={{ width: 300, maxWidth: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '0.95rem' }}>Session Log ({plan.sessions.length})</h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Every logged session — tap to expand. +5 pts each time all 4 fields are filled.
          </p>
          {plan.sessions.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', margin: '16px 0' }}>No sessions logged yet.</p>
          ) : (
            <>
              <style>{`
                .mentoring-session-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
                .mentoring-session-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
                .mentoring-session-scroll::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; }
              `}</style>
              <div className="mentoring-session-scroll" style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                maxHeight: 520, overflowY: 'scroll', paddingRight: 6,
                scrollbarWidth: 'thin', scrollbarColor: '#64748b #e2e8f0',
              }}>
                {plan.sessions.map(s => {
                  const open = expandedSession === s.id;
                  const complete = isCompleteMentoringSession(s);
                  return (
                    <div key={s.id} style={{ borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                      <button onClick={() => setExpandedSession(open ? null : s.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 0.75rem', background: '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)', flex: 1 }}>{s.date}</span>
                        {complete && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#f0fdf4', color: '#15803d', borderRadius: 9999, padding: '1px 6px', flexShrink: 0 }}>+5</span>}
                        {s.challenge?.trim() && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#fef9c3', color: '#b45309', borderRadius: 9999, padding: '1px 6px', flexShrink: 0 }}>⚠</span>}
                        <span style={{ fontSize: '0.68rem', color: '#64748b', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ padding: '0.65rem 0.75rem', background: 'white', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {s.progressReview && <p style={{ margin: '0 0 5px' }}><strong style={{ color: '#0f2044' }}>Progress:</strong> {s.progressReview}</p>}
                          {s.challenge && <p style={{ margin: '0 0 5px' }}><strong style={{ color: '#b45309' }}>Challenge:</strong> {s.challenge}</p>}
                          {s.actionItem && <p style={{ margin: '0 0 5px' }}><strong style={{ color: '#0d9488' }}>Action:</strong> {s.actionItem}</p>}
                          {s.notes && <p style={{ margin: '0 0 5px' }}><strong style={{ color: '#0f2044' }}>Notes:</strong> {s.notes}</p>}
                          <button onClick={() => deleteSession(s.id)} style={{ background: 'none', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, padding: '2px 9px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>🗑 Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      </div>{/* end main + sidebar row */}

      {/* Session log modal */}
      {sessionForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSessionForm(null)}>
          <div className="card" style={{ maxWidth: 500, width: '100%', padding: '1.5rem', borderRadius: 16, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '1rem' }}>Log Mentoring Session</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={sessionForm.date} onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Progress Review</label>
                <textarea className="input" rows={2} value={sessionForm.progressReview} onChange={e => setSessionForm(f => ({ ...f, progressReview: e.target.value }))} placeholder="What progress was made since last session?" />
              </div>
              <div>
                <label className="label">Challenge Discussed</label>
                <textarea className="input" rows={2} value={sessionForm.challenge} onChange={e => setSessionForm(f => ({ ...f, challenge: e.target.value }))} placeholder="What obstacle came up?" />
              </div>
              <div>
                <label className="label">Action Item</label>
                <textarea className="input" rows={2} value={sessionForm.actionItem} onChange={e => setSessionForm(f => ({ ...f, actionItem: e.target.value }))} placeholder="What will you do before next session?" />
              </div>
              <div>
                <label className="label">Additional Notes</label>
                <textarea className="input" rows={2} value={sessionForm.notes} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label className="label">Update Goal Progress</label>
                {plan.goals.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: '0.75rem', flex: 1, color: 'var(--text-secondary)' }}>{g.goal || `Goal ${i + 1}`}</span>
                    <input type="range" min="0" max="100" step="10" value={sessionForm.goalProgress[i] || 0}
                      onChange={e => setSessionForm(f => ({ ...f, goalProgress: { ...f.goalProgress, [i]: Number(e.target.value) } }))} style={{ width: 100 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: PILLAR_COLORS[g.pillar], width: 36 }}>{sessionForm.goalProgress[i] || 0}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-primary" onClick={saveSession} disabled={savingSession} style={{ flex: 1 }}>{savingSession ? 'Saving…' : '💾 Save Session'}</button>
              <button className="btn-secondary" onClick={() => setSessionForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Close-out modal */}
      {closeForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setCloseForm(null)}>
          <div className="card" style={{ maxWidth: 500, width: '100%', padding: '1.5rem', borderRadius: 16, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '1rem' }}>Close Out Mentoring Cycle</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>Rate each pillar 1–5, from both perspectives.</p>
            {PILLARS.map(p => (
              <div key={p} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: PILLAR_COLORS[p] }}>{p}</span>
                <div>
                  <label style={{ fontSize: '0.6rem', color: '#94a3b8', display: 'block' }}>Mentee Self</label>
                  <select className="input" style={{ padding: '0.3rem' }} value={closeForm.menteeSelf[p]} onChange={e => setCloseForm(f => ({ ...f, menteeSelf: { ...f.menteeSelf, [p]: Number(e.target.value) } }))}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.6rem', color: '#94a3b8', display: 'block' }}>Mentor</label>
                  <select className="input" style={{ padding: '0.3rem' }} value={closeForm.mentorAssessment[p]} onChange={e => setCloseForm(f => ({ ...f, mentorAssessment: { ...f.mentorAssessment, [p]: Number(e.target.value) } }))}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <div style={{ margin: '10px 0' }}>
              <label className="label">Recommendation</label>
              <select className="input" value={closeForm.recommendation} onChange={e => setCloseForm(f => ({ ...f, recommendation: e.target.value }))}>
                {RECOMMENDATIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Closing Notes</label>
              <textarea className="input" rows={2} value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-primary" onClick={saveCloseOut} disabled={savingClose} style={{ flex: 1 }}>{savingClose ? 'Saving…' : '💾 Close Cycle'}</button>
              <button className="btn-secondary" onClick={() => setCloseForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
