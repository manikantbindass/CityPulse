import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('PulseAI keeps missing evidence explicit, manages sessions, and is accessible', async ({
  page,
}, info) => {
  // Browser contract fixture intentionally has NO analytical facts or citations.
  await page.route('**/api/pulseai/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/cities'))
      return route.fulfill({
        json: [
          {
            id: '10000000-0000-0000-0000-000000000001',
            name: 'Synthetic test city',
            country_code: 'IN',
            timezone: 'Asia/Kolkata',
          },
        ],
      });
    if (path.endsWith('/messages'))
      return route.fulfill({
        json: {
          sessionId: 'test-session',
          statements: [],
          empty: true,
          documents: [],
          provider: 'evidence-fallback',
          notice: 'No matching records',
          limitations: ['No shortage can be inferred from missing observations.'],
          followUps: [],
          views: [{ label: 'Explore geography', href: '/explorer' }],
        },
      });
    if (method === 'POST') return route.fulfill({ json: { id: 'test-session' } });
    if (method === 'DELETE') return route.fulfill({ status: 204 });
    return route.fulfill({
      json: path.endsWith('test-session')
        ? []
        : [{ id: 'test-session', created_at: '2026-01-01T00:00:00Z' }],
    });
  });
  await page.goto('/analyst');
  await page.locator('.pulse-context summary').click();
  await page.getByRole('button', { name: 'Load permitted cities' }).click();
  await expect(page.getByRole('combobox', { name: 'City', exact: true })).toContainText(
    'Synthetic test city',
  );
  await page.locator('.pulse-context summary').click();
  await page.getByRole('button', { name: 'Explain source provenance', exact: true }).click();
  await expect(page.getByLabel('Ask PulseAI')).toHaveValue('Explain source provenance');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(
    page.getByText(
      'No authorized records match these filters. No analytical conclusion is available.',
    ),
  ).toBeVisible();
  await expect(page.getByText('PulseAI · evidence-fallback')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath('pulseai.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Delete conversation' }).click();
  await expect(
    page.getByText(
      'No authorized records match these filters. No analytical conclusion is available.',
    ),
  ).toHaveCount(0);
});
