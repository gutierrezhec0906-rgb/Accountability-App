import { useState } from 'react';

const tips = [
  { title: 'Set Clear Deadlines', desc: 'Every task should have a specific, non-negotiable deadline. Vague timelines breed complacency.', icon: '📅', type: 'individual' },
  { title: 'Communicate the "Why"', desc: 'People move faster when they understand why urgency matters. Connect tasks to mission and impact.', icon: '💬', type: 'team' },
  { title: 'Remove Obstacles Fast', desc: 'Leaders who remove blockers within hours instead of days set the pace for urgency culture.', icon: '🚧', type: 'team' },
  { title: 'Model Urgency Yourself', desc: 'Respond to emails in < 4 hours. Show up on time. Your behavior sets the standard.', icon: '⚡', type: 'individual' },
  { title: 'Use Visual Boards', desc: 'Make progress visible. When teams see stagnation, they self-correct faster.', icon: '📊', type: 'team' },
  { title: 'Daily Stand-ups', desc: 'Short, focused daily check-ins maintain momentum and surface blockers quickly.', icon: '🏃', type: 'team' },
  { title: 'Celebrate Speed Wins', desc: 'Recognize team members who complete tasks ahead of schedule. What gets rewarded, gets repeated.', icon: '🏆', type: 'team' },
  { title: 'Break Tasks Smaller', desc: 'Smaller deliverables create more frequent "done" moments, sustaining urgency throughout the day.', icon: '✂️', type: 'individual' },
  { title: 'Limit Meetings', desc: 'Excessive meetings kill urgency. Move decision-making out of meeting rooms and into action.', icon: '🚫', type: 'team' },
  { title: 'Time-Box Everything', desc: 'Use time-boxing techniques (Pomodoro, sprints) to create artificial pressure and focused output.', icon: '⏱', type: 'individual' },
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sense of Urgency Guide</h1>
        <p className="text-slate-500 text-sm">Tools and reflection for individual and team urgency</p>
      </div>

      {/* Self-Assessment */}
      <div className="card p-5">
        <h3 className="font-bold text-slate-700 mb-4">Quick Urgency Self-Assessment</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            { label: 'My Personal Urgency Level Today', value: selfScore, set: setSelfScore },
            { label: 'My Team\'s Urgency Level Today', value: teamScore, set: setTeamScore },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <p className="text-sm font-semibold text-slate-600 mb-2">{label}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => set(n)}
                    className="flex-1 py-2 rounded-lg font-bold text-sm transition-all border-2"
                    style={n <= value
                      ? { background: n <= 2 ? '#fee2e2' : n <= 3 ? '#fef9c3' : '#dcfce7', borderColor: n <= 2 ? '#ef4444' : n <= 3 ? '#eab308' : '#16a34a', color: n <= 2 ? '#dc2626' : n <= 3 ? '#ca8a04' : '#16a34a' }
                      : { borderColor: '#e2e8f0', color: '#94a3b8' }}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {value === 0 ? 'Rate yourself' : value <= 2 ? '⚠️ Needs attention — slow pace' : value <= 3 ? '🟡 Moderate — room for improvement' : '✅ Good urgency level'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold text-slate-700">Urgency Tips & Strategies</h3>
          <div className="flex gap-2">
            {['all', 'individual', 'team'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${filter === f ? 'text-white' : 'bg-slate-100 text-slate-600'}`}
                style={filter === f ? { background: '#0f2044' } : {}}>
                {f === 'all' ? 'All Tips' : f === 'individual' ? 'Individual' : 'Team'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(tip => (
            <div key={tip.title} className="card p-4 flex gap-3">
              <span className="text-2xl flex-shrink-0">{tip.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-slate-700 text-sm">{tip.title}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tip.type === 'team' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{tip.type}</span>
                </div>
                <p className="text-sm text-slate-600">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reflection Tool */}
      <div className="card p-5" style={{ background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)' }}>
        <h3 className="font-bold text-slate-700 mb-1">Daily Reflection Prompt</h3>
        <p className="text-xs text-slate-500 mb-4">Take 2 minutes to reflect on urgency</p>
        <div className="bg-white rounded-xl p-4 mb-3">
          <p className="font-medium text-slate-700">"{reflectionQuestions[reflectionIdx]}"</p>
        </div>
        <textarea
          className="input mb-3"
          rows={3}
          placeholder="Write your reflection here..."
          value={answers[reflectionIdx] || ''}
          onChange={e => setAnswers(a => ({ ...a, [reflectionIdx]: e.target.value }))}
        />
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" onClick={() => setReflectionIdx(i => (i - 1 + reflectionQuestions.length) % reflectionQuestions.length)}>← Previous</button>
          <button className="btn-primary text-xs" onClick={() => setReflectionIdx(i => (i + 1) % reflectionQuestions.length)}>Next Question →</button>
          <span className="text-xs text-slate-400 self-center ml-auto">{reflectionIdx + 1}/{reflectionQuestions.length}</span>
        </div>
      </div>
    </div>
  );
}
