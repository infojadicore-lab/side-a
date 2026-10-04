import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { get } from '../../lib/api.js';
import type { UpdateItem } from '../../lib/types.js';
import { shortDate } from '../../lib/format.js';
import { useYouTubePlayer } from '../../lib/youtube.js';

const SOURCES: [string, string][] = [
  ['', 'All'],
  ['side_a', 'Side A'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['twitter_spaces', 'Spaces'],
];

function UpdateRow({ u }: { u: UpdateItem }): React.ReactElement {
  const yt = useYouTubePlayer(u.source_url);
  return (
    <div className="update-row">
      <div className="update-date">{shortDate(u.date)}</div>
      <div className="update-body">
        <p className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {u.title}
          {u.source && u.source !== 'side_a' ? (
            <a className="source-badge" href={u.source_url ?? '#'} target="_blank" rel="noopener noreferrer">
              {u.source}
            </a>
          ) : null}
          {yt.toggle}
        </p>
        <p className="desc">{u.description}</p>
        {yt.embed}
        {u.source_url ? (
          <p style={{ marginTop: 6 }}>
            <a href={u.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
              View source →
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function UpdatesPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const source = params.get('source') ?? '';
  const [updates, setUpdates] = useState<UpdateItem[] | null>(null);

  const load = useCallback((src: string) => {
    const url = src ? `/api/updates?source=${encodeURIComponent(src)}` : '/api/updates';
    void get<{ updates: UpdateItem[] }>(url)
      .then((d) => setUpdates(d.updates))
      .catch(() => setUpdates([]));
  }, []);

  useEffect(() => {
    setUpdates(null);
    load(source);
  }, [source, load]);

  return (
    <section className="screen active">
      <h2 className="section-title">Updates</h2>
      <p className="lede">What&apos;s moving at Side A, week to week.</p>
      <div className="update-filter">
        {SOURCES.map(([value, label]) => (
          <button
            key={label}
            type="button"
            data-source={value}
            className={(source || '') === value ? 'active' : ''}
            onClick={() => setParams(value ? { source: value } : {})}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="card" style={{ marginTop: 12, padding: '4px 20px' }}>
        {updates === null ? (
          <p className="board-empty">Loading updates…</p>
        ) : updates.length === 0 ? (
          <p className="board-empty">No updates yet. Please check back soon.</p>
        ) : (
          updates.map((u) => <UpdateRow key={u.id} u={u} />)
        )}
      </div>
    </section>
  );
}
