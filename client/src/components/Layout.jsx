import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'team', label: 'Team', icon: '👥', path: '/team' },
  { id: 'approvals', label: 'Team Approvals', icon: '✅', path: '/approvals', adminOnly: true },
  { id: 'visual-board', label: 'Visual Mgmt Board', icon: '🔴', path: '/visual-board' },
  { id: 'quotes', label: 'Leadership Quotes', icon: '💬', path: '/quotes' },
  { id: 'training', label: 'Training Center', icon: '🎓', path: '/training' },
  { id: 'coaching', label: 'Coaching Log', icon: '📝', path: '/coaching' },
  { id: 'mentoring', label: 'Mentoring Tracker', icon: '🤝', path: '/mentoring' },
  { id: 'skills', label: 'Skills Development', icon: '⭐', path: '/skills' },
  { id: 'lob', label: 'Line of Balance', icon: '📈', path: '/lob' },
  { id: 'urgency', label: 'Sense of Urgency', icon: '⚡', path: '/urgency' },
  { id: 'feedback', label: 'Feedback Box', icon: '📬', path: '/feedback' },
  { id: 'problem-solving', label: 'Problem Solving', icon: '🔍', path: '/problem-solving' },
  { id: 'vision', label: 'Vision Builder', icon: '🔭', path: '/vision' },
  { id: 'lean', label: 'Lean Toolkit', icon: '🏭', path: '/lean' },
  { id: 'mindfulness', label: 'Mindfulness', icon: '🧘', path: '/mindfulness' },
  { id: 'career', label: 'Career Development', icon: '🚀', path: '/career' },
  { id: 'disc', label: 'DISC Assessment', icon: '🎯', path: '/disc' },
  { id: 'eq-opex', label: 'EQ & OpEx Tools', icon: '💡', path: '/eq-opex' },
  { id: 'scores', label: 'Score Dashboard', icon: '🏆', path: '/scores' },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, logout } = useAuth();

  const canApprove = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';

  // Poll pending count for admins/leaders/managers
  useEffect(() => {
    if (!canApprove) return;
    async function fetchPending() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const count = snap.docs.filter(d => d.data().status === 'pending' && d.id !== currentUser?.uid).length;
        setPendingCount(count);
      } catch (e) {}
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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8fafc' }}>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-30 h-full flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'linear-gradient(180deg, #0f2044 0%, #1e3a6e 100%)', minWidth: collapsed ? '4rem' : '16rem' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-white border-opacity-10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#0d9488' }}>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2"/><path d="M10 16l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {!collapsed && <span className="text-white font-bold text-sm leading-tight">Accountability<br/>App</span>}
          <button className="ml-auto text-slate-400 hover:text-white lg:flex hidden" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              title={collapsed ? item.label : ''}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="truncate flex-1">{item.label}</span>
              )}
              {/* Pending badge on Approvals link */}
              {item.id === 'approvals' && pendingCount > 0 && (
                <span style={{
                  background: '#ef4444', color: 'white', borderRadius: 9999,
                  fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px',
                  minWidth: 18, textAlign: 'center', flexShrink: 0,
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white border-opacity-10">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#0d9488' }}>
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{currentUser?.displayName || 'User'}</p>
                <p className="text-slate-400 text-xs truncate">{currentUser?.email}</p>
                {userProfile?.isAdmin && <p style={{ color: '#fbbf24', fontSize: '0.65rem', fontWeight: 700 }}>⭐ Admin</p>}
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 text-xs" title="Sign out">✕</button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <button className="lg:hidden text-slate-500 hover:text-slate-700" onClick={() => setMobileOpen(o => !o)}>☰</button>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-700 text-sm">
              {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}
            </h2>
          </div>
          {canApprove && pendingCount > 0 && (
            <button onClick={() => navigate('/approvals')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#fef9c3', color: '#ca8a04', border: '1px solid #fcd34d' }}>
              ⏳ {pendingCount} pending approval{pendingCount > 1 ? 's' : ''}
            </button>
          )}
          <span className="text-xs text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
