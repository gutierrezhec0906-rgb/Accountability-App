import { useEffect, useState } from 'react';

// Lightweight "install to home screen" helper.
// - Android/Chrome/Edge: captures the native beforeinstallprompt event and shows
//   an "Install App" button that triggers the real OS install dialog.
// - iOS Safari: no programmatic prompt exists, so we show a one-time hint telling
//   the user to tap Share → "Add to Home Screen".
// Hidden entirely once the app is already running as an installed PWA.

const DISMISS_KEY = 'installPromptDismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed — nothing to do
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Android/desktop Chromium path
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari path — no event fires, so show the manual hint after a short delay
    if (isIos() && !window.navigator.standalone) {
      const t = setTimeout(() => { setIosHint(true); setShow(true); }, 1500);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onBeforeInstall); };
    }

    const onInstalled = () => setShow(false);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, '1');
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
    setShow(false);
  }

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 9999,
      maxWidth: 460, margin: '0 auto',
      background: '#0f2044', color: 'white', borderRadius: 14,
      boxShadow: '0 8px 30px rgba(15,32,68,0.35)', padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 9, flexShrink: 0, background: 'white' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.2 }}>Install Accountability App</div>
        {iosHint ? (
          <div style={{ fontSize: '0.76rem', opacity: 0.9, marginTop: 3, lineHeight: 1.35 }}>
            Tap the <strong>Share</strong> icon <span style={{ fontSize: '0.9em' }}>⎋</span>, then <strong>“Add to Home Screen”</strong>.
          </div>
        ) : (
          <div style={{ fontSize: '0.76rem', opacity: 0.9, marginTop: 3, lineHeight: 1.35 }}>
            Add it to your home screen for a full-screen, app-like experience.
          </div>
        )}
      </div>
      {!iosHint && (
        <button onClick={install} style={{
          background: '#10b981', color: 'white', border: 'none', borderRadius: 10,
          padding: '9px 14px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0,
        }}>Install</button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" style={{
        background: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none',
        fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', flexShrink: 0, padding: '0 2px',
      }}>×</button>
    </div>
  );
}
