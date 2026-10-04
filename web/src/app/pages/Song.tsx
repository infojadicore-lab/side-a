import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fingerprint, get, post } from '../../lib/api.js';
import type { BoardEntry, Song } from '../../lib/types.js';
import { YouTubeLogo, isYouTubeUrl } from '../../lib/youtube.js';
import { SignInButton, displayNameFromToken, readToken, useSignedIn } from '../../components/SignInButton.js';

type ReactionKind = 'repeat' | 'needed' | 'skip';

// Filled triangles, one set for both vote buttons. fill="currentColor" lets
// hover/active/disabled CSS recolor them with no extra assets; up/down carry
// no reading-direction meaning so they never flip in RTL.
// (.agents/skills/better-ui/icons.md)
function VoteUpIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 3.5 13.5 12.5h-11z" fill="currentColor" />
    </svg>
  );
}

function VoteDownIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 12.5 2.5 3.5h11z" fill="currentColor" />
    </svg>
  );
}

function SongRow({ song }: { song: Song }): React.ReactElement {
  const [counts, setCounts] = useState({
    repeat: song.reaction_repeat,
    needed: song.reaction_needed,
    skip: song.reaction_skip,
  });
  const [active, setActive] = useState<Partial<Record<ReactionKind, boolean>>>({});
  const [comments, setComments] = useState(song.comments);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [needsCommentAuth, setNeedsCommentAuth] = useState(false);
  const signedIn = useSignedIn();
  const commentPromptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (signedIn) setNeedsCommentAuth(false);
  }, [signedIn]);

  const react = (kind: ReactionKind): void => {
    const wasActive = active[kind] ?? false;
    setActive((p) => ({ ...p, [kind]: !wasActive }));
    setCounts((c) => ({ ...c, [kind]: c[kind] + (wasActive ? -1 : 1) }));
    // Single persist call (backend toggles by fingerprint) — fire and forget.
    try {
      const fp = fingerprint();
      void fetch(`/api/songs/${song.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-fingerprint': fp },
        body: JSON.stringify({ kind }),
      }).catch(() => {});
    } catch {
      /* offline */
    }
  };

  const submitComment = (): void => {
    const text = draft.trim();
    if (!text) return;
    if (!readToken()) {
      setNeedsCommentAuth(true);
      requestAnimationFrame(() => commentPromptRef.current?.scrollIntoView({ block: 'nearest' }));
      return;
    }
    setNeedsCommentAuth(false);
    const localId = `local-${Date.now()}`;
    const optimistic = {
      id: localId,
      song_id: song.id,
      who: displayNameFromToken(readToken()) ?? 'You',
      text,
      created_at: new Date().toISOString(),
    };
    setComments((c) => [...c, optimistic]);
    setDraft('');
    void post<{ comment: { id: string; who: string } }>(
      `/api/songs/${song.id}/comments`,
      { text },
      { auth: true },
    )
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            // Not signed in (or expired token) — keep the draft visible via prompt.
            setComments((c) => c.filter((x) => x.id !== localId));
            setDraft(text);
            setNeedsCommentAuth(true);
            requestAnimationFrame(() => commentPromptRef.current?.scrollIntoView({ block: 'nearest' }));
            return;
          }
          throw new Error('comment failed');
        }
        // Replace the optimistic name with the server-attributed username.
        const serverWho = res.body.comment.who;
        setComments((c) => c.map((x) => (x.id === localId ? { ...x, id: res.body.comment.id, who: serverWho } : x)));
      })
      .catch(() => {
        setComments((c) => c.filter((x) => x.id !== localId));
        setDraft(text);
      });
  };

  return (
    <div className={`track-row${song.is_current ? ' current' : ''}`}>
      <div className="track-num">{song.week_number}</div>
      <div className="track-main">
        {song.is_current ? <span className="now-badge">Now playing</span> : null}
        <p className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {song.title}
          {song.youtube_url && isYouTubeUrl(song.youtube_url) ? <YouTubeLogo url={song.youtube_url} /> : null}
        </p>
        <p className="by">
          {song.artist} · picked by {song.picked_by}
        </p>
        <p className="note">{song.note}</p>
        <div className="reactions">
          {(
            [
              ['repeat', 'On repeat'],
              ['needed', 'Needed this'],
              ['skip', 'Not for me'],
            ] as [ReactionKind, string][]
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={`reaction${active[kind] ? ' active' : ''}`}
              onClick={() => react(kind)}
            >
              <span className="label">{label}</span> <span className="count">({counts[kind]})</span>
            </button>
          ))}
        </div>
        <div className="comments">
          <button type="button" className="comment-toggle" onClick={() => setFormOpen((v) => !v)}>
            {comments.length} comments
          </button>
          <div className="comment-list">
            {comments.map((c) => (
              <p key={c.id} className="comment">
                <span className="who">{c.who}</span>
                {c.text}
              </p>
            ))}
          </div>
          {!signedIn || needsCommentAuth ? (
            <div ref={commentPromptRef} style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0 4px', flexWrap: 'wrap' }}>
              <p className="board-empty" style={{ padding: 0 }}>
                {needsCommentAuth ? 'Sign in to comment — join the conversation.' : 'Sign in with Google to comment.'}
              </p>
              <SignInButton contextLabel="commenting" />
            </div>
          ) : null}
          <div className={`comment-form${formOpen ? ' open' : ''}`}>
            <input
              type="text"
              placeholder="Add a comment"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment();
              }}
            />
            <button type="button" className="btn small" onClick={submitComment}>
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SongPage(): React.ReactElement {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const signedIn = useSignedIn();
  const promptRef = useRef<HTMLDivElement>(null);

  const loadBoard = useCallback(() => {
    void get<{ board: BoardEntry[] }>('/api/board')
      .then((d) => setBoard(d.board))
      .catch(() => setBoard([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void get<{ songs: Song[] }>('/api/songs')
      .then((d) => {
        if (!cancelled) setSongs(d.songs);
      })
      .catch(() => {
        if (!cancelled) setSongs([]);
      });
    loadBoard();
    return () => {
      cancelled = true;
    };
  }, [loadBoard]);

  useEffect(() => {
    if (signedIn) setNeedsAuth(false);
  }, [signedIn]);

  const vote = (id: string, direction: 'up' | 'down'): void => {
    if (!readToken()) {      setNeedsAuth(true);
      requestAnimationFrame(() => promptRef.current?.scrollIntoView({ block: 'nearest' }));
      return;
    }
    setNeedsAuth(false);
    void api(`/api/board/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
      auth: true,
    }).then((res) => {
      if (!res.ok) {
        if (res.status === 401) {
          // Expired or invalid token — prompt a fresh sign-in, no dead-end alert.
          setNeedsAuth(true);
          requestAnimationFrame(() => promptRef.current?.scrollIntoView({ block: 'nearest' }));
          return;
        }
        alert((res.body as { error?: string }).error ?? 'Vote failed');
        return;
      }
      loadBoard();
    });
  };

  return (
    <section className="screen active">
      <h2 className="section-title">Song of the week</h2>
      <p className="lede">
        Every week, one member&apos;s pick runs the room. React with how it landed, or drop a comment. Anyone can put
        a song up next — see Submit.
      </p>
      <div className="card" style={{ marginTop: 26, padding: '6px 20px' }}>
        {songs === null ? (
          <p className="board-empty">Loading songs…</p>
        ) : songs.length === 0 ? (
          <p className="board-empty">
            No songs yet — submissions that get picked will appear here. Each week card shows reactions and comments.
          </p>
        ) : (
          songs.map((s) => <SongRow key={s.id} song={s} />)
        )}
      </div>
      <div className="card" style={{ marginTop: 16, padding: '6px 20px' }}>
        <p className="panel-label">Board — top 12 this week</p>
        {!signedIn || needsAuth ? (
          <div ref={promptRef} style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 12px' }}>
            <p className="board-empty" style={{ padding: 0 }}>
              {needsAuth ? 'Sign in to vote — your pick counts.' : 'Sign in with Google to vote.'}
            </p>
            <SignInButton contextLabel="voting" />
          </div>
        ) : null}
        {board === null ? (
          <p className="board-empty">Loading board…</p>
        ) : board.length === 0 ? (
          <p className="board-empty">New week — be the first to submit. Top 12 will appear here as votes come in.</p>
        ) : (
          board.map((e, i) => (
            <div key={e.id} className="board-row">
              <div className="board-rank">{i + 1}</div>
              <div className="board-main">
                <p className="board-title">{e.track}</p>
                <p className="board-meta">
                  by {e.name} · score {e.score} ({e.upvotes}↑ {e.downvotes}↓)
                </p>
                <p className="board-note">{e.why}</p>
                <div className="board-votes">
                  <button type="button" className="vote-btn" onClick={() => vote(e.id, 'up')}>
                    <VoteUpIcon /> Upvote ({e.upvotes})
                  </button>
                  <button type="button" className="vote-btn" onClick={() => vote(e.id, 'down')}>
                    <VoteDownIcon /> Downvote ({e.downvotes})
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
