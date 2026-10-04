import { useEffect, useState } from 'react';
import { get } from '../../lib/api.js';
import type { MerchItem } from '../../lib/types.js';
import { naira } from '../../lib/format.js';
import { useCart } from '../cart.js';

export function MerchPage(): React.ReactElement {
  const [items, setItems] = useState<MerchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { lines, setQty } = useCart();
  const [sizes, setSizes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void get<{ items: MerchItem[] }>('/api/merch')
      .then((d) => {
        if (!cancelled) setItems(d.items);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="screen active">
      <h2 className="section-title">Merch</h2>
      <p className="lede">
        Our first drop is preorder only. We make it once we know the count. Pick it up at the next edition, or we
        ship it to you.
      </p>
      <div className="merch-grid" id="merch-grid">
        {items === null ? (
          <p className="board-empty">Loading merch…</p>
        ) : items.length === 0 ? (
          <p className="board-empty">{failed ? 'We could not load the merch. Please try again.' : 'No merch right now. Please check back soon.'}</p>
        ) : (
          items.map((m) => (
            <div key={m.sku} className="card merch-card">
              <span className="preorder-tag">{m.note}</span>
              <div className="merch-swatch">{m.sku.slice(0, 4)}</div>
              <p className="merch-name">{m.name}</p>
              <p className="merch-desc">{m.description}</p>
              <p className="merch-price">
                {naira(m.price)}
                {m.remaining !== null
                  ? ` · ${m.remaining <= 5 ? `${m.remaining} left` : `${m.remaining} in stock`}`
                  : ''}
              </p>
              <div className="merch-select">
                {m.size_options && m.size_options.length > 0 ? (
                  <select
                    aria-label={`Size, ${m.sku}`}
                    value={sizes[m.sku] ?? m.size_options[0]}
                    onChange={(e) => {
                      const size = e.target.value;
                      setSizes((s) => ({ ...s, [m.sku]: size }));
                      const qty = lines[m.sku]?.qty ?? 0;
                      if (qty > 0) setQty(m.sku, qty, m.price, size);
                    }}
                  >
                    {m.size_options.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select
                  aria-label={`Quantity, ${m.sku}`}
                  value={lines[m.sku]?.qty ?? 0}
                  onChange={(e) => {
                    const qty = parseInt(e.target.value, 10) || 0;
                    const size =
                      m.size_options && m.size_options.length > 0 ? (sizes[m.sku] ?? m.size_options[0]) : undefined;
                    setQty(m.sku, qty, m.price, size);
                  }}
                >
                  {[0, 1, 2, 3].map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="order-confirm" id="order-confirm">
        <p className="title">Order in.</p>
        <p className="body">
          Thank you. Preordered pieces are made once, then shipped. In-stock pieces will wait for you at the next
          edition. We sent a confirmation to your inbox.
        </p>
      </div>
    </section>
  );
}
