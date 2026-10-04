import { useState } from 'react';

const YOUTUBE_PATTERNS = [
  // watch / embed on youtube.com + music + mobile subdomains
  /(?:(?:www|music|m)\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/,
  // youtu.be short links, optional timestamp/query
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
];

export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const re of YOUTUBE_PATTERNS) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isYouTubeUrl(url: string | null | undefined): boolean {
  return parseYouTubeId(url) !== null;
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = parseYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
}

export function YouTubeToggle({
  url,
  open,
  onToggle,
}: {
  url: string;
  open: boolean;
  onToggle: () => void;
}): React.ReactElement | null {
  if (!parseYouTubeId(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="yt-logo"
      aria-label={open ? 'Close YouTube player' : 'Watch on YouTube'}
      aria-expanded={open}
      title="Watch on YouTube"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onToggle();
      }}
    >
      <svg viewBox="0 0 24 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M23.5 2.2a3 3 0 0 0-2.1-2.1C19.6 0 12 0 12 0S4.4 0 2.6.1A3 3 0 0 0 .5 2.2 31 31 0 0 0 0 8a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.4 16 12 16 12 16s7.6 0 9.4-.1a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8a31 31 0 0 0-.5-5.8z"
        />
        <path fill="#fff" d="M9.8 11.5L15.6 8 9.8 4.5z" />
      </svg>
    </a>
  );
}

export function YouTubeEmbed({ url, open }: { url: string; open: boolean }): React.ReactElement | null {
  const embed = youtubeEmbedUrl(url);
  if (!open || !embed) return null;
  return (
    <div className="yt-embed open">
      <iframe src={embed} title="YouTube player" allow="accelerometer; encrypted-media" loading="lazy" allowFullScreen />
    </div>
  );
}

// Split toggle + player so call sites can keep the badge inline in the
// title row while the player renders as a full-width block below the
// description (a fragment inside the flex title squeezes the player).
export function useYouTubePlayer(url: string | null | undefined): {
  toggle: React.ReactElement | null;
  embed: React.ReactElement | null;
} {
  const [open, setOpen] = useState(false);
  if (!url || !isYouTubeUrl(url)) return { toggle: null, embed: null };
  const toggle = <YouTubeToggle url={url} open={open} onToggle={() => setOpen((v) => !v)} />;
  const embed = <YouTubeEmbed url={url} open={open} />;
  return { toggle, embed };
}

export function YouTubeLogo({ url }: { url: string }): React.ReactElement | null {
  const { toggle, embed } = useYouTubePlayer(url);
  if (!toggle) return null;
  return (
    <>
      {toggle}
      {embed}
    </>
  );
}
