import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function CompleteProfile() {
  const { currentUser, userProfile, fetchProfile } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ companyId: '', teamName: '' });
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState(null); // { id, companyId, companyName, teamId, teamName, role } if joining via invite link
  const [checkingInvite, setCheckingInvite] = useState(!!sessionStorage.getItem('pendingInviteId'));
  const navigate = useNavigate();

  // If this account was created from an invite link, look up the invite (now
  // readable since the signed-in email matches it). The leader already set
  // the company, team, and position when sending the invite, so this whole
  // page becomes a one-click confirmation instead of a form.
  useEffect(() => {
    async function loadInvite() {
      const inviteId = sessionStorage.getItem('pendingInviteId');
      if (!inviteId || !currentUser) { setCheckingInvite(false); return; }
      try {
        const snap = await getDoc(doc(db, 'invites', inviteId));
        if (snap.exists() && snap.data().status === 'pending') {
          const data = snap.data();
          setInvite({ id: inviteId, companyId: data.companyId, companyName: data.companyName, teamId: data.teamId, teamName: data.teamName, role: data.role });
        } else {
          sessionStorage.removeItem('pendingInviteId');
        }
      } catch {
        sessionStorage.removeItem('pendingInviteId');
      }
      setCheckingInvite(false);
    }
    loadInvite();
  }, [currentUser]);

  useEffect(() => {
    if (userProfile?.companyId && userProfile?.teamName) {
      navigate('/dashboard');
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    if (invite) return; // no need to load the company picker for an invited signup
    async function loadCompanies() {
      try {
        const snap = await getDocs(collection(db, 'companies'));
        setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('Could not load companies', e);
      }
    }
    loadCompanies();
  }, [invite]);

  async function finishInvite() {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        companyId: invite.companyId,
        companyName: invite.companyName,
        teamId: invite.teamId,
        teamName: invite.teamName,
      });
      try { await updateDoc(doc(db, 'invites', invite.id), { status: 'accepted' }); } catch { /* ignore */ }
      sessionStorage.removeItem('pendingInviteId');
      await fetchProfile(currentUser.uid);
      toast.success('Profile completed!');
      navigate('/dashboard');
    } catch (e) {
      toast.error('Failed to save profile');
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.companyId) return toast.error('Please select a company');
    if (!form.teamName.trim()) return toast.error('Please enter your team name');
    setLoading(true);
    try {
      const companyName = companies.find(c => c.id === form.companyId)?.name || '';
      await updateDoc(doc(db, 'users', currentUser.uid), {
        companyId: form.companyId,
        companyName,
        teamName: form.teamName.trim(),
      });
      await fetchProfile(currentUser.uid);
      toast.success('Profile completed!');
      navigate('/dashboard');
    } catch (e) {
      toast.error('Failed to save profile');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 50%, #0d9488 100%)' }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div style={{ width: 72, height: 72, borderRadius: 18, overflow: 'hidden', background: '#0f2044', margin: '0 auto 1rem' }}>
            <img src="/LFT_logo_square_300x300.png" alt="Leadership Flow" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <h1 className="text-3xl font-bold text-white">One More Step</h1>
          <p className="mt-1 text-sm" style={{ color: '#99f6e4' }}>{invite ? "You're almost in" : 'Tell us about your team'}</p>
        </div>

        {checkingInvite ? (
          <div className="card p-8 text-center text-slate-400">Checking your invitation...</div>
        ) : invite ? (
          <div className="card p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Confirm Your Team</h2>
            <p className="text-sm text-slate-500 mb-6">Your leader already set these up for you — just confirm to finish.</p>
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 700 }}>Company</span>
                <span style={{ fontSize: '0.85rem', color: '#0f2044', fontWeight: 700 }}>{invite.companyName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 700 }}>Team</span>
                <span style={{ fontSize: '0.85rem', color: '#0f2044', fontWeight: 700 }}>{invite.teamName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 700 }}>Position</span>
                <span style={{ fontSize: '0.85rem', color: '#0f2044', fontWeight: 700 }}>{invite.role}</span>
              </div>
            </div>
            <button className="btn-primary w-full justify-center" onClick={finishInvite} disabled={loading}>
              {loading ? 'Finishing...' : 'Confirm & Continue'}
            </button>
          </div>
        ) : (
          <div className="card p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Complete Your Profile</h2>
            <p className="text-sm text-slate-500 mb-6">Select your company and enter your team name so your admin can place you correctly.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Company</label>
                {companies.length === 0 ? (
                  <div className="input text-slate-400 flex items-center">Loading companies...</div>
                ) : (
                  <select className="input" value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} required>
                    <option value="">— Select your company —</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Team Name</label>
                <input className="input" placeholder="e.g. Sales Team A, Night Shift Ops..." value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} required />
                <p className="text-xs text-slate-400 mt-1">Type the name of your specific team within the company.</p>
              </div>
              <button className="btn-primary w-full justify-center mt-2" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Complete Profile'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
