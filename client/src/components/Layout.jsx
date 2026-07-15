import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import WelcomeModal from './WelcomeModal';
import ToolVideoModal from './ToolVideoModal';
import { isLocked, TIER_ICONS, TIER_LABELS } from '../utils/subscription';

// Top-level items (always visible, not in a category)
const topNavItems = [
  { id: 'dashboard', label: 'Dashboard',     icon: '📊', path: '/dashboard' },
  { id: 'team',      label: 'Team',           icon: '👥', path: '/team' },
  { id: 'approvals', label: 'Team Approvals', icon: '✅', path: '/approvals', adminOnly: true },
];

const navCategories = [
  {
    id: 'model',
    label: 'Set the Bar',
    icon: '🧭',
    color: '#60a5fa',
    items: [
      { id: 'visual-board', label: 'Visual Mgmt Board', icon: '🔴', path: '/visual-board' },
      { id: 'lob',          label: 'Line of Balance',   icon: '📈', path: '/lob' },
      { id: 'urgency',      label: 'Sense of Urgency',  icon: '⚡', path: '/urgency' },
      { id: 'eq-opex',      label: 'EQ & OpEx Tools',   icon: '💡', path: '/eq-opex' },
    ],
  },
  {
    id: 'inspire',
    label: 'Spark the Vision',
    icon: '🔭',
    color: '#34d399',
    items: [
      { id: 'vision',      label: 'Vision Builder', icon: '🔭', path: '/vision' },
      { id: 'smart-goals', label: 'SMART Goals',    icon: '🎯', path: '/smart-goals' },
      { id: 'mindfulness', label: 'Mindfulness',    icon: '🧘', path: '/mindfulness' },
    ],
  },
  {
    id: 'challenge',
    label: 'Improve the Flow',
    icon: '⚙️',
    color: '#fbbf24',
    items: [
      { id: 'lean',          label: 'Lean Toolkit',    icon: '🏭', path: '/lean' },
      { id: 'problem-solving',label: 'Problem Solving', icon: '🔍', path: '/problem-solving' },
      { id: 'disc',          label: 'DISC Assessment', icon: '🎯', path: '/disc' },
    ],
  },
  {
    id: 'enable',
    label: 'Enable the Team',
    icon: '🤝',
    color: '#a78bfa',
    items: [
      { id: 'skills',   label: 'Skills Development', icon: '⭐', path: '/skills' },
      { id: 'training', label: 'Training Center',    icon: '🎓', path: '/training' },
      { id: 'mentoring',label: 'Mentoring Tracker',  icon: '🫂', path: '/mentoring' },
      { id: 'career',   label: 'Career Development', icon: '🚀', path: '/career' },
    ],
  },
  {
    id: 'encourage',
    label: 'Winning with Compassion',
    icon: '❤️',
    color: '#fb7185',
    items: [
      { id: 'feedback', label: 'Feedback Box',     icon: '📬', path: '/feedback' },
      { id: 'coaching', label: 'Coaching Log',     icon: '📝', path: '/coaching' },
      { id: 'quotes',   label: 'Leadership Quotes',icon: '💬', path: '/quotes' },
    ],
  },
];

// Flat list for lookup (tool video, header title, etc.)
const navItems = [
  ...topNavItems,
  ...navCategories.flatMap(c => c.items),
  { id: 'scores', label: 'Score Dashboard', icon: '🏆', path: '/scores' },
];

const VIDEO_TOOL_IDS = new Set([
  'dashboard',
  'visual-board','quotes','training','coaching','smart-goals','mentoring',
  'skills','lob','urgency','feedback','problem-solving','vision','lean',
  'mindfulness','career','disc','eq-opex','scores',
]);

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Start all categories expanded
  const [openCategories, setOpenCategories] = useState(() => Object.fromEntries(navCategories.map(c => [c.id, true])));
  function toggleCategory(id) { setOpenCategories(prev => ({ ...prev, [id]: !prev[id] })); }
  const [pendingCount, setPendingCount] = useState(0);
  const [toolVideoOpen, setToolVideoOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, logout } = useAuth();

  const canApprove = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';
  const userTier = userProfile?.subscriptionTier || 'free';
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
    const toolId = location.pathname.replace('/', '') || 'dashboard';
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
          position: 'relative',
        }}
      >
        {/* Edge expand tab — visible only when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand menu"
            className="hidden lg:flex"
            style={{
              position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)',
              zIndex: 40, width: 28, height: 48, background: '#0f2044',
              border: '1px solid rgba(255,255,255,0.15)', borderLeft: 'none',
              borderRadius: '0 8px 8px 0', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 700, boxShadow: '3px 0 8px rgba(0,0,0,0.3)',
            }}
          >
            ›
          </button>
        )}

        {/* Logo */}
        <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, overflow: 'hidden' }}>
              <img src="/LFT_logo_square_300x300.png" alt="Leadership Flow" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0, fontWeight: 700 }}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.625rem 0.5rem' }}>

          {/* Top items: Dashboard, Team, Approvals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
            {topNavItems.filter(item => !item.adminOnly || canApprove).map(item => (
              <button key={item.id}
                className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                title={collapsed ? item.label : ''}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                {item.id === 'approvals' && pendingCount > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 9999, fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center', flexShrink: 0 }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0 8px' }} />

          {/* Category groups */}
          {navCategories.map(cat => {
            const isOpen = openCategories[cat.id];
            const hasActive = cat.items.some(i => location.pathname === i.path);
            return (
              <div key={cat.id} style={{ marginBottom: 4 }}>
                {/* Category header */}
                <button
                  onClick={() => !collapsed && toggleCategory(cat.id)}
                  title={collapsed ? cat.label : ''}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    background: hasActive ? `${cat.color}22` : 'transparent',
                    border: 'none', borderRadius: 8, padding: collapsed ? '0.45rem 0' : '0.45rem 0.5rem',
                    cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start',
                    transition: 'background 0.15s',
                  }}>
                  <span style={{ fontSize: '0.85rem', flexShrink: 0, filter: 'none' }}>{cat.icon}</span>
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, fontSize: '0.7rem', fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.label}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>▼</span>
                    </>
                  )}
                </button>

                {/* Category items */}
                {(isOpen || collapsed) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: collapsed ? 0 : 8, marginTop: 2 }}>
                    {cat.items.map(item => {
                      const locked = isLocked(item.id, userTier);
                      return (
                        <button key={item.id}
                          className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                          onClick={() => { navigate(locked ? '/pricing' : item.path); setMobileOpen(false); }}
                          title={collapsed ? item.label : ''}
                          style={{ fontSize: '0.8rem', opacity: locked ? 0.65 : 1 }}>
                          <span style={{ fontSize: '0.875rem', flexShrink: 0 }}>{locked ? '🔒' : item.icon}</span>
                          {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{item.label}</span>}
                          {!collapsed && locked && (
                            <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.04em', flexShrink: 0 }}>PRO</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Divider + Score Dashboard pinned at bottom */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0 6px' }} />
          <button
            className={`sidebar-link ${location.pathname === '/scores' ? 'active' : ''}`}
            onClick={() => { navigate('/scores'); setMobileOpen(false); }}
            title={collapsed ? 'Score Dashboard' : ''}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>🏆</span>
            {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Score Dashboard</span>}
          </button>

          <button
            className={`sidebar-link ${location.pathname === '/self-assessment' ? 'active' : ''}`}
            onClick={() => { navigate('/self-assessment'); setMobileOpen(false); }}
            title={collapsed ? 'Self-Assessment' : ''}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>📋</span>
            {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Self-Assessment</span>}
          </button>

          <button
            className={`sidebar-link ${location.pathname === '/360-feedback' ? 'active' : ''}`}
            onClick={() => { navigate('/360-feedback'); setMobileOpen(false); }}
            title={collapsed ? '360° Feedback' : ''}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔄</span>
            {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>360° Feedback</span>}
          </button>

          {/* Pricing / upgrade link */}
          <button
            className={`sidebar-link ${location.pathname === '/pricing' ? 'active' : ''}`}
            onClick={() => { navigate('/pricing'); setMobileOpen(false); }}
            title={collapsed ? 'Plans & Pricing' : ''}
            style={{ marginTop: 4 }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>💎</span>
            {!collapsed && (
              <>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Plans & Pricing</span>
                <span style={{
                  fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.05em',
                  background: userTier === 'free' ? '#f59e0b' : userTier === 'premium' ? '#2563eb' : '#7c3aed',
                  color: 'white', borderRadius: 99, padding: '1px 6px', flexShrink: 0,
                }}>
                  {TIER_ICONS[userTier]}
                </span>
              </>
            )}
          </button>
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
