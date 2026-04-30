# Audit Quick Reference — Critical & High Issues Only

**Full report:** See `AUDIT_REPORT_2026-04-30.md`

---

## 🔴 CRITICAL — Fix Before Next Buyer Onboarding

| # | Issue | File:Line | Fix Time | Action |
|---|-------|----------|----------|--------|
| 1 | Egypt BCC rule not enforced | `backend/controllers/outreachController.js:70–163` | 1h | Add auto-append of `mohanadfanzey@gmail.com` to all Egypt outreach |
| 2 | No validation on financial fields | `backend/routes/invoiceRoutes.js:153–170`, paymentRoutes.js, quotationRoutes.js | 3h | Add Zod validation for subtotal, discount, tax, paidAmount, balance |
| 3 | Approval token expiry UX broken | `frontend/admin-portal/src/pages/Approvals/ApprovalPage.jsx` | 1.5h | Handle 410 response; show "link expired" message |

---

## 🟠 HIGH — Fix Within 1–2 Weeks

| # | Issue | File:Line | Fix Time | Action |
|---|-------|----------|----------|--------|
| 4 | No rate limiting on public approval endpoints | `backend/routes/approvalRoutes.js:230–376` | 0.5h | Add express-rate-limit middleware |
| 5 | CRM error responses inconsistent | `backend/routes/crm.js`, `backend/controllers/crmController.js` | 1h | Audit & ensure all errors use `next(error)` pattern |
| 6 | No confirmation dialogs on destructive CRM actions | CRM list pages (leads, deals, contacts, activities) | 2h | Add ConfirmDialog component to delete handlers |
| 7 | Missing empty states on CRM list pages | Same as above | 1h | Use existing EmptyState component when data.length === 0 |
| 8 | Aging report timezone broken | `backend/routes/invoiceRoutes.js:64–117` | 2h | Use user's timezone (store in User model) instead of server UTC |
| 9 | No validation on trade fields (Incoterms, currency, shipping, payment terms) | Order/PI/PO routes | 2h | Add Zod enum validation for Incoterms, currency, shippingMethod, paymentTerms |

---

## 🟡 MEDIUM — Backlog (Fix Within 2–4 Weeks)

| # | Issue | File:Line | Fix Time | Action |
|---|-------|----------|----------|--------|
| 10 | Margin calculation rule not audited | Pricing pages | 2h | Code review all price calculations; ensure `price / (1 - margin)` not `price * (1 + margin)` |
| 11 | No confirmation on activity completion | CRM Activity detail page | 0.5h | Add toast/dialog for "Mark as Complete" |
| 12 | No bulk import final-review step | `frontend/admin-portal/src/pages/Settings/BulkImport.jsx` | 2h | Add Step 3: Confirmation dialog before commit |
| 13 | No edit confirmation for large invoices | Invoice detail page | 1h | Show confirm dialog if editing invoice > $10k |
| 14 | No audit trail for manual lead status changes | `crmController.js` updateLeadStatus | 0.5h | Call `auditService.logAction()` on status change |
| 15 | No sanctions screening UI flag | Lead model & detail page | 2h | Add `sanctionsScreened`, `sanctionsScreeningNotes` fields; show badge |

---

## Compliance Flags 🚩

- **Sanctions:** No automated screening on lead creation (intentional). Add UI flag so compliance officer knows who reviewed what.  
- **GDPR:** No consent flag for EU/UK leads. Must have explicit opt-in before outreach.  
- **Data retention:** Soft-deleted records kept indefinitely. Need hard-delete policy (e.g., 1 year).  
- **Audit trail:** Document approvals not logged to AuditLog table.  

---

## What's Working Well ✅

- Status machine guards (SalesOrder, PO, Invoice cannot make invalid transitions)  
- Soft deletes (paranoid: true) — recoverable records  
- Document Approval workflow (256-bit token, expiry, IP logging)  
- Consistent API response envelope  
- RBAC system (CEO, COO, Sales Rep, etc. with permission checks)  
- Email service abstraction (Nodemailer + Resend)  
- Transaction-wrapped PI→SO conversion  
- Tooltip + Help system for UX guidance  

---

## Testing Checklist Before Production

- [ ] Egypt outreach emails always have `mohanadfanzey@gmail.com` in BCC  
- [ ] Invoice creation rejects negative/non-numeric values  
- [ ] Approval link 410 response shows "expired" message, not "not found"  
- [ ] Public approval endpoints rate-limited (50 req/15min per IP)  
- [ ] CRM delete actions show confirmation dialog  
- [ ] CRM list pages show "No results" when empty  
- [ ] Aging report uses user's timezone, not server UTC  
- [ ] PI/SO/PO creation rejects invalid Incoterms/currency  
- [ ] All audit logs recorded for lead status changes  

---

## Deploy Gating Criteria

**Do not onboard a paid buyer/supplier until:**
1. ✅ Critical issues 1–3 are merged & tested  
2. ✅ High issues 4–9 are on sprint board or completed  
3. ✅ Automated test suite for critical paths (at minimum)  

---

**Questions?** See the full audit report: `AUDIT_REPORT_2026-04-30.md`
