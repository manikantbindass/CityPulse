import { test, expect } from '@playwright/test';

test('security headers, explicit auth boundary and safe login failure', async ({
  page,
  request,
}) => {
  const response = await page.goto('/login');
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("'nonce-");
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  await expect(page.getByRole('link', { name: 'Continue with identity provider' })).toHaveAttribute(
    'href',
    '/api/auth/login',
  );
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const anonymous = await request.get('/api/cities');
  expect(anonymous.status()).toBe(401);
  const crossSite = await request.post('/api/ml', {
    headers: { origin: 'https://malicious.invalid', 'sec-fetch-site': 'cross-site' },
    data: {},
  });
  expect(crossSite.status()).toBe(401);
  const config = await request.get('/api/decisions/config');
  expect((await config.json()).localComputeAllowed).toBe(false);
  const auth = await request.get('/api/auth/login');
  expect(auth.status()).toBe(503);
  expect(await auth.text()).not.toMatch(/client_secret|stack trace|password=/i);
});
