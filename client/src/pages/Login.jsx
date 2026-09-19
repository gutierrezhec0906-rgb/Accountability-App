import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import LanguagePicker from '../components/LanguagePicker';

export default function Login() {
  const { t } = useTranslation();
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
      await sendPasswordResetEmail(auth, resetEmail.trim());
      toast.success(t('login.toast.resetSent', 'Password reset email sent! Check your inbox.'));
      setShowReset(false);
    } catch {
      toast.error(t('login.toast.resetFailed', 'Could not send reset email. Check the address and try again.'));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(t('login.toast.invalidCredentials', 'Invalid email or password'));
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 50%, #0d9488 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <LanguagePicker dark style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div style={{ width: 120, height: 120, margin: '0 auto 1rem' }}>
            <img src="/LFT_logo_square_300x300.png" alt="Leadership Flow" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          <h1 className="text-3xl font-bold text-white">{t('login.appName', 'Accountability App')}</h1>
          <p className="text-teal-200 mt-1 text-sm">{t('login.tagline', 'High-Performance Leadership Platform')}</p>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">{t('login.signIn', 'Sign In')}</h2>
          {!showReset ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">{t('login.emailAddress', 'Email Address')}</label>
                  <input className="input" type="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
                </div>
                <div>
                  <label className="label">{t('login.password', 'Password')}</label>
                  <input className="input" type="password" autoCapitalize="none" autoCorrect="off" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                </div>
                <div className="text-right">
                  <button type="button" onClick={() => { setResetEmail(email); setShowReset(true); }} className="text-sm text-teal-600 hover:underline font-medium">
                    {t('login.forgotPassword', 'Forgot password?')}
                  </button>
                </div>
                <button className="btn-primary w-full justify-center mt-2" type="submit" disabled={loading}>
                  {loading ? t('login.signingIn', 'Signing in...') : t('login.signIn', 'Sign In')}
                </button>
              </form>
              <p className="text-center text-sm text-slate-500 mt-6">
                {t('login.noAccount', "Don't have an account?")}{' '}
                <Link to="/signup" className="text-teal-600 font-semibold hover:underline">{t('login.signUp', 'Sign Up')}</Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-4">{t('login.resetInstructions', "Enter your email and we'll send you a password reset link.")}</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="label">{t('login.emailAddress', 'Email Address')}</label>
                  <input className="input" type="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required placeholder="you@company.com" />
                </div>
                <button className="btn-primary w-full justify-center" type="submit">{t('login.sendResetEmail', 'Send Reset Email')}</button>
                <button type="button" onClick={() => setShowReset(false)} className="w-full text-center text-sm text-slate-500 hover:underline mt-2">
                  {t('login.backToSignIn', 'Back to Sign In')}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <Link to="/terms" style={{ color: 'rgba(255,255,255,0.75)' }}>{t('login.terms', 'Terms')}</Link>
          {' · '}
          <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.75)' }}>{t('login.privacy', 'Privacy')}</Link>
          <br />{t('login.copyright', '© 2026 Leadership Flow Technologies, LLC. All rights reserved.')}
        </p>
      </div>
    </div>
  );
}
