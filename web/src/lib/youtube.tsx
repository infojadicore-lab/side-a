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

export function YouTubeLogo({ url }: { url: string }): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const id = parseYouTubeId(url);
  if (!id) return null;
  const embed = youtubeEmbedUrl(url);
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="yt-logo"
        aria-label="Watch on YouTube"
        title="Watch on YouTube"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          setOpen((v) => !v);
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
      {open && embed ? (
        <div className="yt-embed open">
          <iframe src={embed} title="YouTube player" allow="accelerometer; encrypted-media" loading="lazy" allowFullScreen />
        </div>
      ) : null}
    </>
  );
}
