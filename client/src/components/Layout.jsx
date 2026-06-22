import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import WelcomeModal from './WelcomeModal';
import ToolVideoModal from './ToolVideoModal';

const navItems = [
  { id: 'dashboard',       label: 'Dashboard',           icon: '📊', path: '/dashboard' },
  { id: 'team',            label: 'Team',                 icon: '👥', path: '/team' },
  { id: 'approvals',       label: 'Team Approvals',       icon: '✅', path: '/approvals', adminOnly: true },
  { id: 'visual-board',    label: 'Visual Mgmt Board',    icon: '🔴', path: '/visual-board' },
  { id: 'quotes',          label: 'Leadership Quotes',    icon: '💬', path: '/quotes' },
  { id: 'training',        label: 'Training Center',      icon: '🎓', path: '/training' },
  { id: 'coaching',        label: 'Coaching Log',         icon: '📝', path: '/coaching' },
  { id: 'smart-goals',     label: 'SMART Goals',          icon: '🎯', path: '/smart-goals' },
  { id: 'mentoring',       label: 'Mentoring Tracker',    icon: '🤝', path: '/mentoring' },
  { id: 'skills',          label: 'Skills Development',   icon: '⭐', path: '/skills' },
  { id: 'lob',             label: 'Line of Balance',      icon: '📈', path: '/lob' },
  { id: 'urgency',         label: 'Sense of Urgency',     icon: '⚡', path: '/urgency' },
  { id: 'feedback',        label: 'Feedback Box',         icon: '📬', path: '/feedback' },
  { id: 'problem-solving', label: 'Problem Solving',      icon: '🔍', path: '/problem-solving' },
  { id: 'vision',          label: 'Vision Builder',       icon: '🔭', path: '/vision' },
  { id: 'lean',            label: 'Lean Toolkit',         icon: '🏭', path: '/lean' },
  { id: 'mindfulness',     label: 'Mindfulness',          icon: '🧘', path: '/mindfulness' },
  { id: 'career',          label: 'Career Development',   icon: '🚀', path: '/career' },
  { id: 'disc',            label: 'DISC Assessment',      icon: '🎯', path: '/disc' },
  { id: 'eq-opex',         label: 'EQ & OpEx Tools',      icon: '💡', path: '/eq-opex' },
  { id: 'scores',          label: 'Score Dashboard',      icon: '🏆', path: '/scores' },
];

const VIDEO_TOOL_IDS = new Set([
  'visual-board','quotes','training','coaching','smart-goals','mentoring',
  'skills','lob','urgency','feedback','problem-solving','vision','lean',
  'mindfulness','career','disc','eq-opex','scores',
]);

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [toolVideoOpen, setToolVideoOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, logout } = useAuth();

  const canApprove = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';
  const sessionRef = useRef({ tool: null, startTime: null });

  useEffect(() => {
    if (!currentUser) return;
    const tool = location.pathname.replace('/', '') || 'dashboard';

    async function endSession(prevTool, startTime) {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      if (durationSeconds < 10) return;
      try {
        await addDoc(collection(db, 'toolSessions'), {
          uid: currentUser.uid,
          tool: prevTool,
          openedAt: startTime,
          closedAt: Date.now(),
          durationSeconds,
          date: new Date().toISOString().split('T')[0],
        });
      } catch {}
    }

    if (sessionRef.current.tool) endSession(sessionRef.current.tool, sessionRef.current.startTime);
    sessionRef.current = { tool, startTime: Date.now() };
  }, [location.pathname, currentUser]);

  // Auto-show tool help video on first visit
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    if (userProfile.status === 'pending') return;
    const toolId = location.pathname.replace('/', '');
    if (!VIDEO_TOOL_IDS.has(toolId)) return;
    const seen = userProfile.seenToolVideos || [];
    if (seen.includes(toolId)) return;
    setToolVideoOpen(true);
  }, [location.pathname, currentUser, userProfile]);

  useEffect(() => {
    if (!canApprove) return;
    async function fetchPending() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const count = snap.docs.filter(d => d.data().status === 'pending' && d.id !== currentUser?.uid).length;
        setPendingCount(count);
      } catch {}
    }
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [canApprove, currentUser]);

  async function handleLogout() {
    await logout();
    navigate('/login');
    toast.success('Signed out successfully');
  }

  const initials = currentUser?.displayName
    ? currentUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : currentUser?.email?.[0]?.toUpperCase() || 'U';

  const visibleNavItems = navItems.filter(item => !item.adminOnly || canApprove);
  const currentToolId = location.pathname.replace('/', '') || 'dashboard';
  const currentNavItem = navItems.find(n => n.path === location.pathname);
  const hasToolVideo = VIDEO_TOOL_IDS.has(currentToolId);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:relative z-30 h-full flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          background: 'linear-gradient(180deg, #0b1a38 0%, #0f2044 40%, #122550 100%)',
          minWidth: collapsed ? '4rem' : '16rem',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(13,148,136,0.4)',
            }}>
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2"/>
                <path d="M10 16l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem', margin: 0, lineHeight: 1.2 }}>Leadership Flow</p>
                <p style={{ color: '#0d9488', fontSize: '0.65rem', margin: 0, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Accountability App</p>
              </div>
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="ml-auto lg:flex hidden"
              style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.5)', borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.625rem' }}>
          {!collapsed && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.375rem 0.375rem', margin: 0 }}>Navigation</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visibleNavItems.map(item => (
              <button
                key={item.id}
                className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                title={collapsed ? item.label : ''}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                {item.id === 'approvals' && pendingCount > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 9999, fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center', flexShrink: 0 }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* User footer */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.625rem', cursor: 'pointer' }}
            onClick={() => { navigate('/profile'); setMobileOpen(false); }}
          >
            {userProfile?.photoURL || currentUser?.photoURL ? (
              <img
                src={userProfile?.photoURL || currentUser?.photoURL}
                alt={currentUser?.displayName}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #0d9488', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                {initials}
              </div>
            )}
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: '0.78rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.displayName || 'User'}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.email}</p>
                  {userProfile?.isAdmin && <p style={{ color: '#fbbf24', fontSize: '0.62rem', fontWeight: 700, margin: 0 }}>⭐ Admin</p>}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleLogout(); }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 4px', borderRadius: 4, flexShrink: 0 }}
                  title="Sign out"
                >✕</button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 1.5rem', height: 60, flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid var(--border)',
          boxShadow: '0 1px 6px rgba(15,32,68,0.05)',
        }}>
          <button className="lg:hidden" onClick={() => setMobileOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.25rem', padding: '4px 6px' }}>
            ☰
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1rem' }}>{currentNavItem?.icon}</span>
            <h2 style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', margin: 0 }}>
              {currentNavItem?.label || 'Dashboard'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasToolVideo && (
              <button
                onClick={() => setToolVideoOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg,#0f2044,#1e3a6e)',
                  color: 'white', border: 'none', borderRadius: 8,
                  padding: '0.375rem 0.875rem', fontSize: '0.775rem', fontWeight: 700,
                  cursor: 'pointer', letterSpacing: '0.01em',
                }}
              >
                ▶ How to use
              </button>
            )}

            {canApprove && pendingCount > 0 && (
              <button
                onClick={() => navigate('/approvals')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef9c3', color: '#b45309', border: '1px solid #fcd34d', borderRadius: 8, padding: '0.375rem 0.75rem', fontSize: '0.775rem', fontWeight: 700, cursor: 'pointer' }}
              >
                ⏳ {pendingCount} pending
              </button>
            )}

            <span style={{ color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
          {children}
        </main>
      </div>

      <WelcomeModal />
      <ToolVideoModal
        toolId={currentToolId}
        toolLabel={currentNavItem?.label || ''}
        open={toolVideoOpen}
        onClose={() => setToolVideoOpen(false)}
      />
    </div>
  );
}
