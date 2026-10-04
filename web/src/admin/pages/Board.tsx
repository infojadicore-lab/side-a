import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import type { BoardEntry, Song } from '../../lib/types.js';
import { useYouTubePlayer } from '../../lib/youtube.js';
import { Spinner, useBusyKey } from '../../components/Spinner.js';

function ArchiveRow({ s }: { s: Song }): React.ReactElement {
  const yt = useYouTubePlayer(s.youtube_url);
  return (
    <div className="board-row">
      <div className="board-rank">
        W{s.week_number}
        {s.is_current ? ' ★' : ''}
      </div>
      <div className="board-main">
        <p className="board-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>
            {s.title} — {s.artist}
          </span>
          {yt.toggle}
        </p>
        <p className="board-meta">Picked by {s.picked_by}</p>
        <p className="board-note">{s.note}</p>
        {yt.embed}
      </div>
    </div>
  );
}

export function BoardManager(): React.ReactElement {
  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [busyKey, runBusy] = useBusyKey();

  const load = useCallback(() => {
    void api<{ board: BoardEntry[] }>('/api/admin/board').then((res) => setBoard(res.body?.board ?? []));
    void api<{ songs: Song[] }>('/api/songs').then((res) => setSongs(res.body?.songs ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (id: string): void => {
    if (!confirm('Pick this entry? This closes the week — all other queued will be archived.')) return;
    runBusy(
      `pick-${id}`,
      api('/api/admin/board/pick', { method: 'POST', body: JSON.stringify({ id }) }).then((res) => {
        if (!res.ok) {
          alert((res.body as { error?: string }).error ?? 'Pick failed');
          return;
        }
        load();
      }),
    );
  };

  return (
    <section className="screen active">
      <h2 className="section-title">Board</h2>
      <p className="lede">
        Top 12 queued submissions by <code>score = upvotes − downvotes</code>. Downvoted stays visible (rank sinks).
        Picking a winner closes the week — all other queued are archived (new week = fresh).
      </p>
      <div className="card" style={{ marginTop: 16, padding: '6px 20px' }}>
        <p className="panel-label">Live board — queued only</p>
        {board === null ? (
          <p className="board-empty">Loading…</p>
        ) : board.length === 0 ? (
          <p className="board-empty">New week — be first to submit. Top 12 will appear as votes come in.</p>
        ) : (
          board.map((e, i) => (
            <div key={e.id} className="board-row">
              <div className="board-rank">{i + 1}</div>
              <div className="board-main">
                <p className="board-title">{e.track}</p>
                <p className="board-meta">
                  by {e.name} · score {e.score} ({e.upvotes}↑ {e.downvotes}↓) · {e.status}
                </p>
                <p className="board-note">{e.why}</p>
                <div className="board-votes">
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => pick(e.id)}
                    disabled={busyKey === `pick-${e.id}`}
                    aria-busy={busyKey === `pick-${e.id}`}
                  >
                    {busyKey === `pick-${e.id}` ? <Spinner /> : null} Pick as Song of the Week
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <p className="panel-label">Archive — songs (past winners)</p>
        <div className="stack">
          {songs === null ? (
            <p className="board-empty">Loading…</p>
          ) : songs.length === 0 ? (
            <p className="board-empty">No winners yet</p>
          ) : (
            songs.map((s) => <ArchiveRow key={s.id} s={s} />)
          )}
        </div>
      </div>
    </section>
  );
}
