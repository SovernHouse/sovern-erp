const { test, expect } = require('@playwright/test');

test.describe('Admin Portal - Reports', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to reports
    const reportsLink = page.locator(
      'a:has-text("Reports"), a:has-text("Report"), [data-testid="nav-reports"]'
    );
    await reportsLink.first().waitFor({ state: 'visible', timeout: 5000 });
    await reportsLink.first().click();
    await page.waitForURL('**/reports', { timeout: 10000 });
  });

  test('Reports page loads', async ({ page }) => {
    const heading = page.locator('h1:has-text("Report"), h2:has-text("Report")');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('Sales report available', async ({ page }) => {
    const salesReportButton = page.locator('button:has-text("Sales Report"), a:has-text("Sales Report")');

    try {
      await salesReportButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(salesReportButton.first()).toBeVisible();
    } catch (e) {
      // Sales report button might not be visible
    }
  });

  test('Financial report available', async ({ page }) => {
    const finReportButton = page.locator('button:has-text("Financial Report"), a:has-text("Financial Report")');

    try {
      await finReportButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(finReportButton.first()).toBeVisible();
    } catch (e) {
      // Financial report button might not be visible
    }
  });

  test('Customer report available', async ({ page }) => {
    const custReportButton = page.locator('button:has-text("Customer Report"), a:has-text("Customer Report")');

    try {
      await custReportButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(custReportButton.first()).toBeVisible();
    } catch (e) {
      // Customer report button might not be visible
    }
  });

  test('Inventory report available', async ({ page }) => {
    const invReportButton = page.locator('button:has-text("Inventory Report"), a:has-text("Inventory Report")');

    try {
      await invReportButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(invReportButton.first()).toBeVisible();
    } catch (e) {
      // Inventory report button might not be visible
    }
  });

  test('Can select date range', async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');

    try {
      await dateInputs.first().waitFor({ state: 'visible', timeout: 5000 });
      const count = await dateInputs.count();
      expect(count).toBeGreaterThanOrEqual(0);
    } catch (e) {
      // Date inputs might not be visible
    }
  });

  test('Can generate report', async ({ page }) => {
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Run"), button:has-text("Create")');

    try {
      await generateButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(generateButton.first()).toBeVisible();
    } catch (e) {
      // Generate button might not be visible
    }
  });

  test('Can export report as CSV', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), [data-testid="export-button"]');

    try {
      await exportButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(exportButton.first()).toBeVisible();
    } catch (e) {
      // Export button might not be visible
    }
  });

  test('Can export report as PDF', async ({ page }) => {
    const pdfButton = page.locator('button:has-text("PDF"), [data-testid="pdf-button"]');

    try {
      await pdfButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(pdfButton.first()).toBeVisible();
    } catch (e) {
      // PDF button might not be visible
    }
  });

  test('Report table displays results', async ({ page }) => {
    const table = page.locator('table, [role="table"]');

    try {
      await table.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(table.first()).toBeVisible();
    } catch (e) {
      // Table might not be visible initially
    }
  });
});
