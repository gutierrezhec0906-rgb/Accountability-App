import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleForgotPassword(e) {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Password reset email sent! Check your inbox.');
      setShowReset(false);
    } catch {
      toast.error('Could not send reset email. Check the address and try again.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      toast.error('Invalid email or password');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 50%, #0d9488 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div style={{ width: 120, height: 120, margin: '0 auto 1rem' }}>
            <img src="/LFT_logo_square_300x300.png" alt="Leadership Flow" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          <h1 className="text-3xl font-bold text-white">Accountability App</h1>
          <p className="text-teal-200 mt-1 text-sm">High-Performance Leadership Platform</p>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Sign In</h2>
          {!showReset ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                </div>
                <div className="text-right">
                  <button type="button" onClick={() => { setResetEmail(email); setShowReset(true); }} className="text-sm text-teal-600 hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>
                <button className="btn-primary w-full justify-center mt-2" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              <p className="text-center text-sm text-slate-500 mt-6">
                Don't have an account?{' '}
                <Link to="/signup" className="text-teal-600 font-semibold hover:underline">Sign Up</Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-4">Enter your email and we'll send you a password reset link.</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required placeholder="you@company.com" />
                </div>
                <button className="btn-primary w-full justify-center" type="submit">Send Reset Email</button>
                <button type="button" onClick={() => setShowReset(false)} className="w-full text-center text-sm text-slate-500 hover:underline mt-2">
                  Back to Sign In
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
