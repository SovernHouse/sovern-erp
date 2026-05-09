const express = require('express');
const router = express.Router();
const c = require('../controllers/expensesController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Expenses module — admin + super_admin only (bare strings — L-031).
// Mounted in server.js at /api so the resource paths land at:
//   /api/expense-offices/...
//   /api/expense-trips/...
//   /api/expenses/...
//   /api/expense-submissions/...
router.use(requireAuth);
router.use(requireRole('admin', 'super_admin'));

// ── Reimbursement offices ────────────────────────────────────────────────────
router.get   ('/expense-offices',          c.listOffices);
router.post  ('/expense-offices',          c.createOffice);
router.get   ('/expense-offices/:id',      c.getOffice);
router.patch ('/expense-offices/:id',      c.updateOffice);
router.delete('/expense-offices/:id',      c.deleteOffice);

// ── Trips ────────────────────────────────────────────────────────────────────
router.get   ('/expense-trips',            c.listTrips);
router.post  ('/expense-trips',            c.createTrip);
router.get   ('/expense-trips/:id',        c.getTrip);
router.patch ('/expense-trips/:id',        c.updateTrip);
router.delete('/expense-trips/:id',        c.deleteTrip);

// ── Expenses ─────────────────────────────────────────────────────────────────
router.get   ('/expenses',                 c.listExpenses);
router.post  ('/expenses',                 c.createExpense);
router.get   ('/expenses/:id',             c.getExpense);
router.patch ('/expenses/:id',             c.updateExpense);
router.delete('/expenses/:id',             c.deleteExpense);

// ── Submissions ──────────────────────────────────────────────────────────────
router.get   ('/expense-submissions',      c.listSubmissions);
router.post  ('/expense-submissions',      c.createSubmission);
router.get   ('/expense-submissions/:id',  c.getSubmission);
router.patch ('/expense-submissions/:id',  c.updateSubmission);

module.exports = router;
