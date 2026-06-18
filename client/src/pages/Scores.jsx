import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const moduleScores = [
  { id: 'visual-board', label: 'Visual Mgmt Board', icon: '🔴', weight: 1 },
  { id: 'training', label: 'Training Center', icon: '🎓', weight: 1.2 },
  { id: 'coaching', label: 'Coaching Log', icon: '📝', weight: 1 },
  { id: 'mentoring', label: 'Mentoring Tracker', icon: '🤝', weight: 1 },
  { id: 'skills', label: 'Skills Development', icon: '⭐', weight: 1.5 },
  { id: 'lob', label: 'Line of Balance', icon: '📈', weight: 1 },
  { id: 'urgency', label: 'Sense of Urgency', icon: '⚡', weight: 1 },
  { id: 'feedback', label: 'Feedback Box', icon: '📬', weight: 1.2 },
  { id: 'problem-solving', label: 'Problem Solving', icon: '🔍', weight: 1.3 },
  { id: 'vision', label: 'Vision Builder', icon: '🔭', weight: 1 },
  { id: 'lean', label: 'Lean Toolkit', icon: '🏭', weight: 1 },
  { id: 'mindfulness', label: 'Mindfulness', icon: '🧘', weight: 0.8 },
  { id: 'career', label: 'Career Development', icon: '🚀', weight: 1.2 },
  { id: 'disc', label: 'DISC Assessment', icon: '🎯', weight: 1 },
  { id: 'eq-opex', label: 'EQ & OpEx', icon: '💡', weight: 1.5 },
];

const recommendations = {
  1: 'Critical focus needed. Dedicate time daily to this area.',
  2: 'Significant improvement opportunity. Set weekly goals.',
  3: 'Developing well. Look for specific gaps to address.',
  4: 'Strong performance. Mentor others in this area.',
  5: 'Mastery level. Share your best practices with the team.',
};

const peers = ['Alex Johnson', 'Maria Garcia', 'Sam Chen', 'Lisa Park', 'David Torres'];

export default function Scores() {
  const [scores, setScores] = useState({});
  const [peerRequests, setPeerRequests] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState('');
  const [selectedModule, setSelectedModule] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('module-scores');
    if (saved) {
      setScores(JSON.parse(saved));
    } else {
      const demo = {};
      moduleScores.forEach(m => { demo[m.id] = Math.floor(Math.random() * 2) + 3; });
      setScores(demo);
      localStorage.setItem('module-scores', JSON.stringify(demo));
    }
  }, []);

  function updateScore(id, val) {
    const next = { ...scores, [id]: val };
    setScores(next);
    localStorage.setItem('module-scores', JSON.stringify(next));
  }

  function requestReview(e) {
    e.preventDefault();
    if (!selectedPeer || !selectedModule) return toast.error('Select a peer and module');
    setPeerRequests(r => [...r, { peer: selectedPeer, module: selectedModule, date: new Date().toLocaleDateString(), status: 'Pending' }]);
    setSelectedPeer(''); setSelectedModule('');
    toast.success(`Review requested from ${selectedPeer}`);
  }

  const weightedSum = moduleScores.reduce((a, m) => a + (scores[m.id] || 0) * m.weight, 0);
  const totalWeight = moduleScores.reduce((a, m) => a + m.weight, 0);
  const overallScore = totalWeight ? (weightedSum / totalWeight).toFixed(1) : '0.0';

  const r = 60;
  const circ = 2 * Math.PI * r;
  const dash = (parseFloat(overallScore) / 5) * circ;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Score Dashboard</h1>
        <p className="text-slate-500 text-sm">Your accountability index with per-module ratings and peer reviews</p>
      </div>

      <div className="card p-6 flex items-center gap-6 flex-wrap" style={{ background: 'linear-gradient(135deg, #0f2044, #1e3a6e)', color: 'white' }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
          <circle cx="80" cy="80" r={r} fill="none" stroke="#14b8a6" strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 80 80)"
            style={{ transition: 'stroke-dasharray 1s ease' }} />
          <text x="80" y="76" textAnchor="middle" fontSize="28" fontWeight="900" fill="white">{overallScore}</text>
          <text x="80" y="96" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">out of 5.0</text>
        </svg>
        <div className="flex-1">
          <h2 className="text-3xl font-black">Accountability Score</h2>
          <p className="text-slate-300 mt-1">
            {parseFloat(overallScore) >= 4.5 ? '🏆 Exceptional Leader' : parseFloat(overallScore) >= 4 ? '⭐ High Performer' : parseFloat(overallScore) >= 3 ? '📈 Developing Leader' : '🔄 Focus & Growth Needed'}
          </p>
          <p className="text-sm text-slate-400 mt-2">Weighted across {moduleScores.length} accountability modules</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 font-bold text-white text-sm" style={{ background: '#0f2044' }}>Module Scores — Click dots to rate (1–5)</div>
        <div className="divide-y divide-slate-100">
          {moduleScores.map(m => {
            const s = scores[m.id] || 0;
            const scoreColor = s >= 4 ? '#0d9488' : s >= 3 ? '#f59e0b' : '#ef4444';
            return (
              <div key={m.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                <span className="text-xl w-8 flex-shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-36">
                  <p className="text-sm font-semibold text-slate-700">{m.label}</p>
                  {s > 0 && <p className="text-xs text-slate-400 mt-0.5">{recommendations[s]}</p>}
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => updateScore(m.id, n)}
                      className="w-8 h-8 rounded-full text-xs font-bold transition-all border-2"
                      style={n <= s
                        ? { background: scoreColor, borderColor: 'transparent', color: 'white' }
                        : { borderColor: '#e2e8f0', color: '#94a3b8' }}>
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-lg font-black w-6 text-right" style={{ color: s > 0 ? scoreColor : '#94a3b8' }}>{s || '—'}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-slate-700 mb-4">Request Peer Review</h3>
        <form onSubmit={requestReview} className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Select Peer</label>
            <select className="input" value={selectedPeer} onChange={e => setSelectedPeer(e.target.value)}>
              <option value="">Choose peer...</option>
              {peers.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Module to Review</label>
            <select className="input" value={selectedModule} onChange={e => setSelectedModule(e.target.value)}>
              <option value="">Choose module...</option>
              {moduleScores.map(m => <option key={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary" type="submit">Request Review</button>
          </div>
        </form>

        {peerRequests.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pending Reviews</p>
            {peerRequests.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-sm p-3 bg-slate-50 rounded-lg">
                <span className="badge-yellow">{r.status}</span>
                <span className="text-slate-700">{r.peer}</span>
                <span className="text-slate-400">→</span>
                <span className="text-slate-600">{r.module}</span>
                <span className="text-slate-400 ml-auto text-xs">{r.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
