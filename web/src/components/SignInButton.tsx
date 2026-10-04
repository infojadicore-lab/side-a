import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from './Spinner.js';

export const AUTH_EVENT = 'side-a-auth';
export const TOKEN_KEY = 'side-a-google-id-token';

export interface PromptMoment {
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (res: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: (momentListener?: (m: PromptMoment) => void) => void;
          cancel: () => void;
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

// Google "G" brand mark. Brand marks keep their brand colors (never
// currentColor) and never flip in RTL — see .agents/skills/better-ui/icons.md.
// Chunky shape stays legible at the 16–18px sizes it renders at.
export function GoogleGIcon(): React.ReactElement {
  return (
    <svg className="g-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"
      />
    </svg>
  );
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

function storeCredential(credential: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, credential);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function initGis(clientId: string): void {
  window.google?.accounts.id.initialize({
    client_id: clientId,
    callback: (res) => storeCredential(res.credential),
  });
}

// GIS init shared across every SignInButton instance on the page.
let gisInitPromise: Promise<void> | null = null;

function resetGis(): void {
  gisInitPromise = null;
}

function ensureGis(clientId: string): Promise<void> {
  if (window.google?.accounts?.id) {
    initGis(clientId);
    return Promise.resolve();
  }
  if (!gisInitPromise) {
    gisInitPromise = loadGisScript()
      .then(() => {
        initGis(clientId);
      })
      .catch((e: unknown) => {
        gisInitPromise = null;
        throw e;
      });
  }
  return gisInitPromise;
}

export function SignInButton({ contextLabel = 'sign-in' }: { contextLabel?: string }): React.ReactElement {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const signedIn = useSignedIn();
  const [failed, setFailed] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(() => displayNameFromToken(readToken()));
  const btnRef = useRef<HTMLDivElement>(null);
  const busyTimer = useRef<number | null>(null);

  const stopBusy = useCallback(() => {
    if (busyTimer.current !== null) {
      window.clearTimeout(busyTimer.current);
      busyTimer.current = null;
    }
    setBusy(false);
  }, []);

  // Safety net: the moment callback should always fire, but if it never
  // does the button must not spin forever.
  const armBusyTimeout = useCallback(() => {
    if (busyTimer.current !== null) window.clearTimeout(busyTimer.current);
    busyTimer.current = window.setTimeout(() => {
      busyTimer.current = null;
      setBusy(false);
      setUseFallback(true);
    }, 10000);
  }, []);

  useEffect(() => {
    const syncName = (): void => setDisplayName(displayNameFromToken(readToken()));
    syncName();
    window.addEventListener(AUTH_EVENT, syncName);
    return () => window.removeEventListener(AUTH_EVENT, syncName);
  }, []);

  // Preload GIS so One Tap opens instantly on click.
  useEffect(() => {
    if (!clientId || signedIn) return;
    let cancelled = false;
    void ensureGis(clientId)
      .then(() => {
        if (!cancelled) setGisLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, signedIn]);

  // Fallback path only: render Google's own button when One Tap can't show.
  useEffect(() => {
    if (!useFallback || !gisLoaded || signedIn || !btnRef.current || !window.google) return;
    window.google.accounts.id.renderButton(btnRef.current, { theme: 'filled_black', size: 'medium' });
  }, [useFallback, gisLoaded, signedIn]);

  // Dismiss any open One Tap prompt on unmount.
  useEffect(
    () => () => {
      try {
        window.google?.accounts.id.cancel();
      } catch {
        /* not initialized */
      }
      if (busyTimer.current !== null) {
        window.clearTimeout(busyTimer.current);
        busyTimer.current = null;
      }
    },
    [],
  );

  // A stored credential means sign-in completed — stop spinning anywhere.
  useEffect(() => {
    if (signedIn) stopBusy();
  }, [signedIn, stopBusy]);

  const startSignIn = (): void => {
    if (busy) return;
    if (!window.google?.accounts?.id) {
      // GIS not loaded yet — try once more, else show the failure pill.
      if (!clientId) return;
      setBusy(true);
      void ensureGis(clientId)
        .then(() => {
          setGisLoaded(true);
          stopBusy();
        })
        .catch(() => {
          stopBusy();
          setFailed(true);
        });
      return;
    }
    setBusy(true);
    armBusyTimeout();
    try {
      window.google.accounts.id.prompt((moment) => {
        // One Tap couldn't or wouldn't show (no session, dismissed,
        // FedCM opt-out) — offer Google's own button instead.
        if (moment.isSkippedMoment() || moment.isDismissedMoment()) {
          stopBusy();
          setUseFallback(true);
        }
      });
    } catch {
      stopBusy();
      setUseFallback(true);
    }
  };

  const retryLoad = (): void => {
    // Tracker blockers (Brave Shields etc.) kill the GIS script; once the
    // user allows it, retry from scratch without a reload.
    resetGis();
    setFailed(false);
    setUseFallback(false);
    setBusy(true);
    void ensureGis(clientId)
      .then(() => {
        setGisLoaded(true);
        stopBusy();
      })
      .catch(() => {
        stopBusy();
        setFailed(true);
      });
  };

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
      <span className="pill pill-with-icon" title={`Set VITE_GOOGLE_CLIENT_ID to enable ${contextLabel}`}>
        <GoogleGIcon />
        Sign-in not configured
      </span>
    );
  }
  if (failed) {
    return (
      <span className="pill pill-with-icon">
        <GoogleGIcon />
        Google sign-in failed to load
        <button type="button" className="btn small" onClick={retryLoad} style={{ marginLeft: 4 }}>
          Try again
        </button>
      </span>
    );
  }
  if (signedIn) {
    return (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <span className="pill pill-accent pill-with-icon" title="Signed in with Google">
          <GoogleGIcon />
          Signed in{displayName ? `, ${displayName}` : ''}
        </span>
        <button type="button" className="btn small signout" onClick={signOut}>
          Sign out
        </button>
      </span>
    );
  }
  if (useFallback) {
    return (
      <div ref={btnRef} style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center' }} />
    );
  }
  return (
    <button type="button" className="google-btn" onClick={startSignIn} disabled={busy} aria-busy={busy}>
      {busy ? <Spinner /> : <GoogleGIcon />}
      {busy ? 'Waiting for Google…' : 'Continue with Google'}
    </button>
  );
}
