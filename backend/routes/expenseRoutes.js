const express = require('express');
const router = express.Router();
const c = require('../controllers/expensesController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');

// Expenses module — admin + super_admin only (bare strings — L-031).
//
// IMPORTANT: this router is mounted at /api in server.js, NOT at a more
// specific prefix. That means router.use(requireAuth) here would fire on
// EVERY request to /api/* (including /api/health and 404s), breaking the
// unauthenticated health probe. So auth is applied INLINE per route below
// rather than at the router level. Only the paths we explicitly define get
// the auth gate; everything else falls through to the next mounted router.
//
// Mount in server.js:
//   app.use('/api', expenseRoutes);
// Resulting public paths:
//   /api/expense-offices/...
//   /api/expense-trips/...
//   /api/expenses/...
//   /api/expense-submissions/...

// CRITICAL: Super Admin supercedes all other roles and must have access to EVERYTHING.
// authGate: all authenticated users can perform expense operations (user-scoped in controller).
// adminGate: only super_admin can perform (admin configuration, submissions, etc.).
// brandScope (P1 C3b-A) is added to both so every list query auto-filters
// by req.brandScope.where and creates default to req.brandScope.defaultBrand.
const authGate = [requireAuth, brandScope];
const adminGate = [requireAuth, brandScope, requireRole('super_admin')];

// ── Reimbursement offices ────────────────────────────────────────────────────
// Admin-only; employees don't manage office configurations.
router.get   ('/expense-offices',          ...adminGate, c.listOffices);
router.post  ('/expense-offices',          ...adminGate, c.createOffice);
router.get   ('/expense-offices/:id',      ...adminGate, c.getOffice);
router.patch ('/expense-offices/:id',      ...adminGate, c.updateOffice);
router.delete('/expense-offices/:id',      ...adminGate, c.deleteOffice);

// ── Trips ────────────────────────────────────────────────────────────────────
// Admin-only; employees don't manage trips.
router.get   ('/expense-trips',            ...adminGate, c.listTrips);
router.post  ('/expense-trips',            ...adminGate, c.createTrip);
router.get   ('/expense-trips/:id',        ...adminGate, c.getTrip);
router.patch ('/expense-trips/:id',        ...adminGate, c.updateTrip);
router.delete('/expense-trips/:id',        ...adminGate, c.deleteTrip);

// ── Expenses ─────────────────────────────────────────────────────────────────
// Open to all authenticated users. Controller enforces user-scoping (non-admins
// see/edit only their own expenses). Receipt extraction open to all users.
router.get   ('/expenses',                          ...authGate, c.listExpenses);
router.post  ('/expenses',                          ...authGate, c.createExpense);
router.post  ('/expenses/extract-from-receipt',     ...authGate, c.extractFromReceipt);
router.get   ('/expenses/:id',                      ...authGate, c.getExpense);
router.patch ('/expenses/:id',                      ...authGate, c.updateExpense);
router.delete('/expenses/:id',                      ...authGate, c.deleteExpense);

// ── Submissions ──────────────────────────────────────────────────────────────
// Admin-only; only managers/admins create and finalize submission batches.
router.get   ('/expense-submissions',                       ...adminGate, c.listSubmissions);
router.post  ('/expense-submissions',                       ...adminGate, c.createSubmission);
router.get   ('/expense-submissions/:id',                   ...adminGate, c.getSubmission);
router.patch ('/expense-submissions/:id',                   ...adminGate, c.updateSubmission);
router.post  ('/expense-submissions/:id/generate-report',   ...adminGate, c.generateSubmissionReport);

module.exports = router;
