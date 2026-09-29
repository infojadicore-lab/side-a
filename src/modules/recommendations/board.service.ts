import { sql } from '../../db/index.js';

export type BoardRow = {
  id: string;
  name: string;
  track: string;
  why: string;
  link: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
  status: string;
};

export async function listBoard(limit = 12): Promise<BoardRow[]> {
  const rows = await sql<BoardRow[]>`
    select id, name, track, why, link, upvotes, downvotes, score, created_at, status
    from recommendations
    where status = 'queued'
    order by score desc, created_at asc
    limit ${limit}
  `;
  return rows;
}

export async function voteOnRecommendation(
  id: string,
  googleUserId: string,
  direction: 'up' | 'down',
): Promise<BoardRow> {
  const recs = await sql<{ status: string }[]>`select status from recommendations where id = ${id}`;
  if (recs.length === 0) throw Object.assign(new Error('Not found'), { statusCode: 404 });
  if ((recs[0] as { status: string }).status !== 'queued') {
    throw Object.assign(new Error('Not votable'), { statusCode: 400 });
  }

  const existing = await sql<{ direction: string }[]>`
    select direction from recommendation_votes where recommendation_id = ${id} and google_user_id = ${googleUserId}
  `;

  if (existing.length > 0) {
    const prev = (existing[0] as { direction: string }).direction;
    if (prev === direction) {
      await sql`delete from recommendation_votes where recommendation_id = ${id} and google_user_id = ${googleUserId}`;
      if (direction === 'up') {
        await sql`update recommendations set upvotes = greatest(0, upvotes - 1) where id = ${id}`;
      } else {
        await sql`update recommendations set downvotes = greatest(0, downvotes - 1) where id = ${id}`;
      }
    } else {
      await sql`update recommendation_votes set direction = ${direction} where recommendation_id = ${id} and google_user_id = ${googleUserId}`;
      if (direction === 'up') {
        await sql`update recommendations set upvotes = upvotes + 1, downvotes = greatest(0, downvotes - 1) where id = ${id}`;
      } else {
        await sql`update recommendations set downvotes = downvotes + 1, upvotes = greatest(0, upvotes - 1) where id = ${id}`;
      }
    }
  } else {
    await sql`insert into recommendation_votes (recommendation_id, google_user_id, direction) values (${id}, ${googleUserId}, ${direction})`;
    if (direction === 'up') {
      await sql`update recommendations set upvotes = upvotes + 1 where id = ${id}`;
    } else {
      await sql`update recommendations set downvotes = downvotes + 1 where id = ${id}`;
    }
  }

  const rows = await sql<BoardRow[]>`select id, name, track, why, link, upvotes, downvotes, score, created_at, status from recommendations where id = ${id}`;
  return rows[0] as BoardRow;
}

// Mirrors web/src/lib/youtube.tsx: accept watch/embed/shorts/live + short links.
const YOUTUBE_PATTERNS = [
  /(?:(?:www|music|m)\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
];

export function extractYouTubeUrl(link: string | null | undefined): string | null {
  if (!link) return null;
  const ok = YOUTUBE_PATTERNS.some((re) => re.test(link));
  return ok ? link : null;
}

export async function pickBoardEntry(id: string): Promise<{ songId: string; archivedCount: number }> {  const recs = await sql<{ id: string; name: string; track: string; why: string; link: string | null }[]>`
    select id, name, track, why, link from recommendations where id = ${id} and status = 'queued'
  `;
  if (recs.length === 0) throw Object.assign(new Error('Not found or not queued'), { statusCode: 404 });
  const rec = recs[0] as { id: string; name: string; track: string; why: string; link: string | null };

  // Parse track: "Title — Artist" or "Title - Artist"
  const parts = rec.track.split(/\s+[—\-]\s+/);
  const title = (parts[0] ?? rec.track).trim();
  const artist = (parts[1] ?? 'Unknown').trim();

  // Carry the submission link onto the song when it's a YouTube URL so the
  // Song-of-the-week player works without manual backfill.
  const youtubeUrl = extractYouTubeUrl(rec.link);

  const maxWeek = await sql<{ max: number | null }[]>`select max(week_number) as max from songs`;
  const nextWeek = ((maxWeek[0] as { max: number | null }).max ?? 0) + 1;

  const songRows = await sql<{ id: string }[]>`
    insert into songs (week_number, title, artist, picked_by, note, is_current, youtube_url)
    values (${nextWeek}, ${title}, ${artist}, ${rec.name}, ${rec.why}, true, ${youtubeUrl})
    returning id
  `;
  const songId = (songRows[0] as { id: string }).id;

  await sql`update songs set is_current = false where id != ${songId}`;

  await sql`update recommendations set status = 'picked', picked_as_song_id = ${songId} where id = ${id}`;

  const archived = await sql<{ count: string }[]>`
    update recommendations set status = 'archived' where status = 'queued' and id != ${id}
    returning id
  `;

  return { songId, archivedCount: archived.length };
}
