const { test, expect } = require('@playwright/test');

test.describe('Shared - Health & API', () => {
  test('Backend health endpoint returns OK', async ({ page }) => {
    // Make a direct request to the health endpoint
    const response = await page.request.get('http://127.0.0.1:5000/health');

    // Check response status
    expect(response.status()).toBe(200);

    // Parse JSON response
    const responseBody = await response.json();

    // Verify status is OK
    expect(responseBody.status).toBe('OK');
  });

  test('API docs page loads', async ({ page }) => {
    // Navigate to API docs
    await page.goto('http://127.0.0.1:5000/api-docs');

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Verify the Swagger UI is loaded
    const swaggerContainer = page.locator('[id*="swagger"], .swagger-ui');

    // Check if page contains expected content
    const pageTitle = page.locator('title');
    const titleText = await pageTitle.textContent();

    // Verify we have API docs content
    expect(titleText).toMatch(/[Ss]wagger|[Aa]pi|[Dd]ocs/);
  });
});
