import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';

const tips = [
  { title: 'Bias for Action — Start Now, Polish Later', desc: "Perfection is the enemy of momentum. Launch the initiative today — even an imperfect start generates learning, feedback, and energy that waiting never will. Jump into the idea, get alignment, then build and refine in motion. Leaders who act first and adjust along the way consistently outpace those who plan indefinitely. Done and improving beats perfect and delayed every time.", icon: '⚡', type: 'individual' },
  { title: 'Two-Minute Rule (GTD)', desc: "From David Allen's Getting Things Done: if a task takes less than two minutes, do it immediately. The overhead of capturing, categorizing, scheduling, and revisiting it later costs more time and mental energy than just acting on the spot. Stop queuing small actions — close them now.", icon: '⏲️', type: 'individual' },
  { title: 'Set Clear Deadlines',    desc: "Every task should have a specific, non-negotiable deadline. Vague timelines breed complacency. And if circumstances require a date change, communicate it before the deadline — never after. Recommitting early shows respect for others' time, preserves trust, and signals that you take commitments seriously. Missing a deadline silently is a leadership failure; adjusting proactively is a leadership behavior.", icon: '📅', type: 'individual' },
  { title: 'Communicate the "Why"', desc: 'People move faster when they understand why urgency matters. Connect tasks to mission and impact.',                icon: '💬', type: 'team'       },
  { title: 'Remove Obstacles Fast', desc: 'Leaders who remove blockers within hours instead of days set the pace for urgency culture.',                     icon: '🚧', type: 'team'       },
  { title: 'Model Urgency Yourself', desc: "You are the standard. Respond to emails in under 4 hours. Show up on time, start meetings on time, and finish on time — every time. If the leader moves slowly, the team moves slowly. If the leader cuts corners on commitments, the team will too. The bar is always set at the top, so set it high. Urgency is not a policy you enforce — it is a behavior you demonstrate, every single day, in every interaction.", icon: '⚡', type: 'individual' },
  { title: 'Use Visual Boards',     desc: 'Make progress visible. When teams see stagnation, they self-correct faster.',                                    icon: '📊', type: 'team'       },
  { title: 'Daily Stand-ups',       desc: 'Short, focused daily check-ins maintain momentum and surface blockers quickly.',                                 icon: '🏃', type: 'team'       },
  { title: 'Celebrate Speed Wins',  desc: 'Recognize team members who complete tasks ahead of schedule. What gets rewarded gets repeated.',                 icon: '🏆', type: 'team'       },
  { title: 'Create Momentum',        desc: "Break work into smaller deliverables to create more frequent \"done\" moments. Sustain this rhythm throughout the day, the week, and the month. Quick wins fuel energy — for you and your team. Each small completion builds confidence, reinforces progress, and gradually shifts the mindset from just getting through the work to expecting to win. Momentum is not an accident; it is engineered one small victory at a time.", icon: '🚀', type: 'individual' },
  { title: 'Limit Meetings',        desc: 'Excessive meetings kill urgency. Move decision-making out of meeting rooms and into action.',                    icon: '🚫', type: 'team'       },
  { title: 'Time-Box Everything',   desc: "Time-boxing manufactures urgency by putting a hard stop on every task. A visible countdown — typically 25 minutes (Pomodoro) — triggers deadline pressure, eliminates open-ended drift, and makes procrastination visible in real time. Each sprint ends with a clear done/not-done moment, keeping accountability active all day. Short, repeatable cycles make motivation immediate instead of waiting for a distant deadline to feel real.", icon: '⏱', type: 'individual' },
  { title: 'Follow Up on Delegated Tasks', desc: "Delegation without follow-up is just hope. Once you hand off a task, your job isn't done — it shifts to ensuring the work lands. Set a clear check-in point at the moment of delegation, not after. A brief \"Where are we on this?\" keeps accountability alive, surfaces blockers early, and signals that you take the commitment seriously. Leaders who follow up consistently build teams that deliver consistently.", icon: '🔁', type: 'individual' },
];

const reflectionQuestions = [
  "What is one thing I am procrastinating on that needs to happen today?",
  "Am I communicating urgency to my team or assuming they already feel it?",
  "What is the cost of NOT acting on this within the next 24 hours?",
  "Are there blockers I could remove in the next hour that would unblock my team?",
  "Is my calendar reflecting my priorities, or am I busy but not urgent?",
  "What would I do differently if this deadline was moved up by one week?",
  "Am I making fast, good-enough decisions or waiting for perfect information?",
  "Which of my direct reports need more urgency coaching this week?",
];

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Urgency() {
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState('all');
  const [reflectionIdx, setReflectionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [ratings, setRatings] = useState({});
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // Load saved data on mount
  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.urgencyRecords) setRecords(data.urgencyRecords);
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, [currentUser]);

  const filtered = filter === 'all' ? tips : tips.filter(t => t.type === filter);

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

  const ratedTips = tips.filter(t => ratings[t.title] > 0);
  const avgScore = ratedTips.length
    ? +(ratedTips.reduce((sum, t) => sum + ratings[t.title], 0) / ratedTips.length).toFixed(1)
    : 0;
  const avgColor = avgScore >= 4 ? '#15803d' : avgScore >= 3 ? '#b45309' : avgScore > 0 ? '#dc2626' : '#94a3b8';
  const avgBg    = avgScore >= 4 ? '#dcfce7' : avgScore >= 3 ? '#fef9c3' : avgScore > 0 ? '#fee2e2' : '#f1f5f9';
  const avgLabel = avgScore >= 4 ? '✅ Strong urgency culture' : avgScore >= 3 ? '🟡 Room to improve' : avgScore > 0 ? '⚠️ Needs attention' : 'Rate each tip below to see your score';

  // Last saved date per type
  const lastIndividual = [...records].reverse().find(r => r.type === 'individual' || r.type === 'all');
  const lastTeam       = [...records].reverse().find(r => r.type === 'team'       || r.type === 'all');

  async function saveRecord() {
    if (!currentUser || ratedTips.length === 0) return;
    setSaving(true);
    const now = new Date().toISOString();
    const individualRatings = {};
    const teamRatings = {};
    tips.forEach(t => {
      if (ratings[t.title]) {
        if (t.type === 'individual') individualRatings[t.title] = ratings[t.title];
        else teamRatings[t.title] = ratings[t.title];
      }
    });
    const indAvg = Object.keys(individualRatings).length
      ? +(Object.values(individualRatings).reduce((a, b) => a + b, 0) / Object.keys(individualRatings).length).toFixed(1)
      : null;
    const teamAvg = Object.keys(teamRatings).length
      ? +(Object.values(teamRatings).reduce((a, b) => a + b, 0) / Object.keys(teamRatings).length).toFixed(1)
      : null;

    const record = {
      id: now,
      savedAt: now,
      type: 'all',
      ratings: { ...ratings },
      individualAvg: indAvg,
      teamAvg: teamAvg,
      overallAvg: avgScore,
      ratedCount: ratedTips.length,
    };

    const updated = [record, ...records].slice(0, 20);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { urgencyRecords: updated }, { merge: true });
      setRecords(updated);
      setToast('Assessment saved!');
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      console.error(e);
      setToast('Save failed.');
      setTimeout(() => setToast(''), 3000);
    }
    setSaving(false);
  }

  function loadRecord(rec) {
    setRatings(rec.ratings || {});
    setToast('Record loaded.');
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="⚡" title="Sense of Urgency Guide" subtitle="Tools and reflection for individual and team urgency" />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#0f2044', color: 'white', padding: '0.625rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
          {toast}
        </div>
      )}

      {/* Overall average summary */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ background: avgBg, borderRadius: 14, padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: avgColor, lineHeight: 1 }}>{avgScore || '—'}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: avgColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>Avg / 5</span>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '1rem' }}>Your Urgency Self-Assessment</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}>{avgLabel}</p>
          <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 8, maxWidth: 320 }}>
            <div style={{ height: 8, borderRadius: 9999, background: avgColor, width: `${(avgScore / 5) * 100}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>{ratedTips.length} of {tips.length} tips rated</p>
        </div>
        <button className="btn-primary" onClick={saveRecord} disabled={saving || ratedTips.length === 0}
          style={{ alignSelf: 'center', padding: '0.5rem 1.25rem', opacity: ratedTips.length === 0 ? 0.5 : 1 }}>
          {saving ? 'Saving…' : '💾 Save Assessment'}
        </button>
      </div>

      {/* Last saved dates + records */}
      {records.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.9rem' }}>Assessment Records</h4>

          {/* Last saved per type */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ background: '#ede9fe', borderRadius: 10, padding: '0.5rem 0.875rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Individual Save</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5b21b6' }}>{lastIndividual ? fmtDate(lastIndividual.savedAt) : '—'}</div>
              {lastIndividual?.individualAvg && <div style={{ fontSize: '0.72rem', color: '#7c3aed' }}>Avg: {lastIndividual.individualAvg} / 5</div>}
            </div>
            <div style={{ background: '#dbeafe', borderRadius: 10, padding: '0.5rem 0.875rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Team Save</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>{lastTeam ? fmtDate(lastTeam.savedAt) : '—'}</div>
              {lastTeam?.teamAvg && <div style={{ fontSize: '0.72rem', color: '#1d4ed8' }}>Avg: {lastTeam.teamAvg} / 5</div>}
            </div>
          </div>

          {/* Record history list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {records.map((rec, i) => {
              const indTips = tips.filter(t => t.type === 'individual' && rec.ratings?.[t.title] > 0);
              const teamTipsRated = tips.filter(t => t.type === 'team' && rec.ratings?.[t.title] > 0);
              return (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.875rem', background: i === 0 ? '#f0f9ff' : '#f8fafc', borderRadius: 10, border: `1px solid ${i === 0 ? '#bae6fd' : '#e2e8f0'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {i === 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#0284c7', color: 'white', padding: '1px 7px', borderRadius: 9999 }}>Latest</span>}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(rec.savedAt)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 600 }}>
                        Individual: {rec.individualAvg ?? '—'} / 5 ({indTips.length} rated)
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600 }}>
                        Team: {rec.teamAvg ?? '—'} / 5 ({teamTipsRated.length} rated)
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                        Overall: {rec.overallAvg} / 5
                      </span>
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={() => loadRecord(rec)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', flexShrink: 0 }}>
                    Load
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1rem' }}>Urgency Tips & Strategies</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all','individual','team'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: filter === f ? '#0f2044' : '#f1f5f9', color: filter === f ? '#fff' : '#475569' }}>
              {f === 'all' ? 'All Tips' : f === 'individual' ? 'Individual' : 'Team'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '0.875rem', marginBottom: '1.75rem' }}>
        {filtered.map(tip => {
          const val = ratings[tip.title] || 0;
          const rl = rateLabel(val);
          return (
            <div key={tip.title} className="card" style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Header */}
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{tip.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: 0 }}>{tip.title}</h4>
                    <span style={{ padding: '1px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700, background: tip.type === 'team' ? '#dbeafe' : '#ede9fe', color: tip.type === 'team' ? '#1d4ed8' : '#7c3aed' }}>{tip.type}</span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>{tip.desc}</p>
                </div>
              </div>
              {/* Per-tip rating */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How well do you practice this?</p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[1,2,3,4,5].map(n => {
                    const c = scoreColor(n);
                    return (
                      <button key={n} onClick={() => setRatings(r => ({ ...r, [tip.title]: n }))}
                        style={{ width: 34, height: 34, borderRadius: '50%', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
                          background: n <= val ? c.bg : 'transparent',
                          border: `2px solid ${n <= val ? c.border : '#e2e8f0'}`,
                          color: n <= val ? c.text : '#94a3b8' }}>
                        {n}
                      </button>
                    );
                  })}
                  {val > 0 && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: scoreColor(val).text, marginLeft: 6 }}>
                      {rl.icon} {rl.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reflection */}
      <div style={{ borderRadius: 16, padding: '1.5rem', background: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border: '1px solid #bbf7d0' }}>
        <h3 style={{ fontWeight: 800, color: '#166534', margin: '0 0 4px', fontSize: '1rem' }}>Daily Reflection Prompt</h3>
        <p style={{ fontSize: '0.78rem', color: '#15803d', margin: '0 0 14px' }}>Take 2 minutes to reflect on urgency</p>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '0.875rem', boxShadow: '0 1px 4px rgba(15,32,68,0.06)' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>"{reflectionQuestions[reflectionIdx]}"</p>
        </div>
        <textarea className="input" rows={3} placeholder="Write your reflection here..." value={answers[reflectionIdx] || ''} onChange={e => setAnswers(a => ({ ...a, [reflectionIdx]: e.target.value }))} style={{ marginBottom: '0.875rem', background: 'white' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setReflectionIdx(i => (i - 1 + reflectionQuestions.length) % reflectionQuestions.length)}>← Previous</button>
          <button className="btn-primary" onClick={() => setReflectionIdx(i => (i + 1) % reflectionQuestions.length)}>Next →</button>
          <span style={{ fontSize: '0.75rem', color: '#15803d', marginLeft: 'auto', fontWeight: 600 }}>{reflectionIdx + 1}/{reflectionQuestions.length}</span>
        </div>
      </div>
    </div>
  );
}
