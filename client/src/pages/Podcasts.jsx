import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, addDoc, deleteDoc, collection, query, where, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import toast from 'react-hot-toast';

const REACTION_EMOJIS = ['👍', '❤️', '🎉', '🙏', '😍', '👎'];

// One podcast per leadership pillar — mirrors the sidebar categories'
// icon/color scheme in Layout.jsx so this page reads as an extension of
// the same five pillars, not a bolted-on feature.
const PODCASTS = [
  { id: 'model',     pillar: 'Set the Bar',            icon: '🧭', color: '#60a5fa', episodeUrl: 'https://open.spotify.com/episode/3k2erhglbdH6etH2WKmSHr?si=UD32mkdRQG6P8tXotGln2Q' },
  { id: 'inspire',   pillar: 'Spark the Vision',        icon: '🔭', color: '#34d399', episodeUrl: 'https://open.spotify.com/episode/494fA0ybeo7jYEqkejZC1P?si=K891vq3XRUCDh1G-4opQ3w' },
  { id: 'challenge', pillar: 'Improve the Flow',        icon: '⚙️', color: '#fbbf24', episodeUrl: 'https://open.spotify.com/episode/4p8TtCiYP796VBMNqFrSBM?si=r-mwc-HVT5eD_k8ZSSBRvA' },
  { id: 'enable',    pillar: 'Enable the Team',         icon: '🤝', color: '#a78bfa', episodeUrl: 'https://open.spotify.com/episode/14Or7RLH5wF2ZpFQFQkriF?si=x3SWK8tOTEqYLkTHW98MqA' },
  { id: 'encourage', pillar: 'Winning with Compassion', icon: '❤️', color: '#fb7185', episodeUrl: 'https://open.spotify.com/episode/5AsvXJWvPdxcY2NnOckabI?si=1EAjJtYmScSEqf0aNg_T5A' },
];

// Spotify's oEmbed iframe wants /embed/episode/{id} (or /embed/show/{id}),
// not the open.spotify.com share link — strip query params and swap the path.
function spotifyEmbedSrc(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean); // ["episode", "{id}"] or ["show", "{id}"]
    if (parts.length < 2) return null;
    return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

// Opens the device's native share sheet (WhatsApp, Messenger, Mail, etc.) on
// mobile. Desktop browsers mostly don't support navigator.share, so fall
// back to copying the link to the clipboard.
async function sharePodcast(podcast) {
  const shareData = {
    title: `${podcast.pillar} — Leadership Podcast`,
    text: `Check out this ${podcast.pillar} episode from the Accountability App podcast series.`,
    url: podcast.episodeUrl,
  };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch { /* user cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(podcast.episodeUrl);
    toast.success('Link copied to clipboard');
  } catch {
    toast.error('Could not copy link');
  }
}

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function fmtCommentTime(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Team-visible reactions on a podcast episode — same emoji set and visual
// language as Quotes.jsx's TeamReactionRow, kept in sync intentionally.
function TeamReactionRow({ counts = {}, myEmoji, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {REACTION_EMOJIS.map(emoji => {
        const count = counts[emoji] || 0;
        const isMine = myEmoji === emoji;
        if (count === 0 && !isMine) {
          return (
            <button key={emoji} onClick={() => onToggle(emoji)} title="React"
              style={{ background: 'none', border: '1px solid #e8edf5', borderRadius: 9999, padding: '2px 8px', fontSize: '0.85rem', cursor: 'pointer', opacity: 0.55, transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}>
              {emoji}
            </button>
          );
        }
        return (
          <button key={emoji} onClick={() => onToggle(emoji)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, border: isMine ? '1px solid #0d9488' : '1px solid #e8edf5', background: isMine ? '#f0fdfa' : 'white', borderRadius: 9999, padding: '2px 8px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 700, color: '#0f2044' }}>
            {emoji}<span style={{ fontSize: '0.7rem' }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// Facebook/Instagram-style comment thread scoped to the viewer's team —
// identical mechanics to Quotes.jsx's QuoteComments, targeting a separate
// `podcastComments` collection keyed by episodeId instead of quoteIdx.
function PodcastComments({ episodeId, currentUser, teamId, authorName }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState(null); // null = not yet loaded
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!expanded || comments !== null) return;
    async function load() {
      if (!teamId) { setComments([]); return; }
      try {
        const snap = await getDocs(query(
          collection(db, 'podcastComments'),
          where('teamId', '==', teamId),
          where('episodeId', '==', episodeId),
        ));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return at - bt;
        });
        setComments(list);
      } catch (e) { console.error(e); setComments([]); }
    }
    load();
  }, [expanded, teamId, episodeId]);

  const count = comments?.length ?? null;

  async function postComment() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!teamId) {
      toast.error("You need to be assigned to a team before you can comment. Ask your admin.");
      return;
    }
    setPosting(true);
    try {
      const newComment = {
        episodeId, teamId, uid: currentUser.uid, authorName: authorName || 'Teammate',
        text: trimmed, createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'podcastComments'), newComment);
      setComments(c => [...(c || []), { id: ref.id, ...newComment, createdAt: new Date() }]);
      setText('');
    } catch (e) {
      console.error(e);
      toast.error('Could not post comment. Please try again.');
    }
    setPosting(false);
  }

  async function removeComment(id) {
    try {
      await deleteDoc(doc(db, 'podcastComments', id));
      setComments(c => c.filter(x => x.id !== id));
    } catch (e) { console.error(e); toast.error('Could not delete comment.'); }
  }

  return (
    <div>
      <style>{`
        .pc-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
        .pc-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
        .pc-scroll::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; }
      `}</style>
      <button onClick={() => setExpanded(e => !e)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.78rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
        💬 {count === null ? 'Comments' : count === 0 ? 'Comment' : `${count} comment${count === 1 ? '' : 's'}`}
        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', padding: '0.65rem' }}>
          {!teamId && (
            <p style={{ fontSize: '0.72rem', color: '#b45309', margin: '0 0 8px' }}>
              Ask your admin to assign you to a team to see and post your team's comments.
            </p>
          )}
          {comments === null ? (
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Loading…</p>
          ) : comments.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>No comments yet — be the first to say something.</p>
          ) : (
            <div className="pc-scroll" style={{ maxHeight: 260, overflowY: 'scroll', scrollbarWidth: 'thin', scrollbarColor: '#64748b #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {comments.map(c => (
                <div key={c.id} style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
                  <Avatar name={c.authorName} />
                  <div style={{ flex: 1, minWidth: 0, background: 'white', borderRadius: 10, padding: '0.5rem 0.7rem', border: '1px solid #e8edf5' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f2044' }}>{c.authorName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fmtCommentTime(c.createdAt)}</span>
                        {c.uid === currentUser?.uid && (
                          <button onClick={() => removeComment(c.id)} title="Delete"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#94a3b8', padding: 0 }}>🗑</button>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#374151', lineHeight: 1.5, wordBreak: 'break-word' }}>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              placeholder="Write a comment…"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !posting) postComment(); }}
              style={{ flex: 1, background: 'white', fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
            />
            <button onClick={postComment} disabled={posting || !text.trim()}
              style={{ border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', background: text.trim() ? '#0d9488' : '#cbd5e1', color: 'white', fontWeight: 700, fontSize: '0.78rem', cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PodcastCard({ podcast, currentUser, teamId, myName, myEmoji, counts, onToggleReaction }) {
  const embedSrc = spotifyEmbedSrc(podcast.episodeUrl);
  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12, borderLeft: `4px solid ${podcast.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${podcast.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
          {podcast.icon}
        </div>
        <div>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1rem' }}>{podcast.pillar}</h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Podcast</p>
        </div>
      </div>

      {embedSrc ? (
        <>
          <iframe
            title={`${podcast.pillar} podcast player`}
            style={{ borderRadius: 12, border: 'none' }}
            src={embedSrc}
            width="100%"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <a href={podcast.episodeUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '0.78rem', fontWeight: 700, color: podcast.color, textAlign: 'center' }}>
              🎧 Open in Spotify
            </a>
            <button onClick={() => sharePodcast(podcast)} title="Share this episode"
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', padding: 0 }}>
              ↗ Share
            </button>
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TeamReactionRow counts={counts} myEmoji={myEmoji} onToggle={emoji => onToggleReaction(podcast.id, emoji)} />
            <PodcastComments episodeId={podcast.id} currentUser={currentUser} teamId={teamId} authorName={myName} />
          </div>
        </>
      ) : (
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1.5rem 1rem', textAlign: 'center', border: '1px dashed #e2e8f0' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>🎙️ Coming soon</p>
        </div>
      )}
    </div>
  );
}

export default function Podcasts() {
  const { currentUser } = useAuth();
  const [myReactions, setMyReactions] = useState({});  // { episodeId: emoji }
  const [teamCounts, setTeamCounts] = useState({});     // { episodeId: { emoji: count } }
  const [myTeamId, setMyTeamId] = useState(null);
  const [myName, setMyName] = useState('');

  // Team-scoped podcast reactions — each teammate's own pick lives on their
  // own users/{uid}.podcastReactions.{episodeId} field (no rules change
  // needed, same self-doc pattern as Quotes.jsx's quoteReactions); we
  // aggregate everyone sharing the current user's teamId client-side.
  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setMyReactions(data.podcastReactions || {});
          setMyName(data.name || data.displayName || currentUser.email || 'Teammate');

          const teamId = data.teamId || null;
          setMyTeamId(teamId);
          if (teamId) {
            const membersSnap = await getDocs(query(
              collection(db, 'users'),
              where('teamId', '==', teamId)
            ));
            const counts = {};
            membersSnap.docs.forEach(d => {
              const reactions = d.data().podcastReactions || {};
              Object.entries(reactions).forEach(([epId, emoji]) => {
                counts[epId] = counts[epId] || {};
                counts[epId][emoji] = (counts[epId][emoji] || 0) + 1;
              });
            });
            setTeamCounts(counts);
          } else {
            const counts = {};
            Object.entries(data.podcastReactions || {}).forEach(([epId, emoji]) => {
              counts[epId] = { [emoji]: 1 };
            });
            setTeamCounts(counts);
          }
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, [currentUser]);

  async function toggleReaction(episodeId, emoji) {
    const prev = myReactions[episodeId];
    const next = prev === emoji ? null : emoji;

    setTeamCounts(c => {
      const forEp = { ...(c[episodeId] || {}) };
      if (prev) forEp[prev] = Math.max(0, (forEp[prev] || 1) - 1);
      if (next) forEp[next] = (forEp[next] || 0) + 1;
      return { ...c, [episodeId]: forEp };
    });
    setMyReactions(r => {
      const nextR = { ...r };
      if (next) nextR[episodeId] = next; else delete nextR[episodeId];
      return nextR;
    });

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [`podcastReactions.${episodeId}`]: next ?? deleteField(),
      });
    } catch (e) { console.error('Could not save podcast reaction', e); }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="🎙️" title="Leadership Podcast - The Five Pillars of Accountability" subtitle="One show per pillar — listen, then bring it into how you lead" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {PODCASTS.map(p => (
          <PodcastCard key={p.id} podcast={p}
            currentUser={currentUser} teamId={myTeamId} myName={myName}
            myEmoji={myReactions[p.id]} counts={teamCounts[p.id]}
            onToggleReaction={toggleReaction} />
        ))}
      </div>
    </div>
  );
}
