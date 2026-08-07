import PageHeader from '../components/PageHeader';

// One podcast per leadership pillar — mirrors the sidebar categories'
// icon/color scheme in Layout.jsx so this page reads as an extension of
// the same five pillars, not a bolted-on feature.
const PODCASTS = [
  { id: 'model',     pillar: 'Set the Bar',            icon: '🧭', color: '#60a5fa', episodeUrl: 'https://open.spotify.com/episode/6fCn9D7cmtd5LpRGJyy080?si=dnH_bXWLQs-c9K8k65sHLg' },
  { id: 'inspire',   pillar: 'Spark the Vision',        icon: '🔭', color: '#34d399', episodeUrl: 'https://open.spotify.com/episode/3nkZUvhvOBjhPHwK8awL25?si=MDPWRVBYSuKMzXQdBo8tnQ' },
  { id: 'challenge', pillar: 'Improve the Flow',        icon: '⚙️', color: '#fbbf24', episodeUrl: null },
  { id: 'enable',    pillar: 'Enable the Team',         icon: '🤝', color: '#a78bfa', episodeUrl: null },
  { id: 'encourage', pillar: 'Winning with Compassion', icon: '❤️', color: '#fb7185', episodeUrl: null },
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
          <a href={podcast.episodeUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.78rem', fontWeight: 700, color: podcast.color, textAlign: 'center' }}>
            🎧 Open in Spotify
          </a>
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
      <PageHeader icon="🎙️" title="Leadership Podcasts" subtitle="One show per pillar — listen, then bring it into how you lead" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {PODCASTS.map(p => <PodcastCard key={p.id} podcast={p} />)}
      </div>
    </div>
  );
}
