import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { get } from '../../lib/api.js';
import type { HomeData, Song } from '../../lib/types.js';
import { formatEditionDate, naira } from '../../lib/format.js';
import { WaveformBlock } from '../layout.js';

export function HomePage(): React.ReactElement {
  const [home, setHome] = useState<HomeData | null>(null);
  const [nowExtra, setNowExtra] = useState<Song | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<HomeData>('/api/home'),
      get<{ songs: Song[] }>('/api/songs').catch(() => ({ songs: [] })),
    ])
      .then(([h, s]) => {
        if (cancelled) return;
        setHome(h);
        const current = s.songs.find((x) => x.is_current) ?? null;
        setNowExtra(current);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = home?.nowSpinning ?? nowExtra;
  const next = home?.nextEdition ?? null;
  const latest = home?.latestUpdate ?? null;

  return (
    <section className="screen active">
      <div className="hero">
        <p className="eyebrow">A monthly album listening brunch, Lagos</p>
        <h1>Find your frequency.</h1>
        <p className="hero-tag">
          One album, front to back, with food, drinks and people who&apos;d rather sit with a record than talk over it.
        </p>
        <WaveformBlock />
      </div>
      <div>
        <p className="panel-label">Now spinning — the community&apos;s pick this week</p>
        {error ? (
          <div className="card">
            <p className="board-empty">Failed to load home.</p>
          </div>
        ) : !home ? (
          <div className="card">
            <p className="board-empty">Loading…</p>
          </div>
        ) : now ? (
          <div className="card">
            <p className="track-title">{now.title}</p>
            <p className="track-meta">
              Picked by {now.picked_by} · week {now.week_number}
            </p>
            <p className="track-note">{now.note}</p>
            <div className="link-row">
              <Link className="linklike" to="/song">
                React and comment
              </Link>
              <Link className="linklike" to="/submit">
                Recommend next week&apos;s pick
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="board-empty">No song of the week yet — submit and vote to pick one.</p>
          </div>
        )}
      </div>
      <div style={{ marginTop: 32 }}>
        <p className="panel-label">Next edition</p>
        {next ? (
          <div className="card">
            <div className="row-between">
              <p className="edition-album">
                {next.name || next.album} <span className="kind-badge">{next.kind || 'physical'}</span>
              </p>
              <p className="price">{naira(next.price)}</p>
            </div>
            <p className="edition-meta">
              <span>{formatEditionDate(next.date)}</span>
              <span>{next.venue}</span>
              <span className="spots">
                {next.spotsLeft} of {next.capacity} spots left
              </span>
            </p>
            <div style={{ marginTop: 16 }}>
              <a className="btn primary" href={next.tix_africa_url ?? '#'} target="_blank" rel="noopener noreferrer">
                Get tickets
              </a>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="board-empty">No upcoming edition yet. Stay jiggy 😉</p>
          </div>
        )}
      </div>
      <div style={{ marginTop: 32 }}>
        <p className="panel-label">Latest update</p>
        {latest ? (
          <div className="card">
            <p className="update-body-title" style={{ fontSize: 15.5 }}>
              {latest.title}
            </p>
            <p style={{ color: 'var(--cream-dim)', fontSize: 14, marginTop: 6 }}>{latest.description}</p>
            <div className="link-row">
              <Link className="linklike" to="/updates">
                Read all updates
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="board-empty">No updates yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
