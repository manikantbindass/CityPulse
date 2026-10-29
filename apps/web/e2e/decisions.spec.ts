import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import type { DecisionRun } from '../lib/decision-contracts';
const expected = JSON.parse(
  readFileSync(
    new URL('../../../data/sample/decisions/expected-retail.json', import.meta.url),
    'utf8',
  ),
) as DecisionRun;

test('decision dashboards explain real solver fixture and preserve assumptions', async ({
  page,
}, info) => {
  // Captured synthetic SciPy result is a browser-contract fixture, not a live call.
  await page.route('**/api/decisions/config', (r) =>
    r.fulfill({ json: { localComputeAllowed: true } }),
  );
  await page.route('**/api/decisions/local', (r) => r.fulfill({ json: expected }));
  await page.goto('/opportunities');
  await expect(
    page.getByText('There are no precomputed recommendations here.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Evaluate locally' }).click();
  await expect(page.getByText('LOCAL · UNSAVED', { exact: false })).toBeVisible();
  await expect(page.getByRole('table').first()).toContainText('Central sample');
  await page.getByRole('tab', { name: 'Resource Optimization Simulator' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory redistribution plan' })).toBeVisible();
  await page.getByRole('tab', { name: 'Decision Explanation Panel' }).click();
  await expect(page.getByText(expected.result.inputFingerprint, { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('decision-explanation.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Investment Planning Workspace' }).click();
  await page.getByRole('button', { name: 'Stage half-budget what-if' }).click();
  await expect(page.getByLabel('Budget (INR)', { exact: true })).toHaveValue(
    String(Math.round(expected.result.canonicalInput.budget * 0.5)),
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export reproducible JSON' }).click();
  expect((await download).suggestedFilename()).toMatch(/citypulse-scenario/);
});
