# Playwright E2E Tests for Trading ERP System

This directory contains end-to-end tests for the Trading ERP system using Playwright.

## Overview

The test suite covers all three portals:
- **Admin Portal** (port 5173)
- **Customer Portal** (port 3000)
- **Factory Portal** (port 3001)
- **Shared tests** (health checks and API validation)

## Directory Structure

```
e2e/
├── admin-portal/
│   ├── auth.spec.js           # Admin authentication tests
│   ├── dashboard.spec.js       # Dashboard functionality tests
│   └── sales-orders.spec.js    # Sales orders management tests
├── customer-portal/
│   └── auth.spec.js            # Customer authentication tests
├── factory-portal/
│   └── auth.spec.js            # Factory user authentication tests
├── shared/
│   └── health.spec.js          # Backend health and API tests
├── fixtures/
│   └── auth.js                 # Reusable authentication helpers
└── README.md                   # This file
```

## Installation

Playwright is installed as a dev dependency in the root package.json. The test runner uses `npx` to avoid npm workspace issues.

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### Headed Mode (visible browser)
```bash
npm run test:e2e:headed
```

### UI Mode (interactive test explorer)
```bash
npm run test:e2e:ui
```

### Specific Portal Tests
```bash
# Admin portal only
npx playwright test e2e/admin-portal

# Customer portal only
npx playwright test e2e/customer-portal

# Factory portal only
npx playwright test e2e/factory-portal

# Specific test file
npx playwright test e2e/admin-portal/auth.spec.js

# Specific test
npx playwright test e2e/admin-portal/auth.spec.js -g "login"
```

### Debug Mode
```bash
npx playwright test --debug
```

## Configuration

The Playwright configuration is defined in `playwright.config.js` at the root:

- **Projects**: Separate projects for each portal with distinct baseURLs
- **Web Servers**: Automatically starts backend and all 3 frontend dev servers
- **Timeout**: 30 seconds per test
- **Retries**: 1 retry on failure (in CI: 2 retries)
- **Reporter**: HTML report (view with `npx playwright show-report`)

## Test Credentials

### Admin Portal
- Email: `admin@floortrading.com`
- Password: `admin123`

### Customer Portal
- Email: `customer@example.com`
- Password: `customer123`

### Factory Portal
- Email: `factory@example.com`
- Password: `factory123`

## Test Descriptions

### Admin Portal Tests

#### auth.spec.js
- Login with valid credentials
- Login fails with wrong password (shows error)
- Login redirects to dashboard
- Logout clears session

#### dashboard.spec.js
- Dashboard loads after login
- Dashboard shows key metrics cards
- Navigation sidebar is visible

#### sales-orders.spec.js
- Navigate to sales orders page
- Sales orders table loads
- Create sales order form opens

### Customer Portal Tests

#### auth.spec.js
- Login with valid credentials
- Login fails with invalid credentials

### Factory Portal Tests

#### auth.spec.js
- Login with valid credentials
- Login fails with invalid credentials

### Shared Tests

#### health.spec.js
- Backend health endpoint returns 200 OK
- API docs page loads and is accessible

## Selectors Strategy

Tests use flexible selectors to accommodate different implementations:

```javascript
// Text-based selectors
page.click('button:has-text("Login")')

// Data attributes (recommended in production)
page.locator('[data-testid="logout-button"]')

// Role-based selectors
page.locator('[role="table"]')

// CSS selectors
page.locator('.sidebar')
```

## Best Practices

1. **Independence**: Each test is independent and can run in any order
2. **Explicit Waits**: Tests wait for elements explicitly, not hardcoded delays
3. **Page Objects**: Complex workflows are extracted to fixtures
4. **Error Handling**: Tests handle common UI variations
5. **Timeouts**: Reasonable timeouts (5-10 seconds) for element visibility

## Troubleshooting

### Tests timeout while waiting for servers
Ensure all dev servers are running:
```bash
npm run dev
```

Or increase timeout in `playwright.config.js`:
```javascript
webServer: [
  {
    command: 'npm run dev:backend',
    timeout: 180 * 1000,  // Increase to 180 seconds
  }
]
```

### Selectors not found
- Use Playwright Inspector: `npx playwright test --debug`
- Check if elements have different classes/ids than expected
- Update selectors in test files to match actual implementation

### Port conflicts
Ensure ports are free:
- 5000: Backend
- 5173: Admin portal
- 3000: Customer portal
- 3001: Factory portal

Modify ports in configuration if needed.

### Tests hang on login
- Verify login credentials are correct in test files
- Check if login form structure changed (button text, input types)
- Increase wait timeout: `await page.waitForSelector(..., { timeout: 15000 })`

## Continuous Integration

Tests run automatically in CI. To run locally with CI settings:

```bash
CI=true npm run test:e2e
```

This disables server reuse and retries tests twice on failure.

## Coverage

Current test coverage focuses on critical user flows:
- User authentication (all portals)
- Admin dashboard and navigation
- Sales order management
- Backend health and API accessibility

Additional tests can be added for:
- Purchase orders
- Inventory management
- Invoicing
- Shipping management
- Advanced search/filtering

## Contributing

When adding new tests:
1. Create descriptive test names
2. Use flexible selectors (data-testid preferred)
3. Add comments for non-obvious waits
4. Test both happy path and error cases
5. Keep tests independent (no shared state)
6. Update this README with new test descriptions

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Inspector & Debugger](https://playwright.dev/docs/inspector)
- [Test Reports](https://playwright.dev/docs/test-reporters)
