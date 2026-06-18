import { useState, useEffect } from 'react';

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
  { text: "The speed of the leader is the speed of the gang.", author: "Mary Kay Ash" },
  { text: "Accountability is the glue that ties commitment to the result.", author: "Bob Proctor" },
  { text: "Earn your leadership every day.", author: "Michael Jordan" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Real integrity is doing the right thing, knowing that nobody's going to know whether you did it or not.", author: "Oprah Winfrey" },
  { text: "The challenge of leadership is to be strong, but not rude; be kind, but not weak.", author: "Jim Rohn" },
  { text: "Don't tell people how to do things. Tell them what to do and let them surprise you with their results.", author: "George S. Patton" },
  { text: "The key to successful leadership today is influence, not authority.", author: "Kenneth Blanchard" },
  { text: "Clarity is the most important thing. I can compare clarity to pruning in gardening. You know, you need to be clear. If you are not clear, nothing is going to happen.", author: "Diane von Furstenberg" },
  { text: "Urgent optimism is the desire to act immediately to tackle an obstacle, combined with the belief that we have a reasonable hope of success.", author: "Jane McGonigal" },
  { text: "Accountability breeds response-ability.", author: "Stephen R. Covey" },
  { text: "High performance is not about perfection. It is about progress and consistency.", author: "Robin Sharma" },
  { text: "What you permit, you promote.", author: "Unknown" },
  { text: "Culture eats strategy for breakfast.", author: "Peter Drucker" },
  { text: "The measure of a leader is not the quality of their ideas, but the number of people they inspire.", author: "Unknown" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Leaders must be close enough to relate to others, but far enough ahead to motivate them.", author: "John C. Maxwell" },
  { text: "The secret of change is to focus all your energy not on fighting the old, but on building the new.", author: "Socrates" },
  { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", author: "Johann Wolfgang von Goethe" },
];

export default function Quotes() {
  const todayIdx = new Date().getDate() % quotes.length;
  const [current, setCurrent] = useState(todayIdx);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('fav-quotes') || '[]'));
  const [showFavs, setShowFavs] = useState(false);

  function toggleFav(idx) {
    setFavorites(f => {
      const next = f.includes(idx) ? f.filter(i => i !== idx) : [...f, idx];
      localStorage.setItem('fav-quotes', JSON.stringify(next));
      return next;
    });
  }

  const displayed = showFavs ? favorites : quotes.map((_, i) => i);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leadership & Motivational Quotes</h1>
          <p className="text-slate-500 text-sm">Daily inspiration for high-performance leaders</p>
        </div>
        <div className="flex gap-2">
          <button className={showFavs ? 'btn-primary' : 'btn-secondary'} onClick={() => setShowFavs(s => !s)}>
            ⭐ {showFavs ? 'All Quotes' : `Favorites (${favorites.length})`}
          </button>
        </div>
      </div>

      {/* Featured Quote */}
      <div className="rounded-2xl p-8 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f2044, #1e3a6e)' }}>
        <div className="absolute top-4 right-4 text-6xl opacity-10 font-serif">"</div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#5eead4' }}>Today's Quote — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
        <p className="text-xl font-medium leading-relaxed mb-4">"{quotes[todayIdx].text}"</p>
        <p className="font-bold" style={{ color: '#5eead4' }}>— {quotes[todayIdx].author}</p>
        <button onClick={() => toggleFav(todayIdx)} className="mt-4 text-sm" style={{ color: favorites.includes(todayIdx) ? '#fbbf24' : '#94a3b8' }}>
          {favorites.includes(todayIdx) ? '⭐ Saved' : '☆ Save to Favorites'}
        </button>
      </div>

      {/* Quote Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {(showFavs ? favorites : quotes.map((_, i) => i)).map(idx => (
          <div key={idx} className={`card p-5 cursor-pointer transition-all hover:shadow-md ${current === idx ? 'ring-2 ring-teal-500' : ''}`} onClick={() => setCurrent(idx)}>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">"{quotes[idx].text}"</p>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold" style={{ color: '#0d9488' }}>— {quotes[idx].author}</p>
              <button onClick={e => { e.stopPropagation(); toggleFav(idx); }} className="text-lg">
                {favorites.includes(idx) ? '⭐' : '☆'}
              </button>
            </div>
          </div>
        ))}
        {showFavs && favorites.length === 0 && (
          <div className="col-span-2 card p-8 text-center text-slate-400">
            <p className="text-3xl mb-2">☆</p>
            <p>No favorites yet. Click ☆ on any quote to save it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
