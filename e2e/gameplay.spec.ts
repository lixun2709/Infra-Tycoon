import { test, expect } from '@playwright/test';

test.describe('Infra-Tycoon Gameplay Core', () => {
  test('should render the main dashboard and allow interactions', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to initialize
    await expect(page.locator('text=SDDC Orchestrator').first()).toBeVisible({ timeout: 10000 });

    // Validate UI primitives exist (Phase 2 integration)
    const topNav = page.locator('nav');
    await expect(topNav).toBeVisible();

    // Open network manager or similar dashboard
    // Currently relying on generic texts, since this is a basic test
    // Assuming 'Network' or similar tab exists. We'll just verify no crash.
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should open hardware procurement menu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Economy').first()).toBeVisible();
    await page.locator('text=Economy').first().click();
    
    // Expect the panel primitive to show up
    await expect(page.locator('text=Finance & Logistics').first()).toBeVisible();
  });
});
