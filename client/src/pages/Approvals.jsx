import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { TIER_ICONS, TIER_LABELS, TIER_COLORS } from '../utils/subscription';

const TIER_OPTIONS = ['free', 'premium', 'all-inclusive'];

const roleColors = {
  Leader: { bg: '#eff6ff', text: '#1d4ed8' },
  Manager: { bg: '#f0fdf4', text: '#15803d' },
  Supervisor: { bg: '#fdf4ff', text: '#7e22ce' },
  'Team Lead': { bg: '#fff7ed', text: '#c2410c' },
  'Individual Contributor': { bg: '#f8fafc', text: '#475569' },
};

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const color = colors[name?.charCodeAt(0) % colors.length] || '#0d9488';
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function Approvals() {
  const { userProfile, currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const isMasterAdmin = currentUser?.email === 'hectorg@accountability-app.com' || userProfile?.isAdmin;
  const canApprove = isMasterAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';

  useEffect(() => {
    fetchUsers();
  }, [userProfile]);

  async function fetchUsers() {
    try {
      let snap;
      if (isMasterAdmin) {
        // Master admin sees everyone across every company
        snap = await getDocs(collection(db, 'users'));
      } else {
        // Leaders/Managers only see + approve members of their own company
        const companyId = userProfile?.companyId;
        if (!companyId) { setUsers([]); setLoading(false); return; }
        snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)));
      }
      const list = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.uid !== currentUser?.uid);
      setUsers(list);
    } catch (e) {
      toast.error('Could not load users');
    }
    setLoading(false);
  }

  async function updateStatus(uid, status) {
    try {
      await updateDoc(doc(db, 'users', uid), { status });
      setUsers(u => u.map(x => x.uid === uid ? { ...x, status } : x));
      toast.success(status === 'approved' ? '✅ Member approved!' : '❌ Member rejected');
    } catch (e) {
      toast.error('Failed to update status');
    }
  }

  async function toggleAdmin(uid, current) {
    try {
      await updateDoc(doc(db, 'users', uid), { isAdmin: !current });
      setUsers(u => u.map(x => x.uid === uid ? { ...x, isAdmin: !current } : x));
      toast.success(!current ? 'Admin access granted' : 'Admin access removed');
    } catch (e) {
      toast.error('Failed to update admin status');
    }
  }

  async function setTier(uid, tier) {
    try {
      await updateDoc(doc(db, 'users', uid), { subscriptionTier: tier });
      setUsers(u => u.map(x => x.uid === uid ? { ...x, subscriptionTier: tier } : x));
      toast.success(`Plan set to ${TIER_LABELS[tier]}`);
    } catch (e) {
      toast.error('Failed to update plan');
    }
  }

  const filtered = filter === 'all' ? users : users.filter(u => u.status === filter);
  const pendingCount = users.filter(u => u.status === 'pending').length;
  const approvedCount = users.filter(u => u.status === 'approved').length;
  const rejectedCount = users.filter(u => u.status === 'rejected').length;

  if (!canApprove) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-slate-700">Access Restricted</h2>
          <p className="text-slate-500 text-sm mt-2">Only Admins, Leaders, and Managers can manage team approvals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Team Approvals</h1>
        <p className="text-slate-500 text-sm">Review and approve new members before they join your team</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', count: pendingCount, color: '#f59e0b', bg: '#fef9c3', filter: 'pending' },
          { label: 'Approved', count: approvedCount, color: '#16a34a', bg: '#dcfce7', filter: 'approved' },
          { label: 'Rejected', count: rejectedCount, color: '#dc2626', bg: '#fee2e2', filter: 'rejected' },
        ].map(s => (
          <button key={s.label} onClick={() => setFilter(f => f === s.filter ? 'all' : s.filter)}
            className="card p-4 text-center transition-all hover:shadow-md"
            style={{ borderTop: `3px solid ${s.color}`, background: filter === s.filter ? s.bg : '#fff' }}>
            <p className="text-3xl font-black" style={{ color: s.color }}>{s.count}</p>
            <p className="text-sm font-semibold text-slate-600">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[['all', 'All Members'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === val ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={filter === val ? { background: '#0f2044' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="card p-8 text-center text-slate-400">Loading members...</div>}

      {!loading && filtered.length === 0 && (
        <div className="card p-8 text-center text-slate-400">
          <p className="text-3xl mb-2">{filter === 'pending' ? '✅' : '👥'}</p>
          <p>{filter === 'pending' ? 'No pending approvals — you\'re all caught up!' : 'No members in this category.'}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(user => {
          const rc = roleColors[user.role] || roleColors['Individual Contributor'];
          return (
            <div key={user.uid} className="card p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Avatar name={user.displayName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800">{user.displayName}</p>
                    {user.isAdmin && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#fef9c3', color: '#ca8a04' }}>⭐ Admin</span>}
                  </div>
                  <p className="text-xs text-slate-400">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: rc.bg, color: rc.text }}>{user.role}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${user.status === 'approved' ? 'badge-green' : user.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                      {user.status === 'approved' ? '✅ Approved' : user.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {user.status !== 'approved' && (
                    <button onClick={() => updateStatus(user.uid, 'approved')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                      style={{ background: '#16a34a' }}>
                      ✓ Approve
                    </button>
                  )}
                  {user.status !== 'rejected' && (
                    <button onClick={() => updateStatus(user.uid, 'rejected')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                      style={{ background: '#dc2626' }}>
                      ✕ Reject
                    </button>
                  )}
                  {user.status === 'approved' && (
                    <button onClick={() => toggleAdmin(user.uid, user.isAdmin)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                      style={{ background: user.isAdmin ? '#fef9c3' : '#f1f5f9', color: user.isAdmin ? '#ca8a04' : '#475569', borderColor: user.isAdmin ? '#fcd34d' : '#e2e8f0' }}>
                      {user.isAdmin ? '★ Remove Admin' : '☆ Make Admin'}
                    </button>
                  )}
                  {/* Tier selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {TIER_OPTIONS.map(tier => {
                      const tc = TIER_COLORS[tier];
                      const active = (user.subscriptionTier || 'free') === tier;
                      return (
                        <button
                          key={tier}
                          onClick={() => setTier(user.uid, tier)}
                          style={{
                            padding: '3px 10px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 800,
                            border: `1px solid ${active ? tc.border : '#e2e8f0'}`,
                            background: active ? tc.bg : '#f8fafc',
                            color: active ? tc.text : '#94a3b8',
                            cursor: 'pointer',
                          }}
                        >
                          {TIER_ICONS[tier]} {TIER_LABELS[tier]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
