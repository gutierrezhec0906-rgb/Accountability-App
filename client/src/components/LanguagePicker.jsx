import { useTranslation } from 'react-i18next';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { setStoredLanguage, SUPPORTED_LANGUAGES } from '../i18n';

const LABELS = { en: 'EN', es: 'ES' };

// Compact EN/ES toggle. Always switches the app's language immediately; when
// the user is signed in, also persists the choice to users/{uid}.language so
// it follows them across devices (AuthContext applies it on every login).
export default function LanguagePicker({ style = {}, dark = false }) {
  const { i18n } = useTranslation();
  const { currentUser } = useAuth();
  const current = SUPPORTED_LANGUAGES.includes(i18n.language) ? i18n.language : 'en';

  async function selectLanguage(lang) {
    if (lang === current) return;
    i18n.changeLanguage(lang);
    setStoredLanguage(lang);
    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), { language: lang }, { merge: true });
      } catch { /* ignore — local preference still applied */ }
    }
  }

  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border, #e2e8f0)', borderRadius: 9999, padding: 2, gap: 2, ...style }}>
      {SUPPORTED_LANGUAGES.map(lang => (
        <button
          key={lang}
          type="button"
          onClick={() => selectLanguage(lang)}
          aria-pressed={current === lang}
          style={{
            padding: '4px 12px', borderRadius: 9999, border: 'none', cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: 700,
            background: current === lang ? '#0d9488' : 'transparent',
            color: current === lang ? 'white' : (dark ? 'rgba(255,255,255,0.7)' : '#64748b'),
            transition: 'all 0.15s',
          }}>
          {LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
