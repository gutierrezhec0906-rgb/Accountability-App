import { useState } from 'react';
import PageHeader from '../components/PageHeader';

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

export default function Quotes() {
  const todayIdx = new Date().getDate() % quotes.length;
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('fav-quotes') || '[]'));
  const [showFavs, setShowFavs] = useState(false);

  function toggleFav(idx) {
    setFavorites(f => {
      const next = f.includes(idx) ? f.filter(i => i !== idx) : [...f, idx];
      localStorage.setItem('fav-quotes', JSON.stringify(next));
      return next;
    });
  }

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

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
        {displayedIdxs.map(idx => (
          <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.2s' }}>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.65, margin: 0, flex: 1 }}>"{quotes[idx].text}"</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <p style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>— {quotes[idx].author}</p>
              <button onClick={() => toggleFav(idx)} style={{ background: 'none', border: 'none', fontSize: '1.125rem', cursor: 'pointer', padding: '2px 6px' }}>
                {favorites.includes(idx) ? '⭐' : '☆'}
              </button>
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
