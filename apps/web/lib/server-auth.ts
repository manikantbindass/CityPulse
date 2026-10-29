import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createClient } from 'redis';
import { EncryptJWT, jwtDecrypt } from 'jose';
import * as oidc from 'openid-client';

export const SESSION_COOKIE = '__Host-citypulse-session';
export const FLOW_COOKIE = '__Host-citypulse-flow';
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
let redis: ReturnType<typeof createClient> | undefined;
let connecting: Promise<unknown> | undefined;
async function store() {
  if (
    !process.env.SESSION_REDIS_URL?.startsWith('rediss://') &&
    process.env.SESSION_REDIS_ALLOW_LOCAL !== 'true'
  )
    throw new Error('TLS session store required');
  if (!redis) {
    redis = createClient({
      url: process.env.SESSION_REDIS_URL,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    redis.on('error', () => {});
  }
  if (!redis.isOpen) {
    connecting ??= redis.connect().finally(() => {
      connecting = undefined;
    });
    await connecting;
  }
  return redis;
}
function encryptionKey() {
  const key = Buffer.from(process.env.SESSION_ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('Session encryption key must be 32 bytes');
  return new Uint8Array(key);
}
export async function seal(value: Record<string, unknown>, seconds: number) {
  return new EncryptJWT(value)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .setIssuer('citypulse-web')
    .setAudience('citypulse-session')
    .encrypt(encryptionKey());
}
export async function unseal(value: string) {
  return (
    await jwtDecrypt(value, encryptionKey(), {
      issuer: 'citypulse-web',
      audience: 'citypulse-session',
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    })
  ).payload;
}
export function webOrigin() {
  const url = new URL(process.env.WEB_ORIGIN ?? '');
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('WEB_ORIGIN must be an HTTPS origin');
  return url.origin;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const expected = process.env.WEB_ORIGIN ?? new URL(request.url).origin;
  return (
    (!origin || origin === expected) && (!fetchSite || ['same-origin', 'none'].includes(fetchSite))
  );
}
export async function configuration() {
  const issuer = new URL(process.env.OIDC_ISSUER_URI ?? '');
  if (issuer.protocol !== 'https:') throw new Error('HTTPS IdP required');
  if (!process.env.OIDC_CLIENT_ID || !process.env.OIDC_CLIENT_SECRET)
    throw new Error('OIDC client not configured');
  const config = await oidc.discovery(
    issuer,
    process.env.OIDC_CLIENT_ID,
    process.env.OIDC_CLIENT_SECRET,
    oidc.ClientSecretBasic(process.env.OIDC_CLIENT_SECRET),
    { timeout: 8 },
  );
  oidc.enableNonRepudiationChecks(config);
  return config;
}
export async function startLogin() {
  const db = await store();
  const count = await db.incr(`auth:login:${Math.floor(Date.now() / 60000)}`);
  if (count === 1) await db.expire(`auth:login:${Math.floor(Date.now() / 60000)}`, 120);
  if (count > 100) throw new Error('Login budget exceeded');
  const config = await configuration();
  const verifier = oidc.randomPKCECodeVerifier(),
    nonce = oidc.randomNonce(),
    state = oidc.randomState();
  const handle = randomBytes(32).toString('base64url');
  await db.set(`oidc:flow:${hash(handle)}`, await seal({ verifier, nonce, state }, 300), {
    EX: 300,
  });
  (await cookies()).set(FLOW_COOKIE, handle, { ...cookieOptions, maxAge: 300 });
  const parameters: Record<string, string> = {
    redirect_uri: `${webOrigin()}/api/auth/callback`,
    scope: process.env.OIDC_SCOPES ?? 'openid registry:read data:read analytics:read',
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    nonce,
    state,
  };
  if (process.env.OIDC_REQUIRED_ACR) parameters.acr_values = process.env.OIDC_REQUIRED_ACR;
  return oidc.buildAuthorizationUrl(config, parameters);
}
export async function finishLogin(request: Request) {
  const jar = await cookies();
  const handle = jar.get(FLOW_COOKIE)?.value;
  jar.delete(FLOW_COOKIE);
  if (!handle || !/^[A-Za-z0-9_-]{43}$/.test(handle)) throw new Error('Login flow missing');
  const db = await store();
  const encrypted = await db.getDel(`oidc:flow:${hash(handle)}`);
  if (!encrypted) throw new Error('Login flow expired or replayed');
  const flow = await unseal(encrypted);
  const config = await configuration();
  const callback = new URL(`${webOrigin()}/api/auth/callback`);
  callback.search = new URL(request.url).search;
  const tokens = await oidc.authorizationCodeGrant(config, callback, {
    pkceCodeVerifier: String(flow.verifier),
    expectedState: String(flow.state),
    expectedNonce: String(flow.nonce),
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub || !tokens.access_token) throw new Error('Missing identity');
  if (process.env.OIDC_REQUIRED_ACR && claims.acr !== process.env.OIDC_REQUIRED_ACR)
    throw new Error('Required MFA assurance not met');
  if (tokens.token_type?.toLowerCase() !== 'bearer') throw new Error('Unsupported token type');
  // Access token must independently pass the API issuer/audience/membership checks.
  const membership = await fetch(`${process.env.API_BASE_URL}/api/v1/security/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!membership.ok) throw new Error('Account membership rejected');
  const ttl = Math.min(Number(tokens.expires_in ?? 0), 3600);
  if (!Number.isFinite(ttl) || ttl < 1) throw new Error('Expiring access token required');
  const session = randomBytes(32).toString('base64url');
  await db.set(
    `session:${hash(session)}`,
    await seal(
      { accessToken: tokens.access_token, subjectHash: hash(claims.sub), createdAt: Date.now() },
      ttl,
    ),
    { EX: ttl },
  );
  jar.set(SESSION_COOKIE, session, { ...cookieOptions, maxAge: ttl });
}
export async function sessionToken() {
  const handle = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!handle) return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(handle)) return null;
  const value = await (await store()).get(`session:${hash(handle)}`);
  if (!value) return null;
  const payload = await unseal(value);
  return typeof payload.accessToken === 'string' ? payload.accessToken : null;
}
export async function logout() {
  const jar = await cookies();
  const handle = jar.get(SESSION_COOKIE)?.value;
  if (handle) await (await store()).del(`session:${hash(handle)}`);
  jar.delete(SESSION_COOKIE);
  jar.delete(FLOW_COOKIE);
}
export function localPreviewEnabled() {
  return process.env.PULSEAI_LOCAL_PREVIEW === 'true' && !process.env.OIDC_ISSUER_URI;
}
export async function backendAuthorization(request?: Request) {
  if (request && !sameOrigin(request)) return null;
  const bearer = request?.headers.get('authorization');
  if (bearer) return bearer.startsWith('Bearer ') ? bearer : null;
  const token = await sessionToken();
  if (token) return `Bearer ${token}`;
  return localPreviewEnabled() && process.env.LOCAL_API_TOKEN
    ? `Bearer ${process.env.LOCAL_API_TOKEN}`
    : null;
}
