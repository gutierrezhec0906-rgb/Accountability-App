import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const PILLARS = ['Leadership', 'Technical', 'Interpersonal'];
const PILLAR_COLORS = { Leadership: '#0f2044', Technical: '#0891b2', Interpersonal: '#8b5cf6' };
const PILLAR_HINTS = {
  Leadership: 'decision-making, delegation, coaching, accountability',
  Technical: 'role-specific competencies, lean tools, quality systems, process knowledge',
  Interpersonal: 'communication, empathy, conflict resolution, teamwork',
};

const TIMELINE_OPTIONS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '18', label: '18 months (max)' },
];

// A coach does NOT have to be the manager — the employee selects the best fit.
const COACH_RELATIONSHIPS = [
  'Direct Manager',
  'Senior Leader / Mentor',
  'Cross-functional Leader',
  'Internal Subject Matter Expert (SME)',
  'External Coach / Mentor',
  'Peer Coach',
];
const COACH_FREQUENCIES = ['Weekly', 'Bi-weekly', 'Monthly'];

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100];

const MILESTONES = [
  { key: 'd30', label: '30-Day Quick Win',        hint: 'One early, visible win to build momentum' },
  { key: 'd90', label: '90-Day Checkpoint',       hint: 'First progress review and course-correction' },
  { key: 'm6',  label: '6-Month Formal Review',   hint: 'Formal review of progress vs. plan' },
  { key: 'm12', label: '12-Month Completion / Renewal', hint: 'Close out the plan or renew with new goals' },
];

function emptyPlan() {
  return {
    aspiration: '', motivation: '', timeline: '12',
    coach: { name: '', relationship: '', frequency: 'Monthly', committed: false },
    companyNeeds: { skillsGaps: '', strategicPriorities: '', resources: '' },
    pillars: {
      Leadership:    { goal: '', actions: '', resources: '', timeline: '', progress: 0 },
      Technical:     { goal: '', actions: '', resources: '', timeline: '', progress: 0 },
      Interpersonal: { goal: '', actions: '', resources: '', timeline: '', progress: 0 },
    },
    milestones: {
      d30: { text: '', date: '', done: false },
      d90: { text: '', date: '', done: false },
      m6:  { text: '', date: '', done: false },
      m12: { text: '', date: '', done: false },
    },
    createdAt: null, updatedAt: null,
  };
}

// Merge a loaded plan over the empty shape so new fields always exist.
function hydratePlan(saved) {
  const base = emptyPlan();
  if (!saved) return base;
  return {
    ...base, ...saved,
    coach: { ...base.coach, ...(saved.coach || {}) },
    companyNeeds: { ...base.companyNeeds, ...(saved.companyNeeds || {}) },
    pillars: {
      Leadership:    { ...base.pillars.Leadership,    ...(saved.pillars?.Leadership || {}) },
      Technical:     { ...base.pillars.Technical,     ...(saved.pillars?.Technical || {}) },
      Interpersonal: { ...base.pillars.Interpersonal, ...(saved.pillars?.Interpersonal || {}) },
    },
    milestones: {
      d30: { ...base.milestones.d30, ...(saved.milestones?.d30 || {}) },
      d90: { ...base.milestones.d90, ...(saved.milestones?.d90 || {}) },
      m6:  { ...base.milestones.m6,  ...(saved.milestones?.m6 || {}) },
      m12: { ...base.milestones.m12, ...(saved.milestones?.m12 || {}) },
    },
  };
}

// Per-pillar averages from the Skills Development Matrix (categories match the pillars).
function pillarSummary(skillsMatrix) {
  const out = {};
  PILLARS.forEach(p => { out[p] = { self: null, peer: null, count: 0 }; });
  (skillsMatrix || []).forEach(cat => {
    if (!out[cat.category]) return;
    const skills = cat.skills || [];
    if (!skills.length) return;
    const selfAvg = +(skills.reduce((a, s) => a + (s.self || 0), 0) / skills.length).toFixed(1);
    const peerRated = skills.filter(s => s.peer > 0);
    const peerAvg = peerRated.length ? +(peerRated.reduce((a, s) => a + s.peer, 0) / peerRated.length).toFixed(1) : null;
    out[cat.category] = { self: selfAvg, peer: peerAvg, count: skills.length };
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

export default function Career() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(emptyPlan());
  const [skillsMatrix, setSkillsMatrix] = useState(null);
  const [legacyGoals, setLegacyGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  async function load() {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setPlan(hydratePlan(data.careerPlan));
        setSkillsMatrix(data.skillsMatrix || null);
        setLegacyGoals(data.careerGoals || []);
      }
    } catch { toast.error('Could not load your plan'); }
    setLoading(false);
  }

  function setField(path, value) {
    setPlan(p => {
      const next = { ...p };
      if (path.length === 1) next[path[0]] = value;
      else if (path.length === 2) next[path[0]] = { ...next[path[0]], [path[1]]: value };
      else if (path.length === 3) next[path[0]] = { ...next[path[0]], [path[1]]: { ...next[path[0]][path[1]], [path[2]]: value } };
      return next;
    });
  }

  const summary = pillarSummary(skillsMatrix);
  const hasSkills = skillsMatrix && skillsMatrix.some(c => (c.skills || []).length);

  // Completeness — all three pillars have a goal, coach committed, timeline set.
  const pillarsComplete = PILLARS.every(p => (plan.pillars[p].goal || '').trim());
  const coachComplete = plan.coach.name.trim() && plan.coach.relationship && plan.coach.committed;
  const section2Complete = plan.aspiration.trim() && plan.motivation.trim() && plan.timeline;
  const planComplete = pillarsComplete && coachComplete && section2Complete;

  async function savePlan() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const toSave = { ...plan, createdAt: plan.createdAt || now, updatedAt: now };
      await setDoc(doc(db, 'users', currentUser.uid), { careerPlan: toSave }, { merge: true });
      setPlan(toSave);
      toast.success('Career development plan saved');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  }

  if (loading) return <div style={{ maxWidth: 860, margin: '0 auto' }}><PageHeader icon="🚀" title="Career Development Plan" subtitle="Loading…" /></div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader icon="🚀" title="Career Development Plan"
        subtitle="Employee-owned, company-aligned. Start with where you are, define where you want to go, and build the plan at the intersection." />

      {/* Completeness banner */}
      <div style={{ borderRadius: 12, padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: planComplete ? '#f0fdf4' : '#eff6ff', border: `1px solid ${planComplete ? '#86efac' : '#bfdbfe'}` }}>
        <span style={{ fontSize: '1.25rem' }}>{planComplete ? '✅' : '🧭'}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontWeight: 800, margin: 0, fontSize: '0.85rem', color: planComplete ? '#15803d' : '#1e40af' }}>
            {planComplete ? 'Your plan is complete' : 'Build a complete plan'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
            A complete plan has a goal in all three pillars, a committed coach, an aspiration, and a timeline.
          </p>
        </div>
        <button className="btn-primary" onClick={savePlan} disabled={saving} style={{ flexShrink: 0 }}>
          {saving ? 'Saving…' : '💾 Save Plan'}
        </button>
      </div>

      {/* SECTION 1 — Where am I now? (read from Skills Matrix) */}
      <SectionCard n="1" title="Where Am I Now?" accent="#0d9488"
        subtitle="Pulled from your Skills Development Matrix — your current proficiency across the three pillars.">
        {!hasSkills ? (
          <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: '#a16207', margin: '0 0 10px', fontWeight: 600 }}>
              You haven't completed your Skills Development Matrix yet. That assessment is the starting point for this plan.
            </p>
            <button className="btn-primary" onClick={() => navigate('/skills')}>Go to Skills Matrix →</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {PILLARS.map(p => {
              const s = summary[p];
              return (
                <div key={p} style={{ border: `1px solid ${PILLAR_COLORS[p]}30`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ background: PILLAR_COLORS[p], padding: '0.5rem 0.875rem' }}>
                    <span style={{ color: 'white', fontWeight: 800, fontSize: '0.82rem' }}>{p}</span>
                  </div>
                  <div style={{ padding: '0.75rem 0.875rem' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div>
                        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Self</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 900, color: PILLAR_COLORS[p], margin: 0 }}>{s.self ?? '—'}<span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Peer</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 900, color: '#475569', margin: 0 }}>{s.peer ?? '—'}<span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.4 }}>{PILLAR_HINTS[p]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasSkills && (
          <button className="btn-secondary" onClick={() => navigate('/skills')} style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem', marginTop: 12 }}>
            Update Skills Matrix →
          </button>
        )}
      </SectionCard>

      {/* SECTION 2 — Where do I want to go? */}
      <SectionCard n="2" title="Where Do I Want To Go?" accent="#0891b2"
        subtitle="This plan is yours. Start with what you want — the company alignment comes next.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Career Aspiration</label>
            <textarea className="input" rows={2} value={plan.aspiration}
              onChange={e => setField(['aspiration'], e.target.value)}
              placeholder="Your next role, expanded responsibility, or skill mastery you're aiming for…" />
          </div>
          <div>
            <label style={labelStyle}>Personal Motivation — why this matters to you</label>
            <textarea className="input" rows={2} value={plan.motivation}
              onChange={e => setField(['motivation'], e.target.value)}
              placeholder="What makes this growth meaningful for you personally?" />
          </div>
          <div>
            <label style={labelStyle}>Target Timeline</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIMELINE_OPTIONS.map(t => (
                <button key={t.value} type="button" onClick={() => setField(['timeline'], t.value)}
                  style={{ padding: '0.4rem 1rem', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                    background: plan.timeline === t.value ? '#0891b2' : 'white',
                    color: plan.timeline === t.value ? 'white' : '#475569',
                    borderColor: plan.timeline === t.value ? '#0891b2' : '#e2e8f0' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* SECTION 3 — Coach + Company needs */}
      <SectionCard n="3" title="Coach & Company Alignment" accent="#7c3aed"
        subtitle="Who will coach this plan (it does not have to be your manager), and what does the company need that your growth can support?">
        {/* Coach */}
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '1rem', marginBottom: 16 }}>
          <p style={{ fontWeight: 800, color: '#5b21b6', margin: '0 0 4px', fontSize: '0.85rem' }}>Who will coach and support this development plan?</p>
          <p style={{ fontSize: '0.73rem', color: '#7c3aed', margin: '0 0 12px', lineHeight: 1.5 }}>
            The best coach is often not your direct manager — pick whoever will genuinely help you grow.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Coach Name</label>
              <input className="input" value={plan.coach.name}
                onChange={e => setField(['coach', 'name'], e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label style={labelStyle}>Role / Relationship</label>
              <select className="input" value={plan.coach.relationship}
                onChange={e => setField(['coach', 'relationship'], e.target.value)}>
                <option value="">Select…</option>
                {COACH_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Coaching Frequency</label>
              <select className="input" value={plan.coach.frequency}
                onChange={e => setField(['coach', 'frequency'], e.target.value)}>
                {COACH_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={plan.coach.committed}
              onChange={e => setField(['coach', 'committed'], e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: plan.coach.committed ? '#15803d' : 'var(--text-secondary)' }}>
              {plan.coach.committed ? '✅ Coaching commitment confirmed' : 'Coaching commitment confirmed'}
            </span>
          </label>
        </div>

        {/* Company needs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Skills Gaps the Organization Needs Filled</label>
            <textarea className="input" rows={2} value={plan.companyNeeds.skillsGaps}
              onChange={e => setField(['companyNeeds', 'skillsGaps'], e.target.value)}
              placeholder="What capabilities does the team/company need right now that this growth can help fill?" />
          </div>
          <div>
            <label style={labelStyle}>Strategic Priorities This Growth Supports</label>
            <textarea className="input" rows={2} value={plan.companyNeeds.strategicPriorities}
              onChange={e => setField(['companyNeeds', 'strategicPriorities'], e.target.value)}
              placeholder="Which company goals or priorities does this development plan advance?" />
          </div>
          <div>
            <label style={labelStyle}>Resources the Company Will Provide</label>
            <textarea className="input" rows={2} value={plan.companyNeeds.resources}
              onChange={e => setField(['companyNeeds', 'resources'], e.target.value)}
              placeholder="Training budget, mentoring, cross-functional exposure, time, certifications…" />
          </div>
        </div>
      </SectionCard>

      {/* SECTION 4 — Development plan grid */}
      <SectionCard n="4" title="The Development Plan" accent="#be185d"
        subtitle="Built at the intersection of your aspiration and the company's needs — one goal in each of the three pillars.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PILLARS.map(p => {
            const row = plan.pillars[p];
            return (
              <div key={p} style={{ border: `1px solid ${PILLAR_COLORS[p]}30`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: PILLAR_COLORS[p], padding: '0.5rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '0.82rem' }}>{p}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem' }}>{PILLAR_HINTS[p]}</span>
                </div>
                <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Development Goal</label>
                    <textarea className="input" rows={2} value={row.goal}
                      onChange={e => setField(['pillars', p, 'goal'], e.target.value)}
                      placeholder={`What will you develop in ${p.toLowerCase()}?`} />
                  </div>
                  <div>
                    <label style={labelStyle}>Action Steps</label>
                    <textarea className="input" rows={2} value={row.actions}
                      onChange={e => setField(['pillars', p, 'actions'], e.target.value)}
                      placeholder="Concrete steps — training, projects, mentoring, on-the-job experiences…" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 130px', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Resources</label>
                      <input className="input" value={row.resources}
                        onChange={e => setField(['pillars', p, 'resources'], e.target.value)} placeholder="What's needed" />
                    </div>
                    <div>
                      <label style={labelStyle}>Timeline</label>
                      <input className="input" type="date" value={row.timeline}
                        onChange={e => setField(['pillars', p, 'timeline'], e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Progress</label>
                      <select className="input" value={row.progress}
                        onChange={e => setField(['pillars', p, 'progress'], Number(e.target.value))}>
                        {PROGRESS_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 6 }}>
                    <div style={{ height: 6, borderRadius: 9999, background: PILLAR_COLORS[p], width: `${row.progress}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* SECTION 5 — Milestones & check-ins */}
      <SectionCard n="5" title="Milestones & Check-Ins" accent="#b45309"
        subtitle="Time-bound checkpoints keep the plan alive. The coach supports; you own the progress.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MILESTONES.map(m => {
            const ms = plan.milestones[m.key];
            return (
              <div key={m.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.875rem', background: ms.done ? '#f0fdf4' : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <input type="checkbox" checked={ms.done}
                    onChange={e => setField(['milestones', m.key, 'done'], e.target.checked)}
                    style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)', textDecoration: ms.done ? 'line-through' : 'none' }}>{m.label}</span>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>{m.hint}</p>
                  </div>
                  <input type="date" className="input" style={{ width: 150, fontSize: '0.8rem', padding: '0.35rem 0.5rem', flexShrink: 0 }}
                    value={ms.date} onChange={e => setField(['milestones', m.key, 'date'], e.target.value)} />
                </div>
                <input className="input" style={{ fontSize: '0.82rem' }}
                  value={ms.text} onChange={e => setField(['milestones', m.key, 'text'], e.target.value)}
                  placeholder="What does success look like at this checkpoint?" />
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Save (bottom) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn-primary" onClick={savePlan} disabled={saving} style={{ padding: '0.6rem 1.5rem' }}>
          {saving ? 'Saving…' : '💾 Save Career Development Plan'}
        </button>
      </div>

      {/* Legacy goals (older module data) */}
      {legacyGoals.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <details>
            <summary style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
              📁 Previous Career Goals ({legacyGoals.length})
            </summary>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '6px 0 10px' }}>
              Goals saved in the earlier version of this module — kept here for reference.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {legacyGoals.map(g => (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 8, fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{g.title}</span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{g.category}{g.targetDate ? ` · ${g.targetDate}` : ''}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
