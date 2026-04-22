const { test, expect } = require('@playwright/test');

test.describe('Admin Portal - Sales Orders', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and login
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
  });

  test('Can navigate to sales orders page', async ({ page }) => {
    // Click on sales orders in navigation
    // Try multiple selectors for common navigation patterns
    const salesOrdersLink = page.locator(
      'a:has-text("Sales Orders"), a:has-text("Sales"), [data-testid="nav-sales-orders"]'
    );

    // Wait for link to be visible and click
    await salesOrdersLink.first().waitFor({ state: 'visible', timeout: 5000 });
    await salesOrdersLink.first().click();

    // Wait for navigation
    await page.waitForURL('**/sales-orders|**/orders', { timeout: 10000 });

    // Verify we're on sales orders page
    expect(page.url()).toMatch(/sales-orders|orders/);
  });

  test('Sales orders table loads', async ({ page }) => {
    // Navigate to sales orders page
    const salesOrdersLink = page.locator(
      'a:has-text("Sales Orders"), a:has-text("Sales"), [data-testid="nav-sales-orders"]'
    );

    await salesOrdersLink.first().waitFor({ state: 'visible', timeout: 5000 });
    await salesOrdersLink.first().click();
    await page.waitForURL('**/sales-orders|**/orders', { timeout: 10000 });

    // Wait for table to load
    const table = page.locator('table, [role="table"]');
    await table.first().waitFor({ state: 'visible', timeout: 5000 });

    // Verify table is visible
    await expect(table.first()).toBeVisible();
  });

  test('Can open create sales order form', async ({ page }) => {
    // Navigate to sales orders page
    const salesOrdersLink = page.locator(
      'a:has-text("Sales Orders"), a:has-text("Sales"), [data-testid="nav-sales-orders"]'
    );

    await salesOrdersLink.first().waitFor({ state: 'visible', timeout: 5000 });
    await salesOrdersLink.first().click();
    await page.waitForURL('**/sales-orders|**/orders', { timeout: 10000 });

    // Click create button
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("New"), button:has-text("Add"), [data-testid="create-button"]'
    );

    await createButton.first().waitFor({ state: 'visible', timeout: 5000 });
    await createButton.first().click();

    // Wait for form to appear
    const form = page.locator('form, [role="form"]');
    await form.first().waitFor({ state: 'visible', timeout: 5000 });

    // Verify form is visible
    await expect(form.first()).toBeVisible();
  });
});
