import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fingerprint, get, post } from '../../lib/api.js';
import type { BoardEntry, Song } from '../../lib/types.js';
import { useYouTubePlayer } from '../../lib/youtube.js';
import { SignInButton, displayNameFromToken, readToken, useSignedIn } from '../../components/SignInButton.js';
import { Spinner } from '../../components/Spinner.js';

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
  const [commenting, setCommenting] = useState(false);
  const [needsCommentAuth, setNeedsCommentAuth] = useState(false);
  const signedIn = useSignedIn();
  const commentPromptRef = useRef<HTMLDivElement>(null);
  const yt = useYouTubePlayer(song.youtube_url);

  useEffect(() => {
    if (signedIn) setNeedsCommentAuth(false);
  }, [signedIn]);

  const react = (kind: ReactionKind): void => {
    const wasActive = active[kind] ?? false;
    setActive((p) => ({ ...p, [kind]: !wasActive }));
    setCounts((c) => ({ ...c, [kind]: c[kind] + (wasActive ? -1 : 1) }));
    // Single persist call (backend toggles by fingerprint) — revert the
    // optimistic update if it fails so the count never lies.
    try {
      const fp = fingerprint();
      void fetch(`/api/songs/${song.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-fingerprint': fp },
        body: JSON.stringify({ kind }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('reaction failed');
        })
        .catch(() => {
          setActive((p) => ({ ...p, [kind]: wasActive }));
          setCounts((c) => ({ ...c, [kind]: c[kind] + (wasActive ? 1 : -1) }));
        });
    } catch {
      /* offline */
    }
  };

  const submitComment = (): void => {
    const text = draft.trim();
    if (!text || commenting) return;
    if (!readToken()) {
      setNeedsCommentAuth(true);
      requestAnimationFrame(() => commentPromptRef.current?.scrollIntoView({ block: 'nearest' }));
      return;
    }
    setNeedsCommentAuth(false);
    setCommenting(true);
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
      })
      .finally(() => {
        setCommenting(false);
      });
  };

  return (
    <div className={`track-row${song.is_current ? ' current' : ''}`}>
      <div className="track-num">Week {song.week_number}</div>
      <div className="track-main">
        {song.is_current ? <span className="now-badge">Now playing</span> : null}
        <p className="title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {song.title}
          {yt.toggle}
        </p>
        <p className="by">
          {song.artist} · picked by {song.picked_by}
        </p>
        <p className="note">{song.note}</p>
        {yt.embed}
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
          {needsCommentAuth ? (
            <div ref={commentPromptRef} className="auth-prompt">
              <p className="board-empty" style={{ padding: 0 }}>
                Sign in to comment — join the conversation.
              </p>
              <SignInButton contextLabel="commenting" />
            </div>
          ) : null}
          <div className={`comment-form${formOpen ? ' open' : ''}`}>
            <input
              type="text"
              placeholder="Add a comment"
              value={draft}
              disabled={commenting}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => {
                // First real attempt at commenting — ask for sign-in here only.
                if (!readToken()) {
                  setNeedsCommentAuth(true);
                  requestAnimationFrame(() => commentPromptRef.current?.scrollIntoView({ block: 'nearest' }));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment();
              }}
            />
            <button type="button" className="btn small" onClick={submitComment} disabled={commenting} aria-busy={commenting}>
              {commenting ? <Spinner /> : null} Post
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
  // The single board entry the user tried to vote on while signed out.
  // The prompt renders under that entry's vote buttons — nowhere else.
  const [authEntryId, setAuthEntryId] = useState<string | null>(null);
  const [voting, setVoting] = useState<{ id: string; direction: 'up' | 'down' } | null>(null);
  const signedIn = useSignedIn();
  const votePromptRefs = useRef(new Map<string, HTMLDivElement>());

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
    if (signedIn) setAuthEntryId(null);
  }, [signedIn]);

  const scrollToVotePrompt = (id: string): void => {
    requestAnimationFrame(() => votePromptRefs.current.get(id)?.scrollIntoView({ block: 'nearest' }));
  };

  const vote = (id: string, direction: 'up' | 'down'): void => {
    if (voting) return;
    if (!readToken()) {
      setAuthEntryId(id);
      scrollToVotePrompt(id);
      return;
    }
    setAuthEntryId(null);
    setVoting({ id, direction });
    void api(`/api/board/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
      auth: true,
    }).then((res) => {
      setVoting(null);
      if (!res.ok) {
        if (res.status === 401) {
          // Expired or invalid token — prompt a fresh sign-in, no dead-end alert.
          setAuthEntryId(id);
          scrollToVotePrompt(id);
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
                  <button
                    type="button"
                    className="vote-btn"
                    onClick={() => vote(e.id, 'up')}
                    disabled={voting?.id === e.id}
                    aria-busy={voting?.id === e.id && voting.direction === 'up'}
                  >
                    {voting?.id === e.id && voting.direction === 'up' ? <Spinner /> : <VoteUpIcon />} Upvote (
                    {e.upvotes})
                  </button>
                  <button
                    type="button"
                    className="vote-btn"
                    onClick={() => vote(e.id, 'down')}
                    disabled={voting?.id === e.id}
                    aria-busy={voting?.id === e.id && voting.direction === 'down'}
                  >
                    {voting?.id === e.id && voting.direction === 'down' ? <Spinner /> : <VoteDownIcon />} Downvote (
                    {e.downvotes})
                  </button>
                </div>
                {authEntryId === e.id ? (
                  <div
                    ref={(el) => {
                      if (el) votePromptRefs.current.set(e.id, el);
                      else votePromptRefs.current.delete(e.id);
                    }}
                    className="auth-prompt"
                  >
                    <p className="board-empty" style={{ padding: 0 }}>
                      Sign in to vote — your pick counts.
                    </p>
                    <SignInButton contextLabel="voting" />
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
