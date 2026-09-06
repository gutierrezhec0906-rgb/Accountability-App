import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DAILY_PHRASES, PHRASE_CATEGORIES, pickTodaysPhrase, localDateKey } from '../utils/dailyPhrases';

const LS_KEY = 'dailyPhraseSeenDate';

// Shown once per day, right after the user opens the app — a rotating
// Accountability Phrase (100 of them, one per day, cycling back to #1 after
// #100 — see utils/dailyPhrases.js) with a brief "when to use it" tip.
// Gated by localStorage so it's a lightweight per-device "seen today" flag,
// not something worth a Firestore write.
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
    try { lastSeen = localStorage.getItem(LS_KEY) || ''; } catch {}
    if (lastSeen === todayKey) return;

    setPhrase(pickTodaysPhrase());
    setShow(true);
  }, [currentUser, userProfile]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(LS_KEY, localDateKey()); } catch {}
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
        <div style={{ padding: '1.5rem 1.75rem 1.25rem', background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cat.icon} Today's Accountability Phrase · #{phrase.day}/{DAILY_PHRASES.length} · {cat.label}
          </p>
          <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: 'white', lineHeight: 1.35 }}>
            "{phrase.text}"
          </p>
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
