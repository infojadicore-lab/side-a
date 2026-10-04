import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api.js';
import type { Edition, EditionsPage } from '../../lib/types.js';
import { Spinner, useBusyKey } from '../../components/Spinner.js';

const LIMIT = 5;

interface EditionForm {
  kind: string;
  name: string;
  status: string;
  album: string;
  artist: string;
  date: string;
  venue: string;
  price: string;
  capacity: string;
  tixUrl: string;
  tixId: string;
  meta: string;
}

const EMPTY_FORM: EditionForm = {
  kind: 'physical',
  name: '',
  status: 'upcoming',
  album: '',
  artist: '',
  date: '',
  venue: '',
  price: '',
  capacity: '',
  tixUrl: '',
  tixId: '',
  meta: '',
};

function toLocalInput(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

export function EditionsManager(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState<EditionForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [syncVals, setSyncVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyKey, runBusy] = useBusyKey();

  const load = useCallback((p: number) => {
    void api<EditionsPage>(`/api/editions?page=${p}&limit=${LIMIT}`).then((res) => {
      setEditions(res.body?.editions ?? []);
      setTotal(res.body?.total ?? 0);
      setTotalPages(res.body?.totalPages ?? 1);
    });
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const gotoPage = (p: number | 'prev' | 'next'): void => {
    const nextPage = p === 'prev' ? Math.max(1, page - 1) : p === 'next' ? Math.min(totalPages, page + 1) : p;
    setParams(nextPage === 1 ? {} : { page: String(nextPage) });
  };

  const set = (k: keyof EditionForm, v: string): void => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (saving) return;
    let meta: Record<string, unknown> | null = null;
    if (form.meta.trim()) {
      try {
        meta = JSON.parse(form.meta.trim()) as Record<string, unknown>;
      } catch {
        setMsg('Meta must be valid JSON');
        return;
      }
    }
    const cap = parseInt(form.capacity, 10);
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      album: form.album.trim(),
      artist: form.artist.trim(),
      date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
      venue: form.venue.trim(),
      price: parseInt(form.price, 10) || 0,
      capacity: cap,
      status: form.status,
      tix_africa_url: form.tixUrl.trim(),
      tix_africa_event_id: form.tixId.trim(),
      meta,
    };
    if (!payload.name || !payload.album || !payload.artist || !payload.venue || isNaN(cap)) {
      setMsg('Fill name, album, artist, venue, capacity (idx auto)');
      return;
    }
    const url = editId ? `/api/admin/editions/${editId}` : '/api/admin/editions';
    const method = editId ? 'PATCH' : 'POST';
    setSaving(true);
    void api<{ edition?: Edition }>(url, { method, body: JSON.stringify(payload) })
      .then((res) => {
        if (!res.ok) {
          const b = res.body as { issues?: { message?: string }[]; error?: string };
          setMsg(b.issues?.[0]?.message ?? b.error ?? JSON.stringify(res.body));
          return;
        }
        if (editId) {
          setMsg('Updated');
          setEditId(null);
          setForm(EMPTY_FORM);
          load(page);
        } else {
          setMsg('Created — idx auto-assigned');
          setForm(EMPTY_FORM);
          const newIdx = res.body.edition?.idx;
          if (newIdx) {
            const target = Math.min(Math.ceil(newIdx / LIMIT), Math.ceil((total + 1) / LIMIT) || 1);
            if (target !== page) {
              setParams(target === 1 ? {} : { page: String(target) });
              return;
            }
          }
          load(page);
        }
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const startEdit = (ed: Edition): void => {
    setForm({
      kind: ed.kind || 'physical',
      name: ed.name || '',
      status: ed.status,
      album: ed.album,
      artist: ed.artist,
      date: ed.date ? toLocalInput(ed.date) : '',
      venue: ed.venue,
      price: String(ed.price),
      capacity: String(ed.capacity),
      tixUrl: ed.tix_africa_url || '',
      tixId: ed.tix_africa_event_id || '',
      meta: ed.meta ? JSON.stringify(ed.meta) : '',
    });
    setEditId(ed.id);
    setMsg('Editing — submit will PATCH this edition (idx auto, not editable)');
  };

  const now = Date.now();
  const upcomingList = editions
    .filter((e) => new Date(e.date).getTime() >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastList = editions
    .filter((e) => new Date(e.date).getTime() < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const ordered = [...upcomingList, ...pastList];

  return (
    <section className="screen active">
      <h2 className="section-title">Editions</h2>
      <p className="lede">
        Create editions with <code>name</code> + <code>kind</code> physical/virtual. One Tix Africa event per edition;
        spots sync via webhook or manual.
      </p>
      <div className="card" style={{ marginTop: 20 }}>
        <p className="panel-label">New edition</p>
        <form className="rec-form" style={{ maxWidth: '100%' }} onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="ed-kind">Kind</label>
              <select id="ed-kind" value={form.kind} onChange={(e) => set('kind', e.target.value)} style={selectStyle}>
                <option value="physical">Physical</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ed-name">Name</label>
              <input
                id="ed-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Edition 05 — Virtual Listening Room"
              />
            </div>
            <div className="field">
              <label htmlFor="ed-status">Status</label>
              <select
                id="ed-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                style={selectStyle}
              >
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ed-album">Album</label>
              <input
                id="ed-album"
                value={form.album}
                onChange={(e) => set('album', e.target.value)}
                placeholder="Discovery"
              />
            </div>
            <div className="field">
              <label htmlFor="ed-artist">Artist</label>
              <input
                id="ed-artist"
                value={form.artist}
                onChange={(e) => set('artist', e.target.value)}
                placeholder="Daft Punk"
              />
            </div>
            <div className="field">
              <label htmlFor="ed-date">Date</label>
              <input
                id="ed-date"
                type="datetime-local"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ed-venue">Venue</label>
              <input
                id="ed-venue"
                value={form.venue}
                onChange={(e) => set('venue', e.target.value)}
                placeholder="PANU, Victoria Island / Virtual — Spaces"
              />
            </div>
            <div className="field">
              <label htmlFor="ed-price">Price (₦)</label>
              <input
                id="ed-price"
                type="number"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="15000"
              />
            </div>
            <div className="field">
              <label htmlFor="ed-capacity">Capacity</label>
              <input
                id="ed-capacity"
                type="number"
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="field">
              <label htmlFor="ed-tix-url">Tix Africa URL</label>
              <input
                id="ed-tix-url"
                value={form.tixUrl}
                onChange={(e) => set('tixUrl', e.target.value)}
                placeholder="https://tix.africa/event/side-a-05"
              />
              <p className="hint">One event per edition</p>
            </div>
            <div className="field">
              <label htmlFor="ed-tix-id">Tix Africa Event ID</label>
              <input
                id="ed-tix-id"
                value={form.tixId}
                onChange={(e) => set('tixId', e.target.value)}
                placeholder="side-a-05"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ed-meta">Meta JSON (virtual streamUrl / mapUrl)</label>
            <textarea
              id="ed-meta"
              value={form.meta}
              onChange={(e) => set('meta', e.target.value)}
              placeholder='{"streamUrl":"https://..."}'
            />
          </div>
          <button type="submit" className="btn primary" disabled={saving} aria-busy={saving}>
            {saving ? <Spinner /> : null} {editId ? 'Update edition' : 'Create edition'}
          </button>
          {editId ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditId(null);
                setForm(EMPTY_FORM);
                setMsg('');
              }}
            >
              Cancel edit
            </button>
          ) : null}
          <p className="err show" style={{ display: msg ? 'block' : 'none' }}>
            {msg}
          </p>
        </form>
      </div>
      <div className="table-head">
        <p className="panel-label" style={{ margin: 0 }}>
          All editions
        </p>
        <button type="button" className="btn small" onClick={() => load(page)}>
          Reload
        </button>
      </div>
      <div className="card" style={{ marginTop: 12, padding: '0 14px' }}>
        {ordered.length === 0 ? (
          <p className="board-empty">No editions — created editions will appear here.</p>
        ) : (
          <>
            {upcomingList.length > 0 && pastList.length > 0 ? (
              <p className="panel-label">Upcoming — date yardstick (nearest first)</p>
            ) : null}
            {ordered.map((e) => {
              const isUpcoming = new Date(e.date).getTime() >= now;
              return (
                <div key={e.id} className="board-row" style={{ alignItems: 'center' }}>
                  <div className="board-rank">{e.idx}</div>
                  <div className="board-main">
                    <p className="board-title">
                      {e.name || e.album} <span className="kind-badge">{e.kind || 'physical'}</span>{' '}
                      <span className="pill">{isUpcoming ? 'upcoming' : 'past'}</span>
                    </p>
                    <p className="board-meta">
                      {e.album} — {e.artist} · {e.venue} · ₦{e.price} · {e.spots_sold}/{e.capacity} sold (left{' '}
                      {e.spotsLeft}) · {new Date(e.date).toLocaleDateString()}
                    </p>
                    {e.tix_africa_url ? (
                      <p style={{ fontSize: 12.5, marginTop: 6 }}>
                        <a href={e.tix_africa_url} target="_blank" rel="noopener noreferrer">
                          {e.tix_africa_url}
                        </a>{' '}
                        {e.tix_africa_event_id || ''}
                      </p>
                    ) : null}
                    {e.meta ? (
                      <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                        meta: {JSON.stringify(e.meta).slice(0, 120)}
                      </p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input
                        type="number"
                        placeholder="spotsSold"
                        value={syncVals[e.id] ?? ''}
                        onChange={(ev) => setSyncVals((s) => ({ ...s, [e.id]: ev.target.value }))}
                        style={syncInputStyle}
                      />
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          const v = parseInt(syncVals[e.id] ?? '', 10);
                          if (isNaN(v)) return;
                          runBusy(
                            `sync-${e.id}`,
                            api(`/api/admin/sync/editions/${e.id}`, {
                              method: 'POST',
                              body: JSON.stringify({ spotsSold: v }),
                            }).then(() => load(page)),
                          );
                        }}
                        disabled={busyKey === `sync-${e.id}`}
                        aria-busy={busyKey === `sync-${e.id}`}
                      >
                        {busyKey === `sync-${e.id}` ? <Spinner /> : null} Sync spots
                      </button>
                      <button type="button" className="btn small" onClick={() => startEdit(e)}>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div className="update-filter" style={{ justifyContent: 'center', margin: '16px 0 12px' }}>
          {total > LIMIT ? (
            <>
              <button type="button" className="btn small" disabled={page <= 1} onClick={() => gotoPage('prev')}>
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={p === page ? 'active' : ''}
                  style={pagerBtnStyle(p === page)}
                  onClick={() => gotoPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className="btn small"
                disabled={page >= totalPages}
                onClick={() => gotoPage('next')}
              >
                Next
              </button>
            </>
          ) : null}
        </div>
        <p className="panel-label" style={{ textAlign: 'center', margin: '0 0 12px' }}>
          {total} edition{total === 1 ? '' : 's'} · page {page} of {totalPages}
        </p>
      </div>
    </section>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--plum-900)',
  border: '1px solid var(--line-strong)',
  borderRadius: 6,
  padding: '11px 13px',
  color: 'var(--cream)',
};

const syncInputStyle: React.CSSProperties = {
  width: 120,
  background: 'var(--plum-900)',
  border: '1px solid var(--line-strong)',
  borderRadius: 6,
  padding: '7px 9px',
  color: 'var(--cream)',
};

function pagerBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 12.5,
    border: '1px solid var(--line-strong)',
    borderRadius: 20,
    padding: '5px 12px',
    background: active ? 'var(--gold)' : 'transparent',
    color: active ? 'var(--plum-950)' : 'var(--muted)',
    cursor: 'pointer',
  };
}
