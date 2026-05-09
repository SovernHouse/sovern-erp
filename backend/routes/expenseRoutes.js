const express = require('express');
const router = express.Router();
const c = require('../controllers/expensesController');
const { requireAuth, requireRole } = require('../middleware/auth');

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

const gate = [requireAuth, requireRole('admin', 'super_admin')];

// ── Reimbursement offices ────────────────────────────────────────────────────
router.get   ('/expense-offices',          ...gate, c.listOffices);
router.post  ('/expense-offices',          ...gate, c.createOffice);
router.get   ('/expense-offices/:id',      ...gate, c.getOffice);
router.patch ('/expense-offices/:id',      ...gate, c.updateOffice);
router.delete('/expense-offices/:id',      ...gate, c.deleteOffice);

// ── Trips ────────────────────────────────────────────────────────────────────
router.get   ('/expense-trips',            ...gate, c.listTrips);
router.post  ('/expense-trips',            ...gate, c.createTrip);
router.get   ('/expense-trips/:id',        ...gate, c.getTrip);
router.patch ('/expense-trips/:id',        ...gate, c.updateTrip);
router.delete('/expense-trips/:id',        ...gate, c.deleteTrip);

// ── Expenses ─────────────────────────────────────────────────────────────────
router.get   ('/expenses',                          ...gate, c.listExpenses);
router.post  ('/expenses',                          ...gate, c.createExpense);
router.post  ('/expenses/extract-from-receipt',     ...gate, c.extractFromReceipt);
router.get   ('/expenses/:id',                      ...gate, c.getExpense);
router.patch ('/expenses/:id',                      ...gate, c.updateExpense);
router.delete('/expenses/:id',                      ...gate, c.deleteExpense);

// ── Submissions ──────────────────────────────────────────────────────────────
router.get   ('/expense-submissions',                       ...gate, c.listSubmissions);
router.post  ('/expense-submissions',                       ...gate, c.createSubmission);
router.get   ('/expense-submissions/:id',                   ...gate, c.getSubmission);
router.patch ('/expense-submissions/:id',                   ...gate, c.updateSubmission);
router.post  ('/expense-submissions/:id/generate-report',   ...gate, c.generateSubmissionReport);

module.exports = router;
