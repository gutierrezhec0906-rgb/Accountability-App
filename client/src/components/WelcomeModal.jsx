import { useEffect, useState } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function WelcomeModal() {
  const { currentUser, userProfile } = useAuth();
  const [show, setShow] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    if (!currentUser || !userProfile) return;
    if (userProfile.status === 'pending') return;
    if (userProfile.hasSeenWelcome) return;

    // Load video URL from Firestore app config
    getDoc(doc(db, 'appConfig', 'welcome')).then(snap => {
      const url = snap.exists() ? snap.data().videoUrl : '';
      if (url) {
        setVideoUrl(url);
        setShow(true);
      }
    }).catch(() => {});
  }, [currentUser, userProfile]);

  async function dismiss() {
    setShow(false);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { hasSeenWelcome: true });
    } catch {}
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#0f2044', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 720,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2"/>
                <path d="M10 16l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>Leadership Flow Technologies</p>
              <p style={{ color: '#99f6e4', fontSize: '0.72rem', margin: 0, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Accountability App</p>
            </div>
          </div>
          <button onClick={dismiss} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: 8, padding: '0.35rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            Skip
          </button>
        </div>

        {/* Video */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
          <video
            src={videoUrl}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', display: 'block' }}
            onEnded={dismiss}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: 0 }}>
            This message plays once. Welcome to your accountability journey.
          </p>
          <button
            onClick={dismiss}
            style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );
}
