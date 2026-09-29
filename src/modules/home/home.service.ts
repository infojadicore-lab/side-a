import { sql } from '../../db/index.js';

export async function getHome(): Promise<{
  nowSpinning: {
    id: string;
    week_number: number;
    title: string;
    artist: string;
    picked_by: string;
    note: string;
    youtube_url: string | null;
  } | null;
  nextEdition: {
    id: string;
    idx: number;
    album: string;
    artist: string;
    date: string;
    venue: string;
    price: number;
    capacity: number;
    spots_sold: number;
    spotsLeft: number;
    tix_africa_url: string | null;
    name: string;
    kind: string;
    meta: Record<string, unknown> | null;
  } | null;
  latestUpdate: { id: string; date: string; title: string; description: string } | null;
}> {
  const [nowRows, editionRows, updateRows] = await Promise.all([
    sql<{ id: string; week_number: number; title: string; artist: string; picked_by: string; note: string; youtube_url: string | null }[]>`
      select id, week_number, title, artist, picked_by, note, youtube_url from songs where is_current = true limit 1
    `,
    sql<{ id: string; idx: number; album: string; artist: string; date: string; venue: string; price: number; capacity: number; spots_sold: number; tix_africa_url: string | null; name: string; kind: string; meta: Record<string, unknown> | null }[]>`
      select id, idx, album, artist, date, venue, price, capacity, spots_sold, tix_africa_url, name, kind, meta
      from editions where status = 'upcoming' order by date asc limit 1
    `,
    sql<{ id: string; date: string; title: string; description: string }[]>`select id, date, title, description from updates order by date desc limit 1`,
  ]);

  const nowSpinning = (nowRows[0] as unknown) ?? null;
  const nextRaw = editionRows[0] as unknown as { capacity: number; spots_sold: number } | undefined;
  const nextEdition = nextRaw
    ? ({ ...nextRaw, spotsLeft: nextRaw.capacity - nextRaw.spots_sold } as unknown as {
        id: string;
        idx: number;
        album: string;
        artist: string;
        date: string;
        venue: string;
        price: number;
        capacity: number;
        spots_sold: number;
        spotsLeft: number;
        tix_africa_url: string | null;
        name: string;
        kind: string;
        meta: Record<string, unknown> | null;
      })
    : null;
  const latestUpdate = (updateRows[0] as unknown) ?? null;

  return { nowSpinning: nowSpinning as never, nextEdition, latestUpdate: latestUpdate as never };
}
