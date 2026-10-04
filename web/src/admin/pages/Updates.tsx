import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api.js';
import type { UpdateItem } from '../../lib/types.js';
import { shortDate } from '../../lib/format.js';
import { Spinner, useBusyKey } from '../../components/Spinner.js';

const SOURCES = ['', 'side_a', 'instagram', 'youtube', 'twitter_spaces'];
const SOURCE_LABELS: Record<string, string> = {
  '': 'All',
  side_a: 'Side A',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter_spaces: 'Spaces',
};

interface UpdateForm {
  date: string;
  title: string;
  description: string;
  source: string;
  url: string;
  meta: string;
}

const EMPTY_FORM: UpdateForm = { date: '', title: '', description: '', source: 'side_a', url: '', meta: '' };

export function UpdatesManager(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const sourceFilter = params.get('source') ?? '';
  const [updates, setUpdates] = useState<UpdateItem[] | null>(null);
  const [form, setForm] = useState<UpdateForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyKey, runBusy] = useBusyKey();

  const load = useCallback((src: string) => {
    const url = src ? `/api/updates?source=${encodeURIComponent(src)}` : '/api/updates';
    void api<{ updates: UpdateItem[] }>(url).then((res) => setUpdates(res.body?.updates ?? []));
  }, []);

  useEffect(() => {
    setUpdates(null);
    load(sourceFilter);
  }, [sourceFilter, load]);

  const set = (k: keyof UpdateForm, v: string): void => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (saving) return;
    let meta: Record<string, unknown> | null = null;
    if (form.meta.trim()) {
      try {
        meta = JSON.parse(form.meta.trim()) as Record<string, unknown>;
      } catch {
        setMsg('Meta invalid JSON');
        return;
      }
    }
    const payload = {
      date: form.date,
      title: form.title.trim(),
      description: form.description.trim(),
      source: form.source,
      source_url: form.url.trim(),
      meta,
    };
    if (!payload.date || !payload.title || !payload.description) {
      setMsg('Date/title/description required');
      return;
    }
    const url = editId ? `/api/admin/updates/${editId}` : '/api/admin/updates';
    const method = editId ? 'PATCH' : 'POST';
    setSaving(true);
    void api(url, { method, body: JSON.stringify(payload) })
      .then((res) => {
        if (!res.ok) {
          setMsg((res.body as { error?: string }).error ?? JSON.stringify(res.body));
          return;
        }
        setForm(EMPTY_FORM);
        setEditId(null);
        setMsg(editId ? 'Updated' : 'Created');
        load(sourceFilter);
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <section className="screen active">
      <h2 className="section-title">Updates</h2>
      <p className="lede">
        Manual, multi-source. Set <code>source</code> to the Instagram/YouTube/Spaces link via <code>source_url</code>{' '}
        + optional <code>meta</code>.
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <p className="panel-label">New / edit update</p>
        <form className="rec-form" style={{ maxWidth: '100%' }} onSubmit={submit}>
          <div className="field">
            <label htmlFor="up-date">Date</label>
            <input id="up-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="up-title">Title</label>
            <input
              id="up-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Edition 04 — ..."
            />
          </div>
          <div className="field">
            <label htmlFor="up-desc">Description</label>
            <textarea id="up-desc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="up-source">Source</label>
              <select
                id="up-source"
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
                style={selectStyle}
              >
                <option value="side_a">side_a</option>
                <option value="instagram">instagram</option>
                <option value="youtube">youtube</option>
                <option value="twitter_spaces">twitter_spaces</option>
                <option value="other">other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="up-url">Source URL</label>
              <input
                id="up-url"
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="up-meta">Meta JSON</label>
            <textarea id="up-meta" value={form.meta} onChange={(e) => set('meta', e.target.value)} placeholder="{}" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn primary" disabled={saving} aria-busy={saving}>
              {saving ? <Spinner /> : null} {editId ? 'Update' : 'Create update'}
            </button>
            {editId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setEditId(null);
                  setMsg('');
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          <p className="err show" style={{ display: msg ? 'block' : 'none' }}>
            {msg}
          </p>
        </form>
      </div>
      <div className="update-filter" style={{ marginTop: 16 }}>
        {SOURCES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={sourceFilter === s ? 'active' : ''}
            onClick={() => setParams(s ? { source: s } : {})}
          >
            {SOURCE_LABELS[s] ?? s}
          </button>
        ))}
      </div>
      <div className="card" style={{ marginTop: 12, padding: '6px 20px' }}>
        {updates === null ? (
          <p className="board-empty">Loading…</p>
        ) : updates.length === 0 ? (
          <p className="board-empty">No updates</p>
        ) : (
          updates.map((u) => (
            <div key={u.id} className="update-row">
              <div className="update-date">{shortDate(u.date)}</div>
              <div className="update-body">
                <p className="title">
                  {u.title} <span className="source-badge">{u.source}</span>
                </p>
                <p className="desc">{u.description}</p>
                {u.source_url ? (
                  <p style={{ marginTop: 6 }}>
                    <a href={u.source_url} target="_blank" rel="noopener noreferrer">
                      View source →
                    </a>
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      setForm({
                        date: shortDate(u.date),
                        title: u.title,
                        description: u.description,
                        source: u.source,
                        url: u.source_url || '',
                        meta: u.meta ? JSON.stringify(u.meta) : '',
                      });
                      setEditId(u.id);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      if (!confirm('Delete this update?')) return;
                      runBusy(
                        `del-${u.id}`,
                        api(`/api/admin/updates/${u.id}`, { method: 'DELETE' }).then(() =>
                          load(sourceFilter),
                        ),
                      );
                    }}
                    disabled={busyKey === `del-${u.id}`}
                    aria-busy={busyKey === `del-${u.id}`}
                  >
                    {busyKey === `del-${u.id}` ? <Spinner /> : null} Delete
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

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--plum-900)',
  border: '1px solid var(--line-strong)',
  borderRadius: 6,
  padding: '11px 13px',
  color: 'var(--cream)',
};
