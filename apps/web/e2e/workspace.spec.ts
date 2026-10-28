import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('marketing, overview, responsive layout, and accessible navigation', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Understand the city/ })).toBeVisible();
  await page.getByRole('link', { name: 'Explore the foundation' }).click();
  await expect(page.getByRole('heading', { name: 'Your city, in perspective.' })).toBeVisible();
  await expect(page.getByText(/No live city intelligence/)).toBeVisible();
  await page.getByRole('combobox', { name: 'District filter' }).selectOption('east');
  await expect(page.getByRole('cell', { name: '756', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save view' }).click();
  await expect(page.getByText('View saved on this device')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Search pages').fill('Reports');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make intelligence shareable.' })).toBeVisible();
  await page.screenshot({
    path: `../../docs/assets/workspace-${info.project.name}.png`,
    fullPage: true,
  });
});
test('all pages load without uncaught runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [
    'features',
    'login',
    'register',
    'dashboard',
    'explorer',
    'intelligence',
    'predictions',
    'opportunities',
    'optimization',
    'verification',
    'analyst',
    'reports',
    'notifications',
    'settings',
    'admin',
    'help',
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('analyst, digest, exports, and role-aware navigation work', async ({ page }) => {
  await page.goto('/analyst');
  await page.getByLabel('Ask about sample data').fill('Which district has the largest gap?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText(/East Market has the largest sample gap/)).toBeVisible();
  await page.goto('/verification');
  await page.getByRole('button', { name: 'Calculate fingerprint' }).click();
  await expect(page.locator('.digest')).toHaveText(/^0x[a-f0-9]{64}$/);
  await page.goto('/reports');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await download).suggestedFilename()).toContain('report');
  await page.goto('/settings');
  await page.getByLabel('Demo persona').selectOption('administrator');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Local administrator persona' })).toBeVisible();
});
test('dark and light overview meet automated WCAG checks', async ({ page }) => {
  for (const theme of ['dark', 'light']) {
    await page.goto('/settings');
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    await page.goto('/dashboard');
    await page.waitForTimeout(700);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
test('mobile navigation and reduced motion remain usable', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'City explorer' }).click();
    await expect(page.getByRole('heading', { name: 'Explore every district.' })).toBeVisible();
  }
  await expect(page.locator('main#main')).toBeVisible();
});
