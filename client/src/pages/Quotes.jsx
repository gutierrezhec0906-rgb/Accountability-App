import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { logPointEvent } from '../utils/scoring';

const quotes = [
  { text: "Leadership is not about being in charge. It is about taking care of those in your charge.", author: "Simon Sinek" },
  { text: "The function of leadership is to produce more leaders, not more followers.", author: "Ralph Nader" },
  { text: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch" },
  { text: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell" },
  { text: "The greatest leader is not necessarily the one who does the greatest things. He is the one that gets the people to do the greatest things.", author: "Ronald Reagan" },
  { text: "If your actions inspire others to dream more, learn more, do more and become more, you are a leader.", author: "John Quincy Adams" },
  { text: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker" },
  { text: "The art of communication is the language of leadership.", author: "James Humes" },
  { text: "Outstanding leaders go out of their way to boost the self-esteem of their personnel.", author: "Sam Walton" },
  { text: "People don't care how much you know until they know how much you care.", author: "Theodore Roosevelt" },
  { text: "A good leader takes a little more than his share of the blame, a little less than his share of the credit.", author: "Arnold Glasow" },
  { text: "Accountability is the glue that ties commitment to the result.", author: "Bob Proctor" },
  { text: "Earn your leadership every day.", author: "Michael Jordan" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "The challenge of leadership is to be strong, but not rude; be kind, but not weak.", author: "Jim Rohn" },
  { text: "The key to successful leadership today is influence, not authority.", author: "Kenneth Blanchard" },
  { text: "Accountability breeds response-ability.", author: "Stephen R. Covey" },
  { text: "High performance is not about perfection. It is about progress and consistency.", author: "Robin Sharma" },
  { text: "What you permit, you promote.", author: "Unknown" },
  { text: "Culture eats strategy for breakfast.", author: "Peter Drucker" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "The secret of change is to focus all your energy not on fighting the old, but on building the new.", author: "Socrates" },
  { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", author: "Goethe" },
  { text: "Leaders must be close enough to relate to others, but far enough ahead to motivate them.", author: "John C. Maxwell" },
  { text: "Real integrity is doing the right thing, knowing that nobody's going to know whether you did it or not.", author: "Oprah Winfrey" },
];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const today = new Date().toISOString().split('T')[0];

export default function Quotes() {
  const { currentUser } = useAuth();
  const todayIdx = new Date().getDate() % quotes.length;
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('fav-quotes') || '[]'));
  const [showFavs, setShowFavs] = useState(false);

  // Quote reflection state
  const [selectedQuoteIdx, setSelectedQuoteIdx] = useState(todayIdx);
  const [connection, setConnection] = useState('');
  const [action, setAction] = useState('');
  const [reflections, setReflections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [expandedRef, setExpandedRef] = useState(null);

  const alreadyDoneToday = reflections.some(r => r.date === today);

  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          setReflections(snap.data().quoteReflections || []);
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, [currentUser]);

  function toggleFav(idx) {
    setFavorites(f => {
      const next = f.includes(idx) ? f.filter(i => i !== idx) : [...f, idx];
      localStorage.setItem('fav-quotes', JSON.stringify(next));
      return next;
    });
  }

  async function completeReflection() {
    if (!currentUser || !connection.trim() || !action.trim() || alreadyDoneToday) return;
    setSaving(true);
    const now = new Date().toISOString();
    const record = {
      id: now,
      date: today,
      savedAt: now,
      quoteText: quotes[selectedQuoteIdx].text,
      quoteAuthor: quotes[selectedQuoteIdx].author,
      connection: connection.trim(),
      action: action.trim(),
      points: 5,
    };
    const updated = [record, ...reflections].slice(0, 20);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { quoteReflections: updated }, { merge: true });
      const { awarded, capReached } = await logPointEvent(currentUser.uid, {
        points: 5,
        toolLabel: 'Leadership Quotes',
        reason: `Reflection on: "${quotes[selectedQuoteIdx].author}"`,
      });
      if (awarded) {
        await updateDoc(doc(db, 'users', currentUser.uid), { bonusPoints: increment(5) });
      }
      setReflections(updated);
      setConnection('');
      setAction('');
      if (awarded) {
        setToast('⭐ +5 pts earned! Reflection saved to your score.');
      } else if (capReached) {
        setToast('Reflection saved! You\'ve reached your 25-pt daily limit — amazing effort! Come back tomorrow to earn more. 🗓');
      } else {
        setToast('Reflection saved!');
      }
      setTimeout(() => setToast(''), 6000);
    } catch (e) {
      console.error(e);
      setToast('Save failed. Please try again.');
      setTimeout(() => setToast(''), 3000);
    }
    setSaving(false);
  }

  const canSave = connection.trim().length >= 10 && action.trim().length >= 10 && !alreadyDoneToday;
  const displayedIdxs = showFavs ? favorites : quotes.map((_, i) => i);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="💬" title="Leadership Quotes" subtitle="Daily inspiration for high-performance leaders"
        action={
          <button onClick={() => setShowFavs(s => !s)} className={showFavs ? 'btn-primary' : 'btn-secondary'}>
            ⭐ {showFavs ? 'All Quotes' : `Favorites (${favorites.length})`}
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: toast.startsWith('+') ? '#065f46' : '#0f2044', color: 'white', padding: '0.625rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Featured quote */}
      <div style={{
        borderRadius: 20, padding: '2rem', marginBottom: '1.75rem', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0b1a38 0%, #0f2044 60%, #0d9488 160%)',
        boxShadow: '0 8px 32px rgba(15,32,68,0.25)',
      }}>
        <div style={{ position: 'absolute', top: 16, right: 24, fontSize: '6rem', opacity: 0.07, fontFamily: 'Georgia, serif', lineHeight: 1, color: 'white' }}>"</div>
        <p style={{ color: '#99f6e4', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Today's Quote · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </p>
        <p style={{ color: 'white', fontSize: '1.2rem', fontWeight: 500, lineHeight: 1.65, margin: '0 0 14px', maxWidth: 600 }}>
          "{quotes[todayIdx].text}"
        </p>
        <p style={{ color: '#5eead4', fontWeight: 700, margin: '0 0 16px', fontSize: '0.9rem' }}>— {quotes[todayIdx].author}</p>
        <button onClick={() => toggleFav(todayIdx)}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.375rem 1rem', color: favorites.includes(todayIdx) ? '#fbbf24' : 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
          {favorites.includes(todayIdx) ? '⭐ Saved' : '☆ Save to Favorites'}
        </button>
      </div>

      {/* ── Quote Reflection Journal ── */}
      <div style={{ borderRadius: 16, border: '1px solid #e0e7ff', background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', padding: '1.5rem', marginBottom: '1.75rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontWeight: 800, color: '#4c1d95', margin: '0 0 2px', fontSize: '1rem' }}>📓 Quote Reflection Journal</h3>
            <p style={{ fontSize: '0.78rem', color: '#6d28d9', margin: 0 }}>Connect with a quote and commit to an action — earn <strong>+5 points</strong> daily</p>
          </div>
          {alreadyDoneToday && (
            <span style={{ background: '#059669', color: 'white', fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: 9999 }}>
              ✅ Completed today
            </span>
          )}
        </div>

        {alreadyDoneToday ? (
          <div style={{ background: 'white', borderRadius: 12, padding: '1rem', border: '1px solid #a7f3d0', textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', margin: '0 0 6px' }}>🏆</p>
            <p style={{ fontWeight: 700, color: '#065f46', margin: '0 0 4px', fontSize: '0.9rem' }}>You earned +5 points today!</p>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>Come back tomorrow to reflect on a new quote and earn more points.</p>
          </div>
        ) : (
          <>
            {/* Step 1 — Select quote */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Step 1 — Select a Quote
              </label>
              <select
                value={selectedQuoteIdx}
                onChange={e => setSelectedQuoteIdx(Number(e.target.value))}
                className="input"
                style={{ background: 'white', fontWeight: 600, color: '#1e293b' }}>
                {quotes.map((q, i) => (
                  <option key={i} value={i}>"{q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}" — {q.author}</option>
                ))}
              </select>
              {/* Preview selected */}
              <div style={{ marginTop: 10, background: 'white', borderRadius: 10, padding: '0.75rem 1rem', border: '1px solid #ddd6fe', borderLeft: '4px solid #7c3aed' }}>
                <p style={{ fontStyle: 'italic', color: '#374151', margin: '0 0 4px', fontSize: '0.875rem', lineHeight: 1.6 }}>"{quotes[selectedQuoteIdx].text}"</p>
                <p style={{ fontWeight: 700, color: '#7c3aed', fontSize: '0.78rem', margin: 0 }}>— {quotes[selectedQuoteIdx].author}</p>
              </div>
            </div>

            {/* Step 2 — Connection */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Step 2 — How do you connect with this quote?
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Describe how this quote resonates with you. What does it mean in your leadership journey?"
                value={connection}
                onChange={e => setConnection(e.target.value)}
                style={{ background: 'white', resize: 'vertical' }}
              />
              <p style={{ fontSize: '0.68rem', color: connection.trim().length < 10 ? '#ef4444' : '#6d28d9', margin: '4px 0 0', fontWeight: 600 }}>
                {connection.trim().length < 10 ? `${10 - connection.trim().length} more characters needed` : '✓ Good'}
              </p>
            </div>

            {/* Step 3 — Action */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Step 3 — How will you apply this today? Write a specific task or action for you and your team.
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Example: Today I will hold a 10-minute team stand-up focused on recognizing one team member's contribution publicly."
                value={action}
                onChange={e => setAction(e.target.value)}
                style={{ background: 'white', resize: 'vertical' }}
              />
              <p style={{ fontSize: '0.68rem', color: action.trim().length < 10 ? '#ef4444' : '#6d28d9', margin: '4px 0 0', fontWeight: 600 }}>
                {action.trim().length < 10 ? `${10 - action.trim().length} more characters needed` : '✓ Good'}
              </p>
            </div>

            <button
              onClick={completeReflection}
              disabled={!canSave || saving}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
                background: canSave ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : '#c4b5fd',
                color: 'white', fontWeight: 800, fontSize: '0.95rem', transition: 'all 0.2s',
                boxShadow: canSave ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
              }}>
              {saving ? 'Saving…' : '🏆 Complete Reflection — Earn +5 Points'}
            </button>
          </>
        )}
      </div>

      {/* Reflection history */}
      {reflections.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.75rem' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '0.9rem' }}>📚 Past Reflections</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reflections.slice(0, 10).map((rec, i) => (
              <div key={rec.id} style={{ borderRadius: 10, border: `1px solid ${i === 0 ? '#ddd6fe' : '#e2e8f0'}`, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedRef(expandedRef === rec.id ? null : rec.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.875rem', background: i === 0 ? '#f5f3ff' : '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {i === 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#7c3aed', color: 'white', padding: '1px 7px', borderRadius: 9999 }}>Latest</span>}
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(rec.savedAt)}</span>
                    <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>— {rec.quoteAuthor}</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '1px 7px', borderRadius: 9999 }}>+{rec.points} pts</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>{expandedRef === rec.id ? '▲' : '▼'}</span>
                </button>
                {expandedRef === rec.id && (
                  <div style={{ padding: '0.875rem', background: 'white', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ borderLeft: '3px solid #7c3aed', paddingLeft: '0.75rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Quote</p>
                      <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: '#374151', margin: '0 0 2px', lineHeight: 1.55 }}>"{rec.quoteText}"</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', margin: 0 }}>— {rec.quoteAuthor}</p>
                    </div>
                    <div style={{ borderLeft: '3px solid #0d9488', paddingLeft: '0.75rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0d9488', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>My Connection</p>
                      <p style={{ fontSize: '0.82rem', color: '#374151', margin: 0, lineHeight: 1.55 }}>{rec.connection}</p>
                    </div>
                    <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '0.75rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Action</p>
                      <p style={{ fontSize: '0.82rem', color: '#374151', margin: 0, lineHeight: 1.55 }}>{rec.action}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
        {displayedIdxs.map(idx => (
          <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.2s' }}>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.65, margin: 0, flex: 1 }}>"{quotes[idx].text}"</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <p style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>— {quotes[idx].author}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSelectedQuoteIdx(idx)} title="Use in reflection"
                  style={{ background: selectedQuoteIdx === idx ? '#ede9fe' : 'none', border: selectedQuoteIdx === idx ? '1px solid #c4b5fd' : 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', padding: '2px 7px', color: '#7c3aed', fontWeight: 700 }}>
                  {selectedQuoteIdx === idx ? '✓ Selected' : '📓 Reflect'}
                </button>
                <button onClick={() => toggleFav(idx)} style={{ background: 'none', border: 'none', fontSize: '1.125rem', cursor: 'pointer', padding: '2px 6px' }}>
                  {favorites.includes(idx) ? '⭐' : '☆'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {showFavs && favorites.length === 0 && (
          <div className="card" style={{ gridColumn: '1/-1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '2rem', marginBottom: 8 }}>☆</p>
            <p>No favorites yet. Click ☆ on any quote to save it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
