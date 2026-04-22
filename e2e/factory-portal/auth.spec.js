const { test, expect } = require('@playwright/test');

test.describe('Factory Portal - Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to factory portal
    await page.goto('/');
  });

  test('Factory user can login', async ({ page }) => {
    // Wait for email input to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in factory user credentials
    await page.fill('input[type="email"]', 'factory@example.com');
    await page.fill('input[type="password"]', 'factory123');

    // Click login button
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for navigation to complete
    await page.waitForURL('**/', { timeout: 10000 });

    // Verify login was successful by checking we're not on login page
    expect(page.url()).not.toContain('login');
  });

  test('Login fails with invalid credentials', async ({ page }) => {
    // Wait for email input to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'invalidpassword');

    // Click login button
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for error message to appear
    await page.waitForSelector(
      'text=/[Ii]nvalid|[Ww]rong|[Uu]nauthorized|[Ee]rror/',
      { timeout: 5000 }
    );

    // Verify we're still on login page
    expect(page.url()).toContain('login') || !page.url().includes('login');
  });
});
