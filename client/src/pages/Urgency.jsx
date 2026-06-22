import { useState } from 'react';
import PageHeader from '../components/PageHeader';

const tips = [
  { title: 'Set Clear Deadlines',    desc: 'Every task should have a specific, non-negotiable deadline. Vague timelines breed complacency.',                  icon: '📅', type: 'individual' },
  { title: 'Communicate the "Why"', desc: 'People move faster when they understand why urgency matters. Connect tasks to mission and impact.',                icon: '💬', type: 'team'       },
  { title: 'Remove Obstacles Fast', desc: 'Leaders who remove blockers within hours instead of days set the pace for urgency culture.',                     icon: '🚧', type: 'team'       },
  { title: 'Model Urgency Yourself',desc: 'Respond to emails in < 4 hours. Show up on time. Your behavior sets the standard.',                             icon: '⚡', type: 'individual' },
  { title: 'Use Visual Boards',     desc: 'Make progress visible. When teams see stagnation, they self-correct faster.',                                    icon: '📊', type: 'team'       },
  { title: 'Daily Stand-ups',       desc: 'Short, focused daily check-ins maintain momentum and surface blockers quickly.',                                 icon: '🏃', type: 'team'       },
  { title: 'Celebrate Speed Wins',  desc: 'Recognize team members who complete tasks ahead of schedule. What gets rewarded gets repeated.',                 icon: '🏆', type: 'team'       },
  { title: 'Break Tasks Smaller',   desc: 'Smaller deliverables create more frequent "done" moments, sustaining urgency throughout the day.',               icon: '✂️', type: 'individual' },
  { title: 'Limit Meetings',        desc: 'Excessive meetings kill urgency. Move decision-making out of meeting rooms and into action.',                    icon: '🚫', type: 'team'       },
  { title: 'Time-Box Everything',   desc: 'Use time-boxing techniques (Pomodoro, sprints) to create artificial pressure and focused output.',              icon: '⏱', type: 'individual' },
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

export default function Urgency() {
  const [filter, setFilter] = useState('all');
  const [reflectionIdx, setReflectionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selfScore, setSelfScore] = useState(0);
  const [teamScore, setTeamScore] = useState(0);

  const filtered = filter === 'all' ? tips : tips.filter(t => t.type === filter);

  function scoreColor(n) {
    if (n <= 2) return { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' };
    if (n <= 3) return { bg: '#fef9c3', border: '#eab308', text: '#b45309' };
    return { bg: '#dcfce7', border: '#22c55e', text: '#15803d' };
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="⚡" title="Sense of Urgency Guide" subtitle="Tools and reflection for individual and team urgency" />

      {/* Self-assessment */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Quick Urgency Self-Assessment</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {[
            { label: 'My Personal Urgency Level Today', value: selfScore, set: setSelfScore },
            { label: "My Team's Urgency Level Today",  value: teamScore, set: setTeamScore },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.625rem' }}>{label}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4,5].map(n => {
                  const c = scoreColor(n);
                  return (
                    <button key={n} onClick={() => set(n)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: 10, fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s',
                        background: n <= value ? c.bg : 'transparent',
                        border: `2px solid ${n <= value ? c.border : '#e2e8f0'}`,
                        color: n <= value ? c.text : '#94a3b8' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                {value === 0 ? 'Rate yourself' : value <= 2 ? '⚠️ Needs attention' : value <= 3 ? '🟡 Room to improve' : '✅ Good urgency'}
              </p>
            </div>
          ))}
        </div>
      </div>

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
        {filtered.map(tip => (
          <div key={tip.title} className="card" style={{ padding: '1.125rem', display: 'flex', gap: 12 }}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{tip.icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: 0 }}>{tip.title}</h4>
                <span style={{ padding: '1px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700, background: tip.type === 'team' ? '#dbeafe' : '#ede9fe', color: tip.type === 'team' ? '#1d4ed8' : '#7c3aed' }}>{tip.type}</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>{tip.desc}</p>
            </div>
          </div>
        ))}
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
