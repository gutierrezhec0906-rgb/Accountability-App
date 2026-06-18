import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const modules = [
  { id: 'visual-board', label: 'Visual Mgmt Board', icon: '🔴', path: '/visual-board' },
  { id: 'training', label: 'Training Center', icon: '🎓', path: '/training' },
  { id: 'coaching', label: 'Coaching Log', icon: '📝', path: '/coaching' },
  { id: 'mentoring', label: 'Mentoring Tracker', icon: '🤝', path: '/mentoring' },
  { id: 'skills', label: 'Skills Development', icon: '⭐', path: '/skills' },
  { id: 'lob', label: 'Line of Balance', icon: '📈', path: '/lob' },
  { id: 'feedback', label: 'Feedback Box', icon: '📬', path: '/feedback' },
  { id: 'problem-solving', label: 'Problem Solving', icon: '🔍', path: '/problem-solving' },
  { id: 'vision', label: 'Vision Builder', icon: '🔭', path: '/vision' },
  { id: 'lean', label: 'Lean Toolkit', icon: '🏭', path: '/lean' },
  { id: 'mindfulness', label: 'Mindfulness', icon: '🧘', path: '/mindfulness' },
  { id: 'career', label: 'Career Development', icon: '🚀', path: '/career' },
  { id: 'disc', label: 'DISC Assessment', icon: '🎯', path: '/disc' },
  { id: 'eq-opex', label: 'EQ & OpEx', icon: '💡', path: '/eq-opex' },
  { id: 'scores', label: 'Score Dashboard', icon: '🏆', path: '/scores' },
  { id: 'urgency', label: 'Sense of Urgency', icon: '⚡', path: '/urgency' },
];

function ScoreRing({ score, max = 5 }) {
  const pct = (score / max) * 100;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#0d9488" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f766e">{score.toFixed(1)}</text>
    </svg>
  );
}

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState({});
  const [pendingReviews, setPendingReviews] = useState(2);

  useEffect(() => {
    const saved = localStorage.getItem('module-scores');
    if (saved) setScores(JSON.parse(saved));
    else {
      const demo = {};
      modules.forEach(m => { demo[m.id] = +(Math.random() * 2 + 3).toFixed(1); });
      setScores(demo);
    }
  }, []);

  const vals = Object.values(scores);
  const avg = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;

  const recentActivity = [
    { text: 'Completed 5S Checklist', time: '2h ago', icon: '✅' },
    { text: 'Added coaching session note', time: '5h ago', icon: '📝' },
    { text: 'Peer review requested from Alex', time: '1d ago', icon: '🤝' },
    { text: 'Updated career milestone', time: '2d ago', icon: '🚀' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="rounded-xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #0f2044, #1e3a6e)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {currentUser?.displayName?.split(' ')[0] || 'Leader'}! 👋</h1>
            <p className="text-slate-300 mt-1">{userProfile?.role || 'Leader'} · Track your accountability and growth</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <ScoreRing score={avg} />
              <p className="text-xs text-slate-300 mt-1">Overall Score</p>
            </div>
            {pendingReviews > 0 && (
              <div className="bg-yellow-400 text-yellow-900 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">{pendingReviews}</p>
                <p className="text-xs font-semibold">Peer Reviews<br/>Pending</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Overall Score', value: `${avg}/5`, sub: 'accountability index', color: '#0d9488' },
          { label: 'Modules Active', value: `${modules.length}`, sub: 'tools available', color: '#1e3a6e' },
          { label: 'Peer Reviews', value: pendingReviews, sub: 'awaiting response', color: '#f59e0b' },
          { label: 'Streak', value: '7 days', sub: 'consecutive logins', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Module Grid */}
        <div className="lg:col-span-2">
          <h3 className="text-base font-bold text-slate-700 mb-3">Your Modules</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {modules.map(m => {
              const s = scores[m.id] || 0;
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(m.path)}
                  className="card p-4 text-left hover:shadow-md transition-all hover:-translate-y-0.5 group"
                >
                  <div className="text-2xl mb-2">{m.icon}</div>
                  <p className="text-xs font-bold text-slate-700 leading-tight mb-2">{m.label}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${(s / 5) * 100}%`, background: '#0d9488' }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: '#0d9488' }}>{s}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-base font-bold text-slate-700 mb-3">Recent Activity</h3>
          <div className="card p-4 space-y-3">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-lg">{a.icon}</span>
                <div>
                  <p className="text-sm text-slate-700 font-medium">{a.text}</p>
                  <p className="text-xs text-slate-400">{a.time}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-base font-bold text-slate-700 mt-5 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: '+ Log Coaching Session', path: '/coaching' },
              { label: '+ Submit Feedback', path: '/feedback' },
              { label: '+ Update Skills Matrix', path: '/skills' },
              { label: '+ Request Peer Review', path: '/scores' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)} className="btn-secondary w-full justify-start text-left text-xs">
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
