import { test, expect } from '@playwright/test';

test.describe('Infra-Tycoon Onboarding Flow', () => {
  test('should present the player with initial contracts and allow progression', async ({ page }) => {
    await page.goto('/');

    // Verify UI primitives
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    // Open Economy Dashboard
    await expect(page.locator('text=Economy').first()).toBeVisible();
    await page.locator('text=Economy').first().click();

    // Check if there are active contracts
    await expect(page.locator('text=Finance & Logistics').first()).toBeVisible();
  });
});
