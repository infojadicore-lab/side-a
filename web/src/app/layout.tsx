import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { CartProvider, useCart } from './cart.js';
import { naira } from '../lib/format.js';

const TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/editions', label: 'Editions' },
  { to: '/song', label: 'Song of the week' },
  { to: '/submit', label: 'Submit' },
  { to: '/merch', label: 'Merch' },
  { to: '/updates', label: 'Updates' },
];

function isActiveTab(tab: { to: string; end?: boolean }, pathname: string): boolean {
  if (tab.end) return pathname === '/';
  return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

function ScrollToTop(): null {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname, search]);
  return null;
}

export function WaveformBlock(): React.ReactElement {
  const bars = 46;
  const period = 1.6;
  const phases = 16;
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        const h = 6 + Math.round(Math.abs(Math.sin(i * 0.7)) * 26 + Math.random() * 6);
        const opacity = (0.5 + Math.random() * 0.5).toFixed(2);
        // Negative stagger so bars start mid-cycle (smooth wave, no sync pop).
        const delay = (-((i % phases) / phases) * period).toFixed(2);
        return (
          <span
            key={i}
            style={{ height: `${h}px`, opacity, animationDelay: `${delay}s`, animationDuration: `${period}s` }}
          />
        );
      })}
    </div>
  );
}

function CartBar(): React.ReactElement | null {
  const { pathname } = useLocation();
  const { count, total, placing, placeOrder, clear } = useCart();
  if (pathname !== '/merch' || count === 0) return null;
  return (
    <div className="cart-bar show">
      <p className="cart-summary">
        {count} {count === 1 ? 'item' : 'items'} <strong>{naira(total)}</strong>
      </p>
      <button
        className="btn primary"
        disabled={placing}
        onClick={() => {
          void placeOrder().then(({ monnifyLink }) => {
            if (!monnifyLink) {
              clear();
              document.getElementById('order-confirm')?.classList.add('show');
            }
          });
        }}
      >
        {placing ? 'Redirecting…' : 'Place order'}
      </button>
    </div>
  );
}

function Shell(): React.ReactElement {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollToTop />
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            Side A <em>Lagos</em>
          </div>
          <nav className="tabs" aria-label="Primary">
            {TABS.map((t) => (
              <Link key={t.to} to={t.to} aria-current={isActiveTab(t, pathname) ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="wrap">
        <Outlet />
        <CartBar />
      </div>
    </>
  );
}

export function PublicShell(): React.ReactElement {
  return (
    <CartProvider>
      <Shell />
    </CartProvider>
  );
}
