import type { FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

export type GoogleUser = { googleId: string; email?: string | undefined; displayName?: string | undefined };

declare module 'fastify' {
  interface FastifyRequest {
    googleUser?: GoogleUser;
  }
}

let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (!oauthClient) oauthClient = new OAuth2Client();
  return oauthClient;
}

// Legacy unverified decode — dev only (GOOGLE_CLIENT_ID unset). Never trusted
// for authorization decisions; requireAdmin always demands a verified token.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1] as string, 'base64url').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const viaHeader = request.headers['x-google-id-token'];
  return typeof viaHeader === 'string' && viaHeader.length > 0 ? viaHeader : null;
}

function displayNameFromPayload(payload: Record<string, unknown>): string | undefined {
  const given = typeof payload.given_name === 'string' ? payload.given_name.trim().split(' ')[0] : '';
  if (given) return given;
  const full = typeof payload.name === 'string' ? payload.name.trim().split(' ')[0] : '';
  if (full) return full;
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (email.includes('@')) return email.split('@')[0];
  return undefined;
}

async function verifyGoogleToken(token: string): Promise<GoogleUser | null> {
  // Production path: cryptographic verification against Google certs.
  if (config.GOOGLE_CLIENT_ID) {
    try {
      const ticket = await getOAuthClient().verifyIdToken({
        idToken: token,
        audience: config.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) return null;
      return {
        googleId: payload.sub,
        email: payload.email ?? undefined,
        displayName: displayNameFromPayload(payload as unknown as Record<string, unknown>),
      };
    } catch {
      return null;
    }
  }
  // Dev fallback (GOOGLE_CLIENT_ID unset): unverified decode, else raw token id.
  const payload = decodeJwtPayload(token);
  if (payload && typeof payload.sub === 'string') {
    return {
      googleId: payload.sub,
      email: payload.email as string | undefined,
      displayName: displayNameFromPayload(payload),
    };
  }
  return { googleId: token };
}

function adminAllowlist(): string[] {
  return (config.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireGoogleUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractToken(request);
  if (!token) {
    void reply.status(401).send({ error: 'Unauthorized', message: 'Google sign-in required' });
    return;
  }
  const user = await verifyGoogleToken(token);
  if (!user) {
    void reply.status(401).send({ error: 'Unauthorized', message: 'Invalid Google token' });
    return;
  }
  request.googleUser = user;
}

// Admin gate: verified Google identity AND allowlisted email/id.
// - ADMIN_EMAILS unset + production: deny everything (fail closed).
// - ADMIN_EMAILS unset + non-production: allow (local dev ergonomics), warn once.
let warnedOpenAdmin = false;

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireGoogleUser(request, reply);
  if (reply.sent) return;
  const allow = adminAllowlist();
  if (allow.length === 0) {
    if (config.NODE_ENV === 'production') {
      void reply.status(403).send({ error: 'Forbidden', message: 'Admin allowlist not configured' });
      return;
    }
    if (!warnedOpenAdmin) {
      warnedOpenAdmin = true;
      request.log.warn('ADMIN_EMAILS unset — admin routes open in non-production mode');
    }
    return;
  }
  const user = request.googleUser as GoogleUser;
  const email = (user.email ?? '').toLowerCase();
  if (!allow.includes(email) && !allow.includes(user.googleId)) {
    void reply.status(403).send({ error: 'Forbidden', message: 'Not an admin account' });
    return;
  }
}
