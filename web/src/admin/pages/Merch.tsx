import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import type { MerchItem, MerchOrder } from '../../lib/types.js';
import { shortDate } from '../../lib/format.js';
import { Spinner, useBusyKey } from '../../components/Spinner.js';

interface MerchForm {
  sku: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  status: string;
  note: string;
  sizes: string;
  monnify: string;
}

const EMPTY_FORM: MerchForm = {
  sku: '',
  name: '',
  description: '',
  price: '',
  stock: '',
  status: 'preorder',
  note: '',
  sizes: '',
  monnify: '',
};

export function MerchManager(): React.ReactElement {
  const [items, setItems] = useState<MerchItem[] | null>(null);
  const [orders, setOrders] = useState<MerchOrder[] | null>(null);
  const [form, setForm] = useState<MerchForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [syncVals, setSyncVals] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyKey, runBusy] = useBusyKey();

  const load = useCallback(() => {
    void api<{ items: MerchItem[] }>('/api/admin/merch')
      .then((res) => {
        setItems(res.body?.items ?? []);
        setLoadError('');
      })
      .catch((e: Error) => {
        setLoadError(e.message);
        setItems([]);
      });
    void api<{ orders: MerchOrder[] }>('/api/admin/merch/orders')
      .then((res) => setOrders(res.body?.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof MerchForm, v: string): void => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (saving) return;
    let sizes: string[] | null = null;
    if (form.sizes.trim()) {
      try {
        const parsed: unknown = JSON.parse(form.sizes.trim());
        if (!Array.isArray(parsed)) throw new Error('not array');
        sizes = parsed as string[];
      } catch {
        setMsg('Size options must be JSON array e.g. ["S","M","L"]');
        return;
      }
    }
    const price = parseInt(form.price, 10);
    const stock = form.stock.trim() === '' ? null : parseInt(form.stock.trim(), 10);
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      stock,
      status: form.status,
      note: form.note.trim(),
      size_options: sizes,
      monnify_base_url: form.monnify.trim() || null,
    };
    if (!payload.sku || !payload.name || !payload.description || isNaN(price) || !payload.status || !payload.note) {
      setMsg('Fill sku, name, description, price, status, note');
      return;
    }
    const url = editId ? `/api/admin/merch/${editId}` : '/api/admin/merch';
    const method = editId ? 'PATCH' : 'POST';
    setSaving(true);
    void api(url, { method, body: JSON.stringify(payload) })
      .then((res) => {
        if (!res.ok) {
          const b = res.body as { issues?: { message?: string }[]; error?: string };
          setMsg(b.issues?.[0]?.message ?? b.error ?? JSON.stringify(res.body));
          return;
        }
        setMsg(editId ? 'Updated' : 'Created as Draft — hit Publish to go public');
        if (!editId) setForm(EMPTY_FORM);
        setEditId(null);
        load();
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const startEdit = (m: MerchItem): void => {
    setForm({
      sku: m.sku,
      name: m.name,
      description: m.description,
      price: String(m.price),
      stock: m.stock === null ? '' : String(m.stock),
      status: m.status,
      note: m.note,
      sizes: m.size_options ? JSON.stringify(m.size_options) : '',
      monnify: m.monnify_base_url || '',
    });
    setEditId(m.id);
    setMsg('Editing — submit will PATCH');
  };

  const row = (m: MerchItem): React.ReactElement => {
    const draft = !m.is_published;
    return (
      <div key={m.id} className="board-row" style={{ alignItems: 'center', opacity: draft ? 0.7 : 1 }}>
        <div className="board-main">
          <p className="board-title">
            {m.name} <span className="pill">{m.status}</span>{' '}
            <span
              className="pill"
              style={
                draft
                  ? { color: '#E8867F', borderColor: '#E8867F' }
                  : { color: 'var(--gold)', borderColor: 'var(--gold)' }
              }
            >
              {draft ? 'Draft' : 'Published'}
            </span>{' '}
            ₦{m.price}
          </p>
          <p className="board-meta">
            sku {m.sku} · stock {m.stock === null ? '∞' : m.stock} · sold {m.sold} · remaining{' '}
            {m.remaining === null ? '∞' : m.remaining}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {m.note}
            {m.size_options ? ` · sizes ${JSON.stringify(m.size_options)}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input
              placeholder="sold or delta"
              value={syncVals[m.sku] ?? ''}
              onChange={(ev) => setSyncVals((s) => ({ ...s, [m.sku]: ev.target.value }))}
              style={syncInputStyle}
            />
            <button
              type="button"
              className="btn small"
              onClick={() => {
                const v = parseInt(syncVals[m.sku] ?? '', 10);
                if (isNaN(v)) return;
                runBusy(
                  `sync-${m.id}`,
                  api('/api/admin/sync/merch', {
                    method: 'POST',
                    body: JSON.stringify({ sku: m.sku, sold: v }),
                  }).then(() => load()),
                );
              }}
              disabled={busyKey === `sync-${m.id}`}
              aria-busy={busyKey === `sync-${m.id}`}
            >
              {busyKey === `sync-${m.id}` ? <Spinner /> : null} Sync sold
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                const v = parseInt(syncVals[m.sku] ?? '', 10);
                if (isNaN(v)) return;
                runBusy(
                  `delta-${m.id}`,
                  api('/api/admin/sync/merch', {
                    method: 'POST',
                    body: JSON.stringify({ sku: m.sku, delta: v }),
                  }).then(() => load()),
                );
              }}
              disabled={busyKey === `delta-${m.id}`}
              aria-busy={busyKey === `delta-${m.id}`}
            >
              {busyKey === `delta-${m.id}` ? <Spinner /> : null} +Delta
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                runBusy(
                  `pub-${m.id}`,
                  api(`/api/admin/merch/${m.id}/publish`, {
                    method: 'PATCH',
                    body: JSON.stringify({ is_published: !m.is_published }),
                  }).then((res) => {
                    if (!res.ok) {
                      alert((res.body as { error?: string }).error ?? 'Publish failed');
                      return;
                    }
                    load();
                  }),
                );
              }}
              disabled={busyKey === `pub-${m.id}`}
              aria-busy={busyKey === `pub-${m.id}`}
            >
              {busyKey === `pub-${m.id}` ? <Spinner /> : null} {draft ? 'Publish' : 'Unpublish'}
            </button>
            <button type="button" className="btn small" onClick={() => startEdit(m)}>
              Edit
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                if (!confirm('Delete this merch item?')) return;
                runBusy(
                  `del-${m.id}`,
                  api(`/api/admin/merch/${m.id}`, { method: 'DELETE' }).then(() => load()),
                );
              }}
              disabled={busyKey === `del-${m.id}`}
              aria-busy={busyKey === `del-${m.id}`}
            >
              {busyKey === `del-${m.id}` ? <Spinner /> : null} Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const drafts = (items ?? []).filter((m) => !m.is_published);
  const published = (items ?? []).filter((m) => m.is_published);

  return (
    <section className="screen active">
      <h2 className="section-title">Merch</h2>
      <p className="lede">
        Inventory truth lives here. New items are Draft until you Publish — only Published appears on public front.
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <p className="panel-label">New merch (defaults Draft)</p>
        <form className="rec-form" style={{ maxWidth: '100%' }} onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="merch-sku">SKU*</label>
              <input
                id="merch-sku"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                placeholder="hoodie"
              />
            </div>
            <div className="field">
              <label htmlFor="merch-name">Name*</label>
              <input
                id="merch-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Side A hoodie"
              />
            </div>
            <div className="field">
              <label htmlFor="merch-price">Price (₦)*</label>
              <input
                id="merch-price"
                type="number"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="18000"
              />
            </div>
            <div className="field">
              <label htmlFor="merch-stock">Stock (blank=∞ preorder)</label>
              <input
                id="merch-stock"
                type="number"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
                placeholder="30"
              />
              <p className="hint">Leave blank for made-to-order</p>
            </div>
            <div className="field">
              <label htmlFor="merch-status">Status*</label>
              <select
                id="merch-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                style={selectStyle}
              >
                <option value="preorder">preorder</option>
                <option value="in_stock">in_stock</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="merch-note">Note* (tag)</label>
              <input
                id="merch-note"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="Preorder · ships Dec"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="merch-desc">Description*</label>
            <textarea
              id="merch-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Heavy canvas..."
            />
          </div>
          <div className="field">
            <label htmlFor="merch-sizes">Size options JSON (e.g. [&quot;S&quot;,&quot;M&quot;,&quot;L&quot;])</label>
            <input
              id="merch-sizes"
              value={form.sizes}
              onChange={(e) => set('sizes', e.target.value)}
              placeholder='["S","M","L","XL"]'
            />
            <p className="hint">Leave blank if no sizes</p>
          </div>
          <div className="field">
            <label htmlFor="merch-monnify">Monnify base URL (optional)</label>
            <input
              id="merch-monnify"
              value={form.monnify}
              onChange={(e) => set('monnify', e.target.value)}
              placeholder="https://pay.monnify.com/..."
            />
            <p className="hint">Per-item override; global MONNIFY_PAYMENT_BASE_URL used per-cart</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn primary" disabled={saving} aria-busy={saving}>
              {saving ? <Spinner /> : null} {editId ? 'Update merch' : 'Create draft'}
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
      <div className="card" style={{ marginTop: 16, padding: '14px 20px' }}>
        <p className="panel-label">Drafts — ready to publish (hidden from public)</p>
        {items === null ? (
          <p className="board-empty">Loading merch…</p>
        ) : loadError ? (
          <p className="board-empty">Failed to load merch: {loadError}</p>
        ) : drafts.length === 0 ? (
          <p className="board-empty">No drafts — everything is published.</p>
        ) : (
          drafts.map(row)
        )}
      </div>
      <div className="card" style={{ marginTop: 16, padding: '14px 20px' }}>
        <p className="panel-label">Published — live on public front</p>
        {items !== null && !loadError && published.length === 0 ? (
          <p className="board-empty">Nothing published yet — hit Publish on a draft.</p>
        ) : (
          published.map(row)
        )}
      </div>
      <div className="card" style={{ marginTop: 16, padding: '14px 20px' }}>
        <p className="panel-label">Orders (merch_orders)</p>
        {orders === null ? (
          <p className="board-empty">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="board-empty">No orders yet</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="update-row">
              <div className="update-date">{shortDate(o.created_at)}</div>
              <div className="update-body">
                <p className="title">
                  Order {o.id.slice(0, 8)} · ₦{o.total} · <span className="pill">{o.status}</span>
                </p>
                <p className="desc">{JSON.stringify(o.items).slice(0, 140)}</p>
                {o.monnify_link ? (
                  <p style={{ marginTop: 6 }}>
                    <a href={o.monnify_link} target="_blank" rel="noopener noreferrer">
                      Monnify link →
                    </a>
                  </p>
                ) : null}
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

const syncInputStyle: React.CSSProperties = {
  width: 120,
  background: 'var(--plum-900)',
  border: '1px solid var(--line-strong)',
  borderRadius: 6,
  padding: '7px 9px',
  color: 'var(--cream)',
};
