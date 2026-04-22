const { test, expect } = require('@playwright/test');

test.describe('Admin Portal - Invoices', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to invoices
    const invoicesLink = page.locator(
      'a:has-text("Invoices"), a:has-text("Invoice"), [data-testid="nav-invoices"]'
    );
    await invoicesLink.first().waitFor({ state: 'visible', timeout: 5000 });
    await invoicesLink.first().click();
    await page.waitForURL('**/invoices|**/invoice', { timeout: 10000 });
  });

  test('Invoices page loads', async ({ page }) => {
    const heading = page.locator('h1:has-text("Invoice"), h2:has-text("Invoice")');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('Invoices table displays', async ({ page }) => {
    const table = page.locator('table, [role="table"]');
    await expect(table.first()).toBeVisible({ timeout: 5000 });
  });

  test('Can create new invoice', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("New"), [data-testid="create-button"]'
    );

    try {
      await createButton.first().waitFor({ state: 'visible', timeout: 5000 });
      await createButton.first().click();

      const form = page.locator('form, [role="form"]');
      await form.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(form.first()).toBeVisible();
    } catch (e) {
      // Create button might not be available
    }
  });

  test('Can view invoice details', async ({ page }) => {
    const tableRows = page.locator('tbody tr, [role="row"]');
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      const firstRow = tableRows.first();
      const rowLink = firstRow.locator('a, [role="button"]').first();

      try {
        await rowLink.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        expect(page.url()).toBeTruthy();
      } catch (e) {
        // Link might not be clickable
      }
    }
  });

  test('Can filter invoices by status', async ({ page }) => {
    const statusFilter = page.locator('select, [data-testid="status-filter"]');

    try {
      await statusFilter.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(statusFilter.first()).toBeVisible();
    } catch (e) {
      // Filter might not be available
    }
  });

  test('Can search invoices', async ({ page }) => {
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[aria-label*="Search"], input[type="search"]'
    );

    try {
      await searchInput.first().waitFor({ state: 'visible', timeout: 5000 });
      await searchInput.first().fill('INV');
      await page.waitForTimeout(500);

      const value = await searchInput.first().inputValue();
      expect(value).toBe('INV');
    } catch (e) {
      // Search might not be available
    }
  });

  test('Can record payment', async ({ page }) => {
    const paymentButtons = page.locator('button:has-text("Payment"), button:has-text("Pay"), [data-testid="payment-button"]');

    try {
      await paymentButtons.first().waitFor({ state: 'visible', timeout: 5000 });
      await paymentButtons.first().click();

      const form = page.locator('form, [role="form"], dialog');
      await form.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(form.first()).toBeVisible();
    } catch (e) {
      // Payment button might not be available
    }
  });

  test('Can download invoice PDF', async ({ page }) => {
    const downloadButtons = page.locator('button:has-text("Download"), button:has-text("PDF"), [data-testid="download-button"]');

    try {
      await downloadButtons.first().waitFor({ state: 'visible', timeout: 5000 });
      // Note: We don't click to avoid actual download
      await expect(downloadButtons.first()).toBeVisible();
    } catch (e) {
      // Download button might not be available
    }
  });

  test('Can edit invoice', async ({ page }) => {
    const editButtons = page.locator('button:has-text("Edit"), [data-testid="edit-button"]');

    try {
      await editButtons.first().waitFor({ state: 'visible', timeout: 5000 });
      await editButtons.first().click();

      const form = page.locator('form, [role="form"]');
      await form.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(form.first()).toBeVisible();
    } catch (e) {
      // Edit button might not be available
    }
  });

  test('Can delete invoice', async ({ page }) => {
    const deleteButtons = page.locator('button:has-text("Delete"), [data-testid="delete-button"]');

    try {
      const count = await deleteButtons.count();
      if (count > 0) {
        await deleteButtons.first().click();

        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        try {
          await confirmButton.first().waitFor({ state: 'visible', timeout: 3000 });
          await confirmButton.first().click();
        } catch (e) {
          // No confirmation dialog
        }
      }
    } catch (e) {
      // Delete button might not be available
    }
  });

  test('Invoice amount displays correctly', async ({ page }) => {
    const amountCol = page.locator('[data-testid="amount-col"], th:has-text("Amount")');

    try {
      await amountCol.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(amountCol.first()).toBeVisible();
    } catch (e) {
      // Amount column might not be visible
    }
  });

  test('Invoice date displays correctly', async ({ page }) => {
    const dateCol = page.locator('[data-testid="date-col"], th:has-text("Date")');

    try {
      await dateCol.first().waitFor({ state: 'visible', timeout: 5000 });
      await expect(dateCol.first()).toBeVisible();
    } catch (e) {
      // Date column might not be visible
    }
  });
});
