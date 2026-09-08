import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { DAILY_PHRASES, PHRASE_CATEGORIES, pickTodaysPhrase, localDateKey } from '../utils/dailyPhrases';

const LS_KEY_PREFIX = 'dailyPhraseSeenDate_';

function shareText(phrase, catLabel) {
  return `"${phrase.text}"\n\n(${catLabel}) — ${phrase.tip}\n\nToday's Accountability Phrase, from the Accountability App.`;
}

// Share icon + fallback menu for the phrase. Uses the native share sheet
// (covers Messages/WhatsApp/Mail/everything installed) when available —
// mainly mobile — and falls back to explicit SMS/WhatsApp/Email/Copy links
// on desktop where navigator.share doesn't exist.
function ShareButton({ phrase, cat }) {
  const [open, setOpen] = useState(false);
  const text = shareText(phrase, cat.label);

  async function handleClick() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Accountability Phrase', text });
      } catch { /* user cancelled — no-op */ }
      return;
    }
    setOpen(o => !o);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy — try again');
    }
    setOpen(false);
  }

  const encoded = encodeURIComponent(text);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={handleClick} title="Share this phrase"
        style={{
          width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.95rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        📤
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 200,
            background: '#0f2044', borderRadius: 10, padding: 6, minWidth: 170,
            display: 'flex', flexDirection: 'column', gap: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            <a href={`sms:?body=${encoded}`} onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 0.6rem', borderRadius: 6, color: 'white', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
              💬 Text Message
            </a>
            <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 0.6rem', borderRadius: 6, color: 'white', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
              🟢 WhatsApp
            </a>
            <a href={`mailto:?subject=${encodeURIComponent('Accountability Phrase')}&body=${encoded}`} onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 0.6rem', borderRadius: 6, color: 'white', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
              ✉️ Email
            </a>
            <button onClick={copyText}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 0.6rem', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'white', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600 }}>
              📋 Copy Text
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Shown once per day, right after the user opens the app — a rotating
// Accountability Phrase. The pillar it comes from advances every day (Set
// the Bar -> Spark the Vision -> Improve the Flow -> Enable the Team ->
// Winning with Compassion -> Set the Bar again, but the next phrase in that
// pillar), cycling through all 100 phrases over 100 days — see
// utils/dailyPhrases.js. Gated by localStorage so it's a lightweight
// "seen today" flag, not worth a Firestore write — keyed by uid so
// switching accounts on the same device/browser doesn't have one account's
// dismissal suppress it for every other account.
export default function DailyPhraseModal() {
  const { currentUser, userProfile } = useAuth();
  const [show, setShow] = useState(false);
  const [phrase, setPhrase] = useState(null);

  useEffect(() => {
    if (!currentUser || !userProfile) return;
    if (userProfile.status === 'pending') return;
    // Don't stack on top of the welcome/tool-video modals a brand-new
    // account sees on its very first load.
    if (!userProfile.hasSeenWelcome) return;

    const todayKey = localDateKey();
    let lastSeen = '';
    try { lastSeen = localStorage.getItem(LS_KEY_PREFIX + currentUser.uid) || ''; } catch {}
    if (lastSeen === todayKey) return;

    setPhrase(pickTodaysPhrase());
    setShow(true);
  }, [currentUser, userProfile]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(LS_KEY_PREFIX + currentUser.uid, localDateKey()); } catch {}
  }

  if (!show || !phrase) return null;
  const cat = PHRASE_CATEGORIES[phrase.cat];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 480,
        boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
      }}>
        <div style={{ padding: '1.5rem 1.75rem 1.25rem', background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {cat.icon} Today's Accountability Phrase · #{phrase.day}/{DAILY_PHRASES.length} · {cat.label}
            </p>
            <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: 'white', lineHeight: 1.35 }}>
              "{phrase.text}"
            </p>
          </div>
          <ShareButton phrase={phrase} cat={cat} />
        </div>

        <div style={{ padding: '1.25rem 1.75rem' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>When to use it</p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>{phrase.tip}</p>
        </div>

        <div style={{ padding: '0 1.75rem 1.5rem' }}>
          <button onClick={dismiss} className="btn-primary" style={{ width: '100%' }}>
            Got it →
          </button>
        </div>
      </div>
    </div>
  );
}
