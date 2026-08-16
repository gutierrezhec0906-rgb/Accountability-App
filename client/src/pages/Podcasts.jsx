import PageHeader from '../components/PageHeader';
import toast from 'react-hot-toast';

// One podcast per leadership pillar — mirrors the sidebar categories'
// icon/color scheme in Layout.jsx so this page reads as an extension of
// the same five pillars, not a bolted-on feature.
const PODCASTS = [
  { id: 'model',     pillar: 'Set the Bar',            icon: '🧭', color: '#60a5fa', episodeUrl: 'https://open.spotify.com/episode/6fCn9D7cmtd5LpRGJyy080?si=dnH_bXWLQs-c9K8k65sHLg' },
  { id: 'inspire',   pillar: 'Spark the Vision',        icon: '🔭', color: '#34d399', episodeUrl: 'https://open.spotify.com/episode/3nkZUvhvOBjhPHwK8awL25?si=MDPWRVBYSuKMzXQdBo8tnQ' },
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

function PodcastCard({ podcast }) {
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
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="🎙️" title="Leadership Podcast - The Five Pillars of Accountability" subtitle="One show per pillar — listen, then bring it into how you lead" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {PODCASTS.map(p => <PodcastCard key={p.id} podcast={p} />)}
      </div>
    </div>
  );
}
