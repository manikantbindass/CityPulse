import { test, expect } from '@playwright/test';

test('real Java/AI forecast renders and report downloads', async ({ page }) => {
  test.skip(process.env.CITYPULSE_FULL_STACK !== 'true', 'Requires the real Compose API/AI stack');
  await page.goto('/predictions');
  await page.getByRole('button', { name: 'Forecast next 7 days' }).click();
  await expect(page.getByText(/Model:.*version/)).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole('table', { name: 'Actual AI output from synthetic daily inputs' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Actual AI output from synthetic daily inputs' })
      .locator('tbody tr'),
  ).toHaveCount(7);
  await page.goto('/reports');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await download).suggestedFilename()).toContain('report');
});
