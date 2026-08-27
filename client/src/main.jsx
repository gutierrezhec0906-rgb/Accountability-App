import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import toast from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker so the app is installable to the phone home screen (PWA).
// A tab left open across a deploy keeps running the old JS in memory forever — the
// service worker updating in the background doesn't rescue it. So when a NEW worker
// finishes installing over an already-active one (controller already set — i.e. this
// isn't the very first install), prompt the user to reload instead of silently forcing
// it, since a forced reload could wipe out whatever they're mid-typing.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            toast((t) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                🚀 A new version is available.
                <button
                  onClick={() => { toast.dismiss(t.id); window.location.reload() }}
                  style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}
                >
                  Reload
                </button>
              </span>
            ), { duration: Infinity, id: 'sw-update' })
          }
        })
      })
    }).catch(() => {})
  })
}
