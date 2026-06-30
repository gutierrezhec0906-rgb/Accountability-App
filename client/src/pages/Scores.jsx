import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { calculateScore } from '../utils/scoring';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const BREAKDOWN_CONFIG = [
  { key: 'breadth',   label: 'Tool Diversity',  max: 20, icon: '🗂',  desc: 'How many different tools you use' },
  { key: 'frequency', label: 'Consistency',      max: 20, icon: '📅',  desc: 'How regularly you use the app (last 30 days)' },
  { key: 'depth',     label: 'Session Depth',    max: 15, icon: '⏱',  desc: 'Quality time spent per tool session' },
  { key: 'quality',   label: 'Entry Quality',    max: 25, icon: '✍️', desc: 'Completeness and depth of your entries' },
  { key: 'smart',     label: 'SMART Goals',      max: 10, icon: '🎯',  desc: 'Active and completed SMART goals' },
  { key: 'evidence',  label: 'Evidence & AI',    max: 10, icon: '🤖',  desc: 'Attachments and AI-assessed purposefulness (coming soon)' },
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

// Smooth SVG line chart matching reference style
function ScoreLineChart({ history }) {
  const W = 480, H = 160, PAD_L = 40, PAD_R = 16, PAD_T = 12, PAD_B = 32;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (history.length === 0) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center', padding: '0 1rem' }}>
        Calculate your score to start tracking the trend
      </div>
    );
  }

  // Single point — show as a labelled dot
  if (history.length === 1) {
    const d = new Date(history[0].date + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return (
      <div style={{ height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="22" fill="#f0fdfa" stroke="#0d9488" strokeWidth="3" />
          <text x="30" y="34" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0d9488">{history[0].score}</text>
        </svg>
        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>{label} — calculate again tomorrow to see your trend</p>
      </div>
    );
  }

  const scores = history.map(h => h.score);
  const minS = Math.max(0, Math.min(...scores) - 5);
  const maxS = Math.min(100, Math.max(...scores) + 5);
  const range = maxS - minS || 1;

  function px(i) { return PAD_L + (i / (history.length - 1)) * chartW; }
  function py(s) { return PAD_T + chartH - ((s - minS) / range) * chartH; }

  // Smooth bezier path
  const points = history.map((h, i) => [px(i), py(h.score)]);
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1][0] + points[i][0]) / 2;
    d += ` C ${cpx} ${points[i - 1][1]}, ${cpx} ${points[i][1]}, ${points[i][0]} ${points[i][1]}`;
  }
  // Fill area under curve
  const fillD = d + ` L ${points[points.length - 1][0]} ${PAD_T + chartH} L ${points[0][0]} ${PAD_T + chartH} Z`;

  // Y-axis grid lines (4 lines)
  const yTicks = Array.from({ length: 4 }, (_, i) => Math.round(minS + (range / 3) * i));

  // X-axis date labels — show max 4 labels
  const step = Math.ceil(history.length / 4);
  const xLabels = history.filter((_, i) => i % step === 0 || i === history.length - 1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
        <clipPath id="chartClip">
          <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {yTicks.map(tick => {
        const y = py(tick);
        return (
          <g key={tick}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{tick}</text>
          </g>
        );
      })}

      {/* Fill */}
      <path d={fillD} fill="url(#scoreGrad)" clipPath="url(#chartClip)" />

      {/* Line */}
      <path d={d} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#chartClip)" />

      {/* Dots on each point */}
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke="#0d9488" strokeWidth="2" clipPath="url(#chartClip)" />
      ))}

      {/* X-axis labels */}
      {xLabels.map((h, i) => {
        const idx = history.indexOf(h);
        const d = new Date(h.date + 'T00:00:00');
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <text key={i} x={px(idx)} y={H - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">{label}</text>
        );
      })}

      {/* Baseline */}
      <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

function DailyMovementFeed({ logs }) {
  if (logs.length === 0) return (
    <p style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>
      No point events yet — calculate your score or use tools to start tracking.
    </p>
  );

  // Group events by date, newest first
  const byDate = {};
  logs.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 14);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
      {dates.map((date, di) => {
        const events = byDate[date];
        const netDelta = events.reduce((sum, e) => sum + e.points, 0);
        const d = new Date(date + 'T00:00:00');
        const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return (
          <div key={date} style={{ borderRadius: 10, border: `1px solid ${di === 0 ? '#99f6e4' : '#f1f5f9'}`, overflow: 'hidden' }}>
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: di === 0 ? '#f0fdfa' : '#f8fafc' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>{dateLabel}</span>
              <span style={{
                padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 800,
                background: netDelta > 0 ? '#dcfce7' : netDelta < 0 ? '#fee2e2' : '#f1f5f9',
                color: netDelta > 0 ? '#15803d' : netDelta < 0 ? '#dc2626' : '#64748b',
              }}>
                {netDelta > 0 ? `+${netDelta}` : netDelta === 0 ? '—' : netDelta} pts net
              </span>
            </div>
            {/* Individual events */}
            {events.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '0.45rem 0.75rem', borderTop: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                <span style={{
                  padding: '1px 7px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 800, flexShrink: 0, marginTop: 2,
                  background: ev.points > 0 ? '#dcfce7' : '#fee2e2',
                  color: ev.points > 0 ? '#15803d' : '#dc2626',
                }}>
                  {ev.points > 0 ? `+${ev.points}` : ev.points}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e293b', margin: '0 0 1px' }}>{ev.toolLabel}</p>
                  <p style={{ fontSize: '0.68rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>{ev.reason}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function Scores() {
  const { currentUser, userProfile } = useAuth();
  const [score, setScore]           = useState(null);
  const [breakdown, setBreakdown]   = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [teamScores, setTeamScores] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [history, setHistory]       = useState([]);
  const [pointsLog, setPointsLog]   = useState([]);

  const canSeeTeam = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';

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

  useEffect(() => {
    if (!currentUser) return;
    async function fetchHistory() {
      try {
        const [histSnap, logSnap] = await Promise.all([
          getDocs(query(collection(db, 'scoreHistory'), where('uid', '==', currentUser.uid))),
          getDocs(query(collection(db, 'pointsLog'),    where('uid', '==', currentUser.uid))),
        ]);
        const entries = histSnap.docs.map(d => d.data());
        entries.sort((a, b) => a.date.localeCompare(b.date));
        setHistory(entries);

        const logs = logSnap.docs.map(d => d.data());
        logs.sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });
        setPointsLog(logs);
      } catch (e) {
        console.error('history fetch error:', e);
      }
    }
    fetchHistory();
  }, [currentUser, score]);

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

  // Today's delta vs yesterday
  const todayEntry = history[history.length - 1];
  const prevEntry  = history[history.length - 2];
  const todayDelta = todayEntry && prevEntry ? todayEntry.score - prevEntry.score : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} className="space-y-6">
      <PageHeader icon="📊" title="Accountability Score" subtitle="Calculated by the app based on how you use your tools — not self-reported." />

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Score hero */}
          <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 60%, #0d9488 100%)', color: 'white', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <ScoreGauge score={score ?? 0} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 8px', color: 'white' }}>
                {currentUser?.displayName?.split(' ')[0]}'s Score
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: '0 0 16px', lineHeight: 1.6 }}>
                Your score grows as you use the app with purpose — more tools, deeper entries, consistent habits, and completed SMART goals.
              </p>
              {todayDelta !== null && (
                <div style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.4rem 0.875rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>Today's movement:</span>
                  <span style={{ fontWeight: 900, fontSize: '1rem', color: todayDelta > 0 ? '#86efac' : todayDelta < 0 ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                    {todayDelta > 0 ? `+${todayDelta}` : todayDelta === 0 ? '—' : todayDelta} pts
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={handleCalculate} disabled={calculating}
                  style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: calculating ? 'not-allowed' : 'pointer' }}>
                  {calculating ? '⏳ Calculating...' : '🔄 Calculate My Score'}
                </button>
                {lastUpdated && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>Last updated: {lastUpdated}</span>}
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { icon: '🗂',  tip: 'Use more tools across the app — diversity matters.' },
                { icon: '📅',  tip: 'Log in consistently. Aim for daily or weekly sessions.' },
                { icon: '⏱',  tip: 'Spend meaningful time per tool — 5+ minutes per session.' },
                { icon: '✍️', tip: 'Fill SMART goal fields with detail — aim for 30+ words each.' },
                { icon: '🎯',  tip: 'Create active SMART goals and mark them complete.' },
                { icon: '🤖',  tip: 'Attach evidence to entries (AI assessment coming soon).' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem', display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{item.icon}</span>
                  <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>{item.tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team scores */}
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

        {/* Right column: chart + daily movement */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Weekly trend chart */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <p style={{ fontWeight: 800, color: '#1e293b', margin: '0 0 4px', fontSize: '0.9rem' }}>Score Trend</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 12px' }}>Weekly movement</p>
            <ScoreLineChart history={history.slice(-14)} />
          </div>

          {/* Daily movement feed */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <p style={{ fontWeight: 800, color: '#1e293b', margin: '0 0 4px', fontSize: '0.9rem' }}>Daily Movement</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 12px' }}>Points gained or lost each day</p>
            <DailyMovementFeed logs={pointsLog} />
          </div>
        </div>
      </div>
    </div>
  );
}
