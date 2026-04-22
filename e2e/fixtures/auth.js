const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Helper to login and return authenticated context
async function loginAsAdmin(page) {
  await page.goto('/');

  // Wait for login form to be visible
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Enter credentials
  await page.fill('input[type="email"]', 'admin@floortrading.com');
  await page.fill('input[type="password"]', 'admin123');

  // Click login button
  await page.click('button:has-text("Login"), button:has-text("Sign In")');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  return page;
}

async function loginAsCustomer(page) {
  await page.goto('/');

  // Wait for login form to be visible
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Enter credentials (assuming customer portal uses different credentials)
  await page.fill('input[type="email"]', 'customer@example.com');
  await page.fill('input[type="password"]', 'customer123');

  // Click login button
  await page.click('button:has-text("Login"), button:has-text("Sign In")');

  // Wait for redirect
  await page.waitForURL('**/', { timeout: 10000 });

  return page;
}

async function loginAsFactory(page) {
  await page.goto('/');

  // Wait for login form to be visible
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Enter credentials (assuming factory portal uses different credentials)
  await page.fill('input[type="email"]', 'factory@example.com');
  await page.fill('input[type="password"]', 'factory123');

  // Click login button
  await page.click('button:has-text("Login"), button:has-text("Sign In")');

  // Wait for redirect
  await page.waitForURL('**/', { timeout: 10000 });

  return page;
}

// Fixture for authenticated admin context
const authenticatedAdminTest = test.extend({
  authenticatedPage: async ({ page }, use) => {
    const authenticatedPage = await loginAsAdmin(page);
    await use(authenticatedPage);
  },
});

// Fixture for authenticated customer context
const authenticatedCustomerTest = test.extend({
  authenticatedPage: async ({ page }, use) => {
    const authenticatedPage = await loginAsCustomer(page);
    await use(authenticatedPage);
  },
});

// Fixture for authenticated factory context
const authenticatedFactoryTest = test.extend({
  authenticatedPage: async ({ page }, use) => {
    const authenticatedPage = await loginAsFactory(page);
    await use(authenticatedPage);
  },
});

module.exports = {
  loginAsAdmin,
  loginAsCustomer,
  loginAsFactory,
  authenticatedAdminTest,
  authenticatedCustomerTest,
  authenticatedFactoryTest,
};
