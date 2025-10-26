# Frontend Testing Example with Playwright

This directory will contain example Playwright tests for the chaiNNer frontend.

## Setup

First, install Playwright:

```bash
npm install -D @playwright/test
```

Then install browsers:

```bash
npx playwright install
```

## Running Tests

1. Start the mock backend:
   ```bash
   npm run mock-backend
   ```

2. In another terminal, start the frontend:
   ```bash
   npm run frontend:web
   ```

3. Run Playwright tests:
   ```bash
   npx playwright test
   ```

Alternatively, use the combined script that starts both:
```bash
npm run dev:web:mock
```

Then in another terminal:
```bash
npx playwright test
```

## Example Test

Create a file `tests/e2e/example.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('ChaiNNer Frontend', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the frontend
    await page.goto('http://localhost:5173');
  });

  test('should load the application', async ({ page }) => {
    // Wait for the app to load
    await page.waitForSelector('#root');
    
    // Check that the main UI elements are present
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('should show node palette', async ({ page }) => {
    // Wait for the node palette to load
    // Add specific selectors based on your UI
    await page.waitForLoadState('networkidle');
    
    // You can add more specific tests based on your UI structure
  });
});
```

## Playwright Configuration

Create a `playwright.config.ts` in the root directory:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev:web:mock',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

This configuration will automatically start the frontend and mock backend before running tests.
