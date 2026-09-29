import { useCallback, useEffect, useRef, useState } from 'react';

export const AUTH_EVENT = 'side-a-auth';
export const TOKEN_KEY = 'side-a-google-id-token';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (res: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// Display-only name from the ID token payload (given name → full name → email
// handle). Never used for authorization — the server verifies the token.
export function displayNameFromToken(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      given_name?: string;
      name?: string;
      email?: string;
    };
    const given = (payload.given_name ?? '').trim();
    if (given) return given.split(' ')[0];
    const full = (payload.name ?? '').trim();
    if (full) return full.split(' ')[0];
    const email = (payload.email ?? '').trim();
    if (email.includes('@')) return email.split('@')[0];
    return null;
  } catch {
    return null;
  }
}

export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState<boolean>(() => readToken() !== null);
  useEffect(() => {
    const sync = (): void => setSignedIn(readToken() !== null);
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return signedIn;
}

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-gis', '1');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GIS failed to load'));
    document.head.appendChild(s);
  });
}

export function SignInButton({ contextLabel = 'sign-in' }: { contextLabel?: string }): React.ReactElement {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const signedIn = useSignedIn();
  const [failed, setFailed] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(() => displayNameFromToken(readToken()));
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncName = (): void => setDisplayName(displayNameFromToken(readToken()));
    syncName();
    window.addEventListener(AUTH_EVENT, syncName);
    return () => window.removeEventListener(AUTH_EVENT, syncName);
  }, []);

  useEffect(() => {
    if (!clientId || signedIn) return;
    let cancelled = false;
    void loadGisScript()
      .then(() => {
        if (cancelled || !btnRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            try {
              localStorage.setItem(TOKEN_KEY, res.credential);
            } catch {
              /* private mode */
            }
            window.dispatchEvent(new Event(AUTH_EVENT));
          },
        });
        window.google.accounts.id.renderButton(btnRef.current, { theme: 'filled_black', size: 'medium' });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, signedIn]);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(AUTH_EVENT));
  }, []);

  if (!clientId) {
    return (
      <span className="pill" title={`Set VITE_GOOGLE_CLIENT_ID to enable ${contextLabel}`}>
        Sign-in not configured
      </span>
    );
  }
  if (failed) {
    return <span className="pill">Google sign-in failed to load</span>;
  }
  if (signedIn) {
    return (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <span className="pill pill-accent" title="Signed in with Google">
          Signed in{displayName ? `, ${displayName}` : ''}
        </span>
        <button type="button" className="btn small signout" onClick={signOut}>
          Sign out
        </button>
      </span>
    );
  }
  return <div ref={btnRef} style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center' }} />;
}
