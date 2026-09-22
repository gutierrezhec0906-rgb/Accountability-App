import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { LEGAL_META } from '../legal/legalContent';

// Public page — reachable logged-in or logged-out, satisfies Google Play's
// "Delete account URL" data-safety requirement. A logged-in user can delete
// their own Firestore profile + Firebase Auth account here; deleting the Auth
// account requires a recent login, so we ask for the password to
// reauthenticate first (Firebase throws auth/requires-recent-login otherwise).
export default function DeleteAccount() {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    if (!currentUser) return;
    if (!confirmChecked) {
      toast.error(t('deleteAccount.mustConfirm', 'Please check the confirmation box first.'));
      return;
    }
    if (!password) {
      toast.error(t('deleteAccount.enterPassword', 'Enter your password to confirm.'));
      return;
    }
    setBusy(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      await deleteDoc(doc(db, 'users', currentUser.uid));
      await deleteUser(currentUser);
      toast.success(t('deleteAccount.done', 'Your account and data have been deleted.'));
      navigate('/login');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error(t('deleteAccount.wrongPassword', 'Incorrect password — try again.'));
      } else {
        toast.error(t('deleteAccount.failed', 'Could not delete account: {{message}}', { message: err.message }));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 60%, #0d9488 100%)', color: 'white', borderRadius: '16px 16px 0 0', padding: '1.75rem 2rem' }}>
          <Link to={currentUser ? '/profile' : '/login'} style={{ color: '#99f6e4', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
            ← {currentUser ? t('deleteAccount.backToProfile', 'Back to profile') : t('legal.backToSignIn', 'Back to sign in')}
          </Link>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '10px 0 4px' }}>{t('deleteAccount.title', 'Delete Account')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', margin: 0 }}>
            {t('deleteAccount.subtitle', 'Permanently delete your {{appName}} account and data.', { appName: LEGAL_META.appName })}
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: '0 0 16px 16px', padding: '1.75rem 2rem', boxShadow: '0 12px 40px rgba(15,32,68,0.08)' }}>
          <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.65, margin: '0 0 16px' }}>
            {t('deleteAccount.explain', 'Deleting your account permanently removes your profile, scores, goals, assessments, and all other data associated with your account from {{appName}}. This cannot be undone.', { appName: LEGAL_META.appName })}
          </p>

          {!currentUser ? (
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '1rem 1.1rem' }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#713f12', fontWeight: 700 }}>
                {t('deleteAccount.notLoggedIn', "You'll need to log in first to delete your account.")}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
                  {t('deleteAccount.logIn', 'Log in')}
                </Link>
              </div>
              <p style={{ margin: '14px 0 0', fontSize: '0.82rem', color: '#78716c' }}>
                {t('deleteAccount.orEmail', "Can't log in? Email us at {{email}} and we'll delete your account and data for you.", { email: LEGAL_META.contactEmail })}
              </p>
            </div>
          ) : (
            <form onSubmit={handleDelete}>
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, padding: '1rem 1.1rem', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b', fontWeight: 700 }}>
                  {t('deleteAccount.signedInAs', 'Signed in as {{email}}', { email: currentUser.email })}
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)} style={{ marginTop: 2 }} />
                {t('deleteAccount.confirmText', 'I understand this permanently deletes my account and all my data, and cannot be undone.')}
              </label>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f2044', marginBottom: 6 }}>
                {t('deleteAccount.passwordLabel', 'Confirm your password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('deleteAccount.passwordPlaceholder', 'Your password')}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', marginBottom: 18, boxSizing: 'border-box' }}
              />

              <button
                type="submit"
                disabled={busy}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: 10, border: 'none',
                  background: busy ? '#fca5a5' : '#dc2626', color: 'white', fontWeight: 800,
                  fontSize: '0.9rem', cursor: busy ? 'default' : 'pointer',
                }}
              >
                {busy ? t('deleteAccount.deleting', 'Deleting…') : t('deleteAccount.deleteButton', 'Permanently Delete My Account')}
              </button>
            </form>
          )}

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/terms" style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>{t('legal.termsConditions', 'Terms & Conditions')}</Link>
            <Link to="/privacy" style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>{t('legal.privacyPolicy', 'Privacy Policy')}</Link>
            <a href={`mailto:${LEGAL_META.contactEmail}`} style={{ color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>{LEGAL_META.contactEmail}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
