import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// localStorage mirror of "videos this user has already seen" — persisted
// instantly and per-device, so a video never auto-reopens even if the cached
// userProfile hasn't refreshed with the Firestore write yet.
const LS_KEY = 'seenToolVideos';
export function seenVideosLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function markSeenLocal(toolId) {
  const arr = seenVideosLocal();
  if (!arr.includes(toolId)) { arr.push(toolId); localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
}

export default function ToolVideoModal({ toolId, toolLabel, open, onClose }) {
  const { currentUser } = useAuth();
  const [videoUrl, setVideoUrl] = useState('');
  const [ready, setReady] = useState(false);
  const videoRef = useRef(null);

  async function markSeen() {
    if (!toolId) return;
    markSeenLocal(toolId);
    if (currentUser) {
      try { await updateDoc(doc(db, 'users', currentUser.uid), { seenToolVideos: arrayUnion(toolId) }); } catch {}
    }
  }

  useEffect(() => {
    if (!open || !toolId) { setReady(false); return; }
    let active = true;
    // Always fetch the latest config on open so a freshly uploaded video shows
    // immediately (no stale session cache).
    (async () => {
      let url = '';
      try {
        const snap = await getDoc(doc(db, 'appConfig', 'toolVideos'));
        url = (snap.exists() && snap.data()[toolId]) || '';
      } catch (e) {
        console.warn('Could not load tool video config', e);
      }
      if (!active) return;
      setVideoUrl(url);
      setReady(!!url);
      // The moment a video is actually shown, mark it seen — so it won't
      // auto-open again even if the user navigates away without closing it.
      if (url) markSeen();
    })();
    return () => { active = false; };
  }, [open, toolId]);

  async function dismiss() {
    onClose();
    await markSeen();
  }

  if (!open || !ready) return null;

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
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <polygon points="12,8 26,16 12,24" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>How to Use: {toolLabel}</p>
              <p style={{ color: '#99f6e4', fontSize: '0.72rem', margin: 0, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Quick Walkthrough</p>
            </div>
          </div>
          <button onClick={dismiss} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: 8, padding: '0.35rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            Skip
          </button>
        </div>

        {/* Video */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            playsInline
            preload="auto"
            style={{ width: '100%', height: '100%', display: 'block' }}
            onEnded={dismiss}
            onError={() => console.warn('Tool video failed to load:', videoUrl)}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: 0 }}>
            You can replay this anytime using the "▶ How to use" button.
          </p>
          <button
            onClick={dismiss}
            style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Got it →
          </button>
        </div>
      </div>
    </div>
  );
}
