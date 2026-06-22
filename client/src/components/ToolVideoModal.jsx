import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// Module-level cache so we only fetch appConfig/toolVideos once per session
let videoUrlCache = null;

export default function ToolVideoModal({ toolId, toolLabel, open, onClose }) {
  const { currentUser } = useAuth();
  const [videoUrl, setVideoUrl] = useState('');
  const [ready, setReady] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!open || !toolId) return;
    async function load() {
      if (!videoUrlCache) {
        try {
          const snap = await getDoc(doc(db, 'appConfig', 'toolVideos'));
          videoUrlCache = snap.exists() ? snap.data() : {};
        } catch {
          videoUrlCache = {};
        }
      }
      const url = videoUrlCache[toolId] || '';
      setVideoUrl(url);
      setReady(!!url);
    }
    load();
  }, [open, toolId]);

  async function dismiss() {
    onClose();
    if (currentUser && toolId) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          seenToolVideos: arrayUnion(toolId),
        });
      } catch {}
    }
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
            style={{ width: '100%', height: '100%', display: 'block' }}
            onEnded={dismiss}
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
