// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => (state.cookies.has(key) ? { value: state.cookies.get(key) } : undefined),
  }),
}));
import {
  seal,
  unseal,
  backendAuthorization,
  localPreviewEnabled,
  sameOrigin,
} from '../lib/server-auth';

describe('browser security boundary', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    state.cookies.clear();
    vi.stubEnv('SESSION_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
    vi.stubEnv('PULSEAI_LOCAL_PREVIEW', 'false');
    vi.stubEnv('OIDC_ISSUER_URI', '');
  });
  it('rejects anonymous delegation unless local preview is explicitly enabled', async () => {
    vi.stubEnv('LOCAL_API_TOKEN', 'unit-test-secret');
    expect(await backendAuthorization()).toBeNull();
    vi.stubEnv('PULSEAI_LOCAL_PREVIEW', 'true');
    expect(await backendAuthorization()).toBe('Bearer unit-test-secret');
    vi.stubEnv('OIDC_ISSUER_URI', 'https://idp.example.test');
    expect(localPreviewEnabled()).toBe(false);
    expect(await backendAuthorization()).toBeNull();
  });
  it('rejects cross-site cookie mutations', () => {
    expect(
      sameOrigin(
        new Request('https://city.example/api/ml', {
          method: 'POST',
          headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
        }),
      ),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request('https://city.example/api/ml', {
          method: 'POST',
          headers: { origin: 'https://city.example', 'sec-fetch-site': 'same-origin' },
        }),
      ),
    ).toBe(true);
  });
  it('authenticates encrypted sessions and detects tampering/key rotation', async () => {
    const encrypted = await seal({ accessToken: 'test-not-real' }, 60);
    expect(encrypted).not.toContain('test-not-real');
    expect((await unseal(encrypted)).accessToken).toBe('test-not-real');
    await expect(unseal(encrypted.slice(0, -8) + 'corrupt!')).rejects.toThrow();
    vi.stubEnv('SESSION_ENCRYPTION_KEY', Buffer.alloc(32, 9).toString('base64'));
    await expect(unseal(encrypted)).rejects.toThrow();
  });
  it('does not accept unbounded or non-bearer auth headers', async () => {
    expect(
      await backendAuthorization(
        new Request('https://city.example/api/cities', {
          headers: { authorization: 'Basic not-a-token' },
        }),
      ),
    ).toBeNull();
  });
  it('accepts the explicit loopback host when Next internally rewrites its URL', () => {
    vi.stubEnv('PULSEAI_LOCAL_PREVIEW', 'true');
    expect(
      sameOrigin(
        new Request('http://localhost:3300/api/decisions/local', {
          headers: { host: '127.0.0.1:3300', origin: 'http://127.0.0.1:3300' },
        }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        new Request('http://localhost:3300/api/decisions/local', {
          headers: { host: '127.0.0.1:3300', origin: 'https://evil.invalid' },
        }),
      ),
    ).toBe(false);
  });
});
