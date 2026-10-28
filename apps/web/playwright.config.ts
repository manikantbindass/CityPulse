import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run start -- --port 3000',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
