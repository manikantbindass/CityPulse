import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The color values are the actual shared design tokens, not a screenshot tolerance.
const themes = [
  { name: 'dark', surface: 'rgb(16, 23, 35)', body: 'rgb(9, 13, 22)' },
  { name: 'light', surface: 'rgb(255, 255, 255)', body: 'rgb(240, 243, 248)' },
] as const;

test('saved theme aligns document, portal dialogs, native controls and notifications', async ({
  page,
}, info) => {
  await page.goto('/settings');
  const select = page.getByLabel('Theme', { exact: true });
  await expect(select).toBeEnabled();
  for (const theme of themes) {
    await select.selectOption(theme.name);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.name);
    await expect(page.locator('body')).toHaveCSS('background-color', theme.body);
    await expect(select).toHaveCSS('color-scheme', theme.name);
    await page.getByRole('button', { name: 'Save local profile' }).click();
    await expect(page.getByText('Local display name saved', { exact: true }).last()).toBeVisible();
    await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute(
      'data-sonner-theme',
      theme.name,
    );
    // The portal is a sibling of the app shell, so a shell-only theme cannot pass.
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveCSS('background-color', theme.surface);
    await expect(dialog.getByLabel('Search pages')).toHaveCSS('background-color', theme.surface);
    await expect(dialog.getByLabel('Search pages')).toBeFocused();
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`theme-${theme.name}-dialog.png`),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('dialog')).toHaveCSS(
        'background-color',
        theme.name === 'dark' ? 'rgb(13, 18, 28)' : theme.surface,
      );
      await page.keyboard.press('Escape');
    }
    await page.reload();
    await expect(select).toBeEnabled();
    await expect(select).toHaveValue(theme.name);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.name);
  }
  await page.goto('/dashboard');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', themes[1].body);
});
