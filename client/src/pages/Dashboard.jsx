import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { isLocked, TIER_LABELS, TIER_ICONS } from '../utils/subscription';

const categories = [
  {
    id: 'model',
    label: 'Model the Way',
    icon: '🧭',
    accent: '#3b82f6',
    bg: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
    desc: 'Set the standard. Lead by example.',
    modules: [
      { id: 'visual-board',  label: 'Visual Mgmt Board', icon: '🔴', path: '/visual-board',   iconBg: 'linear-gradient(135deg,#fca5a5,#f87171)' },
      { id: 'lob',           label: 'Line of Balance',   icon: '📈', path: '/lob',             iconBg: 'linear-gradient(135deg,#a5b4fc,#818cf8)' },
      { id: 'urgency',       label: 'Sense of Urgency',  icon: '⚡', path: '/urgency',         iconBg: 'linear-gradient(135deg,#fb923c,#ea580c)' },
      { id: 'eq-opex',       label: 'EQ & OpEx Tools',   icon: '💡', path: '/eq-opex',         iconBg: 'linear-gradient(135deg,#fef08a,#facc15)' },
    ],
  },
  {
    id: 'inspire',
    label: 'Inspire & Share the Vision',
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
    label: 'Challenge the Process',
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
    label: 'Enable Others to Act',
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
    label: 'Encourage the Heart',
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

  useEffect(() => {
    if (userProfile?.calculatedScore !== undefined) setScore(userProfile.calculatedScore);
  }, [userProfile]);

  const firstName = currentUser?.displayName?.split(' ')[0] || 'Leader';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userTier = userProfile?.subscriptionTier || 'free';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* ── Hero banner ── */}
      <div style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg, #0b1a38 0%, #0f2044 50%, #0d9488 140%)',
        padding: '2rem 2.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap',
        boxShadow: '0 8px 40px rgba(15,32,68,0.2)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(13,148,136,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(13,148,136,0.08)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>{greeting}</p>
          <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 900, margin: '0 0 6px', lineHeight: 1.2 }}>
            {firstName} 👋
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', margin: '0 0 20px', fontWeight: 400 }}>
            {userProfile?.role || 'Leader'} · Track your accountability and growth
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/scores')}
              style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 10, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              View My Score
            </button>
            <button
              onClick={() => navigate('/smart-goals')}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              My SMART Goals
            </button>
            <button
              onClick={() => navigate('/pricing')}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              {TIER_ICONS[userTier]} {TIER_LABELS[userTier]} Plan
            </button>
          </div>
        </div>

        {/* Score pill */}
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '1.25rem 2rem',
            backdropFilter: 'blur(10px)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>Accountability Score</p>
            <p style={{ color: 'white', fontSize: '3rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>
              {score ?? '—'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', margin: '4px 0 0' }}>out of 100</p>
          </div>
        </div>
      </div>

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
    </div>
  );
}
