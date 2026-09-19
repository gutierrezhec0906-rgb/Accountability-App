import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { calculateScore, logPointEvent } from '../utils/scoring';
import { generateCareerPDF } from '../utils/careerReport';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const MIN_WORDS = 20; // every narrative question needs 20+ words for the 10 pts
function wc(text = '') { return text.trim().split(/\s+/).filter(Boolean).length; }

const PILLARS = ['Leadership', 'Technical', 'Interpersonal'];
const PILLAR_COLORS = { Leadership: '#0f2044', Technical: '#0891b2', Interpersonal: '#8b5cf6' };
const PILLAR_KEYS = { Leadership: 'leadership', Technical: 'technical', Interpersonal: 'interpersonal' };
function trPillar(t, p) { return t(`career.pillars.${PILLAR_KEYS[p] || p}`, p); }
const PILLAR_HINTS = {
  Leadership: 'decision-making, delegation, coaching, accountability',
  Technical: 'role-specific competencies, lean tools, quality systems, process knowledge',
  Interpersonal: 'communication, empathy, conflict resolution, teamwork',
};
function trPillarHint(t, p) { return t(`career.pillarHints.${PILLAR_KEYS[p] || p}`, PILLAR_HINTS[p]); }

const TIMELINE_OPTIONS = [
  { value: '6', key: 'm6', label: '6 months' },
  { value: '12', key: 'm12', label: '12 months' },
  { value: '18', key: 'm18', label: '18 months (max)' },
];
function trTimelineOption(t, tl) { return t(`career.timelineOptions.${tl.key}`, tl.label); }

// A coach does NOT have to be the manager — the employee selects the best fit.
const COACH_RELATIONSHIPS = [
  { value: 'Direct Manager', key: 'directManager' },
  { value: 'Senior Leader / Mentor', key: 'seniorLeader' },
  { value: 'Cross-functional Leader', key: 'crossFunctionalLeader' },
  { value: 'Internal Subject Matter Expert (SME)', key: 'internalSme' },
  { value: 'External Coach / Mentor', key: 'externalCoach' },
  { value: 'Peer Coach', key: 'peerCoach' },
];
function trCoachRelationship(t, r) { return t(`career.coachRelationships.${r.key}`, r.value); }
const COACH_FREQUENCIES = [
  { value: 'Weekly', key: 'weekly' },
  { value: 'Bi-weekly', key: 'biweekly' },
  { value: 'Monthly', key: 'monthly' },
];
function trCoachFrequency(t, f) { return t(`career.coachFrequencies.${f.key}`, f.value); }

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100];

const MILESTONES = [
  { key: 'd30', label: '30-Day Quick Win',        hint: 'One early, visible win to build momentum' },
  { key: 'd90', label: '90-Day Checkpoint',       hint: 'First progress review and course-correction' },
  { key: 'm6',  label: '6-Month Formal Review',   hint: 'Formal review of progress vs. plan' },
  { key: 'm12', label: '12-Month Completion / Renewal', hint: 'Close out the plan or renew with new goals' },
];
function trMilestoneLabel(t, m) { return t(`career.milestones.${m.key}.label`, m.label); }
function trMilestoneHint(t, m) { return t(`career.milestones.${m.key}.hint`, m.hint); }

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
    // Progress notes the leader returns to log at each checkpoint — these sustain the score.
    checkIns: {
      d30: { note: '', savedAt: null },
      d90: { note: '', savedAt: null },
      m6:  { note: '', savedAt: null },
      m12: { note: '', savedAt: null },
    },
    completedAt: null, // set when the plan first reaches 100% + 20 words — anchors milestone windows
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
    checkIns: {
      d30: { ...base.checkIns.d30, ...(saved.checkIns?.d30 || {}) },
      d90: { ...base.checkIns.d90, ...(saved.checkIns?.d90 || {}) },
      m6:  { ...base.checkIns.m6,  ...(saved.checkIns?.m6 || {}) },
      m12: { ...base.checkIns.m12, ...(saved.checkIns?.m12 || {}) },
    },
  };
}

// The narrative "questions" that must have 20+ words for the 10 pts.
function essayFields(plan) {
  return [
    plan.aspiration, plan.motivation,
    plan.companyNeeds.skillsGaps, plan.companyNeeds.strategicPriorities, plan.companyNeeds.resources,
    ...PILLARS.flatMap(p => [plan.pillars[p].goal, plan.pillars[p].actions]),
  ];
}

// Template is 100% complete when every essay question has 20+ words, the coach is
// committed, timeline is set, and each pillar has resources + a timeline date.
function isTemplateComplete(plan) {
  if (!essayFields(plan).every(t => wc(t) >= MIN_WORDS)) return false;
  if (!plan.timeline) return false;
  if (!(plan.coach.name.trim() && plan.coach.relationship && plan.coach.committed)) return false;
  if (!PILLARS.every(p => (plan.pillars[p].resources || '').trim() && plan.pillars[p].timeline)) return false;
  return true;
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

// 20-word progress hint shown under each narrative question
function WordHint({ text }) {
  const { t } = useTranslation();
  const n = wc(text);
  const ok = n >= MIN_WORDS;
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: ok ? '#15803d' : '#94a3b8' }}>
      {t('career.wordsCount', '{{n}}/{{min}} words', { n, min: MIN_WORDS })} {ok ? '✓' : ''}
    </span>
  );
}

// Milestone check-in windows that drive the score decay.
const CHECKINS = [
  { key: 'd30', label: '30-Day Progress Note',  days: 30,  penalty: 2, penaltyLabel: '−2 pts',        note: 'Missing after 30 days: −2 pts' },
  { key: 'd90', label: '90-Day Progress Note',  days: 90,  penalty: 3, penaltyLabel: '−3 pts',        note: 'Missing after 90 days: −3 more' },
  { key: 'm6',  label: '6-Month Progress Note', days: 180, penalty: 2, penaltyLabel: '−2 pts',        note: 'Missing after 6 months: −2 more' },
  { key: 'm12', label: '12-Month Completion / Renewal Note', days: 365, penalty: 10, penaltyLabel: 'lose all', note: 'Missing after 12 months: lose all remaining points' },
];
function trCheckinLabel(t, ci) { return t(`career.checkins.${ci.key}.label`, ci.label); }
function trCheckinNote(t, ci) { return t(`career.checkins.${ci.key}.note`, ci.note); }

export default function Career() {
  const { t } = useTranslation();
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
    } catch { toast.error(t('career.toast.loadFailed', 'Could not load your plan')); }
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

  // 100%-complete template with 20 words per question → eligible for the 10 pts.
  const essays = essayFields(plan);
  const essaysDone = essays.filter(t => wc(t) >= MIN_WORDS).length;
  const planComplete = isTemplateComplete(plan);

  // Live score standing (mirrors scoring.js so the leader sees decay before it hits the total).
  const careerStanding = (() => {
    if (!plan.completedAt) return { pts: planComplete ? 10 : 0, earned: false };
    const daysSince = (Date.now() - new Date(plan.completedAt).getTime()) / 86400000;
    const noteFilled = k => (plan.checkIns?.[k]?.note || '').trim().length > 0;
    let pts = 10;
    if (daysSince >= 30  && !noteFilled('d30')) pts -= 2;
    if (daysSince >= 90  && !noteFilled('d90')) pts -= 3;
    if (daysSince >= 180 && !noteFilled('m6'))  pts -= 2;
    if (daysSince >= 365 && !noteFilled('m12')) pts = 0;
    return { pts: Math.max(0, pts), earned: true, daysSince };
  })();

  async function savePlan() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      // Anchor the milestone windows the first time the plan reaches 100% + 20 words.
      const completedAt = plan.completedAt || (isTemplateComplete(plan) ? now : null);
      // Stamp savedAt on any check-in note that has text but no timestamp yet.
      const checkIns = {};
      for (const k of ['d30', 'd90', 'm6', 'm12']) {
        const ci = plan.checkIns[k] || { note: '', savedAt: null };
        const hasText = (ci.note || '').trim().length > 0;
        checkIns[k] = { note: ci.note || '', savedAt: hasText ? (ci.savedAt || now) : null };
      }
      const toSave = { ...plan, checkIns, completedAt, createdAt: plan.createdAt || now, updatedAt: now };
      await setDoc(doc(db, 'users', currentUser.uid), { careerPlan: toSave }, { merge: true });
      setPlan(toSave);
      // First time the plan reaches 100% → log a +10 event so it appears in Daily Movement.
      // (The score itself is computed live from careerPlan, so this event is display-only and
      // is NOT summed by any scoring component — no double counting.)
      const firstCompletion = !plan.completedAt && completedAt;
      if (firstCompletion) {
        await logPointEvent(currentUser.uid, {
          points: 10,
          toolLabel: 'Career Development Plan',
          reason: 'Completed the full career development plan (100% + 20 words per question)',
        });
      }
      try { await calculateScore(currentUser.uid); } catch { /* score refresh is best-effort */ }
      if (firstCompletion) {
        toast.success(t('career.toast.planComplete', 'Plan complete! +10 pts earned. Return at each milestone to keep them.'), { duration: 5000 });
      } else {
        toast.success(t('career.toast.planSaved', 'Career development plan saved'));
      }
    } catch { toast.error(t('career.toast.saveFailed', 'Save failed')); }
    setSaving(false);
  }

  function downloadPDF() {
    try {
      generateCareerPDF(plan, {
        userName: currentUser?.displayName || '',
        skillsSummary: hasSkills ? summary : null,
      });
    } catch (e) { console.error(e); toast.error(t('career.toast.pdfFailed', 'Could not generate PDF')); }
  }

  if (loading) return <div style={{ maxWidth: 860, margin: '0 auto' }}><PageHeader icon="🚀" title={t('career.pageTitle', 'Career Development Plan')} subtitle={t('career.loading', 'Loading…')} /></div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader icon="🚀" title={t('career.title', 'Career Development — Accountability for Growth')}
        subtitle={t('career.subtitle', 'Employee-owned, company-aligned. Start with where you are, define where you want to go, and build the plan at the intersection.')} />

      {/* Completeness + points banner */}
      <div style={{ borderRadius: 12, padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: planComplete ? '#f0fdf4' : '#eff6ff', border: `1px solid ${planComplete ? '#86efac' : '#bfdbfe'}` }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: careerStanding.pts === 10 ? '#15803d' : careerStanding.pts > 0 ? '#b45309' : '#94a3b8' }}>
            {careerStanding.pts}<span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>/10</span>
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{t('career.planPts', 'Plan pts')}</div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontWeight: 800, margin: 0, fontSize: '0.85rem', color: planComplete ? '#15803d' : '#1e40af' }}>
            {careerStanding.earned
              ? (careerStanding.pts === 10 ? t('career.fullPoints', 'Full 10 points — keep logging milestone notes') : t('career.pointsDecaying', 'Points decaying — add your milestone progress notes below'))
              : planComplete ? t('career.readyToEarn', 'Ready to earn 10 points — save your plan') : t('career.completeTemplate', 'Complete the template to earn 10 points')}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
            {t('career.bannerHint', 'Fill 100% of the template with 20+ words per question → +10 pts. Then return at 30 days, 90 days, 6 months, and 12 months to log progress notes or the points decay (−2 / −3 / −2 / lose all).')}
            {' '}<strong>{t('career.questionsHave20Words', '{{done}}/{{total}} questions have 20+ words.', { done: essaysDone, total: essays.length })}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn-secondary" onClick={downloadPDF} style={{ flexShrink: 0 }}>
            🖨️ {t('career.pdf', 'PDF')}
          </button>
          <button className="btn-primary" onClick={savePlan} disabled={saving} style={{ flexShrink: 0 }}>
            {saving ? t('career.saving', 'Saving…') : `💾 ${t('career.savePlan', 'Save Plan')}`}
          </button>
        </div>
      </div>

      {/* SECTION 1 — Where am I now? (read from Skills Matrix) */}
      <SectionCard n="1" title={t('career.section1.title', 'Where Am I Now?')} accent="#0d9488"
        subtitle={t('career.section1.subtitle', 'Pulled from your Skills Development Matrix — your current proficiency across the three pillars.')}>
        {!hasSkills ? (
          <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: '#a16207', margin: '0 0 10px', fontWeight: 600 }}>
              {t('career.noSkillsMatrix', "You haven't completed your Skills Development Matrix yet. That assessment is the starting point for this plan.")}
            </p>
            <button className="btn-primary" onClick={() => navigate('/skills')}>{t('career.goToSkillsMatrix', 'Go to Skills Matrix →')}</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {PILLARS.map(p => {
              const s = summary[p];
              return (
                <div key={p} style={{ border: `1px solid ${PILLAR_COLORS[p]}30`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ background: PILLAR_COLORS[p], padding: '0.5rem 0.875rem' }}>
                    <span style={{ color: 'white', fontWeight: 800, fontSize: '0.82rem' }}>{trPillar(t, p)}</span>
                  </div>
                  <div style={{ padding: '0.75rem 0.875rem' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div>
                        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>{t('career.self', 'Self')}</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 900, color: PILLAR_COLORS[p], margin: 0 }}>{s.self ?? '—'}<span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>{t('career.peer', 'Peer')}</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 900, color: '#475569', margin: 0 }}>{s.peer ?? '—'}<span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.4 }}>{trPillarHint(t, p)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasSkills && (
          <button className="btn-secondary" onClick={() => navigate('/skills')} style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem', marginTop: 12 }}>
            {t('career.updateSkillsMatrix', 'Update Skills Matrix →')}
          </button>
        )}
      </SectionCard>

      {/* SECTION 2 — Where do I want to go? */}
      <SectionCard n="2" title={t('career.section2.title', 'Where Do I Want To Go?')} accent="#0891b2"
        subtitle={t('career.section2.subtitle', 'This plan is yours. Start with what you want — the company alignment comes next.')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('career.careerAspiration', 'Career Aspiration')}</label>
            <textarea className="input" rows={2} value={plan.aspiration}
              onChange={e => setField(['aspiration'], e.target.value)}
              placeholder={t('career.aspirationPlaceholder', "Your next role, expanded responsibility, or skill mastery you're aiming for…")} />
            <WordHint text={plan.aspiration} />
          </div>
          <div>
            <label style={labelStyle}>{t('career.personalMotivation', 'Personal Motivation — why this matters to you')}</label>
            <textarea className="input" rows={2} value={plan.motivation}
              onChange={e => setField(['motivation'], e.target.value)}
              placeholder={t('career.motivationPlaceholder', 'What makes this growth meaningful for you personally?')} />
            <WordHint text={plan.motivation} />
          </div>
          <div>
            <label style={labelStyle}>{t('career.targetTimeline', 'Target Timeline')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIMELINE_OPTIONS.map(tl => (
                <button key={tl.value} type="button" onClick={() => setField(['timeline'], tl.value)}
                  style={{ padding: '0.4rem 1rem', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                    background: plan.timeline === tl.value ? '#0891b2' : 'white',
                    color: plan.timeline === tl.value ? 'white' : '#475569',
                    borderColor: plan.timeline === tl.value ? '#0891b2' : '#e2e8f0' }}>
                  {trTimelineOption(t, tl)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* SECTION 3 — Coach + Company needs */}
      <SectionCard n="3" title={t('career.section3.title', 'Coach & Company Alignment')} accent="#7c3aed"
        subtitle={t('career.section3.subtitle', 'Who will coach this plan (it does not have to be your manager), and what does the company need that your growth can support?')}>
        {/* Coach */}
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '1rem', marginBottom: 16 }}>
          <p style={{ fontWeight: 800, color: '#5b21b6', margin: '0 0 4px', fontSize: '0.85rem' }}>{t('career.whoWillCoach', 'Who will coach and support this development plan?')}</p>
          <p style={{ fontSize: '0.73rem', color: '#7c3aed', margin: '0 0 12px', lineHeight: 1.5 }}>
            {t('career.bestCoachHint', 'The best coach is often not your direct manager — pick whoever will genuinely help you grow.')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>{t('career.coachName', 'Coach Name')}</label>
              <input className="input" value={plan.coach.name}
                onChange={e => setField(['coach', 'name'], e.target.value)} placeholder={t('career.fullName', 'Full name')} />
            </div>
            <div>
              <label style={labelStyle}>{t('career.roleRelationship', 'Role / Relationship')}</label>
              <select className="input" value={plan.coach.relationship}
                onChange={e => setField(['coach', 'relationship'], e.target.value)}>
                <option value="">{t('career.select', 'Select…')}</option>
                {COACH_RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{trCoachRelationship(t, r)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t('career.coachingFrequency', 'Coaching Frequency')}</label>
              <select className="input" value={plan.coach.frequency}
                onChange={e => setField(['coach', 'frequency'], e.target.value)}>
                {COACH_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{trCoachFrequency(t, f)}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={plan.coach.committed}
              onChange={e => setField(['coach', 'committed'], e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: plan.coach.committed ? '#15803d' : 'var(--text-secondary)' }}>
              {plan.coach.committed ? `✅ ${t('career.coachingCommitmentConfirmed', 'Coaching commitment confirmed')}` : t('career.coachingCommitmentConfirmed', 'Coaching commitment confirmed')}
            </span>
          </label>
        </div>

        {/* Company needs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('career.skillsGapsLabel', 'Skills Gaps the Organization Needs Filled')}</label>
            <textarea className="input" rows={2} value={plan.companyNeeds.skillsGaps}
              onChange={e => setField(['companyNeeds', 'skillsGaps'], e.target.value)}
              placeholder={t('career.skillsGapsPlaceholder', 'What capabilities does the team/company need right now that this growth can help fill?')} />
            <WordHint text={plan.companyNeeds.skillsGaps} />
          </div>
          <div>
            <label style={labelStyle}>{t('career.strategicPrioritiesLabel', 'Strategic Priorities This Growth Supports')}</label>
            <textarea className="input" rows={2} value={plan.companyNeeds.strategicPriorities}
              onChange={e => setField(['companyNeeds', 'strategicPriorities'], e.target.value)}
              placeholder={t('career.strategicPrioritiesPlaceholder', 'Which company goals or priorities does this development plan advance?')} />
            <WordHint text={plan.companyNeeds.strategicPriorities} />
          </div>
          <div>
            <label style={labelStyle}>{t('career.resourcesLabel', 'Resources the Company Will Provide')}</label>
            <textarea className="input" rows={2} value={plan.companyNeeds.resources}
              onChange={e => setField(['companyNeeds', 'resources'], e.target.value)}
              placeholder={t('career.resourcesPlaceholder', 'Training budget, mentoring, cross-functional exposure, time, certifications…')} />
            <WordHint text={plan.companyNeeds.resources} />
          </div>
        </div>
      </SectionCard>

      {/* SECTION 4 — Development plan grid */}
      <SectionCard n="4" title={t('career.section4.title', 'The Development Plan')} accent="#be185d"
        subtitle={t('career.section4.subtitle', "Built at the intersection of your aspiration and the company's needs — one goal in each of the three pillars.")}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PILLARS.map(p => {
            const row = plan.pillars[p];
            return (
              <div key={p} style={{ border: `1px solid ${PILLAR_COLORS[p]}30`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: PILLAR_COLORS[p], padding: '0.5rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '0.82rem' }}>{trPillar(t, p)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem' }}>{trPillarHint(t, p)}</span>
                </div>
                <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>{t('career.developmentGoal', 'Development Goal')}</label>
                    <textarea className="input" rows={2} value={row.goal}
                      onChange={e => setField(['pillars', p, 'goal'], e.target.value)}
                      placeholder={t('career.developmentGoalPlaceholder', 'What will you develop in {{pillar}}?', { pillar: trPillar(t, p).toLowerCase() })} />
                    <WordHint text={row.goal} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('career.actionSteps', 'Action Steps')}</label>
                    <textarea className="input" rows={2} value={row.actions}
                      onChange={e => setField(['pillars', p, 'actions'], e.target.value)}
                      placeholder={t('career.actionStepsPlaceholder', 'Concrete steps — training, projects, mentoring, on-the-job experiences…')} />
                    <WordHint text={row.actions} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 130px', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>{t('career.resources', 'Resources')}</label>
                      <input className="input" value={row.resources}
                        onChange={e => setField(['pillars', p, 'resources'], e.target.value)} placeholder={t('career.whatsNeeded', "What's needed")} />
                    </div>
                    <div>
                      <label style={labelStyle}>{t('career.timeline', 'Timeline')}</label>
                      <input className="input" type="date" value={row.timeline}
                        onChange={e => setField(['pillars', p, 'timeline'], e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>{t('career.progress', 'Progress')}</label>
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
      <SectionCard n="5" title={t('career.section5.title', 'Milestones & Check-Ins')} accent="#b45309"
        subtitle={t('career.section5.subtitle', 'Time-bound checkpoints keep the plan alive. The coach supports; you own the progress.')}>
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
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)', textDecoration: ms.done ? 'line-through' : 'none' }}>{trMilestoneLabel(t, m)}</span>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>{trMilestoneHint(t, m)}</p>
                  </div>
                  <input type="date" className="input" style={{ width: 150, fontSize: '0.8rem', padding: '0.35rem 0.5rem', flexShrink: 0 }}
                    value={ms.date} onChange={e => setField(['milestones', m.key, 'date'], e.target.value)} />
                </div>
                <input className="input" style={{ fontSize: '0.82rem' }}
                  value={ms.text} onChange={e => setField(['milestones', m.key, 'text'], e.target.value)}
                  placeholder={t('career.milestoneTextPlaceholder', 'What does success look like at this checkpoint?')} />
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Milestone progress notes — sustain the 10 points */}
      <SectionCard n="✓" title={t('career.checkinsSection.title', 'Milestone Progress Notes')} accent="#15803d"
        subtitle={t('career.checkinsSection.subtitle', 'Return at each checkpoint and log your real progress. These notes sustain your 10 points — miss one and the points decay.')}>
        {!plan.completedAt && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 12 }}>
            <p style={{ fontSize: '0.78rem', color: '#1e40af', margin: 0, lineHeight: 1.5 }}>
              {t('career.completeFirstHint', 'Complete and save the plan above first (100% + 20 words per question). Once you earn the 10 points, your 30 / 90 / 180-day windows start and these notes keep the points alive.')}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CHECKINS.map(ci => {
            const val = plan.checkIns[ci.key] || { note: '', savedAt: null };
            const filled = (val.note || '').trim().length > 0;
            const daysSince = plan.completedAt ? (Date.now() - new Date(plan.completedAt).getTime()) / 86400000 : 0;
            const daysUntil = plan.completedAt ? Math.ceil(ci.days - daysSince) : null;
            const overdue = plan.completedAt && daysSince >= ci.days && !filled && ci.penalty > 0;
            const comingSoon = plan.completedAt && !filled && !overdue && daysUntil !== null && daysUntil > 0 && daysUntil <= 14;
            // Status color/label: green logged · red past-due · yellow coming-soon · gray upcoming/locked
            const statusColor = filled ? '#15803d' : overdue ? '#dc2626' : comingSoon ? '#b45309' : '#94a3b8';
            const statusLabel = filled ? `✓ ${t('career.logged', 'Logged')}`
              : overdue ? `🚨 ${t('career.pastDueTakeAction', 'Past due — take action')}`
              : comingSoon ? `⚠️ ${daysUntil === 1 ? t('career.comingSoonInDay', 'Coming soon — in {{count}} day', { count: daysUntil }) : t('career.comingSoonInDays', 'Coming soon — in {{count}} days', { count: daysUntil })}`
              : plan.completedAt ? t('career.dueDay', 'Due day {{day}}', { day: ci.days }) : t('career.locked', 'Locked');
            const cardBg = filled ? '#f0fdf4' : overdue ? '#fef2f2' : comingSoon ? '#fef9c3' : 'white';
            const cardBorder = filled ? '#86efac' : overdue ? '#fecaca' : comingSoon ? '#fde68a' : 'var(--border)';
            return (
              <div key={ci.key} style={{ border: `1px solid ${cardBorder}`, borderRadius: 10, padding: '0.75rem 0.875rem', background: cardBg }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{trCheckinLabel(t, ci)}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                </div>
                <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>{trCheckinNote(t, ci)}{val.savedAt ? ` · ${t('career.lastSaved', 'last saved {{date}}', { date: new Date(val.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}` : ''}</p>
                <textarea className="input" rows={2} style={{ fontSize: '0.82rem' }}
                  value={val.note}
                  onChange={e => setField(['checkIns', ci.key, 'note'], e.target.value)}
                  placeholder={t('career.checkinPlaceholder', "What progress have you made? What's working, what's blocked, what's next?")} />
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
          {t('career.checkinTip', "Tip: adding a note — even late — restores that milestone's points. Save the plan after writing your notes to update your score.")}
        </p>
      </SectionCard>

      {/* Save + PDF (bottom) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={downloadPDF} style={{ padding: '0.6rem 1.25rem' }}>
          🖨️ {t('career.downloadPrintPdf', 'Download / Print PDF')}
        </button>
        <button className="btn-primary" onClick={savePlan} disabled={saving} style={{ padding: '0.6rem 1.5rem' }}>
          {saving ? t('career.saving', 'Saving…') : `💾 ${t('career.saveCareerDevelopmentPlan', 'Save Career Development Plan')}`}
        </button>
      </div>

      {/* Legacy goals (older module data) */}
      {legacyGoals.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <details>
            <summary style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
              📁 {t('career.previousCareerGoals', 'Previous Career Goals ({{count}})', { count: legacyGoals.length })}
            </summary>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '6px 0 10px' }}>
              {t('career.legacyGoalsHint', 'Goals saved in the earlier version of this module — kept here for reference.')}
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
