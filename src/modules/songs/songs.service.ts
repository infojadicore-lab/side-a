import { sql } from '../../db/index.js';

export type SongRow = {
  id: string;
  week_number: number;
  title: string;
  artist: string;
  picked_by: string;
  note: string;
  is_current: boolean;
  reaction_repeat: number;
  reaction_needed: number;
  reaction_skip: number;
  youtube_url: string | null;
};

export type CommentRow = { id: string; song_id: string; who: string; text: string; created_at: string };

export async function listSongs(): Promise<(SongRow & { comments: CommentRow[] })[]> {
  const songs = await sql<SongRow[]>`
    select id, week_number, title, artist, picked_by, note, is_current, reaction_repeat, reaction_needed, reaction_skip, youtube_url
    from songs order by week_number desc
  `;
  const comments = await sql<CommentRow[]>`
    select id, song_id, who, text, created_at from song_comments order by created_at asc
  `;
  const bySong = new Map<string, CommentRow[]>();
  for (const c of comments) {
    const arr = bySong.get(c.song_id) ?? [];
    arr.push(c);
    bySong.set(c.song_id, arr);
  }
  return songs.map((s) => ({ ...s, comments: bySong.get(s.id) ?? [] }));
}

export async function toggleReaction(songId: string, kind: 'repeat' | 'needed' | 'skip', fingerprint: string): Promise<SongRow> {
  const col = kind === 'repeat' ? 'reaction_repeat' : kind === 'needed' ? 'reaction_needed' : 'reaction_skip';
  // Try insert; if exists, delete (toggle off)
  const existing = await sql<{ id: string }[]>`
    select id from song_reactions where song_id = ${songId} and kind = ${kind} and fingerprint = ${fingerprint}
  `;
  if (existing.length > 0) {
    await sql`delete from song_reactions where song_id = ${songId} and kind = ${kind} and fingerprint = ${fingerprint}`;
    await sql.unsafe(`update songs set ${col} = greatest(0, ${col} - 1) where id = $1`, [songId]);
  } else {
    await sql`insert into song_reactions (song_id, kind, fingerprint) values (${songId}, ${kind}, ${fingerprint})`;
    await sql.unsafe(`update songs set ${col} = ${col} + 1 where id = $1`, [songId]);
  }
  const rows = await sql<SongRow[]>`select id, week_number, title, artist, picked_by, note, is_current, reaction_repeat, reaction_needed, reaction_skip, youtube_url from songs where id = ${songId}`;
  if (rows.length === 0) throw new Error('Song not found');
  return rows[0] as SongRow;
}

export async function addComment(songId: string, who: string, text: string): Promise<CommentRow> {
  const rows = await sql<CommentRow[]>`
    insert into song_comments (song_id, who, text) values (${songId}, ${who}, ${text})
    returning id, song_id, who, text, created_at
  `;
  return rows[0] as CommentRow;
}
