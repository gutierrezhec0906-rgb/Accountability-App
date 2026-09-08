import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PHRASE_CATEGORIES, pickTodaysPhrases, localDateKey } from '../utils/dailyPhrases';

const LS_KEY_PREFIX = 'dailyPhraseSeenDate_';

// Shown once per day, right after the user opens the app — one rotating
// Accountability Phrase per pillar (5 total, all 5 pillars every day), so
// the user gets a variety of perspectives daily instead of just one. Each
// pillar's list has 20 phrases and advances in lockstep, cycling back to
// day 1 after 20 days — see utils/dailyPhrases.js. Gated by localStorage
// so it's a lightweight "seen today" flag, not worth a Firestore write —
// keyed by uid so switching accounts on the same device/browser doesn't
// have one account's dismissal suppress it for every other account.
export default function DailyPhraseModal() {
  const { currentUser, userProfile } = useAuth();
  const [show, setShow] = useState(false);
  const [phrases, setPhrases] = useState(null);

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

    setPhrases(pickTodaysPhrases());
    setShow(true);
  }, [currentUser, userProfile]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(LS_KEY_PREFIX + currentUser.uid, localDateKey()); } catch {}
  }

  if (!show || !phrases) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
      }}>
        <div style={{ padding: '1.25rem 1.75rem', background: 'linear-gradient(135deg, #0f2044, #134e6a)', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'rgba(153,246,228,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🗓️ Today's Accountability Phrases · Day {phrases[0].day}/20
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 900, color: 'white' }}>One phrase from each of the 5 pillars</p>
        </div>

        <div style={{ padding: '1.25rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {phrases.map((phrase, i) => {
            const cat = PHRASE_CATEGORIES[phrase.cat];
            return (
              <div key={i} style={{ border: `1.5px solid ${cat.color}33`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.6rem 0.9rem', background: `${cat.color}14` }}>
                  <p style={{ margin: '0 0 3px', fontSize: '0.66rem', fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {cat.icon} {cat.label}
                  </p>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f2044', lineHeight: 1.35 }}>
                    "{phrase.text}"
                  </p>
                </div>
                <div style={{ padding: '0.6rem 0.9rem', background: 'white' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.55 }}>{phrase.tip}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '0 1.75rem 1.5rem', flexShrink: 0 }}>
          <button onClick={dismiss} className="btn-primary" style={{ width: '100%' }}>
            Got it →
          </button>
        </div>
      </div>
    </div>
  );
}
