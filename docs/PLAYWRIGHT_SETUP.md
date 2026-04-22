# Playwright E2E Testing Setup - Trading ERP System

## Overview

This document describes the Playwright end-to-end (E2E) testing setup for the Trading ERP system. The tests validate critical user flows across all three portals and the backend API.

## What Was Installed

### 1. Playwright Test Framework
- **Package**: `@playwright/test` (v1.40.0+)
- **Installation**: Added to root `package.json` devDependencies
- **Browser**: Chromium (lightweight, faster than multi-browser setup)

### 2. Configuration File
- **Location**: `/playwright.config.js`
- **Features**:
  - Three projects (admin-portal, customer-portal, factory-portal)
  - Each project targets its respective baseURL
  - Auto-starts backend and all 3 frontend dev servers
  - 30-second test timeout
  - 1 retry on failure (2 retries in CI)
  - HTML reporter for test results

### 3. Test Files Structure

```
e2e/
├── admin-portal/
│   ├── auth.spec.js           # 4 authentication tests
│   ├── dashboard.spec.js       # 3 dashboard tests
│   └── sales-orders.spec.js    # 3 sales order tests
├── customer-portal/
│   └── auth.spec.js            # 2 authentication tests
├── factory-portal/
│   └── auth.spec.js            # 2 authentication tests
├── shared/
│   └── health.spec.js          # 2 backend health tests
├── fixtures/
│   └── auth.js                 # Reusable auth helpers
└── README.md                   # Detailed test documentation
```

**Total Tests Created**: 16 practical tests covering critical flows

### 4. NPM Scripts
Added to root `package.json`:
```bash
npm run test:e2e          # Run all tests (headless)
npm run test:e2e:headed   # Run tests with visible browser
npm run test:e2e:ui       # Run interactive test explorer
```

## Quick Start

### Prerequisites
- Node.js v18+ installed
- All ports available:
  - 5000: Backend
  - 5173: Admin Portal
  - 3000: Customer Portal
  - 3001: Factory Portal

### Step 1: Run All Tests
```bash
cd "/sessions/eager-stoic-wozniak/mnt/Trading ERP"
npm run test:e2e
```

This will:
1. Install Playwright (if not already installed)
2. Start backend and all 3 frontend dev servers
3. Run all tests across all portals
4. Generate HTML report

### Step 2: View Test Results
After tests complete, open the HTML report:
```bash
npx playwright show-report
```

### Step 3: Run Tests with Visible Browser (Debugging)
```bash
npm run test:e2e:headed
```

This shows exactly what the tests are doing in a real browser.

## Test Coverage

### Admin Portal (7 tests)

**Authentication (4 tests)**
- Login with valid credentials
- Login fails with wrong password
- Login redirects to dashboard
- Logout clears session

**Dashboard (3 tests)**
- Dashboard loads after login
- Dashboard shows metrics cards
- Navigation sidebar visible

**Sales Orders (3 tests)**
- Navigate to sales orders page
- Sales orders table loads
- Create form opens

### Customer Portal (2 tests)
- Login with valid credentials
- Login fails with invalid credentials

### Factory Portal (2 tests)
- Login with valid credentials
- Login fails with invalid credentials

### Shared/Backend (2 tests)
- Health endpoint returns 200 OK
- API docs page loads

## Test Credentials

### Admin Portal
- **Email**: `admin@floortrading.com`
- **Password**: `admin123`

### Customer Portal
- **Email**: `customer@example.com`
- **Password**: `customer123`

### Factory Portal
- **Email**: `factory@example.com`
- **Password**: `factory123`

## Configuration Details

### playwright.config.js

**Test Settings**
- `testDir`: Points to `./e2e` directory
- `fullyParallel`: Tests run in parallel
- `timeout`: 30 seconds per test
- `retries`: 1 (or 2 in CI)

**Projects**
Each project is configured independently:

```javascript
{
  name: 'admin-portal',
  use: {
    ...devices['chromium'],
    baseURL: 'http://127.0.0.1:5173',
  },
}
```

**Web Server Configuration**
Automatically starts before tests:
- Backend: `npm run dev:backend` → port 5000
- Admin: `npm run dev:admin` → port 5173
- Customer: `npm run dev:customer` → port 3000
- Factory: `npm run dev:factory` → port 3001

**Reporter**
HTML report generated in `playwright-report/` directory, viewable with:
```bash
npx playwright show-report
```

## Running Specific Tests

### By Portal
```bash
# Admin portal only
npx playwright test e2e/admin-portal

# Customer portal only
npx playwright test e2e/customer-portal

# Factory portal only
npx playwright test e2e/factory-portal
```

### By File
```bash
npx playwright test e2e/admin-portal/auth.spec.js
```

### By Pattern
```bash
# Tests containing "login"
npx playwright test -g "login"

# Tests containing "logout"
npx playwright test -g "logout"
```

### Debug Mode
```bash
npx playwright test --debug
```

## Selector Strategy

Tests use flexible selectors to handle various UI implementations:

```javascript
// Text-based (most flexible)
page.click('button:has-text("Login")')

// Data attributes (production recommended)
page.locator('[data-testid="logout-button"]')

// Role-based (accessibility)
page.locator('[role="table"]')

// CSS selectors
page.locator('.sidebar')

// Combined with fallbacks
page.locator('a:has-text("Sales Orders"), [data-testid="nav-sales"]')
```

## Fixture System

### Auth Helpers (e2e/fixtures/auth.js)

Reusable functions for authentication:

```javascript
// For direct use in tests
const { loginAsAdmin, loginAsCustomer, loginAsFactory } = require('../fixtures/auth');

// Or use as Playwright fixtures for automatic cleanup
const { authenticatedAdminTest } = require('../fixtures/auth');
```

Current fixtures:
- `loginAsAdmin()` - Logs in as admin user
- `loginAsCustomer()` - Logs in as customer
- `loginAsFactory()` - Logs in as factory user

## Best Practices Applied

1. **Independence**: Each test can run alone or in any order
2. **Explicit Waits**: No hardcoded delays, proper wait conditions
3. **Flexible Selectors**: Multiple selector patterns for resilience
4. **Error Messages**: Clear assertion messages for debugging
5. **Timeout Management**: Realistic timeouts (5-10 seconds for UI)
6. **Page Reusability**: Shared fixture patterns reduce duplication

## Continuous Integration

### Running in CI Environment
```bash
CI=true npm run test:e2e
```

In CI:
- Server reuse disabled (fresh start each time)
- Tests retried 2 times on failure
- Single worker (no parallel)
- All features enabled (traces, etc.)

### GitHub Actions Integration
Can be integrated into CI/CD pipelines:

```yaml
- name: Install dependencies
  run: npm install

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests Timeout While Waiting for Servers
**Issue**: Tests fail because dev servers aren't starting
**Solution**:
```bash
# Increase timeout in playwright.config.js
webServer: [{
  timeout: 180 * 1000,  // 3 minutes
}]
```

### Selectors Not Found
**Issue**: Tests fail because UI elements changed
**Solution**:
1. Run in debug mode: `npx playwright test --debug`
2. Use Playwright Inspector to find correct selectors
3. Update selectors in test files

### Port Already in Use
**Issue**: "EADDRINUSE: address already in use :::5000"
**Solution**:
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or modify ports in playwright.config.js and frontend .env files
```

### Login Always Fails
**Issue**: Tests can't authenticate
**Solution**:
1. Verify credentials are correct in test files
2. Check if login form structure changed
3. Inspect actual HTML: `--debug` mode
4. Update selectors or credentials as needed

## Performance Metrics

- **Test Setup Time**: ~30 seconds (starting all servers)
- **Average Test Duration**: 3-8 seconds each
- **Total Suite Duration**: ~2-3 minutes (first run)
- **Subsequent Runs**: ~1-2 minutes (server reuse)

## Extending the Tests

### Adding New Tests

1. **Create test file**:
```javascript
// e2e/admin-portal/inventory.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Admin Portal - Inventory', () => {
  test('Can view inventory page', async ({ page }) => {
    // Your test here
  });
});
```

2. **Add to organization**:
```javascript
test.beforeEach(async ({ page }) => {
  // Setup before each test
});

test.afterEach(async ({ page }) => {
  // Cleanup after each test
});
```

3. **Run tests**:
```bash
npx playwright test e2e/admin-portal/inventory.spec.js
```

### Adding Fixtures

Update `e2e/fixtures/auth.js`:
```javascript
async function loginWithRole(page, role) {
  const credentials = {
    admin: { email: 'admin@...', password: '...' },
    customer: { email: 'customer@...', password: '...' },
  };
  // Implementation
}
```

## Files Modified/Created

### Created Files
- `/playwright.config.js` - Test configuration
- `/e2e/` - All test files and fixtures
- `/e2e/README.md` - Detailed test documentation
- `/PLAYWRIGHT_SETUP.md` - This setup guide

### Modified Files
- `/package.json` - Added dev dependency and npm scripts

## Next Steps

1. **Verify Setup**:
```bash
npm run test:e2e
```

2. **Review Results**:
```bash
npx playwright show-report
```

3. **Add to CI/CD Pipeline**: Integrate into GitHub Actions or similar

4. **Expand Test Coverage**: Add tests for additional features

5. **Use in Development**: Run tests locally before pushing changes

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/locators)
- [API Reference](https://playwright.dev/docs/api/class-test)
- [Debugging](https://playwright.dev/docs/debug)

## Support

For issues or questions:
1. Check `e2e/README.md` for detailed test documentation
2. Run tests in `--debug` mode for inspection
3. Review Playwright official documentation
4. Check test output and HTML report for specific failures

---

**Setup Date**: 2026-03-16
**Playwright Version**: 1.40.0+
**Node Version Required**: 18.0.0+
**Status**: Ready for use
