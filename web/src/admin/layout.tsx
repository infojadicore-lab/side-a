import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { AUTH_EVENT, GoogleSignIn } from './GoogleSignIn.js';

const TABS = [
  { to: '', label: 'Dashboard', end: true },
  { to: 'editions', label: 'Editions' },
  { to: 'board', label: 'Board' },
  { to: 'merch', label: 'Merch' },
  { to: 'updates', label: 'Updates' },
  { to: 'webhooks', label: 'Webhooks' },
];

const LEGACY_TABS = ['dashboard', 'editions', 'board', 'merch', 'updates', 'webhooks'];

function LegacyHashRedirect(): null {
  const { hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const name = (hash || '').replace(/^#\/?/, '');
    if (LEGACY_TABS.includes(name)) {
      navigate(name === 'dashboard' ? '' : name, { replace: true });
    }
  }, [hash, navigate]);
  return null;
}

function ScrollToTop(): null {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname, search]);
  return null;
}

function adminBase(): string {
  const raw = (import.meta.env.VITE_ADMIN_BASENAME ?? '/admin').trim();
  if (raw === '' || raw === '/') return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function isActiveTab(to: string, end: boolean | undefined, pathname: string): boolean {
  const base = adminBase();
  const home = base === '' ? '/' : base;
  const full = to ? `${base}/${to}` : home;
  if (end) return pathname === home;
  return pathname === full || pathname.startsWith(`${full}/`);
}

export function AdminShell(): React.ReactElement {
  const { pathname } = useLocation();
  const [signedIn, setSignedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('side-a-google-id-token') !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = (): void => {
      try {
        setSignedIn(localStorage.getItem('side-a-google-id-token') !== null);
      } catch {
        setSignedIn(false);
      }
    };
    window.addEventListener(AUTH_EVENT, sync);
    return () => window.removeEventListener(AUTH_EVENT, sync);
  }, []);

  return (
    <>
      <LegacyHashRedirect />
      <ScrollToTop />
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            Side A <em>Admin</em>
          </div>
          <nav className="tabs" id="admin-tabs" aria-label="Admin">
            {TABS.map((t) => (
              <Link key={t.label} to={t.to} aria-current={isActiveTab(t.to, t.end, pathname) ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
          <GoogleSignIn />
        </div>
      </header>
      <div className="wrap">
        {!signedIn ? (
          <p className="board-empty" style={{ marginTop: 12 }}>
            Admin actions require Google sign-in with an allowlisted account — data below is read-only until you sign
            in.
          </p>
        ) : null}
        <Outlet />
      </div>
    </>
  );
}
