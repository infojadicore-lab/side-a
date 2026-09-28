import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { get } from '../../lib/api.js';
import type { EditionsPage } from '../../lib/types.js';
import { formatEditionDate, naira } from '../../lib/format.js';

const LIMIT = 5;

export function EditionsPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const [upcoming, setUpcoming] = useState<EditionsPage | null>(null);
  const [past, setPast] = useState<EditionsPage | null>(null);

  const load = useCallback(() => {
    void get<EditionsPage>('/api/editions?status=upcoming&page=1&limit=5')
      .then(setUpcoming)
      .catch(() => {});
    void get<EditionsPage>(`/api/editions?status=past&page=${page}&limit=${LIMIT}`)
      .then(setPast)
      .catch(() => {});
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const upcomingAll = upcoming?.editions ?? [];
  const pastEditions = past?.editions ?? [];
  const pastTotal = past?.total ?? 0;
  const pastTotalPages = past?.totalPages ?? 1;
  const total = (upcoming?.total ?? 0) + pastTotal;

  const gotoPage = (p: number | 'prev' | 'next'): void => {
    const nextPage =
      p === 'prev' ? Math.max(1, page - 1) : p === 'next' ? Math.min(pastTotalPages, page + 1) : p;
    setParams(nextPage === 1 ? {} : { page: String(nextPage) });
  };

  return (
    <section className="screen active">
      <h2 className="section-title">Editions</h2>
      <p className="lede">
        Each edition is one album, played front to back, with brunch alongside it. Arrive on time — we start the
        record together.
      </p>
      {total === 0 && past && upcoming ? (
        <p className="board-empty">Upcoming and past editions would be shown here.</p>
      ) : (
        <>
          <div style={{ marginTop: 28 }}>
            <p className="panel-label">Upcoming — most upcoming highlighted</p>
            {upcomingAll.length === 0 ? (
              <p className="board-empty">No upcoming editions — check back soon.</p>
            ) : (
              upcomingAll.map((u, idx) => {
                const highlight = idx === 0;
                return (
                  <div
                    key={u.id}
                    className="card edition-card"
                    style={
                      highlight
                        ? { marginTop: 12, border: '2px solid var(--gold)', boxShadow: '0 0 0 1px var(--gold-dim)' }
                        : { marginTop: 12 }
                    }
                  >
                    <div className="edition-index">{String(u.idx).padStart(2, '0')}</div>
                    <div className="edition-body">
                      <p className="edition-album">
                        {u.name || u.album}{' '}
                        <span className="kind-badge">{u.kind === 'virtual' ? 'Virtual' : 'Physical'}</span>
                        {highlight ? (
                          <span className="pill" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                            ● Most upcoming
                          </span>
                        ) : null}
                      </p>
                      <p className="edition-artist">{u.artist}</p>
                      <p className="edition-meta">
                        <span>{formatEditionDate(u.date)}</span>
                        <span>{u.venue}</span>
                      </p>
                      <div className="edition-foot">
                        <p className="price">
                          {naira(u.price)}{' '}
                          <span className="spots">
                            · {u.spotsLeft} of {u.capacity} left
                          </span>
                        </p>
                        {u.tix_africa_url ? (
                          <a className="btn primary small" href={u.tix_africa_url} target="_blank" rel="noopener noreferrer">
                            Get tickets on Tix Africa
                          </a>
                        ) : (
                          <span className="pill">Tix Africa link not set</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div style={{ marginTop: 36 }}>
            <p className="panel-label">Past editions — sorted by date (most recent first, desc)</p>
            {pastEditions.length === 0 ? (
              <p className="board-empty">{pastTotal === 0 ? 'No past editions yet.' : 'No past editions on this page.'}</p>
            ) : (
              <div className="stack past-list">
                {pastEditions.map((e) => (
                  <div key={e.id} className="card edition-card">
                    <div className="edition-index">{String(e.idx).padStart(2, '0')}</div>
                    <div className="edition-body">
                      <p className="edition-album">
                        {e.name || e.album}{' '}
                        <span className="kind-badge">{e.kind === 'virtual' ? 'Virtual' : 'Physical'}</span>
                      </p>
                      <p className="edition-artist">{e.artist}</p>
                      <p className="edition-meta">
                        <span>{formatEditionDate(e.date)}</span>
                        <span>{e.venue}</span>
                        <span>{e.attendance != null ? `${e.attendance} attended` : e.price === 0 ? 'free' : ''}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="update-filter" style={{ justifyContent: 'center', margin: '18px 0 8px' }}>
            {pastTotal > LIMIT ? (
              <>
                <button type="button" className="btn small" disabled={page <= 1} onClick={() => gotoPage('prev')}>
                  Prev
                </button>
                {Array.from({ length: pastTotalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === page ? 'active' : ''}
                    style={{
                      fontSize: 12.5,
                      border: '1px solid var(--line-strong)',
                      borderRadius: 20,
                      padding: '5px 12px',
                      background: p === page ? 'var(--gold)' : 'transparent',
                      color: p === page ? 'var(--plum-950)' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                    onClick={() => gotoPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn small"
                  disabled={page >= pastTotalPages}
                  onClick={() => gotoPage('next')}
                >
                  Next
                </button>
              </>
            ) : null}
          </div>
          <p className="panel-label" style={{ textAlign: 'center' }}>
            {pastTotal} edition{pastTotal === 1 ? '' : 's'} · page {page} of {pastTotalPages}
          </p>
        </>
      )}
    </section>
  );
}
