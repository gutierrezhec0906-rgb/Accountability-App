import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function PendingApproval() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 50%, #0d9488 100%)' }}>
      <div className="w-full max-w-md px-4">
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Awaiting Approval</h2>
          <p className="text-slate-500 text-sm mb-4">
            Hi <strong>{currentUser?.displayName}</strong>, your account has been created successfully.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Your team admin or leader needs to approve your access before you can use the Accountability App. They will be notified of your request.
          </p>

          <div className="rounded-lg p-4 mb-6 text-left" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0d9488' }}>Your account details</p>
            <p className="text-sm text-slate-700"><span className="font-semibold">Name:</span> {currentUser?.displayName}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold">Email:</span> {currentUser?.email}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold">Role:</span> {userProfile?.role}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold">Status:</span> <span style={{ color: '#f59e0b', fontWeight: 700 }}>Pending Approval</span></p>
          </div>

          <p className="text-xs text-slate-400 mb-4">Please check back later or contact your team admin directly.</p>
          <button onClick={handleLogout} className="btn-secondary w-full justify-center">Sign Out</button>
        </div>
      </div>
    </div>
  );
}
