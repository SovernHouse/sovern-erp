# Audit Fix Checklist — Detailed Steps for Each Issue

Use this checklist to track progress on audit fixes. Reference the full audit report for context.

---

## CRITICAL Issues

### Issue 1: Egypt BCC Rule Not Enforced
**File:** `backend/controllers/outreachController.js`  
**Function:** `sendOutreachEmailToLead` (lines 70–163)  
**Effort:** 1 hour

**Steps:**
- [ ] Read the full outreachController to understand the current flow
- [ ] Add a query to fetch the lead's country: `const lead = await db.Lead.findByPk(id);`
- [ ] Modify the email sending block (around line 105–116) to check if country === 'Egypt'
- [ ] If Egypt, ensure `mohanadfanzey@gmail.com` is in the BCC array
  ```javascript
  let finalBcc = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];
  if (lead.country === 'Egypt' && !finalBcc.includes('mohanadfanzey@gmail.com')) {
    finalBcc.push('mohanadfanzey@gmail.com');
  }
  ```
- [ ] Pass `bcc: finalBcc.length > 0 ? finalBcc : null` to sendOutreachEmail
- [ ] Test: Send outreach to a lead with country='Egypt' and verify Mohannad receives BCC
- [ ] Test: Send outreach to a non-Egypt lead and verify no forced BCC
- [ ] Commit with message: "CRITICAL: Enforce Egypt BCC rule in outreach emails"

---

### Issue 2: No Input Validation on Financial Fields
**Files:**
- `backend/routes/invoiceRoutes.js` (lines 153–170, 183–200)
- `backend/routes/paymentRoutes.js` (payment creation endpoints)
- `backend/routes/quotationRoutes.js` (quotation creation endpoints)

**Effort:** 3 hours

**Steps:**

#### Part A: Create Zod schemas
- [ ] At the top of `invoiceRoutes.js`, add:
  ```javascript
  const { z } = require('zod');
  
  const FinancialInputSchema = z.object({
    subtotal: z.number({ coerce: true })
      .min(0, 'Subtotal must be >= 0')
      .finite({ message: 'Subtotal must be a finite number' }),
    discount: z.number({ coerce: true })
      .min(0, 'Discount must be >= 0')
      .finite()
      .default(0),
    tax: z.number({ coerce: true })
      .min(0, 'Tax must be >= 0')
      .finite()
      .default(0),
    paidAmount: z.number({ coerce: true })
      .min(0, 'Paid amount must be >= 0')
      .finite()
      .default(0),
    balance: z.number({ coerce: true })
      .min(0, 'Balance must be >= 0')
      .finite()
      .default(0),
  });
  ```

#### Part B: Update invoice creation routes
- [ ] In `POST /` (line 151–179):
  ```javascript
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      // Validate input
      const { salesOrderId, customerId, type, subtotal, discount, tax, dueDate, paymentTerms } = req.body;
      const validated = FinancialInputSchema.parse({
        subtotal, discount, tax
      });
      
      const total = validated.subtotal - validated.discount + validated.tax;
      
      const invoice = await db.Invoice.create({
        // ... use validated fields ...
      });
    } catch (error) {
      next(error);
    }
  });
  ```
- [ ] Do the same for `POST /generate-from-sales-order`

#### Part C: Update payment routes
- [ ] Create a PaymentInputSchema in `paymentRoutes.js`:
  ```javascript
  const PaymentInputSchema = z.object({
    amount: z.number({ coerce: true })
      .positive('Payment amount must be > 0')
      .finite(),
    method: z.enum(['wire_transfer', 'credit_card', 'check', 'cash', 'other']),
  });
  ```
- [ ] Apply to all payment creation/update endpoints
- [ ] Test: Try creating an invoice with negative subtotal → should be rejected with 400
- [ ] Test: Try creating an invoice with `subtotal: "abc"` → should be coerced to number or rejected
- [ ] Test: Try creating an invoice with `Infinity` → should be rejected
- [ ] Commit: "CRITICAL: Add financial field validation to invoice and payment routes"

---

### Issue 3: Approval Token Expiry UX Broken
**Files:**
- `backend/routes/approvalRoutes.js` (GET /public/:token, lines 230–261)
- `frontend/admin-portal/src/pages/Approvals/ApprovalPage.jsx`

**Effort:** 1.5 hours

**Steps:**

#### Part A: Backend — simplify expiry check
- [ ] In `approvalRoutes.js`, modify the `GET /public/:token` endpoint:
  ```javascript
  router.get('/public/:token', async (req, res, next) => {
    try {
      const approval = await db.DocumentApproval.findOne({
        where: { token: req.params.token },
      });
      if (!approval) {
        return res.status(404).json({ success: false, message: 'Approval link not found' });
      }
      
      // Check expiry FIRST, before querying document
      if (dayjs().isAfter(approval.expiresAt)) {
        // Don't update status here — only in approve/reject paths
        return res.status(410).json({ success: false, message: 'This approval link has expired' });
      }
      
      // ... rest of the function ...
    } catch (error) {
      next(error);
    }
  });
  ```

#### Part B: Frontend — handle 410 response
- [ ] In `ApprovalPage.jsx`, find the `fetchApprovalData` or similar function
- [ ] Wrap it with try/catch and handle status codes:
  ```javascript
  const fetchApprovalData = async () => {
    setIsLoading(true);
    try {
      const result = await approvalAPI.getByToken(token);
      setApprovalData(result);
      setError(null);
    } catch (error) {
      if (error.response?.status === 410) {
        setError('This approval link has expired. Please request a new one from your supplier.');
        setIsExpired(true);
      } else if (error.response?.status === 404) {
        setError('This approval link was not found or has been revoked.');
      } else {
        setError(error.message || 'Failed to load approval');
      }
    } finally {
      setIsLoading(false);
    }
  };
  ```
- [ ] Add conditional rendering for expired state:
  ```javascript
  if (isExpired) {
    return <ExpiredApprovalPage message={error} />;
  }
  ```
- [ ] Test: Create an approval link, wait until it expires, then visit the link → should see "expired" message
- [ ] Test: Visit a non-existent token → should see "not found"
- [ ] Commit: "CRITICAL: Fix approval token expiry handling on frontend and backend"

---

## HIGH Issues

### Issue 4: No Rate Limiting on Public Approval Endpoints
**File:** `backend/routes/approvalRoutes.js`  
**Effort:** 0.5 hours

**Steps:**
- [ ] At the top of `approvalRoutes.js`, add:
  ```javascript
  const rateLimit = require('express-rate-limit');
  
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 50,  // 50 requests per 15 minutes
    message: 'Too many requests to this approval link. Please try again later.',
    skip: (req, res) => req.user,  // Skip rate limit for authenticated users
  });
  ```
- [ ] Apply the limiter to public endpoints:
  ```javascript
  router.get('/public/:token', publicLimiter, async (req, res, next) => { ... });
  router.post('/public/:token/approve', publicLimiter, async (req, res, next) => { ... });
  router.post('/public/:token/reject', publicLimiter, async (req, res, next) => { ... });
  ```
- [ ] Test: Send 51 requests in 15 minutes → 51st should be rejected
- [ ] Commit: "HIGH: Add rate limiting to public approval endpoints"

---

### Issue 5: CRM Error Responses Inconsistent
**Files:** `backend/routes/crm.js`, `backend/controllers/crmController.js`  
**Effort:** 1 hour

**Steps:**
- [ ] Read through `crmController.js` and note all error return patterns
- [ ] Look for `res.status(...).json({ error: ... })` patterns
- [ ] Replace them with:
  ```javascript
  // Instead of:
  // return res.status(404).json({ error: 'Lead not found' });
  
  // Use:
  throw new NotFoundError('Lead not found');  // caught by middleware
  ```
- [ ] Ensure ALL error paths use `next(error)` so the errorHandler middleware can standardize them
- [ ] Test: Call a CRM endpoint with invalid input → should get consistent `{ success: false, message: '...' }` shape
- [ ] Commit: "HIGH: Standardize CRM error responses via error handler middleware"

---

### Issue 6: No Confirmation Dialogs on Destructive CRM Actions
**Files:** CRM list pages (leads, deals, contacts, activities)  
**Effort:** 2 hours

**Steps:**
- [ ] Find the main CRM list page files (e.g., `pages/CRM/LeadsList.jsx` or similar)
- [ ] Look for `onDelete` handlers in DataTable or similar
- [ ] Copy the pattern from `pages/Customers/CustomerList.jsx` (lines 19, 42–52, 116–124)
- [ ] Add state for delete confirmation:
  ```javascript
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null });
  ```
- [ ] Create a delete handler that opens the dialog:
  ```javascript
  const handleDeleteClick = (item) => {
    setDeleteConfirm({ isOpen: true, item });
  };
  ```
- [ ] Implement the actual delete in a separate function:
  ```javascript
  const handleConfirmDelete = async () => {
    try {
      await crmAPI.deleteLead(deleteConfirm.item.id);
      toast.success('Lead deleted');
      setDeleteConfirm({ isOpen: false, item: null });
      // Refresh the list
      fetchLeads();
    } catch (error) {
      toast.error(error.message);
    }
  };
  ```
- [ ] Add the ConfirmDialog component at the bottom:
  ```jsx
  <ConfirmDialog
    isOpen={deleteConfirm.isOpen}
    title="Delete Lead"
    message={`Are you sure you want to delete ${deleteConfirm.item?.companyName} and all associated emails?`}
    onConfirm={handleConfirmDelete}
    onClose={() => setDeleteConfirm({ isOpen: false, item: null })}
    isDangerous
  />
  ```
- [ ] Repeat for: campaigns, contacts, activities, deals
- [ ] Test: Click delete on a lead → should see confirmation dialog
- [ ] Commit: "HIGH: Add confirmation dialogs to CRM destructive actions"

---

### Issue 7: Missing Empty States on CRM List Pages
**Files:** Same CRM list pages as Issue 6  
**Effort:** 1 hour

**Steps:**
- [ ] In each CRM list page, after the data fetch and loading check, add:
  ```javascript
  if (isLoading) return <LoadingSpinner />;
  if (!data || data.length === 0) {
    return <EmptyState 
      message="No leads yet. Create your first lead to get started." 
      icon={<PlusIcon />}
    />;
  }
  ```
- [ ] Import EmptyState from components:
  ```javascript
  import EmptyState from '../../components/EmptyState';
  ```
- [ ] Test: On a fresh system with no leads → should see "No leads yet" message
- [ ] Commit: "HIGH: Add empty states to CRM list pages"

---

### Issue 8: Aging Report Timezone Broken
**File:** `backend/routes/invoiceRoutes.js` (GET /aging-report, lines 64–117)  
**Effort:** 2 hours

**Steps:**

#### Part A: Add timezone to User model
- [ ] In `backend/models/User.js`, add:
  ```javascript
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC',
    enum: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Singapore', 'Asia/Hong_Kong', 'Australia/Sydney'],
  }
  ```
- [ ] Run a migration to add the column to existing users

#### Part B: Update aging report
- [ ] In `invoiceRoutes.js`, modify the GET /aging-report endpoint:
  ```javascript
  router.get('/aging-report', requireAuth, async (req, res, next) => {
    try {
      // Get user's timezone
      const user = await db.User.findByPk(req.user.id);
      const userTimezone = user.timezone || 'UTC';
      
      const invoices = await db.Invoice.findAll({
        where: { /* ... */ },
        include: [ /* ... */ ]
      });
      
      const now = dayjs().tz(userTimezone);
      const agingReport = { /* ... */ };
      
      invoices.forEach(invoice => {
        const daysDue = now.diff(dayjs(invoice.dueDate).tz(userTimezone), 'day');
        // ... rest of logic ...
      });
    } catch (error) {
      next(error);
    }
  });
  ```
- [ ] Test: Create a user with timezone 'America/New_York', create an invoice with dueDate in 10 days, and verify it buckets correctly
- [ ] Commit: "HIGH: Add timezone support to User model and aging report calculation"

---

### Issue 9: No Validation on Trade-Specific Fields
**Files:** `backend/routes/salesOrderRoutes.js`, `backend/routes/proformaInvoiceRoutes.js`, `backend/routes/purchaseOrderRoutes.js`, `backend/routes/quotationRoutes.js`  
**Effort:** 2 hours

**Steps:**
- [ ] Create a shared Zod schema file: `backend/utils/tradeValidation.js`:
  ```javascript
  const { z } = require('zod');
  
  const TradeFieldsSchema = z.object({
    incoterms: z.enum(
      ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
      { errorMap: () => ({ message: 'Invalid Incoterms. Must be one of: EXW, FOB, CIF, DAP, DDP, etc.' }) }
    ),
    currency: z.enum(
      ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AED', 'SGD', 'HKD', 'AUD'],
      { errorMap: () => ({ message: 'Unsupported currency. Use: USD, EUR, GBP, CNY, AED, SGD, HKD, AUD' }) }
    ),
    shippingMethod: z.enum(
      ['Air', 'Sea', 'Land', 'Rail', 'Combined'],
      { errorMap: () => ({ message: 'Invalid shipping method. Use: Air, Sea, Land, Rail, Combined' }) }
    ).optional(),
    paymentTerms: z.enum(
      ['Net 30', 'Net 60', 'Net 90', '2/10 Net 30', '1/10 Net 30', 'Cash on Delivery', 'Prepayment'],
      { errorMap: () => ({ message: 'Invalid payment terms.' }) }
    ).optional(),
  });
  
  module.exports = { TradeFieldsSchema };
  ```
- [ ] Import and use in salesOrderRoutes:
  ```javascript
  const { TradeFieldsSchema } = require('../utils/tradeValidation');
  
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const validated = TradeFieldsSchema.parse({
        incoterms: req.body.incoterms,
        currency: req.body.currency,
        shippingMethod: req.body.shippingMethod,
        paymentTerms: req.body.paymentTerms,
      });
      
      const so = await db.SalesOrder.create({
        // ... other fields ...
        incoterms: validated.incoterms,
        currency: validated.currency,
        shippingMethod: validated.shippingMethod,
        paymentTerms: validated.paymentTerms,
      });
    } catch (error) {
      next(error);
    }
  });
  ```
- [ ] Do the same for PI, PO, and quotation routes
- [ ] Test: Create a SO with `incoterms: 'INVALID'` → should be rejected with 400
- [ ] Test: Create a SO with `currency: 'BTC'` → should be rejected
- [ ] Commit: "HIGH: Add trade field validation (Incoterms, currency, shipping, payment terms)"

---

## MEDIUM Issues (Lower Priority)

### Issue 10: Margin Calculation Audit
**Effort:** 2 hours

**Steps:**
- [ ] Search for all occurrences of margin, markup, or price calculation:
  ```bash
  grep -rn "margin\|markup\|price.*\*\|price.*/" frontend/admin-portal/src --include="*.jsx"
  ```
- [ ] For each pricing page, verify the formula is: `sovern_price = factory_price / (1 - margin_percent)`
- [ ] NOT: `sovern_price = factory_price * (1 + margin_percent)`
- [ ] Document findings in a comment block if formula is correct
- [ ] Commit: "MEDIUM: Code review and audit margin calculation across pricing pages"

---

### Issue 11: Activity Completion Confirmation
**File:** CRM Activity detail page  
**Effort:** 0.5 hours

**Steps:**
- [ ] Find the activity completion button (usually "Mark as Complete")
- [ ] Wrap the click handler with a confirmation toast or simple dialog:
  ```javascript
  const handleCompleteActivity = async () => {
    toast.success('Activity marked as complete!');
    await crmAPI.completeActivity(activity.id);
    refetchActivity();
  };
  ```
- [ ] Or use a toast.promise for async operation:
  ```javascript
  toast.promise(
    crmAPI.completeActivity(activity.id),
    {
      loading: 'Marking as complete...',
      success: 'Activity completed!',
      error: 'Failed to complete activity',
    }
  );
  ```
- [ ] Commit: "MEDIUM: Add confirmation feedback for activity completion"

---

### Issue 12: Bulk Import Final-Review Step
**File:** `frontend/admin-portal/src/pages/Settings/BulkImport.jsx`  
**Effort:** 2 hours

**Steps:**
- [ ] Review the current BulkImport wizard (likely 2 steps: upload + preview + map)
- [ ] Add a Step 3: Confirmation
- [ ] Display: "You are about to import X records. This action cannot be undone."
- [ ] Show buttons: "Confirm Import" and "Back"
- [ ] On confirm, call the import API and show progress
- [ ] Commit: "MEDIUM: Add final review step to bulk import wizard"

---

### Issue 13: Invoice Edit Confirmation
**File:** Invoice detail page  
**Effort:** 1 hour

**Steps:**
- [ ] In the invoice edit form, detect changes:
  ```javascript
  const hasLargeChange = formData.total > 10000 && formData.total !== originalInvoice.total;
  ```
- [ ] If true, show a confirmation dialog before submit:
  ```javascript
  if (hasLargeChange) {
    return <ConfirmDialog
      title="Confirm Large Invoice Edit"
      message={`You are changing the invoice total from $${originalInvoice.total.toLocaleString()} to $${formData.total.toLocaleString()}. Proceed?`}
      isDangerous
      onConfirm={() => submitForm()}
    />;
  }
  ```
- [ ] Commit: "MEDIUM: Add edit confirmation for large invoices"

---

### Issue 14: Audit Trail for Lead Status Changes
**File:** `backend/controllers/crmController.js` updateLeadStatus function  
**Effort:** 0.5 hours

**Steps:**
- [ ] Find the updateLeadStatus function
- [ ] After updating the lead, add an audit log:
  ```javascript
  const lead = await db.Lead.findByPk(id);
  const oldStatus = lead.status;
  await lead.update({ status: newStatus });
  
  // Log the change
  await auditService.logAction(
    req.user.id,
    'UPDATE',
    'Lead',
    id,
    { statusChange: { before: oldStatus, after: newStatus } },
    req.ip
  );
  ```
- [ ] Test: Change a lead status and verify an entry appears in the audit log
- [ ] Commit: "MEDIUM: Log lead status changes to audit trail"

---

### Issue 15: Sanctions Screening UI Flag
**Files:** `backend/models/Lead.js`, Lead detail page  
**Effort:** 2 hours

**Steps:**

#### Part A: Update Lead model
- [ ] Add fields to `backend/models/Lead.js`:
  ```javascript
  sanctionsScreened: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sanctionsScreeningNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sanctionsScreenedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sanctionsScreenedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'User', key: 'id' },
  },
  ```

#### Part B: Add route to update screening status
- [ ] In `crmController.js`, add:
  ```javascript
  const updateLeadSanctionsStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { sanctionsScreened, sanctionsScreeningNotes } = req.body;
      
      const lead = await db.Lead.findByPk(id);
      await lead.update({
        sanctionsScreened,
        sanctionsScreeningNotes,
        sanctionsScreenedAt: sanctionsScreened ? new Date() : null,
        sanctionsScreenedBy: sanctionsScreened ? req.user.id : null,
      });
      
      res.json(getSuccessResponse(lead));
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  ```

#### Part C: Add to routes
- [ ] In `crm.js`:
  ```javascript
  router.patch('/leads/:id/sanctions-screening', crmController.updateLeadSanctionsStatus);
  ```

#### Part D: Update frontend
- [ ] On Lead detail page, add a badge showing screening status:
  ```jsx
  <div className="flex items-center gap-2">
    {lead.sanctionsScreened ? (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
        <CheckIcon className="w-4 h-4" />
        Sanctions Cleared
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
        <AlertIcon className="w-4 h-4" />
        Pending Screening
      </span>
    )}
  </div>
  ```
- [ ] Add a form field to mark as screened (compliance officer only)
- [ ] Test: Create a lead → should show "Pending Screening" badge
- [ ] Test: Compliance officer marks as screened → badge changes to "Sanctions Cleared"
- [ ] Commit: "MEDIUM: Add sanctions screening status tracking to Lead model"

---

## Testing Checklist

After implementing each fix, verify:

- [ ] **Issue 1:** Send outreach to Egypt lead (country='Egypt') → Mohannad BCC'd automatically
- [ ] **Issue 2:** Try creating invoice with `subtotal: -100` → rejected with 400
- [ ] **Issue 3:** Visit expired approval link → shows "link expired" message, not "not found"
- [ ] **Issue 4:** Send 51 requests to public approval endpoint in 15min → 51st returns 429
- [ ] **Issue 5:** Call CRM endpoint with bad input → consistent `{ success: false, message }` response
- [ ] **Issue 6:** Click delete on CRM item → confirmation dialog appears
- [ ] **Issue 7:** Fresh system with no CRM items → "No items yet" message shows
- [ ] **Issue 8:** Create invoice with dueDate in 10 days, user in EST → buckets correctly in aging report
- [ ] **Issue 9:** Create SO with `incoterms: 'INVALID'` → rejected with 400
- [ ] **Issue 10:** Code review margin calculation → formula is `price / (1 - margin)`, not `* (1 + margin)`
- [ ] **Issue 11:** Click "Mark Activity Complete" → shows success feedback
- [ ] **Issue 12:** Bulk import > 100 records → final review step shows record count
- [ ] **Issue 13:** Edit invoice > $10k → confirmation dialog appears
- [ ] **Issue 14:** Change lead status → audit log entry created
- [ ] **Issue 15:** Create lead → shows "Pending Screening" badge; compliance officer marks as screened → badge changes

---

## Commit Messages Template

```
[SEVERITY] [ISSUE_NUMBER]: Short description

- What was changed
- Why it was changed
- How to test

Fixes audit issue #N.
File: backend/path/to/file.js
```

Example:
```
CRITICAL [Issue-1]: Enforce Egypt BCC rule in outreach emails

- Added check for lead.country === 'Egypt'
- Auto-appends mohanadfanzey@gmail.com to BCC if not already present
- Prevents accidental omission of Egypt country manager from outreach

To test: Send outreach to a lead with country='Egypt' and verify Mohannad receives BCC.

Fixes audit issue #1.
File: backend/controllers/outreachController.js
```

---

**Total estimated effort: 18 hours (critical + high + medium)**  
**Recommended allocation: 1 developer, 3 sprints (1 sprint per week)**

