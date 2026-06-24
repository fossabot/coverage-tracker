import { createMiddleware } from 'hono/factory';
import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from 'jose';
import type { Bindings, Variables, GitHubOidcClaims } from '../types';

const JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_ISS = 'https://token.actions.githubusercontent.com';
const OIDC_AUD = 'coverage-tracker';

interface JWKSResponse {
  keys: JWK[];
}

async function fetchJWKS(forceRefresh: boolean): Promise<JWKSResponse> {
  const cacheKey = new Request(JWKS_URL);

  if (!forceRefresh) {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached.json() as Promise<JWKSResponse>;
  }

  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

  const body = await res.text();
  await caches.default.put(
    cacheKey,
    new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600',
      },
    }),
  );

  return JSON.parse(body) as JWKSResponse;
}

export async function verifyOidcToken(token: string): Promise<GitHubOidcClaims> {
  const header = decodeProtectedHeader(token);

  // Pin algorithm — reject alg:none and HS256 (A1)
  if (header.alg !== 'RS256') {
    throw new Error(`Unexpected JWT algorithm: ${header.alg}`);
  }

  let jwks = await fetchJWKS(false);
  let jwk = jwks.keys.find((k) => k.kid === header.kid);

  // Refetch once on unknown kid before rejecting (A8)
  if (!jwk) {
    jwks = await fetchJWKS(true);
    jwk = jwks.keys.find((k) => k.kid === header.kid);
  }

  if (!jwk) throw new Error(`Unknown signing key kid: ${header.kid}`);

  const publicKey = await importJWK(jwk, 'RS256');

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: OIDC_ISS,
    audience: OIDC_AUD,
    algorithms: ['RS256'],
  });

  return payload as unknown as GitHubOidcClaims;
}

export function requireOidc() {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing OIDC token' }, 401);
    }

    const token = auth.slice(7);
    let claims: GitHubOidcClaims;
    try {
      claims = await verifyOidcToken(token);
    } catch {
      return c.json({ error: 'Invalid OIDC token' }, 401);
    }

    c.set('oidcClaims', claims);
    await next();
  });
}
