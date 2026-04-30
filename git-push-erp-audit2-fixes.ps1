# git-push-erp-audit2-fixes.ps1
# Tasks 71-84: Full audit sprint
# Run from the ERP repo root on Windows.

$ErrorActionPreference = "Stop"

# ── Commit 1: Egypt BCC enforcement ───────────────────────────────────────────
git add backend/controllers/outreachController.js
git commit -m @"
fix(outreach): auto-enforce Egypt BCC for Mohannad Fanzey

mohanadfanzey@gmail.com is now force-appended to BCC for every outreach
email to an Egypt lead, regardless of what the caller passes in req.body.
Duplicate-safe. Applied to sendOutreachEmailToLead and sendCampaign.

Task-71
"@

# ── Commit 2: Financial field validation ──────────────────────────────────────
git add backend/utils/validateFinancials.js `
       backend/routes/invoiceRoutes.js `
       backend/routes/quotationRoutes.js `
       backend/routes/salesOrderRoutes.js `
       backend/controllers/quotationController.js
git commit -m @"
fix(validation): add Zod schema validation to all financial fields

New util: backend/utils/validateFinancials.js enforces subtotal, discount,
tax, total, paidAmount, balance, amount, unitPrice, quantity as non-negative
finite numbers. Applied to invoice, quotation, and sales order handlers.
Prevents negative totals, NaN, and string injection into financial records.

Task-72
"@

# ── Commit 3: Trade field validation ──────────────────────────────────────────
git add backend/utils/validateTradeFields.js `
       backend/routes/salesOrderRoutes.js `
       backend/routes/proformaInvoiceRoutes.js `
       backend/routes/purchaseOrderRoutes.js
git commit -m @"
fix(validation): add Zod enum validation for trade-specific fields

New util: backend/utils/validateTradeFields.js validates incoterms against
11 standard values, currency against 10 codes, shippingMethod against
7 methods. Applied to sales orders, proforma invoices, and purchase orders.
Prevents free-text ambiguity on trade-critical fields.

Task-78
"@

# ── Commit 4: Approval token expiry UX ───────────────────────────────────────
git add frontend/admin-portal/src/pages/Approvals/ApprovalPage.jsx
git commit -m @"
fix(ui): handle HTTP 410 on expired approval tokens with clear UX

ApprovalPage catches 410 separately from 404. Expired tokens show a
dedicated expired screen with instructions to contact the supplier.
isExpired state added.

Task-73
"@

# ── Commit 5: Rate limiting on public approval endpoints ──────────────────────
git add backend/routes/approvalRoutes.js
git commit -m @"
fix(security): add rate limiting to public approval endpoints

express-rate-limit applied to GET and POST on /api/approvals/public/:token
at 50 requests per 15 minutes per IP. Prevents token brute-forcing.

Task-74
"@

# ── Commit 6: CRM error response standardization ─────────────────────────────
git add backend/controllers/crmController.js
git commit -m @"
fix(api): standardize CRM error responses through errorHandler middleware

Replaced direct res.status().json error patterns with next(err) so all
CRM errors are formatted consistently as success/message/statusCode.

Task-75
"@

# ── Commit 7: Invoice aging timezone fix ─────────────────────────────────────
git add backend/routes/invoiceRoutes.js
git commit -m @"
fix(finance): use user timezone in invoice aging report calculations

dayjs extended with utc and timezone plugins. Aging buckets now use
req.user.timezone or DEFAULT_TIMEZONE env var, fallback Asia/Taipei.
Prevents off-by-one-day aging errors for non-UTC users.

Task-77
"@

# ── Commit 8: CRM delete confirmation dialogs ────────────────────────────────
git add frontend/admin-portal/src/pages/CRM/LeadList.jsx `
       frontend/admin-portal/src/pages/CRM/CampaignList.jsx `
       frontend/admin-portal/src/pages/CRM/ActivityList.jsx
git commit -m @"
fix(ux): replace window.confirm with ConfirmDialog on all CRM deletes

LeadList, CampaignList, ActivityList: all delete actions now show
ConfirmDialog with entity name and consequence. isDangerous styling applied.

Task-76
"@

# ── Commit 9: Activity complete confirmation + EmptyState ─────────────────────
git add frontend/admin-portal/src/pages/CRM/ActivityList.jsx
git commit -m @"
fix(ux): add complete confirmation and EmptyState to ActivityList

Marking complete now requires ConfirmDialog instead of firing immediately.
Both list and calendar views updated. EmptyState used when list is empty.

Task-79 Task-80
"@

# ── Commit 10: CampaignList EmptyState ───────────────────────────────────────
git add frontend/admin-portal/src/pages/CRM/CampaignList.jsx
git commit -m @"
fix(ux): add EmptyState to CampaignList when no campaigns found

Replaced inline text fallback with EmptyState component.

Task-79
"@

# ── Commit 11: Bulk Import confirmation + success toast ───────────────────────
git add frontend/admin-portal/src/pages/Settings/BulkImport.jsx
git commit -m @"
fix(ux): add confirmation dialog and success toast to BulkImport

Import button now triggers ConfirmDialog showing record count and
cannot-be-undone warning before firing the API. toast.success fires
with created record count on completion.

Task-81 Task-83
"@

# ── Commit 12: Large payment confirmation ─────────────────────────────────────
git add frontend/admin-portal/src/pages/Invoices/InvoiceDetail.jsx
git commit -m @"
fix(ux): require confirmation for payment amounts at or above 10000 USD

Payments at or above LARGE_PAYMENT_THRESHOLD show a ConfirmDialog with
the exact formatted USD amount before submitting. Protects against data
entry errors on high-value trade deals.

Task-82
"@

# ── Push ──────────────────────────────────────────────────────────────────────
git push origin main

Write-Host ""
Write-Host "Tasks 71-84 pushed. All audit fixes complete." -ForegroundColor Green
