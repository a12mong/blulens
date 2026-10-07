import { createHmac, timingSafeEqual } from 'node:crypto';

/** Minimal HS256 JWT (node:crypto, no dependency). Only what the access cookie needs. */

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');
const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export interface AccessClaims {
  sub: string;
  roles: string[];
  iat: number;
  exp: number;
}

export function signJwt(claims: Omit<AccessClaims, 'iat' | 'exp'>, secret: string, ttlSec: number, nowSec: number): string {
  const payload = b64url(JSON.stringify({ ...claims, iat: nowSec, exp: nowSec + ttlSec }));
  const sig = createHmac('sha256', secret).update(`${HEADER}.${payload}`).digest('base64url');
  return `${HEADER}.${payload}.${sig}`;
}

/** Returns the claims, or null when the token is malformed, forged or expired. Never throws. */
export function verifyJwt(token: string, secret: string, nowSec: number): AccessClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return null;
  const [, payload, sig] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(`${HEADER}.${payload}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessClaims;
    if (typeof claims.sub !== 'string' || !Array.isArray(claims.roles) || typeof claims.exp !== 'number') return null;
    return claims.exp > nowSec ? claims : null;
  } catch {
    return null;
  }
}
