import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { calculateScore } from '../utils/scoring';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const BREAKDOWN_CONFIG = [
  { key: 'breadth',   label: 'Tool Diversity',     max: 20, icon: '🗂', desc: 'How many different tools you use' },
  { key: 'frequency', label: 'Consistency',         max: 20, icon: '📅', desc: 'How regularly you use the app (last 30 days)' },
  { key: 'depth',     label: 'Session Depth',       max: 15, icon: '⏱', desc: 'Quality time spent per tool session' },
  { key: 'quality',   label: 'Entry Quality',       max: 25, icon: '✍️', desc: 'Completeness and depth of your entries' },
  { key: 'smart',     label: 'SMART Goals',         max: 10, icon: '🎯', desc: 'Active and completed SMART goals' },
  { key: 'evidence',  label: 'Evidence & AI',       max: 10, icon: '🤖', desc: 'Attachments and AI-assessed purposefulness (coming soon)' },
];

function ScoreGauge({ score }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? '#0d9488' : score >= 50 ? '#f59e0b' : score >= 25 ? '#f97316' : '#ef4444';
  const label = score >= 75 ? '🏆 Exceptional' : score >= 50 ? '⭐ High Performer' : score >= 25 ? '📈 Developing' : '🔄 Getting Started';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dasharray 1.2s ease' }} />
        <text x="90" y="84" textAnchor="middle" fontSize="36" fontWeight="900" fill="white">{score}</text>
        <text x="90" y="104" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.6)">out of 100</text>
      </svg>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '0.9rem' }}>{label}</span>
    </div>
  );
}

function BreakdownBar({ label, icon, desc, value, max }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 75 ? '#0d9488' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: '1.25rem', width: 28, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{label}</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 800, color }}>{value}<span style={{ color: '#94a3b8', fontWeight: 400 }}>/{max}</span></span>
        </div>
        <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 7 }}>
          <div style={{ height: 7, borderRadius: 9999, background: color, width: `${pct}%`, transition: 'width 1s ease' }} />
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.72rem', margin: '4px 0 0' }}>{desc}</p>
      </div>
    </div>
  );
}

export default function Scores() {
  const { currentUser, userProfile } = useAuth();
  const [score, setScore] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [teamScores, setTeamScores] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const canSeeTeam = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';

  // Load persisted score on mount
  useEffect(() => {
    if (userProfile?.calculatedScore !== undefined) {
      setScore(userProfile.calculatedScore);
      setBreakdown(userProfile.scoreBreakdown || null);
      if (userProfile.scoreUpdatedAt) {
        const d = userProfile.scoreUpdatedAt.toDate?.();
        if (d) setLastUpdated(d.toLocaleString());
      }
    }
  }, [userProfile]);

  // Load team scores for leaders/admins
  useEffect(() => {
    if (!canSeeTeam) return;
    async function fetchTeam() {
      setLoadingTeam(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const members = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(m => m.uid !== currentUser.uid && m.status === 'approved')
          .sort((a, b) => (b.calculatedScore || 0) - (a.calculatedScore || 0));
        setTeamScores(members);
      } catch {}
      setLoadingTeam(false);
    }
    fetchTeam();
  }, [canSeeTeam]);

  async function handleCalculate() {
    setCalculating(true);
    try {
      const result = await calculateScore(currentUser.uid);
      setScore(result.total);
      setBreakdown(result.breakdown);
      setLastUpdated(new Date().toLocaleString());
      toast.success('Score updated!');
    } catch (e) {
      toast.error('Could not calculate score. Try again.');
    }
    setCalculating(false);
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-6">
      <PageHeader icon="📊" title="Accountability Score" subtitle="Calculated by the app based on how you use your tools — not self-reported." />

      {/* Score hero */}
      <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 60%, #0d9488 100%)', color: 'white', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <ScoreGauge score={score ?? 0} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 8px', color: 'white' }}>
            {currentUser?.displayName?.split(' ')[0]}'s Score
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: '0 0 20px', lineHeight: 1.6 }}>
            Your score grows as you use the app with purpose — more tools, deeper entries, consistent habits, and completed SMART goals.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={handleCalculate}
              disabled={calculating}
              style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: calculating ? 'not-allowed' : 'pointer' }}
            >
              {calculating ? '⏳ Calculating...' : '🔄 Calculate My Score'}
            </button>
            {lastUpdated && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>Last updated: {lastUpdated}</span>}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 800, color: '#1e293b', marginBottom: 4, fontSize: '1rem' }}>Score Breakdown</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 16 }}>Each category contributes to your total. Click "Calculate" to refresh.</p>
        {BREAKDOWN_CONFIG.map(c => (
          <BreakdownBar key={c.key} {...c} value={breakdown?.[c.key] ?? 0} />
        ))}
      </div>

      {/* How to improve */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 800, color: '#1e293b', marginBottom: 16, fontSize: '1rem' }}>How to Improve Your Score</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { icon: '🗂', tip: 'Use more tools across the app — diversity matters.' },
            { icon: '📅', tip: 'Log in consistently. Aim for daily or weekly sessions.' },
            { icon: '⏱', tip: 'Spend meaningful time per tool — 5+ minutes per session.' },
            { icon: '✍️', tip: 'Fill SMART goal fields with detail — aim for 30+ words each.' },
            { icon: '🎯', tip: 'Create active SMART goals and mark them complete.' },
            { icon: '🤖', tip: 'Attach evidence to entries (AI assessment coming soon).' },
          ].map((item, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem', display: 'flex', gap: 10 }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{item.icon}</span>
              <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>{item.tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team scores — leaders/admins only */}
      {canSeeTeam && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', background: '#0f2044' }}>
            <h3 style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Team Accountability Scores</h3>
          </div>
          {loadingTeam ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading team...</div>
          ) : teamScores.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No approved team members yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '0.625rem 1.25rem', color: '#64748b', fontWeight: 600 }}>Member</th>
                  <th style={{ textAlign: 'left', padding: '0.625rem 1rem', color: '#64748b', fontWeight: 600 }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '0.625rem 1rem', color: '#64748b', fontWeight: 600, minWidth: 160 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {teamScores.map((m, i) => {
                  const s = m.calculatedScore ?? 0;
                  const color = s >= 75 ? '#0d9488' : s >= 50 ? '#f59e0b' : s >= 25 ? '#f97316' : '#94a3b8';
                  return (
                    <tr key={m.uid} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: '#1e293b' }}>{m.displayName || m.email}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{m.role}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 6 }}>
                            <div style={{ height: 6, borderRadius: 9999, background: color, width: `${s}%`, transition: 'width 1s' }} />
                          </div>
                          <span style={{ fontWeight: 800, color, minWidth: 28 }}>{s}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
