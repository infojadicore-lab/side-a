import { useState } from 'react';
import { api } from '../../lib/api.js';
import { Spinner } from '../../components/Spinner.js';

export function WebhooksTester(): React.ReactElement {
  const [tixId, setTixId] = useState('side-a-04');
  const [tixQty, setTixQty] = useState('1');
  const [tixMsg, setTixMsg] = useState('');
  const [tixBusy, setTixBusy] = useState(false);
  const [ref, setRef] = useState('');
  const [paid, setPaid] = useState('true');
  const [monnifyMsg, setMonnifyMsg] = useState('');
  const [monnifyBusy, setMonnifyBusy] = useState(false);

  return (
    <section className="screen active">
      <h2 className="section-title">Webhooks</h2>
      <p className="lede">
        Tix Africa &amp; Monnify stubs (no auto-ingest). Fire a test payload or watch live hits land; inventory via{' '}
        <code>LEAST(capacity, spots_sold+qty)</code>.
      </p>
      <div className="admin-grid">
        <div className="card">
          <p className="panel-label">Test Tix Africa webhook</p>
          <form
            className="rec-form"
            style={{ maxWidth: '100%' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (tixBusy) return;
              setTixBusy(true);
              void api('/api/webhooks/tix-africa', {
                method: 'POST',
                body: JSON.stringify({ eventId: tixId.trim(), quantity: parseInt(tixQty, 10) || 1 }),
              })
                .then((res) => setTixMsg(JSON.stringify(res.body)))
                .finally(() => setTixBusy(false));
            }}
          >
            <div className="field">
              <label>Event ID</label>
              <input value={tixId} onChange={(e) => setTixId(e.target.value)} />
            </div>
            <div className="field">
              <label>Quantity</label>
              <input type="number" value={tixQty} onChange={(e) => setTixQty(e.target.value)} />
            </div>
            <button type="submit" className="btn primary small" disabled={tixBusy} aria-busy={tixBusy}>
              {tixBusy ? <Spinner /> : null} Fire POST /api/webhooks/tix-africa
            </button>
            <p style={{ fontSize: 13, color: 'var(--gold)', marginTop: 8 }}>{tixMsg}</p>
          </form>
        </div>
        <div className="card">
          <p className="panel-label">Test Monnify webhook</p>
          <form
            className="rec-form"
            style={{ maxWidth: '100%' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (monnifyBusy) return;
              setMonnifyBusy(true);
              void api('/api/webhooks/monnify', {
                method: 'POST',
                body: JSON.stringify({ reference: ref.trim(), paid: paid === 'true' }),
              })
                .then((res) => setMonnifyMsg(JSON.stringify(res.body)))
                .finally(() => setMonnifyBusy(false));
            }}
          >
            <div className="field">
              <label>Order reference (merch_orders id)</label>
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="uuid" />
            </div>
            <div className="field">
              <label>Paid</label>
              <select value={paid} onChange={(e) => setPaid(e.target.value)} style={selectStyle}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <button type="submit" className="btn primary small" disabled={monnifyBusy} aria-busy={monnifyBusy}>
              {monnifyBusy ? <Spinner /> : null} Fire POST /api/webhooks/monnify
            </button>
            <p style={{ fontSize: 13, color: 'var(--gold)', marginTop: 8 }}>{monnifyMsg}</p>
          </form>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16, padding: '14px 20px' }}>
        <p className="panel-label">How webhooks affect inventory</p>
        <p style={{ color: 'var(--cream-dim)', fontSize: 14 }}>
          Tix Africa: <code>tix_africa_event_id</code> matched →{' '}
          <code>spots_sold = LEAST(capacity, spots_sold+qty)</code>. Monnify: <code>reference</code> matched →{' '}
          <code>merch_orders.status=&apos;paid&apos;</code> + <code>merch_items.sold += qty</code>. Manual overrides
          via <code>POST /api/admin/sync/*</code> (Editions/Merch tabs).
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
