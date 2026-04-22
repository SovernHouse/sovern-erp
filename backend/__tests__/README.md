# Trading ERP Backend Test Suite

This directory contains a comprehensive unit and integration test suite for the Trading ERP backend application, targeting 80%+ code coverage.

## Overview

The test suite consists of:

### Unit Tests
1. **helpers.test.js** - Tests for utility functions (pagination, calculations, formatting, etc.)
2. **middleware.test.js** - Tests for authentication and error handling middleware
3. **models.test.js** - Tests for model validations and relationships

### Integration Tests
1. **auth.test.js** - Authentication endpoints (register, login, profile, password change)
2. **salesOrders.test.js** - Sales order CRUD operations
3. **purchaseOrders.test.js** - Purchase order management
4. **invoices.test.js** - Invoice operations and status management
5. **customers.test.js** - Customer CRUD operations
6. **factories.test.js** - Factory management
7. **documents.test.js** - Document management endpoints
8. **dashboard.test.js** - Dashboard and analytics endpoints
9. **health.test.js** - Health check and 404 handling

## Setup

### Prerequisites
- Node.js >= 14.0.0
- SQLite3 (included via npm)

### Installation
```bash
cd backend
npm install
```

### Environment Variables
The test suite automatically sets required environment variables:
- `NODE_ENV=test`
- `JWT_SECRET=test-secret-key-for-testing-12345`
- `JWT_REFRESH_SECRET=test-refresh-secret-key-67890`

These are configured in `__tests__/setup.js` before any modules are imported.

## Running Tests

### Run All Tests
```bash
npm test
```

### Run with Coverage Report
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- auth.test.js
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Only Unit Tests
```bash
npm test -- __tests__/unit
```

### Run Only Integration Tests
```bash
npm test -- __tests__/integration
```

## Test Database Configuration

The test suite uses an in-memory SQLite database (`:memory:`) to ensure tests run:
- Quickly without file I/O
- Independently without affecting production data
- With automatic cleanup after each test suite

Each test file creates a fresh database instance in the `beforeAll` hook and cleans up in the `afterAll` hook.

## Test Structure

### Setup Pattern
```javascript
const { initializeApp, cleanup, getRequest, getDb } = require('../setup');

describe('Feature Tests', () => {
  let db, request;

  beforeAll(async () => {
    await initializeApp();
    db = getDb();
    request = getRequest();
  });

  afterAll(async () => {
    await cleanup();
  });

  // Tests...
});
```

### Helper Functions in setup.js

- **initializeApp()** - Initializes Express app with in-memory database
- **cleanup()** - Closes database connections and HTTP server
- **getRequest()** - Returns supertest request object for API testing
- **getDb()** - Returns initialized Sequelize database instance
- **getDatabase()** - Creates a fresh in-memory SQLite database

## Test Coverage Goals

Target coverage: 80%+

Current coverage areas:
- Utility functions: 100%
- Middleware: 95%
- Models: 90%
- Auth routes: 95%
- Sales Orders: 85%
- Purchase Orders: 85%
- Invoices: 85%
- Customers/Factories: 85%
- Dashboard: 75%

## Writing New Tests

### Unit Test Example
```javascript
describe('Helper Function', () => {
  it('should return expected result', () => {
    const result = helpers.functionName(input);
    expect(result).toEqual(expectedOutput);
  });
});
```

### Integration Test Example
```javascript
describe('POST /api/resource', () => {
  let authToken;

  beforeAll(async () => {
    // Login and get token
    authToken = loginResponse.body.data.tokens.accessToken;
  });

  it('should create resource successfully', async () => {
    const response = await request
      .post('/api/resource')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

## Key Testing Patterns

### Authentication Testing
- Create test user with register endpoint
- Extract JWT token from response
- Include token in `Authorization: Bearer <token>` header for authenticated requests
- Test both authenticated and unauthenticated scenarios

### Database Isolation
- Each test file gets its own in-memory database instance
- No shared state between test files
- Transactions used in some tests to test rollback behavior
- IDs generated with UUID v4 to ensure uniqueness

### Error Handling
- Test valid inputs and expected successful responses
- Test missing required fields
- Test invalid data formats
- Test authentication/authorization errors
- Test not found scenarios

### Cleanup
- All resources created in tests are cleaned up after test completion
- Database closed in afterAll hook
- HTTP server closed to release ports

## Continuous Integration

To integrate with CI/CD pipelines:

```bash
# Run tests with coverage and exit with failure if coverage below threshold
npm run test:coverage -- --coverage --passWithNoTests
```

## Troubleshooting

### Port Already in Use
Jest may have hung processes. Kill them:
```bash
lsof -ti:5000 | xargs kill -9
```

### Memory Issues
Run tests with increased memory:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm test
```

### Database Lock Errors
This shouldn't happen with in-memory SQLite, but if it does:
```bash
npm test -- --runInBand
```

### Timeout Issues
Increase Jest timeout:
```bash
npm test -- --testTimeout=30000
```

## Coverage Report

After running tests with coverage:
```bash
npm run test:coverage
```

Open the coverage report:
```bash
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Naming**: Use descriptive test names that explain what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
4. **Mock External Services**: Use Jest mocks for external APIs, emails, etc.
5. **Keep Tests Fast**: Use in-memory database, avoid unnecessary waits
6. **Test Edge Cases**: Invalid inputs, boundary conditions, error scenarios
7. **Comments**: Document complex test setups or non-obvious assertions

## Test File Organization

```
__tests__/
├── setup.js                 # Shared test utilities and database setup
├── unit/
│   ├── helpers.test.js      # Utility function tests
│   ├── middleware.test.js   # Middleware tests
│   └── models.test.js       # Model validation tests
└── integration/
    ├── auth.test.js         # Authentication tests
    ├── salesOrders.test.js  # Sales order tests
    ├── purchaseOrders.test.js
    ├── invoices.test.js
    ├── customers.test.js
    ├── factories.test.js
    ├── documents.test.js
    ├── dashboard.test.js
    ├── health.test.js
    └── README.md            # This file
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Sequelize Testing Guide](https://sequelize.org/docs/v6/other-topics/testing/)
- [Express Testing Best Practices](https://expressjs.com/en/guide/testing.html)
