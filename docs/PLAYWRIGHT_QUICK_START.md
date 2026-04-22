# Playwright E2E Testing - Quick Start Guide

## One-Command Test Run

```bash
cd "/sessions/eager-stoic-wozniak/mnt/Trading ERP"
npm run test:e2e
```

That's it! Tests will:
1. Install Playwright (if needed)
2. Start backend + all 3 frontend servers
3. Run 16 tests across all portals
4. Generate HTML report

## View Results

After tests finish:
```bash
npx playwright show-report
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Run all tests (fastest, headless) |
| `npm run test:e2e:headed` | Run with visible browser (for debugging) |
| `npm run test:e2e:ui` | Interactive test explorer |
| `npx playwright test -g "login"` | Run tests containing "login" |
| `npx playwright test --debug` | Debug mode with inspector |
| `npx playwright show-report` | View HTML test report |

## Test Credentials

```
Admin:    admin@floortrading.com / admin123
Customer: customer@example.com / customer123
Factory:  factory@example.com / factory123
```

## What Gets Tested

### Admin Portal (7 tests)
- Login/logout
- Dashboard loads
- Metrics visible
- Navigation works
- Sales orders page navigation
- Sales table loads
- Create form opens

### Customer & Factory Portals (4 tests)
- Login works
- Login fails with bad password

### Backend (2 tests)
- Health endpoint returns OK
- API docs page loads

## Files to Know

| File | Purpose |
|------|---------|
| `/playwright.config.js` | Test configuration & server startup |
| `/e2e/**/*.spec.js` | Actual test files |
| `/e2e/fixtures/auth.js` | Reusable login helpers |
| `/PLAYWRIGHT_SETUP.md` | Detailed setup documentation |
| `/e2e/README.md` | Test documentation |

## If Tests Fail

### Tests timeout waiting for servers
- Increase timeout in `playwright.config.js`: `timeout: 180 * 1000`
- Or make sure you're not running multiple dev environments

### Selectors not found
- Run in debug: `npx playwright test --debug`
- Update selectors in test files if UI changed

### Port already in use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Login always fails
- Check credentials in test files match your actual setup
- Verify UI elements (button text, input types) match test expectations

## Adding Your Own Tests

Create a new test file in appropriate directory:

```javascript
// e2e/admin-portal/my-feature.spec.js
const { test, expect } = require('@playwright/test');

test.describe('My Feature', () => {
  test('does something cool', async ({ page }) => {
    await page.goto('/');
    // Your test here
  });
});
```

Run it:
```bash
npx playwright test e2e/admin-portal/my-feature.spec.js
```

## Tips for Reliable Tests

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** explicitly (don't use sleep)
3. **Test user flows** not implementation details
4. **Keep tests independent** (no shared state between tests)
5. **Use meaningful names** for test readability

## Ports Used

- **5000**: Backend API
- **5173**: Admin Portal
- **3000**: Customer Portal
- **3001**: Factory Portal

Make sure these are available before running tests.

## Integration with CI/CD

For GitHub Actions:

```yaml
- name: Run E2E tests
  run: npm run test:e2e

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Documentation

- **Full Setup Guide**: `/PLAYWRIGHT_SETUP.md`
- **Test Documentation**: `/e2e/README.md`
- **Playwright Docs**: https://playwright.dev

## Status

✅ Ready to use
✅ 16 tests configured
✅ All 3 portals covered
✅ Backend health checks included

---

**Version**: 1.0
**Last Updated**: 2026-03-16
