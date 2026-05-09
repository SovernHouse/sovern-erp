# ERP QA — Backend, API, and Business Logic Quality Assurance

**Version:** 1.0 | **Created:** 2026-04-30
**Adapted from:** vendetta-qa (Vendetta Saloon)
**Depends on:** `erp-debug.md`, `trade-backend.md`, `trade-frontend.md`
**Use for:** Quality assurance of the Trading ERP — API endpoints, CRUD operations, business logic (order lifecycle, pricing, compliance), authentication, role permissions, and pre-ship regression checks. This is NOT the website QA skill (see `trade-qa.md`).

**This role has veto power over untested changes. Nothing ships without a test for its failure modes.**

---

## Why This Role Exists

Every bug in lessons.md was catchable before it hit production:
- `requireRole(['admin'])` silently denying all admin routes — a single auth test would have caught it
- `Activity is not associated to Lead!` breaking the CRM — an integration test on `GET /api/crm/leads/:id` would have caught it
- Double-encoded JSON fields breaking product specs — a model-layer test would have caught it

None of these required a QA specialist. They required someone to ask "what test verifies this is correct?" before shipping.

---

## Test Category Hierarchy

### Category 1 — Critical (No Ship Without These)
Direct impact on data integrity or business operations.

- Authentication and authorization (login, token expiry, requireRole)
- CRUD integrity (create → read → update → delete → confirm deleted)
- Business logic that moves money or creates commitments (order creation, invoice generation, payment recording)
- Lifecycle state transitions (Lead → Customer, Inquiry → Quotation → PI → SO → PO)
- API response shape contracts (fields that the frontend depends on must always be present)

### Category 2 — High (Strong Preference)
Failures break core ERP functionality or data quality.

- Search, filter, and pagination on all major list views
- Association integrity (related records load correctly on detail pages)
- Permission boundaries (manager can't access admin-only routes, factory portal can't access CRM)
- Bulk operations (bulk update status, bulk export)
- Email delivery (outreach emails, RFQ notifications, shipment alerts)

### Category 3 — Standard (Best Effort)
UX quality; doesn't corrupt data.

- Empty state rendering (first time a module is opened, no data yet)
- Loading states and error states
- Form validation (client-side field validation, inline error messages)
- Responsive layout at mobile breakpoints

---

## API Test Templates

### Auth and Role Guard

```javascript
// Test: protected route rejects unauthenticated requests
test('GET /api/crm/leads returns 401 without token', async () => {
  const res = await fetch('http://localhost:5000/api/crm/leads');
  expect(res.status).toBe(401);
});

// Test: requireRole blocks wrong role
test('GET /api/settings/users returns 403 for non-admin', async () => {
  const token = await loginAs('manager'); // helper
  const res = await fetch('http://localhost:5000/api/settings/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.status).toBe(403);
});

// Test: requireRole passes correct role (bare string, NOT array)
test('GET /api/settings/users returns 200 for admin', async () => {
  const token = await loginAs('admin');
  const res = await fetch('http://localhost:5000/api/settings/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.status).toBe(200);
});
```

### CRUD Integrity

```javascript
// Full lifecycle: create → read → update → delete
describe('Lead CRUD', () => {
  let leadId;

  test('POST /api/crm/leads creates a lead', async () => {
    const res = await authedPost('/api/crm/leads', {
      companyName: 'Test Flooring Co', contactName: 'Jane Test',
      email: 'jane@testflooring.com', country: 'US',
      vertical: 'flooring', leadType: 'outbound_prospect'
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    leadId = res.data.id;
  });

  test('GET /api/crm/leads/:id returns the lead with activities', async () => {
    const res = await authedGet(`/api/crm/leads/${leadId}`);
    expect(res.status).toBe(200);
    expect(res.data.companyName).toBe('Test Flooring Co');
    expect(Array.isArray(res.data.activities)).toBe(true); // association must load
  });

  test('PUT /api/crm/leads/:id updates status', async () => {
    const res = await authedPut(`/api/crm/leads/${leadId}`, { status: 'contacted' });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('contacted');
  });

  test('DELETE /api/crm/leads/:id removes the lead', async () => {
    const res = await authedDelete(`/api/crm/leads/${leadId}`);
    expect(res.status).toBe(200);
    const check = await authedGet(`/api/crm/leads/${leadId}`);
    expect(check.status).toBe(404);
  });
});
```

### Business Logic — Order Lifecycle

```javascript
// Test: inquiry → quotation lifecycle
describe('Inquiry to Quotation lifecycle', () => {
  test('creating a quotation from an inquiry links the records', async () => {
    const inquiry = await createTestInquiry();
    const quotation = await authedPost('/api/quotations', {
      inquiryId: inquiry.id, customerId: inquiry.customerId, ...
    });
    expect(quotation.data.inquiryId).toBe(inquiry.id);

    // Confirm inquiry shows linked quotation
    const inquiryDetail = await authedGet(`/api/inquiries/${inquiry.id}`);
    expect(inquiryDetail.data.quotations.length).toBeGreaterThan(0);
  });
});
```

### JSON Field Integrity

```javascript
// Test: JSON fields are NOT double-encoded
test('Lead tags field returns array, not encoded string', async () => {
  const lead = await createTestLead({ tags: ['flooring', 'usa'] });
  const res = await authedGet(`/api/crm/leads/${lead.id}`);
  expect(Array.isArray(res.data.tags)).toBe(true); // not a string
  expect(res.data.tags[0]).toBe('flooring'); // not "[\"flooring\",\"usa\"]"
});
```

### Permission Boundaries (Portal Isolation)

```javascript
// Factory portal cannot access CRM
test('factory portal token cannot read CRM leads', async () => {
  const factoryToken = await loginAsFactory();
  const res = await fetch('/api/crm/leads', {
    headers: { Authorization: `Bearer ${factoryToken}` }
  });
  expect(res.status).toBe(403);
});

// Customer portal cannot see other customers' data
test('customer cannot read another customer orders', async () => {
  const customer1Token = await loginAsCustomer('customer-1');
  const customer2Order = await getCustomer2OrderId();
  const res = await fetch(`/api/orders/${customer2Order}`, {
    headers: { Authorization: `Bearer ${customer1Token}` }
  });
  expect([403, 404]).toContain(res.status); // either is acceptable
});
```

---

## Pre-Ship Regression Checklist

Run this before every git push to main on the ERP.

### Auth layer
- [ ] Login with valid credentials → JWT returned, stored correctly
- [ ] Login with wrong password → 401, no token
- [ ] Protected route without token → 401
- [ ] Protected route with expired token → 401
- [ ] `requireRole('admin')` — admin user passes, non-admin user gets 403
- [ ] `requireRole('manager', 'admin')` — both roles pass, others get 403

### CRM module
- [ ] Create lead → appears in lead list → detail page shows all fields including activities array
- [ ] Add activity to lead → activity visible in lead detail
- [ ] Search leads by company name → correct results
- [ ] Filter leads by status → correct results
- [ ] Pagination on leads list → page 2 returns different records

### Trade lifecycle
- [ ] Create inquiry → quotation → PI → SO → PO chain works without FK errors
- [ ] Status transitions update correctly
- [ ] Associated documents (packingList, shipment) link to correct SO

### Data integrity
- [ ] All JSON fields return arrays/objects, not JSON strings
- [ ] Confidential factory not visible to unauthorized user
- [ ] Audit log records admin actions

### Frontend
- [ ] Dashboard loads without errors on first visit (no undefined errors)
- [ ] Empty state shown when a module has no records
- [ ] Loading spinner/skeleton shown while data fetches
- [ ] Error state shown if API fails (not a blank screen)
- [ ] Mobile layout at 390px — no horizontal overflow

---

## Bug Fix Protocol

When fixing a bug in the ERP:

1. **Reproduce it reliably.** Know the exact steps.
2. **Write a test that fails.** Proves you understand the failure.
3. **Fix the code.** Minimal surgical change.
4. **Run the test — it passes now.**
5. **Run the regression checklist** for the affected module.
6. **Document in lessons.md.** Root cause + fix + preventive rule.
7. **Check for siblings** — same pattern elsewhere in the codebase.

---

## ERP-Specific Test Helpers (Bootstrap)

Create `backend/__tests__/helpers/auth.js`:

```javascript
const jwt = require('jsonwebtoken');
const { User } = require('../../models');

async function loginAs(role) {
  const user = await User.findOne({ where: { role } });
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function authedGet(path, token) {
  return fetch(`http://localhost:5000${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json().then(data => ({ status: r.status, data })));
}

module.exports = { loginAs, authedGet, /* authedPost, authedPut, authedDelete */ };
```

Run tests with: `cd backend && npm test`
