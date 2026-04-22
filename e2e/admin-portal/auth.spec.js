const { test, expect } = require('@playwright/test');

test.describe('Admin Portal - Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/');
  });

  test('Admin can login with valid credentials', async ({ page }) => {
    // Wait for email input to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');

    // Click login button
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Verify we're on dashboard page
    expect(page.url()).toContain('dashboard');
  });

  test('Login fails with wrong password, shows error message', async ({
    page,
  }) => {
    // Wait for email input to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in credentials with wrong password
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Click login button
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for error message to appear
    await page.waitForSelector(
      'text=/[Ii]nvalid|[Ww]rong|[Uu]nauthorized/',
      { timeout: 5000 }
    );

    // Verify we're still on login page
    expect(page.url()).not.toContain('dashboard');
  });

  test('Login redirects to dashboard', async ({ page }) => {
    // Fill in valid credentials
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');

    // Click login button
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for navigation
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Verify redirect happened
    expect(page.url()).toContain('dashboard');
  });

  test('Logout clears session', async ({ page }) => {
    // First, login
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@floortrading.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Login"), button:has-text("Sign In")');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Find and click logout button
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout-button"]'
    );

    // Wait for logout button to be visible
    await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
    await logoutButton.click();

    // Wait for redirect to login page
    await page.waitForURL('/', { timeout: 10000 });

    // Verify we're back on login page
    expect(page.url()).not.toContain('dashboard');
  });
});
