import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Signup() {
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite');
  const invitedEmail = searchParams.get('email') || '';
  const invitedRole = searchParams.get('role') || '';
  const invitedCompany = searchParams.get('company') || '';
  const isInvited = !!(inviteId && invitedEmail);

  const [form, setForm] = useState({
    name: '', email: invitedEmail, password: '', confirm: '',
    role: isInvited ? invitedRole : 'Leader',
  });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Carry the invite through to CompleteProfile, where it's verified server-side.
  useEffect(() => {
    if (isInvited) sessionStorage.setItem('pendingInviteId', inviteId);
  }, [isInvited, inviteId]);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (!agreed) return toast.error('Please accept the Terms & Conditions and Privacy Policy to continue');
    setLoading(true);
    try {
      await signup(form.email, form.password, form.name, form.role);
      toast.success('Account created! Welcome aboard.');
      navigate('/complete-profile');
    } catch (err) {
      toast.error(err.message || 'Failed to create account');
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
          <h1 className="text-3xl font-bold text-white">Accountability App</h1>
          <p className="mt-1 text-sm" style={{ color: '#99f6e4' }}>High-Performance Leadership Platform</p>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Create Account</h2>
          {isInvited && (
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.82rem', color: '#0f766e', margin: 0, lineHeight: 1.5 }}>
                🎉 You've been invited to join <strong>{invitedCompany || 'your team'}</strong> as a <strong>{invitedRole}</strong>. Just fill in your name and password to get started.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" name="name" value={form.name} onChange={handleChange} required placeholder="Jane Smith" />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@company.com" readOnly={isInvited} style={isInvited ? { background: '#f1f5f9', color: '#64748b' } : undefined} />
            </div>
            <div>
              <label className="label">Role</label>
              {isInvited
                ? <input className="input" value={form.role} readOnly style={{ background: '#f1f5f9', color: '#64748b' }} />
                : <select className="input" name="role" value={form.role} onChange={handleChange}>
                    <option>Leader</option>
                    <option>Manager</option>
                    <option>Supervisor</option>
                    <option>Individual Contributor</option>
                  </select>
              }
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" name="password" value={form.password} onChange={handleChange} required placeholder="Min. 6 characters" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" name="confirm" value={form.confirm} onChange={handleChange} required placeholder="Repeat password" />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, cursor: 'pointer', marginTop: 4 }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: '#0d9488', cursor: 'pointer' }} />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" style={{ color: '#0d9488', fontWeight: 700 }}>Terms &amp; Conditions</Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" style={{ color: '#0d9488', fontWeight: 700 }}>Privacy Policy</Link>.
              </span>
            </label>
            <button className="btn-primary w-full justify-center mt-2" type="submit" disabled={loading || !agreed}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: '#0d9488' }}>Sign In</Link>
          </p>
        </div>
        <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <Link to="/terms" style={{ color: 'rgba(255,255,255,0.75)' }}>Terms</Link>
          {' · '}
          <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.75)' }}>Privacy</Link>
          <br />© 2026 Leadership Flow Technologies, LLC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
