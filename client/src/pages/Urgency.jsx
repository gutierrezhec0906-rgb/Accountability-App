import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore, localDateStr } from '../utils/scoring';
import PageHeader from '../components/PageHeader';

const tips = [
  { title: 'Bias for Action — Start Now, Polish Later', desc: "Perfection is the enemy of momentum. Launch the initiative today — even an imperfect start generates learning, feedback, and energy that waiting never will. Jump into the idea, get alignment, then build and refine in motion. Leaders who act first and adjust along the way consistently outpace those who plan indefinitely. Done and improving beats perfect and delayed every time.", icon: '⚡', type: 'individual' },
  { title: 'Two-Minute Rule (GTD)', desc: "From David Allen's Getting Things Done: if a task takes less than two minutes, do it immediately. The overhead of capturing, categorizing, scheduling, and revisiting it later costs more time and mental energy than just acting on the spot. Stop queuing small actions — close them now.", icon: '⏲️', type: 'individual' },
  { title: 'Set Clear Deadlines', desc: "Every task should have a specific, non-negotiable deadline. Vague timelines breed complacency. And if circumstances require a date change, communicate it before the deadline — never after. Recommitting early shows respect for others' time, preserves trust, and signals that you take commitments seriously. Missing a deadline silently is a leadership failure; adjusting proactively is a leadership behavior.", icon: '📅', type: 'individual' },
  { title: 'Model Urgency Yourself', desc: "You are the standard. Respond to emails in under 4 hours. Show up on time, start meetings on time, and finish on time — every time. If the leader moves slowly, the team moves slowly. If the leader cuts corners on commitments, the team will too. The bar is always set at the top, so set it high. Urgency is not a policy you enforce — it is a behavior you demonstrate, every single day, in every interaction.", icon: '⚡', type: 'individual' },
  { title: 'Time-Box Everything', desc: "Time-boxing manufactures urgency by putting a hard stop on every task. A visible countdown — typically 25 minutes (Pomodoro) — triggers deadline pressure, eliminates open-ended drift, and makes procrastination visible in real time. Each sprint ends with a clear done/not-done moment, keeping accountability active all day.", icon: '⏱', type: 'individual' },
  { title: 'Follow Up on Delegated Tasks', desc: "Delegation without follow-up is just hope. Once you hand off a task, your job shifts to ensuring the work lands. Set a clear check-in point at the moment of delegation, not after. A brief \"Where are we on this?\" keeps accountability alive, surfaces blockers early, and signals that you take the commitment seriously.", icon: '🔁', type: 'individual' },
  { title: 'Create Momentum', desc: "Break work into smaller deliverables to create more frequent \"done\" moments. Sustain this rhythm throughout the day, the week, and the month. Quick wins fuel energy — for you and your team. Each small completion builds confidence, reinforces progress, and gradually shifts the mindset from just getting through the work to expecting to win.", icon: '🚀', type: 'individual' },
  { title: 'Communicate the "Why"', desc: 'People move faster when they understand why urgency matters. Connect tasks to mission and impact. When the team sees the purpose behind the deadline, speed becomes a shared value rather than a top-down demand.', icon: '💬', type: 'team' },
  { title: 'Remove Obstacles Fast', desc: 'Leaders who remove blockers within hours instead of days set the pace for urgency culture. Ask your team daily: "What is slowing you down?" Then act on the answer before end of day.', icon: '🚧', type: 'team' },
  { title: 'Use Visual Boards', desc: 'Make progress visible. When teams see stagnation, they self-correct faster. A shared board where work moves — or stalls — in plain sight creates natural peer accountability and keeps urgency alive without micromanaging.', icon: '📊', type: 'team' },
  { title: 'Daily Stand-ups', desc: 'Short, focused daily check-ins maintain momentum and surface blockers quickly. Keep it to 15 minutes: what did you finish, what are you doing today, and what is in your way? No solutions in the stand-up — just visibility.', icon: '🏃', type: 'team' },
  { title: 'Celebrate Speed Wins', desc: 'Recognize team members who complete tasks ahead of schedule. What gets rewarded gets repeated. A public shout-out for finishing early sends a louder signal than any policy document about urgency.', icon: '🏆', type: 'team' },
  { title: 'Limit Meetings', desc: 'Excessive meetings kill urgency. Move decision-making out of meeting rooms and into action. Challenge every recurring meeting: does this still deserve the time? Replace status meetings with async updates and reserve live time for decisions only.', icon: '🚫', type: 'team' },
];

// Individual reflection questions — personal urgency habits
const INDIVIDUAL_REFLECTION_QS = [
  "What is one thing I am procrastinating on right now that needs to happen today — and what is the first action I can take in the next 30 minutes?",
  "Is my calendar today reflecting my highest priorities, or am I filling time with tasks that feel busy but are not truly urgent?",
  "What would I do differently if my most important deadline this week was moved up by two days?",
  "Am I making fast, good-enough decisions on the things that matter, or am I waiting for more information that may never arrive?",
  "Which single action on my list, if completed before noon, would create the most momentum for the rest of my day?",
  "When did I last respond to something important faster than expected — and what did that feel like for the other person?",
];

// Team reflection questions — leadership urgency behaviors
const TEAM_REFLECTION_QS = [
  "Am I clearly communicating urgency to my team, or am I assuming they already feel the same pressure I do?",
  "Are there blockers on my team right now that I could remove today — and what is stopping me from doing it immediately?",
  "Which of my direct reports would benefit from an urgency conversation this week, and what specific behavior needs to change?",
  "Does my team have a visible, shared understanding of what is most urgent right now, or is everyone working from their own priority list?",
  "How quickly did I follow up on delegated work this week — and what message did that send to my team about accountability?",
  "Am I celebrating speed wins on my team, or only noticing when deadlines are missed?",
];

function wordCount(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return localDateStr();
}

// Deterministic daily question index
function dailyIdx(arr) {
  const d = new Date();
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return dayOfYear % arr.length;
}

export default function Urgency() {
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState('all');
  const [ratings, setRatings] = useState({});
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState({ ind: false, team: false });
  const [toastMsg, setToastMsg] = useState('');

  // Reflection state
  const [indAnswer, setIndAnswer] = useState('');
  const [teamAnswer, setTeamAnswer] = useState('');
  const [savingRefl, setSavingRefl] = useState({ ind: false, team: false });
  const [reflRecords, setReflRecords] = useState([]);
  const [expandedRefl, setExpandedRefl] = useState(null);

  // Today's earned points (derived from pointEvents on load)
  const [todayPts, setTodayPts] = useState({ indSurvey: false, indRefl: false, teamSurvey: false, teamRefl: false });

  const indQIdx  = dailyIdx(INDIVIDUAL_REFLECTION_QS);
  const teamQIdx = dailyIdx(TEAM_REFLECTION_QS);

  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.urgencyRecords)     setRecords(data.urgencyRecords);
        if (data.urgencyReflections) setReflRecords(data.urgencyReflections);

        // Determine which urgency points already earned today
        const today = todayStr();
        const events = data.pointEvents || [];
        const todayEvents = events.filter(e => e.date === today && e.points > 0);
        setTodayPts({
          indSurvey:  todayEvents.some(e => e.toolLabel === 'Urgency Individual Survey'),
          indRefl:    todayEvents.some(e => e.toolLabel === 'Urgency Individual Reflection'),
          teamSurvey: todayEvents.some(e => e.toolLabel === 'Urgency Team Survey'),
          teamRefl:   todayEvents.some(e => e.toolLabel === 'Urgency Team Reflection'),
        });
      } catch (e) { console.error(e); }
    }
    load();
  }, [currentUser]);

  function showToast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  }

  function scoreColor(n) {
    if (n <= 2) return { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' };
    if (n <= 3) return { bg: '#fef9c3', border: '#eab308', text: '#b45309' };
    return { bg: '#dcfce7', border: '#22c55e', text: '#15803d' };
  }

  function rateLabel(n) {
    if (!n) return { icon: '', text: 'Rate yourself' };
    if (n <= 2) return { icon: '⚠️', text: 'Needs attention' };
    if (n <= 3) return { icon: '🟡', text: 'Room to improve' };
    return { icon: '✅', text: 'Good urgency' };
  }

  const indTips  = tips.filter(t => t.type === 'individual');
  const teamTips = tips.filter(t => t.type === 'team');
  const filtered = filter === 'all' ? tips : tips.filter(t => t.type === filter);

  const indAllRated  = indTips.every(t => (ratings[t.title] || 0) > 0);
  const teamAllRated = teamTips.every(t => (ratings[t.title] || 0) > 0);
  const ratedTips    = tips.filter(t => ratings[t.title] > 0);
  const avgScore     = ratedTips.length
    ? +(ratedTips.reduce((s, t) => s + ratings[t.title], 0) / ratedTips.length).toFixed(1) : 0;
  const avgColor = avgScore >= 4 ? '#15803d' : avgScore >= 3 ? '#b45309' : avgScore > 0 ? '#dc2626' : '#94a3b8';
  const avgBg    = avgScore >= 4 ? '#dcfce7' : avgScore >= 3 ? '#fef9c3' : avgScore > 0 ? '#fee2e2' : '#f1f5f9';

  async function persistRecord(type) {
    const now = new Date().toISOString();
    const subset = tips.filter(t => t.type === type);
    const ratingsCopy = {};
    subset.forEach(t => { if (ratings[t.title]) ratingsCopy[t.title] = ratings[t.title]; });
    const avg = Object.values(ratingsCopy).length
      ? +(Object.values(ratingsCopy).reduce((a, b) => a + b, 0) / Object.values(ratingsCopy).length).toFixed(1)
      : null;
    const record = { id: now, savedAt: now, type, ratings: ratingsCopy, avg };
    const updated = [record, ...records].slice(0, 30);
    await setDoc(doc(db, 'users', currentUser.uid), { urgencyRecords: updated }, { merge: true });
    setRecords(updated);
  }

  async function saveIndSurvey() {
    if (!currentUser || !indAllRated || todayPts.indSurvey) return;
    setSaving(s => ({ ...s, ind: true }));
    try {
      await persistRecord('individual');
      const { awarded, capReached } = await logPointEvent(currentUser.uid, {
        points: 1,
        toolLabel: 'Urgency Individual Survey',
        reason: 'Completed individual urgency self-assessment',
      });
      if (awarded) {
        await calculateScore(currentUser.uid);
        setTodayPts(p => ({ ...p, indSurvey: true }));
        showToast('Individual survey saved! +1 pt earned.');
      } else if (capReached) {
        showToast('Individual survey saved. Daily point cap reached.');
      } else {
        showToast('Individual survey saved.');
      }
    } catch (e) { console.error(e); showToast('Save failed.'); }
    setSaving(s => ({ ...s, ind: false }));
  }

  async function saveTeamSurvey() {
    if (!currentUser || !teamAllRated || todayPts.teamSurvey) return;
    setSaving(s => ({ ...s, team: true }));
    try {
      await persistRecord('team');
      const { awarded, capReached } = await logPointEvent(currentUser.uid, {
        points: 1,
        toolLabel: 'Urgency Team Survey',
        reason: 'Completed team urgency self-assessment',
      });
      if (awarded) {
        await calculateScore(currentUser.uid);
        setTodayPts(p => ({ ...p, teamSurvey: true }));
        showToast('Team survey saved! +1 pt earned.');
      } else if (capReached) {
        showToast('Team survey saved. Daily point cap reached.');
      } else {
        showToast('Team survey saved.');
      }
    } catch (e) { console.error(e); showToast('Save failed.'); }
    setSaving(s => ({ ...s, team: false }));
  }

  async function saveIndReflection() {
    if (!currentUser || wordCount(indAnswer) < 20 || todayPts.indRefl) return;
    setSavingRefl(s => ({ ...s, ind: true }));
    try {
      const now = new Date().toISOString();
      const record = {
        id: now,
        savedAt: now,
        type: 'individual',
        question: INDIVIDUAL_REFLECTION_QS[indQIdx],
        answer: indAnswer.trim(),
      };
      const updated = [record, ...reflRecords].slice(0, 20);
      await setDoc(doc(db, 'users', currentUser.uid), { urgencyReflections: updated }, { merge: true });
      setReflRecords(updated);

      const { awarded, capReached } = await logPointEvent(currentUser.uid, {
        points: 1,
        toolLabel: 'Urgency Individual Reflection',
        reason: 'Individual daily reflection (20+ words)',
      });
      if (awarded) {
        await calculateScore(currentUser.uid);
        setTodayPts(p => ({ ...p, indRefl: true }));
        setIndAnswer('');
        showToast('Reflection saved! +1 pt earned.');
      } else if (capReached) {
        setTodayPts(p => ({ ...p, indRefl: true }));
        setIndAnswer('');
        showToast('Reflection saved. Daily point cap reached.');
      } else {
        setIndAnswer('');
        showToast('Reflection saved.');
      }
    } catch (e) { console.error(e); showToast('Save failed.'); }
    setSavingRefl(s => ({ ...s, ind: false }));
  }

  async function saveTeamReflection() {
    if (!currentUser || wordCount(teamAnswer) < 20 || todayPts.teamRefl) return;
    setSavingRefl(s => ({ ...s, team: true }));
    try {
      const now = new Date().toISOString();
      const record = {
        id: now,
        savedAt: now,
        type: 'team',
        question: TEAM_REFLECTION_QS[teamQIdx],
        answer: teamAnswer.trim(),
      };
      const updated = [record, ...reflRecords].slice(0, 20);
      await setDoc(doc(db, 'users', currentUser.uid), { urgencyReflections: updated }, { merge: true });
      setReflRecords(updated);

      const { awarded, capReached } = await logPointEvent(currentUser.uid, {
        points: 1,
        toolLabel: 'Urgency Team Reflection',
        reason: 'Team daily reflection (20+ words)',
      });
      if (awarded) {
        await calculateScore(currentUser.uid);
        setTodayPts(p => ({ ...p, teamRefl: true }));
        setTeamAnswer('');
        showToast('Reflection saved! +1 pt earned.');
      } else if (capReached) {
        setTodayPts(p => ({ ...p, teamRefl: true }));
        setTeamAnswer('');
        showToast('Reflection saved. Daily point cap reached.');
      } else {
        setTeamAnswer('');
        showToast('Reflection saved.');
      }
    } catch (e) { console.error(e); showToast('Save failed.'); }
    setSavingRefl(s => ({ ...s, team: false }));
  }

  const ptsEarned = [todayPts.indSurvey, todayPts.indRefl, todayPts.teamSurvey, todayPts.teamRefl].filter(Boolean).length;

  const indWc   = wordCount(indAnswer);
  const teamWc  = wordCount(teamAnswer);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="⚡" title="Sense of Urgency Guide — The Rhythm" subtitle="Tools and reflection for individual and team urgency" />

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#0f2044', color: 'white', padding: '0.625rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
          {toastMsg}
        </div>
      )}

      {/* Daily pts counter */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: ptsEarned === 4 ? '#15803d' : '#0f2044' }}>{ptsEarned}/4</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>pts earned today</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Individual Survey', key: 'indSurvey' },
            { label: 'Individual Reflection', key: 'indRefl' },
            { label: 'Team Survey', key: 'teamSurvey' },
            { label: 'Team Reflection', key: 'teamRefl' },
          ].map(({ label, key }) => (
            <span key={key} style={{
              padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700,
              background: todayPts[key] ? '#f0fdf4' : '#f1f5f9',
              color: todayPts[key] ? '#15803d' : '#94a3b8',
              border: `1px solid ${todayPts[key] ? '#86efac' : '#e2e8f0'}`,
            }}>
              {todayPts[key] ? '✓' : '○'} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Overall average */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ background: avgBg, borderRadius: 14, padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: avgColor, lineHeight: 1 }}>{avgScore || '—'}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: avgColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>Avg / 5</span>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '1rem' }}>Your Urgency Self-Assessment</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
            {avgScore >= 4 ? '✅ Strong urgency culture' : avgScore >= 3 ? '🟡 Room to improve' : avgScore > 0 ? '⚠️ Needs attention' : 'Rate each tip below to see your score'}
          </p>
          <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 8, maxWidth: 320 }}>
            <div style={{ height: 8, borderRadius: 9999, background: avgColor, width: `${(avgScore / 5) * 100}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>{ratedTips.length} of {tips.length} tips rated</p>
        </div>
      </div>

      {/* Tips filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1rem' }}>Urgency Tips & Strategies</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'individual', 'team'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: filter === f ? '#0f2044' : '#f1f5f9', color: filter === f ? '#fff' : '#475569' }}>
              {f === 'all' ? 'All Tips' : f === 'individual' ? 'Individual' : 'Team'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '0.875rem', marginBottom: '1.75rem' }}>
        {filtered.map(tip => {
          const val = ratings[tip.title] || 0;
          const rl  = rateLabel(val);
          return (
            <div key={tip.title} className="card" style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{tip.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: 0 }}>{tip.title}</h4>
                    <span style={{ padding: '1px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700,
                      background: tip.type === 'team' ? '#dbeafe' : '#ede9fe',
                      color: tip.type === 'team' ? '#1d4ed8' : '#7c3aed' }}>{tip.type}</span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>{tip.desc}</p>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How well do you practice this?</p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const c = scoreColor(n);
                    return (
                      <button key={n} onClick={() => setRatings(r => ({ ...r, [tip.title]: n }))}
                        style={{ width: 34, height: 34, borderRadius: '50%', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                          background: n <= val ? c.bg : 'transparent',
                          border: `2px solid ${n <= val ? c.border : '#e2e8f0'}`,
                          color: n <= val ? c.text : '#94a3b8' }}>
                        {n}
                      </button>
                    );
                  })}
                  {val > 0 && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: scoreColor(val).text, marginLeft: 6 }}>{rl.icon} {rl.text}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Survey save buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
        {/* Individual survey */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #7c3aed' }}>
          <h4 style={{ fontWeight: 800, color: '#5b21b6', margin: '0 0 6px', fontSize: '0.9rem' }}>Individual Survey</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Rate all {indTips.length} individual tips to earn <strong>+1 pt</strong>.
            {' '}{indTips.filter(t => (ratings[t.title] || 0) > 0).length}/{indTips.length} rated.
          </p>
          {todayPts.indSurvey ? (
            <div style={{ padding: '0.5rem 0.875rem', borderRadius: 9999, background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center' }}>✓ +1 pt earned today</div>
          ) : (
            <button className="btn-primary" onClick={saveIndSurvey}
              disabled={saving.ind || !indAllRated}
              style={{ width: '100%', opacity: indAllRated ? 1 : 0.5, background: '#7c3aed', borderColor: '#7c3aed' }}>
              {saving.ind ? 'Saving…' : indAllRated ? '💾 Save Individual Survey (+1 pt)' : `Rate all ${indTips.length} individual tips first`}
            </button>
          )}
        </div>

        {/* Team survey */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #1d4ed8' }}>
          <h4 style={{ fontWeight: 800, color: '#1e40af', margin: '0 0 6px', fontSize: '0.9rem' }}>Team Survey</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Rate all {teamTips.length} team tips to earn <strong>+1 pt</strong>.
            {' '}{teamTips.filter(t => (ratings[t.title] || 0) > 0).length}/{teamTips.length} rated.
          </p>
          {todayPts.teamSurvey ? (
            <div style={{ padding: '0.5rem 0.875rem', borderRadius: 9999, background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center' }}>✓ +1 pt earned today</div>
          ) : (
            <button className="btn-primary" onClick={saveTeamSurvey}
              disabled={saving.team || !teamAllRated}
              style={{ width: '100%', opacity: teamAllRated ? 1 : 0.5 }}>
              {saving.team ? 'Saving…' : teamAllRated ? '💾 Save Team Survey (+1 pt)' : `Rate all ${teamTips.length} team tips first`}
            </button>
          )}
        </div>
      </div>

      {/* Daily Reflection — Individual */}
      <div style={{ borderRadius: 16, padding: '1.5rem', background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #c4b5fd', marginBottom: '1.25rem' }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontWeight: 800, color: '#5b21b6', margin: '0 0 2px', fontSize: '1rem' }}>Daily Reflection — Individual</h3>
          <p style={{ fontSize: '0.78rem', color: '#7c3aed', margin: 0 }}>Personal urgency question · rotates daily · 20+ words to earn +1 pt</p>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '0.875rem', boxShadow: '0 1px 4px rgba(15,32,68,0.06)' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>
            "{INDIVIDUAL_REFLECTION_QS[indQIdx]}"
          </p>
        </div>
        {todayPts.indRefl ? (
          <div style={{ padding: '0.625rem 1rem', borderRadius: 9999, background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '0.8rem', textAlign: 'center' }}>✓ +1 pt earned today — reflection saved</div>
        ) : (
          <>
            <textarea className="input" rows={3}
              placeholder="Write your reflection here (minimum 20 words)..."
              value={indAnswer}
              onChange={e => setIndAnswer(e.target.value)}
              style={{ marginBottom: '0.5rem', background: 'white' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: '0.72rem', color: indWc >= 20 ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                {indWc} / 20 words {indWc >= 20 ? '✓' : ''}
              </span>
              <button className="btn-primary"
                onClick={saveIndReflection}
                disabled={savingRefl.ind || indWc < 20}
                style={{ opacity: indWc >= 20 ? 1 : 0.5, background: '#7c3aed', borderColor: '#7c3aed' }}>
                {savingRefl.ind ? 'Saving…' : '💾 Save Reflection (+1 pt)'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Daily Reflection — Team */}
      <div style={{ borderRadius: 16, padding: '1.5rem', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1px solid #93c5fd', marginBottom: '1.75rem' }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontWeight: 800, color: '#1e40af', margin: '0 0 2px', fontSize: '1rem' }}>Daily Reflection — Team</h3>
          <p style={{ fontSize: '0.78rem', color: '#1d4ed8', margin: 0 }}>Team leadership urgency question · rotates daily · 20+ words to earn +1 pt</p>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '0.875rem', boxShadow: '0 1px 4px rgba(15,32,68,0.06)' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>
            "{TEAM_REFLECTION_QS[teamQIdx]}"
          </p>
        </div>
        {todayPts.teamRefl ? (
          <div style={{ padding: '0.625rem 1rem', borderRadius: 9999, background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '0.8rem', textAlign: 'center' }}>✓ +1 pt earned today — reflection saved</div>
        ) : (
          <>
            <textarea className="input" rows={3}
              placeholder="Write your reflection here (minimum 20 words)..."
              value={teamAnswer}
              onChange={e => setTeamAnswer(e.target.value)}
              style={{ marginBottom: '0.5rem', background: 'white' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: '0.72rem', color: teamWc >= 20 ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                {teamWc} / 20 words {teamWc >= 20 ? '✓' : ''}
              </span>
              <button className="btn-primary"
                onClick={saveTeamReflection}
                disabled={savingRefl.team || teamWc < 20}
                style={{ opacity: teamWc >= 20 ? 1 : 0.5 }}>
                {savingRefl.team ? 'Saving…' : '💾 Save Reflection (+1 pt)'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Assessment records */}
      {records.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.9rem' }}>Assessment Records</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {records.slice(0, 10).map((rec, i) => (
              <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.875rem', background: i === 0 ? '#f5f3ff' : '#f8fafc', borderRadius: 10, border: `1px solid ${i === 0 ? '#c4b5fd' : '#e2e8f0'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {i === 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#7c3aed', color: 'white', padding: '1px 7px', borderRadius: 9999 }}>Latest</span>}
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(rec.savedAt)}</span>
                    <span style={{ fontSize: '0.72rem', padding: '1px 8px', borderRadius: 9999, fontWeight: 700,
                      background: rec.type === 'team' ? '#dbeafe' : '#ede9fe',
                      color: rec.type === 'team' ? '#1d4ed8' : '#7c3aed' }}>{rec.type}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                    Avg: {rec.avg ?? '—'} / 5 · {Object.keys(rec.ratings || {}).length} tips rated
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection history */}
      {reflRecords.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.9rem' }}>Reflection History</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reflRecords.slice(0, 10).map((rec, i) => (
              <div key={rec.id} style={{ borderRadius: 10, border: `1px solid ${i === 0 ? '#c4b5fd' : '#e2e8f0'}`, overflow: 'hidden' }}>
                <button onClick={() => setExpandedRefl(expandedRefl === rec.id ? null : rec.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.875rem', background: i === 0 ? '#f5f3ff' : '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {i === 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#7c3aed', color: 'white', padding: '1px 7px', borderRadius: 9999 }}>Latest</span>}
                    <span style={{ fontSize: '0.72rem', padding: '1px 8px', borderRadius: 9999, fontWeight: 700,
                      background: rec.type === 'team' ? '#dbeafe' : '#ede9fe',
                      color: rec.type === 'team' ? '#1d4ed8' : '#7c3aed' }}>{rec.type}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(rec.savedAt)}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{expandedRefl === rec.id ? '▲ Hide' : '▼ View'}</span>
                </button>
                {expandedRefl === rec.id && (
                  <div style={{ padding: '0.75rem 0.875rem', background: 'white' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: rec.type === 'team' ? '#1d4ed8' : '#7c3aed', margin: '0 0 4px' }}>Q: {rec.question}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>{rec.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
