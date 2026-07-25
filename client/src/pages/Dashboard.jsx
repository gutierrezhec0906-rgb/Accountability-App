import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { isLocked, TIER_LABELS, TIER_ICONS } from '../utils/subscription';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const categories = [
  {
    id: 'model',
    label: 'Set the Bar',
    icon: '🧭',
    accent: '#3b82f6',
    bg: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
    desc: 'Set the standard. Lead by example.',
    modules: [
      { id: 'visual-board',  label: 'Visual Management', icon: '🔴', path: '/visual-board',   iconBg: 'linear-gradient(135deg,#fca5a5,#f87171)' },
      { id: 'lob',           label: 'Line of Balance',   icon: '📈', path: '/lob',             iconBg: 'linear-gradient(135deg,#a5b4fc,#818cf8)' },
      { id: 'urgency',       label: 'Sense of Urgency',  icon: '⚡', path: '/urgency',         iconBg: 'linear-gradient(135deg,#fb923c,#ea580c)' },
      { id: 'eq-opex',       label: 'EQ & OpEx Tools',   icon: '💡', path: '/eq-opex',         iconBg: 'linear-gradient(135deg,#fef08a,#facc15)' },
    ],
  },
  {
    id: 'inspire',
    label: 'Spark the Vision',
    icon: '🔭',
    accent: '#0d9488',
    bg: 'linear-gradient(135deg,#134e4a,#0d9488)',
    desc: 'Paint the picture. Unite around purpose.',
    modules: [
      { id: 'vision',      label: 'Vision Builder', icon: '🔭', path: '/vision',      iconBg: 'linear-gradient(135deg,#60a5fa,#2563eb)' },
      { id: 'smart-goals', label: 'SMART Goals',    icon: '🎯', path: '/smart-goals', iconBg: 'linear-gradient(135deg,#fde68a,#fbbf24)' },
      { id: 'mindfulness', label: 'Mindfulness',    icon: '🧘', path: '/mindfulness', iconBg: 'linear-gradient(135deg,#0d9488,#0f766e)' },
    ],
  },
  {
    id: 'challenge',
    label: 'Improve the Flow',
    icon: '⚙️',
    accent: '#d97706',
    bg: 'linear-gradient(135deg,#78350f,#d97706)',
    desc: 'Question the status quo. Drive improvement.',
    modules: [
      { id: 'lean',           label: 'Lean Toolkit',    icon: '🏭', path: '/lean',           iconBg: 'linear-gradient(135deg,#fdba74,#f97316)' },
      { id: 'problem-solving',label: 'Problem Solving', icon: '🔍', path: '/problem-solving', iconBg: 'linear-gradient(135deg,#e879f9,#c026d3)' },
      { id: 'disc',           label: 'DISC Assessment', icon: '🎯', path: '/disc',           iconBg: 'linear-gradient(135deg,#fda4af,#fb7185)' },
    ],
  },
  {
    id: 'enable',
    label: 'Enable the Team',
    icon: '🤝',
    accent: '#7c3aed',
    bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)',
    desc: 'Build capacity. Foster collaboration.',
    modules: [
      { id: 'skills',   label: 'Skills Development', icon: '⭐', path: '/skills',   iconBg: 'linear-gradient(135deg,#fcd34d,#f59e0b)' },
      { id: 'training', label: 'Training Center',    icon: '🎓', path: '/training', iconBg: 'linear-gradient(135deg,#93c5fd,#60a5fa)' },
      { id: 'mentoring',label: 'Mentoring Tracker',  icon: '🫂', path: '/mentoring',iconBg: 'linear-gradient(135deg,#86efac,#4ade80)' },
      { id: 'career',   label: 'Career Development', icon: '🚀', path: '/career',   iconBg: 'linear-gradient(135deg,#7dd3fc,#0ea5e9)' },
    ],
  },
  {
    id: 'encourage',
    label: 'Winning with Compassion',
    icon: '❤️',
    accent: '#e11d48',
    bg: 'linear-gradient(135deg,#881337,#e11d48)',
    desc: 'Recognize contributions. Celebrate wins.',
    modules: [
      { id: 'feedback', label: 'Feedback Box',      icon: '📬', path: '/feedback', iconBg: 'linear-gradient(135deg,#6ee7b7,#34d399)' },
      { id: 'coaching', label: 'Coaching Log',      icon: '📝', path: '/coaching', iconBg: 'linear-gradient(135deg,#fde68a,#fbbf24)' },
      { id: 'quotes',   label: 'Leadership Quotes', icon: '💬', path: '/quotes',   iconBg: 'linear-gradient(135deg,#c084fc,#a855f7)' },
    ],
  },
];

const allModules = categories.flatMap(c => c.modules);

// Rising trend line under the score (mockup). Takes newest-first scoreHistory,
// plots the last ~14 points chronologically. Falls back to a gentle flat line.
function Sparkline({ history, width = 300, height = 56 }) {
  const pts = [...(history || [])]
    .filter(h => typeof h.score === 'number')
    .reverse()
    .slice(-14);
  const vals = pts.length >= 2 ? pts.map(p => p.score) : [Math.max(0, (pts[0]?.score ?? 0) - 4), pts[0]?.score ?? 0];
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pad = 4;
  const stepX = (width - pad * 2) / (vals.length - 1);
  const coords = vals.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y];
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height} L${coords[0][0].toFixed(1)},${height} Z`;
  const [ex, ey] = coords[coords.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', height }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path d={line} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ex} cy={ey} r="4.5" fill="#6ee7b7" stroke="#052e22" strokeWidth="2" />
    </svg>
  );
}

const quickActions = [
  { label: 'Log Coaching Session', icon: '📝', path: '/coaching' },
  { label: 'Submit Feedback',       icon: '📬', path: '/feedback' },
  { label: 'Update Skills',         icon: '⭐', path: '/skills' },
  { label: 'Add SMART Goal',        icon: '🎯', path: '/smart-goals' },
];

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [score, setScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Read the latest score straight from Firestore on mount — never trust the
  // possibly-stale userProfile cache (it can lag behind a fresh Calculate on the
  // Scores page). Seed from userProfile first so there's no flash of '—'.
  useEffect(() => {
    if (userProfile?.calculatedScore !== undefined) setScore(userProfile.calculatedScore);
  }, [userProfile]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.calculatedScore !== undefined) setScore(d.calculatedScore);
          if (Array.isArray(d.scoreHistory)) setHistory(d.scoreHistory);
        }
      } catch (e) { console.warn('Could not load fresh score', e); }
    })();
  }, [currentUser]);

  useEffect(() => {
    async function loadTeam() {
      if (!userProfile?.companyId) return;
      try {
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('companyId', '==', userProfile.companyId),
          where('status', '==', 'approved'),
        ));
        const members = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.uid !== currentUser?.uid);
        setTeamMembers(members);
      } catch (e) {
        console.warn('Could not load team members', e);
      }
    }
    loadTeam();
  }, [userProfile, currentUser]);

  const firstName = currentUser?.displayName?.split(' ')[0] || 'Leader';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userTier = userProfile?.subscriptionTier || 'free';

  // Teammates who asked ME to complete their skills peer assessment
  const incomingSkillsRequests = teamMembers.filter(
    m => m.skillsPeerRequest?.status === 'pending' && m.skillsPeerRequest?.toUid === currentUser?.uid
  );

  // Career plan milestone reminder — due within 5 days or overdue (points at risk)
  const careerReminder = (() => {
    const cp = userProfile?.careerPlan;
    if (!cp?.completedAt) return null;
    const windows = [
      { key: 'd30', label: '30-day', days: 30,  penalty: '−2 pts' },
      { key: 'd90', label: '90-day', days: 90,  penalty: '−3 pts' },
      { key: 'm6',  label: '6-month', days: 180, penalty: '−2 pts' },
      { key: 'm12', label: '12-month', days: 365, penalty: 'all remaining points' },
    ];
    const daysSince = (Date.now() - new Date(cp.completedAt).getTime()) / 86400000;
    for (const w of windows) {
      const filled = (cp.checkIns?.[w.key]?.note || '').trim().length > 0;
      if (filled) continue;
      const daysUntil = Math.ceil(w.days - daysSince);
      if (daysUntil <= 0) return { ...w, overdue: true };            // already lost the points
      if (daysUntil <= 5) return { ...w, overdue: false, daysUntil }; // due soon
      break; // the next unmet window is more than 5 days out — nothing to nag yet
    }
    return null;
  })();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* ── Hero banner (forest-green, app-style) ── */}
      <div style={{
        borderRadius: 22,
        background: 'linear-gradient(160deg, #0b3b2c 0%, #0f4d38 55%, #0a5a42 120%)',
        padding: '1.75rem 2rem',
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
        gap: 28, flexWrap: 'wrap',
        boxShadow: '0 10px 40px rgba(11,59,44,0.28)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(52,211,153,0.10)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -70, width: 170, height: 170, borderRadius: '50%', background: 'rgba(52,211,153,0.07)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', flex: '1 1 300px', minWidth: 260 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', fontWeight: 500, margin: '0 0 2px' }}>Welcome back,</p>
          <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 900, margin: '0 0 6px', lineHeight: 1.15 }}>
            {firstName} <span style={{ fontWeight: 400 }}>👋</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: '0 0 20px', fontWeight: 400 }}>
            {userProfile?.role || 'Leader'} · Track your accountability and growth
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/scores')}
              style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 12, padding: '0.6rem 1.3rem', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}
            >
              View My Score
            </button>
            <button
              onClick={() => navigate('/smart-goals')}
              style={{ background: 'white', color: '#0b3b2c', border: 'none', borderRadius: 12, padding: '0.6rem 1.3rem', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}
            >
              My SMART Goals
            </button>
            <button
              onClick={() => navigate('/self-assessment')}
              style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              📋 Self-Assessment
            </button>
            <button
              onClick={() => navigate('/pricing')}
              style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              {TIER_ICONS[userTier]} {TIER_LABELS[userTier]} Plan
            </button>
          </div>
        </div>

        {/* Score card with trend sparkline */}
        <button
          onClick={() => navigate('/scores')}
          style={{
            position: 'relative', textAlign: 'center', flex: '1 1 260px', maxWidth: 340,
            background: 'rgba(3,26,19,0.55)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 18, padding: '1.1rem 1.5rem 0.75rem', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 2px' }}>Accountability Score</p>
          <p style={{ color: 'white', fontSize: '3.25rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>
            {score ?? '—'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', margin: '2px 0 6px' }}>out of 100</p>
          <Sparkline history={history} />
        </button>
      </div>

      {/* ── Action needed: incoming skills peer-assessment requests ── */}
      {incomingSkillsRequests.length > 0 && (
        <div style={{
          borderRadius: 14, border: '1px solid #fde047', background: '#fefce8',
          padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🙋</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontWeight: 800, color: '#a16207', margin: '0 0 2px', fontSize: '0.9rem' }}>
              Action needed: peer assessment{incomingSkillsRequests.length > 1 ? 's' : ''} waiting on you
            </p>
            <p style={{ fontSize: '0.8rem', color: '#854d0e', margin: 0, lineHeight: 1.5 }}>
              {incomingSkillsRequests.map(m => m.displayName || m.email || 'A teammate').join(', ')} asked you to rate their skills in the Skills Development Matrix.
            </p>
          </div>
          <button onClick={() => navigate('/skills')}
            style={{ background: '#ca8a04', color: 'white', border: 'none', borderRadius: 10, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0 }}>
            Complete Assessment →
          </button>
        </div>
      )}

      {/* ── Career plan milestone reminder ── */}
      {careerReminder && (
        <div style={{
          borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          background: careerReminder.overdue ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${careerReminder.overdue ? '#fecaca' : '#bfdbfe'}`,
        }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{careerReminder.overdue ? '⚠️' : '🚀'}</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontWeight: 800, margin: '0 0 2px', fontSize: '0.9rem', color: careerReminder.overdue ? '#b91c1c' : '#1e40af' }}>
              {careerReminder.overdue
                ? `Your ${careerReminder.label} career check-in is overdue`
                : `Your ${careerReminder.label} career check-in is due in ${careerReminder.daysUntil} day${careerReminder.daysUntil === 1 ? '' : 's'}`}
            </p>
            <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: 1.5, color: careerReminder.overdue ? '#991b1b' : '#3730a3' }}>
              {careerReminder.overdue
                ? `Add your progress note to restore your points (${careerReminder.penalty} at stake).`
                : `Log a progress note on your Career Development Plan to keep your points (${careerReminder.penalty} at stake).`}
            </p>
          </div>
          <button onClick={() => navigate('/career')}
            style={{ background: careerReminder.overdue ? '#dc2626' : '#0d9488', color: 'white', border: 'none', borderRadius: 10, padding: '0.5rem 1.1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0 }}>
            {careerReminder.overdue ? 'Update Now →' : 'Add Progress Note →'}
          </button>
        </div>
      )}

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Accountability Score', value: score ?? '—', sub: 'calculated by the app', accent: '#0d9488', icon: '🏆' },
          { label: 'Active Modules',        value: allModules.length, sub: 'tools available',      accent: '#1e3a6e', icon: '🗂' },
          { label: 'Role',                  value: userProfile?.role || 'Leader', sub: 'your position', accent: '#7c3aed', icon: '👤' },
          { label: 'Today',                 value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sub: new Date().toLocaleDateString('en-US', { weekday: 'long' }), accent: '#0891b2', icon: '📅' },
        ].map(s => (
          <div key={s.label} className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span>
              <span style={{ fontSize: '1rem' }}>{s.icon}</span>
            </div>
            <p style={{ fontSize: '1.625rem', fontWeight: 900, color: s.accent, margin: '4px 0 2px', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Categories + Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Category sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {categories.map(cat => (
            <div key={cat.id}>
              {/* Category header */}
              <div style={{
                borderRadius: '12px 12px 0 0',
                background: cat.bg,
                padding: '0.75rem 1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.125rem' }}>{cat.icon}</span>
                  <div>
                    <p style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem', margin: 0, lineHeight: 1.2 }}>{cat.label}</p>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: 0 }}>{cat.desc}</p>
                  </div>
                </div>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.7rem', fontWeight: 700, borderRadius: 99, padding: '2px 8px' }}>
                  {cat.modules.length} tools
                </span>
              </div>
              {/* Module cards for this category */}
              <div style={{
                border: `1px solid ${cat.accent}33`,
                borderTop: 'none',
                borderRadius: '0 0 12px 12px',
                padding: '0.75rem',
                background: 'var(--card-bg)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                gap: '0.625rem',
              }}>
                {cat.modules.map(m => {
                  const locked = isLocked(m.id, userTier);
                  return (
                    <button
                      key={m.id}
                      className="module-card"
                      onClick={() => locked ? navigate('/pricing') : navigate(m.path)}
                      style={{ position: 'relative', opacity: locked ? 0.72 : 1 }}
                    >
                      {locked && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: '#f59e0b', borderRadius: 99, padding: '1px 7px', fontSize: '0.6rem', fontWeight: 800, color: 'white', letterSpacing: '0.04em' }}>
                          ⭐ PREMIUM
                        </div>
                      )}
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: m.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', filter: locked ? 'grayscale(40%)' : 'none' }}>
                        {locked ? '🔒' : m.icon}
                      </div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>{m.label}</p>
                      <div style={{ height: 3, borderRadius: 9999, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 9999, background: locked ? '#e2e8f0' : cat.bg, width: '40%' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.875rem', fontSize: '1rem' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quickActions.map(a => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#fff', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '0.75rem 1rem',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.18s ease',
                  boxShadow: '0 1px 4px rgba(15,32,68,0.05)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.background = '#f0fdfa'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fff'; }}
              >
                <span style={{ fontSize: '1.125rem' }}>{a.icon}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{a.label}</span>
              </button>
            ))}
          </div>

          {/* Mini tip card */}
          <div style={{
            marginTop: '1rem', borderRadius: 12, padding: '1rem',
            background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
            border: '1px solid #bbf7d0',
          }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#15803d', margin: '0 0 4px' }}>💡 Tip</p>
            <p style={{ fontSize: '0.8rem', color: '#166534', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
              Use more tools consistently to grow your Accountability Score.
            </p>
          </div>
        </div>
      </div>

      {/* ── Team Members ── */}
      {teamMembers.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem' }}>👥 My Team</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>{userProfile?.companyName} · {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => navigate('/team')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              View All →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {teamMembers.slice(0, 8).map(m => {
              const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
              const color = colors[(m.displayName?.charCodeAt(0) || 0) % colors.length];
              const initials = m.displayName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
              const ROLE_COLORS = { Leader: '#1d4ed8', Manager: '#15803d', Supervisor: '#7e22ce', 'Individual Contributor': '#475569' };
              return (
                <div key={m.uid} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</p>
                    <p style={{ fontSize: 11, color: ROLE_COLORS[m.role] || '#475569', fontWeight: 600, margin: '2px 0 0' }}>{m.role}</p>
                    {m.teamName && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>{m.teamName}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
