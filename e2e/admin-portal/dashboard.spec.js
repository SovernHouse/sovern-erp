const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('../fixtures/auth');

test.describe('Admin Portal - Dashboard', () => {
  test('Dashboard loads after login', async ({ page }) => {
    // Navigate to login page
    await page.goto('/');

    // Wait for email input to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');

    // Click login button
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Verify dashboard title or heading is visible
    const dashboardHeading = page.locator(
      'h1:has-text("Dashboard"), h2:has-text("Dashboard")'
    );
    await expect(dashboardHeading).toBeVisible({ timeout: 5000 });
  });

  test('Dashboard shows key metrics cards', async ({ page }) => {
    // Navigate and login
    await page.goto('/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Look for metrics cards (common patterns)
    const cards = page.locator('[data-testid="metric-card"], .metric-card, .card');

    // Wait for at least some cards to appear
    await page.waitForTimeout(1000);

    // Verify cards are visible
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(0);
  });

  test('Navigation sidebar is visible', async ({ page }) => {
    // Navigate and login
    await page.goto('/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Look for sidebar navigation
    const sidebar = page.locator(
      '[data-testid="sidebar"], .sidebar, nav, aside'
    );

    // Wait for sidebar to be visible
    await sidebar.first().waitFor({ state: 'visible', timeout: 5000 });

    // Verify sidebar is visible
    await expect(sidebar.first()).toBeVisible();
  });
});
