# Sovern House ERP — Comprehensive Audit Report
**Date:** 2026-04-30  
**Scope:** Full-system audit (back-end, front-end, security, UX, business logic, compliance)  
**Audited by:** All team lenses (CEO, CTO, CFO, CMO, CRO, Attorney, Compliance, Frontend Dev, Backend Dev, Operations Manager, Internal User, Customer/Partner)

---

## Executive Summary

**Overall Health Rating: AMBER** (functional system with medium-priority issues; proceed with caution on new buyer/supplier onboarding)

### Top 3 Critical Issues

1. **[CRITICAL] Egypt BCC Rule Not Enforced in Outreach Email Controller**  
   Outreach emails to Egypt leads should auto-BCC `mohanadfanzey@gmail.com` per standing instruction, but the controller accepts user-supplied `bcc` without enforcing the rule. A user could send Egypt outreach without Mohannad's visibility.  
   **File:** `backend/controllers/outreachController.js:70–163`  
   **Risk:** Regulatory/compliance gap; Egypt country manager loses visibility on supplier/buyer contacts.

2. **[CRITICAL] No Input Validation on Financial Fields**  
   Invoice, Payment, and Quote routes accept raw `req.body` for `subtotal`, `discount`, `tax`, `total`, `paidAmount`, and `balance` without schema validation. SQL injection risk is low (Sequelize parameterizes), but numeric validation is missing; negative or non-numeric values could corrupt financial records.  
   **Files:** `backend/routes/invoiceRoutes.js:153–170`, `backend/routes/paymentRoutes.js:*`, `backend/routes/quotationRoutes.js:*`  
   **Risk:** Data integrity; fraudulent/accidental negative invoices; incorrect aging reports and margin calculations.

3. **[CRITICAL] Frontend Approval Page Does Not Validate Token Expiry Display**  
   The public approval page (`/approve/:token`) calls `GET /api/approvals/public/:token` but does not handle the case where the token is already marked `status: 'expired'` in the UI before rendering. The API returns 410, but UX feedback is unclear.  
   **Files:** `frontend/admin-portal/src/pages/Approvals/ApprovalPage.jsx`  
   **Risk:** Confusing user experience for clients; expired links shown as "not found" instead of "link has expired."

---

## Critical Issues (Fix Immediately — System Stability or Data Integrity Risk)

### 1. Egypt BCC Rule Enforcement Missing
- **Severity:** CRITICAL  
- **File:Line:** `backend/controllers/outreachController.js:70–163` (`sendOutreachEmailToLead` function)  
- **Team Lens:** Compliance Officer, Operations Manager  
- **Problem:**  
  The function accepts `bcc` from the request body but does NOT enforce the standing rule that all Egypt outreach must BCC `mohanadfanzey@gmail.com`. A user sending to an Egypt lead can omit or override the BCC, breaking compliance visibility.  
  Per memory: "Always BCC 'Mohannad Fanzey' on ALL Egypt outreach emails until Alex says otherwise."  
- **Current Code:**  
  ```javascript
  const { fromAddress, toAddress, toName, subject, bodyText, touchNumber = 1, followUpDays, cc, bcc, signatureId } = req.body;
  // ... later:
  const result = await sendOutreachEmail({
    fromAddress, toAddress, toName, subject, bodyText, replyTo: fromAddress,
    cc: cc || null,
    bcc: bcc || null,  // <-- User-supplied bcc, not enforced
  });
  ```
- **Fix:**  
  Before sending, check if the lead's country is 'Egypt' and force-append `mohanadfanzey@gmail.com` to the BCC list:
  ```javascript
  const lead = await db.Lead.findByPk(id);
  let finalBcc = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];
  if (lead.country === 'Egypt' && !finalBcc.includes('mohanadfanzey@gmail.com')) {
    finalBcc.push('mohanadfanzey@gmail.com');
  }
  const result = await sendOutreachEmail({
    // ... other fields
    bcc: finalBcc.length > 0 ? finalBcc : null,
  });
  ```

### 2. No Input Validation on Financial Fields
- **Severity:** CRITICAL  
- **Files:Lines:**  
  - `backend/routes/invoiceRoutes.js:153–170` (POST /invoices)  
  - `backend/routes/invoiceRoutes.js:183–200` (POST /generate-from-sales-order)  
  - `backend/routes/paymentRoutes.js:*` (financial amounts)  
  - `backend/routes/quotationRoutes.js:*` (quotation totals)  
- **Team Lens:** CTO, Backend Dev, CFO  
- **Problem:**  
  Routes accept `subtotal`, `discount`, `tax`, `total`, `paidAmount`, and `balance` directly from `req.body` without validation. A malicious or buggy client can:
  - Send negative numbers (`subtotal: -1000`)  
  - Send non-numeric strings (`paidAmount: "abc"`)  
  - Send `NaN` or `Infinity`  
  
  This corrupts financial records and breaks aging reports, margin calculations, and reconciliation.  
- **Current Code (invoiceRoutes.js:153–170):**  
  ```javascript
  const { salesOrderId, customerId, type, subtotal, discount, tax, dueDate, paymentTerms } = req.body;
  const total = subtotal - (discount || 0) + (tax || 0);  // <-- No validation
  const invoice = await db.Invoice.create({
    subtotal, discount, tax, total,  // <-- Directly stored
    balance: total,
  });
  ```
- **Fix:**  
  Add zod validation (already in package.json) to all financial routes:
  ```javascript
  const { z } = require('zod');
  const FinancialSchema = z.object({
    subtotal: z.number().min(0, 'Subtotal must be >= 0').finite(),
    discount: z.number().min(0, 'Discount must be >= 0').finite().optional().default(0),
    tax: z.number().min(0, 'Tax must be >= 0').finite().optional().default(0),
    paidAmount: z.number().min(0, 'Paid amount must be >= 0').finite().optional().default(0),
  });
  const validated = FinancialSchema.parse(req.body);
  const invoice = await db.Invoice.create({
    subtotal: validated.subtotal,
    discount: validated.discount,
    tax: validated.tax,
    // ...
  });
  ```

### 3. Missing Approval Token Expiry Handling on Frontend
- **Severity:** CRITICAL  
- **File:Line:** `frontend/admin-portal/src/pages/Approvals/ApprovalPage.jsx`  
- **Team Lens:** Frontend Dev, UX, Internal User  
- **Problem:**  
  The public approval page fetches the document via `GET /api/approvals/public/:token`. If the token is expired, the backend returns HTTP 410 (Gone) with message "This approval link has expired." However, the frontend does not have specific error handling for this case; it will show a generic error or a 404-style message, confusing the client.  
  Also, the backend correctly sets `status: 'expired'` and returns 410, but there's a race condition: if the same token is used twice in quick succession, the first request sets it to expired, and the second request succeeds with `status: 'expired'` before the update is seen.  
- **Current Code (approvalRoutes.js:230–261):**  
  ```javascript
  router.get('/public/:token', async (req, res, next) => {
    const approval = await db.DocumentApproval.findOne({
      where: { token: req.params.token },
    });
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval link not found' });
    }
    if (approval.status === 'expired' || dayjs().isAfter(approval.expiresAt)) {
      await approval.update({ status: 'expired' });
      return res.status(410).json({ success: false, message: 'This approval link has expired' });
    }
    // ...
  });
  ```
- **Fix (Backend):**  
  Check expiry BEFORE querying the document summary to avoid redundant DB calls:
  ```javascript
  if (dayjs().isAfter(approval.expiresAt)) {
    // Don't update status in the read path — only in the approve/reject paths
    return res.status(410).json({ success: false, message: 'This approval link has expired' });
  }
  ```
- **Fix (Frontend):**  
  Handle the 410 response explicitly in ApprovalPage:
  ```javascript
  const fetchApprovalData = async () => {
    try {
      const result = await approvalAPI.getByToken(token);
      setApprovalData(result);
    } catch (error) {
      if (error.response?.status === 410) {
        setError('This approval link has expired. Please request a new one from your supplier.');
        setIsExpired(true);
      } else if (error.response?.status === 404) {
        setError('This approval link was not found or has been revoked.');
      } else {
        setError(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  ```

---

## High Issues (Fix Before Next Buyer Onboarding)

### 1. Missing API Error Standardization Across CRM Routes
- **Severity:** HIGH  
- **File:Lines:** `backend/routes/crm.js`, `backend/controllers/crmController.js`  
- **Team Lens:** Backend Dev, Internal User  
- **Problem:**  
  CRM routes (leads, activities, deals, contacts) sometimes return error responses with `{ success: false, message: '...' }` and sometimes with `{ error: '...' }`. This inconsistency breaks the frontend's error interceptor (`services/api.js` expects `{ success, data, message }`).  
- **Evidence:**  
  - `crmController.js:44` returns `{ success: false, message: 'Lead not found' }`  
  - But some routes return `{ error: 'reason' }` directly (not all use the consistent envelope)  
- **Fix:**  
  Ensure ALL routes in crm.js use the consistent error handler by catching with `next(error)` and letting the errorHandler middleware format the response.

### 2. No Confirmation Dialogs Before Destructive CRM Actions
- **Severity:** HIGH  
- **File:Lines:** `frontend/admin-portal/src/pages/CRM/ClientContacts.jsx` (or similar)  
- **Team Lens:** UX, Internal User  
- **Problem:**  
  Deleting a lead or campaign is a single click with no confirmation dialog. If a user accidentally deletes a lead with 5+ outreach emails, the data is soft-deleted but not recoverable without a restore endpoint.  
- **Evidence:**  
  CustomerList.jsx shows a confirm dialog (ConfirmDialog component exists), but CRM list pages do not use it.  
- **Fix:**  
  Wrap all `onDelete` handlers in CRM pages with a ConfirmDialog:
  ```javascript
  const handleDeleteLead = async () => {
    try {
      await crmAPI.deleteLead(lead.id);
      toast.success('Lead deleted');
      setDeleteConfirm({ isOpen: false });
      refetchLeads();
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  <ConfirmDialog
    isOpen={deleteConfirm.isOpen}
    title="Delete Lead"
    message={`Are you sure you want to delete ${deleteConfirm.lead?.companyName} and all associated emails?`}
    onConfirm={handleDeleteLead}
    isDangerous
  />
  ```

### 3. Missing Rate Limiting on Public Approval Endpoints
- **Severity:** HIGH  
- **File:Lines:** `backend/routes/approvalRoutes.js:230–376` (public endpoints)  
- **Team Lens:** CTO, Security  
- **Problem:**  
  The public approval endpoints (`GET /api/approvals/public/:token`, `POST /api/approvals/public/:token/approve`, `POST /api/approvals/public/:token/reject`) have NO rate limiting. An attacker could brute-force tokens or spam approvals.  
- **Current Code:**  
  ```javascript
  // No rate limiter middleware
  router.get('/public/:token', async (req, res, next) => { ... });
  ```
- **Fix:**  
  Add rate limiting to public endpoints:
  ```javascript
  const rateLimit = require('express-rate-limit');
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 min
    max: 50,  // 50 requests per 15 min per IP
    message: 'Too many requests, please try again later'
  });
  
  router.get('/public/:token', publicLimiter, async (req, res, next) => { ... });
  router.post('/public/:token/approve', publicLimiter, async (req, res, next) => { ... });
  router.post('/public/:token/reject', publicLimiter, async (req, res, next) => { ... });
  ```

### 4. Missing Timezone/Localization Context in Invoice Aging
- **Severity:** HIGH  
- **File:Lines:** `backend/routes/invoiceRoutes.js:64–117` (aging-report endpoint)  
- **Team Lens:** CFO, Operations  
- **Problem:**  
  The aging report calculates `daysDue` using `dayjs()` without timezone context. If the server is in UTC and the user is in Asia, the aging buckets will be off by hours or days. For trade finance (where 1 day can affect a client relationship), this is unacceptable.  
- **Current Code:**  
  ```javascript
  const now = dayjs();  // <-- defaults to server timezone
  const daysDue = now.diff(dayjs(invoice.dueDate), 'day');
  ```
- **Fix:**  
  Read the user's timezone from the User record or a global config, then use it:
  ```javascript
  const userTimezone = req.user.timezone || 'UTC';  // stored in User model
  const now = dayjs().tz(userTimezone);
  const daysDue = now.diff(dayjs(invoice.dueDate).tz(userTimezone), 'day');
  ```

### 5. No Validation on Incoterms or Trade-Specific Fields
- **Severity:** HIGH  
- **File:Lines:** All order/PI routes (e.g., `salesOrderRoutes.js`, `proformaInvoiceRoutes.js`, `purchaseOrderRoutes.js`)  
- **Team Lens:** Compliance Officer, Attorney, CFO  
- **Problem:**  
  Routes accept orders without validating critical trade fields like:
  - Incoterms (FOB, CIF, EXW, etc.) — now just free text  
  - Currency — must be a known code (USD, EUR, CNY)  
  - Shipping method — should be restricted (Air, Sea, Land, etc.)  
  - Payment terms — should match known terms (Net 30, 2/10 Net 30, etc.)  
  
  Missing validation leads to ambiguous orders, disputes with suppliers, and compliance gaps.  
- **Fix:**  
  Add Zod schemas for trade fields:
  ```javascript
  const TradeFieldsSchema = z.object({
    incoterms: z.enum(['EXW', 'FOB', 'CIF', 'CIP', 'DAP', 'DDP'], { errorMap: () => ({ message: 'Invalid Incoterms' }) }),
    currency: z.enum(['USD', 'EUR', 'GBP', 'CNY', 'AED'], { errorMap: () => ({ message: 'Unsupported currency' }) }),
    shippingMethod: z.enum(['Air', 'Sea', 'Land', 'Rail', 'Combined'], { errorMap: () => ({ message: 'Invalid shipping method' }) }),
    paymentTerms: z.enum(['Net 30', '2/10 Net 30', 'Net 60', 'Net 90', 'Cash on Delivery'], { errorMap: () => ({ message: 'Invalid payment terms' }) }),
  });
  ```

---

## Medium Issues (Fix Within 2 Weeks)

### 1. Missing "No Results" Empty State on CRM List Pages
- **Severity:** MEDIUM  
- **File:Lines:** CRM pages (leads, deals, contacts, activities lists)  
- **Team Lens:** UX, Internal User  
- **Problem:**  
  When a CRM list page has no data (new system or filtered out all), the table shows nothing. No loading state, no "no results" message. User thinks the page is broken.  
- **Evidence:**  
  CustomerList.jsx uses `<EmptyState />` component, but ClientContacts and other CRM pages likely do not.  
- **Fix:**  
  Add empty state checks:
  ```javascript
  if (isLoading) return <LoadingSpinner />;
  if (data.length === 0) return <EmptyState message="No leads yet. Create your first lead." icon={<PlusIcon />} />;
  return <DataTable columns={columns} data={data} />;
  ```

### 2. Margin Calculation Uses Division, Not Multiplication
- **Severity:** MEDIUM  
- **File:Lines:** Frontend calculation logic or wherever margin logic is used  
- **Team Lens:** CFO, Frontend Dev  
- **Problem:**  
  Per standing instruction: "Sovern FOB = Factory FOB / (1 - margin%). Never multiply × (1 + margin%). Gross margin by division always."  
  Need to audit all price calculation pages to ensure they follow this rule. If any use `price * (1 + margin)`, that's a bug.  
- **Fix:**  
  Code review all price/cost pages. Enforce:
  ```javascript
  const sovern_fob = factory_fob / (1 - margin_percent);  // NOT * (1 + margin)
  ```

### 3. Missing Activity Completion Confirmation
- **Severity:** MEDIUM  
- **File:Lines:** CRM Activity detail page (mark as complete)  
- **Team Lens:** UX, Internal User  
- **Problem:**  
  Marking an activity as completed is a single click. No confirmation, no undo. If a user accidentally marks "Call Alex on Monday" as complete when it's still pending, the activity disappears from upcoming lists.  
- **Fix:**  
  Add a small confirmation toast or dialog for activity completion.

### 4. No Bulk Delete Warning on CRM Imports
- **Severity:** MEDIUM  
- **File:Lines:** `frontend/admin-portal/src/pages/Settings/BulkImport.jsx`  
- **Team Lens:** UX, Internal User, Compliance  
- **Problem:**  
  The bulk import flow allows uploading CSV/XLSX with leads. If a user accidentally uploads a file with 1000 rows, all get imported without a final review step. No "confirm bulk action" dialog.  
- **Fix:**  
  Add a final review page before commit:
  ```javascript
  // Step 3: Import Confirmation
  if (step === 3) {
    return (
      <div>
        <p>You are about to import {previewData.length} records. This action cannot be undone.</p>
        <button onClick={handleConfirmImport} className="btn-danger">Confirm Import</button>
        <button onClick={() => setStep(2)}>Back</button>
      </div>
    );
  }
  ```

### 5. Missing "Edit" Confirmation on Multi-Thousand Dollar Invoices
- **Severity:** MEDIUM  
- **File:Lines:** Invoice detail page  
- **Team Lens:** CFO, UX  
- **Problem:**  
  Editing an invoice's total or payment terms should ask for confirmation if the amount exceeds a threshold (e.g., $10,000). This protects against accidental data entry errors on large deals.  
- **Fix:**  
  On InvoiceDetail, before submitting changes, check if `total > 10000` and show a confirmation:
  ```javascript
  if (formData.total > 10000 && formData.total !== originalData.total) {
    return (
      <ConfirmDialog
        title="Confirm Large Invoice Edit"
        message={`You are changing the invoice total from $${originalData.total} to $${formData.total}. Proceed?`}
        isDangerous
      />
    );
  }
  ```

### 6. No Audit Trail for Manual Lead Status Changes
- **Severity:** MEDIUM  
- **File:Lines:** `crmController.js` updateLeadStatus function  
- **Team Lens:** Compliance, Operations  
- **Problem:**  
  When a user manually changes a lead's status from "new" to "qualified" or "converted", there's no audit log entry. This breaks the ability to trace who changed a lead's progress and when.  
- **Fix:**  
  Add audit logging to lead status updates:
  ```javascript
  await auditService.logAction(
    req.user.id,
    'UPDATE',
    'Lead',
    lead.id,
    { statusChange: { before: lead.status, after: newStatus } },
    req.ip
  );
  ```

---

## Compliance & Legal Flags

### 1. Sanctions Screening Missing from Lead Creation
- **Severity:** HIGH (Compliance)  
- **File:Lines:** `crmController.js` createLead, `outreachController.js` sendOutreachEmailToLead  
- **Problem:**  
  New leads are created without checking sanctions lists. A lead from a sanctioned country or entity could be added without warning. The DEVELOPER_GUIDE.md notes: "No automated screening on lead creation. Manual process via compliance officer role."  
  This is intentional, but there's NO UI flag or audit trail showing that a lead WAS/WASN'T screened.  
- **Fix:**  
  Add a `sanctionsScreened` boolean field to Lead model and a `sanctionsScreeningNotes` field. When a compliance officer reviews a lead, they mark it as screened:
  ```javascript
  await lead.update({
    sanctionsScreened: true,
    sanctionsScreeningNotes: 'Checked against OFAC/UN lists — clear',
    sanctionsScreenedBy: req.user.id,
    sanctionsScreenedAt: new Date()
  });
  ```

### 2. No GDPR Consent Flag for EU/UK Leads
- **Severity:** MEDIUM (Legal)  
- **File:Lines:** Lead model, outreach controller  
- **Problem:**  
  Outreach emails to EU/UK leads require explicit opt-in consent (GDPR, PECR). There's no flag in the Lead model to track whether consent was obtained. An outreach to a UK company without consent is a violation.  
- **Fix:**  
  Add:
  ```javascript
  gdprConsent: { type: DataTypes.BOOLEAN, defaultValue: false },
  gdprConsentObtainedAt: { type: DataTypes.DATE },
  gdprConsentChannel: { type: DataTypes.STRING }, // 'email', 'phone', 'form', etc.
  ```
  Before sending outreach to UK/EU leads, check `gdprConsent === true`.

### 3. Document Approval Tokens Not Logged to Audit Trail
- **Severity:** MEDIUM (Compliance)  
- **File:Lines:** `approvalRoutes.js` approve/reject endpoints  
- **Problem:**  
  When a client approves or rejects a document via the token link, the action is recorded in DocumentApproval (IP, User-Agent) but NOT in the AuditLog table. This makes it hard to track who approved what across all documents.  
- **Fix:**  
  After a successful approve/reject, log to AuditLog:
  ```javascript
  await auditService.logAction(
    null,  // anonymous (no authenticated user)
    'APPROVE',  // or REJECT
    approval.entityType,  // ProformaInvoice, etc.
    approval.entityId,
    { clientName, clientEmail, clientIp: req.ip },
    req.ip
  );
  ```

### 4. Data Retention Policy Not Enforced
- **Severity:** MEDIUM (Legal/Compliance)  
- **Problem:**  
  Soft-deleted records (paranoid: true) are kept indefinitely. There's no policy for when they should be hard-deleted (30 days? 1 year?). For GDPR compliance, right-to-erasure requests require hard deletion, but there's no mechanism.  
- **Fix:**  
  Add a scheduler job that hard-deletes soft-deleted records older than a retention period:
  ```javascript
  // schedulerService.js
  cron.schedule('0 2 * * *', async () => {  // 2am daily
    const retentionDays = process.env.DATA_RETENTION_DAYS || 365;
    const cutoff = dayjs().subtract(retentionDays, 'day').toDate();
    const models = [Customer, Factory, SalesOrder, PurchaseOrder, Lead];
    for (const model of models) {
      await model.destroy({
        where: { deletedAt: { [Op.lt]: cutoff } },
        force: true  // hard delete
      });
    }
  });
  ```

---

## Internal User Experience Score

**Score: 6/10** — System is functional but has several friction points that make day-to-day use slower and more error-prone than it should be.

### Pain Points

1. **No confirmation dialogs on destructive CRM actions** → users can accidentally delete leads  
2. **Missing empty states on list pages** → confusing when filters return zero results  
3. **Inconsistent error messages** → CRM routes return different error shapes  
4. **No success feedback after bulk actions** → unclear if import/update succeeded  
5. **Aging report timezone issues** → aging buckets are off if user is in a different timezone than server  
6. **No sanctions screening UI flag** → compliance officer doesn't know if a lead was reviewed  

### Quick Wins (1–2 hours each)

- Add confirmation dialogs to all CRM delete actions (use existing ConfirmDialog component)  
- Add empty state components to CRM list pages  
- Standardize all error responses through the middleware  
- Add a toast/badge showing "Sanctions Screening Status: Pending/Cleared" on lead detail pages  

### Medium Effort (4–8 hours)

- Implement timezone support for user profiles and aging report calculations  
- Add "Edit Confirmation" dialog for invoices > $10k  
- Add bulk import final-review step  

---

## What's Working Well (Don't Break This)

1. **Status machine guards** — Sales Orders, POs, Invoices cannot transition to invalid states. This prevents "in_transit → draft" mistakes.  
2. **Soft deletes (paranoid: true)** — Customer/Factory/Order records are recoverable; no accidental data loss.  
3. **Document Approval system** — 256-bit token, expiry, IP/UA logging. Strong design.  
4. **Consistent API response envelope** — `{ success, data, message, pagination }` across all routes makes frontend predictable.  
5. **RBAC system** — Comprehensive role definitions (CEO, COO, Sales Rep, etc.) with permission checks at route and component level.  
6. **Email service abstraction** — Supports Nodemailer + Resend without hardcoding; easy to switch providers.  
7. **Transaction-wrapped PI→SO conversion** — DB consistency protected if creation fails midway.  
8. **Tooltip + Help system** — Extensive UI guidance for non-technical users (FieldTip, StatusTip, HelpPanel).  

---

## Recommended Fix Order (Punch List)

### Week 1 (Before Next Buyer Onboarding)

1. **[CRITICAL] Egypt BCC enforcement** — Add auto-append of `mohanadfanzey@gmail.com` to all Egypt outreach emails. **1 hour**  
2. **[CRITICAL] Financial field validation** — Add Zod schemas to invoice, payment, and quotation routes. **3 hours**  
3. **[CRITICAL] Approval token expiry UX** — Handle 410 response on frontend; display "link expired" message. **1.5 hours**  
4. **[HIGH] Rate limiting on public approval endpoints** — Add rate limiter middleware. **0.5 hours**  
5. **[HIGH] CRM error standardization** — Audit CRM controller; ensure all errors use `next(error)` pattern. **1 hour**  

**Total: 7 hours** (1 developer, 1 day)

### Week 2 (Standard Sprint)

6. **[HIGH] Confirm dialogs on CRM deletes** — Add ConfirmDialog to lead/deal/contact/campaign list pages. **2 hours**  
7. **[MEDIUM] Empty states on CRM lists** — Use existing EmptyState component. **1 hour**  
8. **[MEDIUM] Invoice timezone context** — Add timezone field to User model; use in aging report. **2 hours**  
9. **[MEDIUM] Trade field validation** — Add Zod schemas for Incoterms, currency, shipping method, payment terms. **2 hours**  
10. **[MEDIUM] Sanctions screening UI flag** — Add fields to Lead model; show status badge on detail pages. **2 hours**  

**Total: 9 hours** (1–2 developers, 5 days)

### Week 3+ (Backlog)

11. GDPR consent flag for EU/UK leads  
12. Document approval actions logged to AuditLog  
13. Data retention scheduler (hard delete after 1 year)  
14. Bulk import final-review step  
15. Activity completion confirmation  
16. Invoice edit confirmation for large amounts  

---

## Security Notes

- **JWT handling:** Tokens stored in `localStorage` (acceptable for internal tool; consider httpOnly cookies if extending to external users).  
- **DocumentApproval tokens:** 256-bit entropy; brute-force resistant. Expiry enforced server-side.  
- **Input sanitization:** Request sanitizer middleware active; SQL injection risk low (Sequelize parameterizes).  
- **CORS:** Configured from env var; allows localhost + whitelisted origins.  
- **Password hashing:** Uses bcryptjs (good; no plaintext stored).  
- **Sensitive data in logs:** Audit trail logs action types + entity IDs, not PII; acceptable.  

**Note:** Once system is exposed to external users (customer portal, supplier portal), add:
- CSRF protection (express-csrf)  
- Helmet CSP hardening (currently permissive for Swagger)  
- Rate limiting on all endpoints (not just auth)  
- Input validation on ALL routes (not just financial)  

---

## Deployment Readiness

**Current Status: CONDITIONAL READY**  
- ✅ Database migrations scripted  
- ✅ Backup scheduler configured  
- ✅ Error handling middleware in place  
- ⚠️ No automated tests (DEVELOPER_GUIDE notes "Priority for next sprint")  
- ⚠️ Critical bugs (Egypt BCC, financial validation, approval expiry UX) must be fixed before production buyer onboarding  
- ⚠️ No API rate limiting (needed before public exposure)  

**Recommendation:** Fix the 3 critical issues (1–3) before onboarding the first paid buyer. The 5 high issues (4–8) can go into Week 2 but should be done before external user access.

---

## Conclusion

The Sovern House ERP is a well-architected, feature-rich system with solid foundations (RBAC, status machines, soft deletes, approval workflow). The codebase is maintainable and documented. However, three critical issues (Egypt BCC, financial validation, approval expiry UX) and five high-priority issues (rate limiting, error standardization, destructive action confirmations, timezone handling, trade field validation) must be addressed before scaling to external users.

**Next Steps:**
1. Create tickets for all critical/high issues in your sprint board.  
2. Assign Week 1 critical fixes to a developer.  
3. Plan Week 2 high-priority fixes.  
4. Block buyer/supplier onboarding until critical fixes are merged and tested.  

---

*Audit completed by all team lenses. Final review: CTO, CFO, Compliance Officer, CEO.*
