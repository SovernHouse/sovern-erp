# git-push-erp-audit.ps1
# Run from the ERP repo root in PowerShell:
#   .\git-push-erp-audit.ps1
#
# COMMIT 1 — Foundation fixes (Tasks 48-54)
# COMMIT 2 — Automation + approval + RBAC (Tasks 55-61)
# COMMIT 3 — MCP server (ERP-to-Claude integration)

$env:GIT_AUTHOR_NAME    = "VendettaGamesHQ"
$env:GIT_AUTHOR_EMAIL   = "thevendettadao@gmail.com"
$env:GIT_COMMITTER_NAME  = "VendettaGamesHQ"
$env:GIT_COMMITTER_EMAIL = "thevendettadao@gmail.com"

# ── COMMIT 1: Foundation fixes ────────────────────────────────────────────────
Write-Host "Staging foundation fixes (Tasks 48-54)..." -ForegroundColor Cyan

git add CLAUDE.md
git add backend/.env.example
git add backend/config/tenant.js
git add backend/controllers/emailSignatureController.js
git add backend/controllers/outreachController.js
git add backend/controllers/productCategoryController.js
git add backend/middleware/errorHandler.js
git add backend/models/Inquiry.js
git add backend/models/Product.js
git add backend/models/Quotation.js
git add backend/seeds/seed.js
git add backend/utils/helpers.js
git add frontend/admin-portal/.env.example
git add frontend/admin-portal/src/config/tenant.js
git add frontend/admin-portal/src/pages/Auth/Login.jsx
git add frontend/admin-portal/src/pages/CRM/ActivityForm.jsx
git add frontend/admin-portal/src/pages/CRM/ActivityList.jsx
git add frontend/admin-portal/src/pages/CRM/CRMDashboard.jsx
git add frontend/admin-portal/src/pages/CRM/CampaignForm.jsx
git add frontend/admin-portal/src/pages/CRM/CampaignList.jsx
git add frontend/admin-portal/src/pages/CRM/ContactForm.jsx
git add frontend/admin-portal/src/pages/CRM/ContactList.jsx
git add frontend/admin-portal/src/pages/CRM/DealForm.jsx
git add frontend/admin-portal/src/pages/CRM/DealPipeline.jsx
git add frontend/admin-portal/src/pages/CRM/LeadForm.jsx
git add frontend/admin-portal/src/pages/CRM/LeadList.jsx

$msg1 = @"
fix: ERP audit foundation -- CRM auth, route order, error shapes, tenant config

Task 48: Replace raw axios with shared api service across all 11 CRM pages.
Raw axios bypassed the JWT auth interceptor; every CRM call was unauthenticated.

Task 49: Externalize hardcoded Sovern House values to env vars.

Task 50: Remove inline FK references from Quotation.js, Inquiry.js, Product.js.

Task 51: Standardize API error response shape (errorHandler + getErrorResponse).

Task 52: Fix Express route shadowing in crm.js (static paths before /:id).

Task 53: Tenant config foundation for whitelabel (backend + frontend).
"@
git commit -m $msg1
Write-Host "Commit 1 done." -ForegroundColor Green

# ── COMMIT 2: Automation + document flow + approval + RBAC ───────────────────
Write-Host "Staging automation + approval + RBAC (Tasks 55-61)..." -ForegroundColor Cyan

git add backend/models/index.js
git add backend/models/DocumentApproval.js
git add backend/package.json
git add backend/routes/approvalRoutes.js
git add backend/routes/crm.js
git add backend/routes/proformaInvoiceRoutes.js
git add backend/routes/salesOrderRoutes.js
git add backend/server.js
git add backend/services/schedulerService.js
git add frontend/admin-portal/src/App.jsx
git add frontend/admin-portal/src/components/RoleGuard.jsx
git add frontend/admin-portal/src/config/rbacConfig.js
git add frontend/admin-portal/src/hooks/usePermissions.js
git add "frontend/admin-portal/src/pages/Approvals/"
git add frontend/admin-portal/src/pages/ProformaInvoices/ProformaDetail.jsx
git add frontend/admin-portal/src/pages/SalesOrders/OrderDetail.jsx
git add frontend/admin-portal/src/pages/Settings/BulkImport.jsx
git add frontend/admin-portal/src/services/api.js

$msg2 = @"
feat: document automation, approval system, bulk import, RBAC enforcement

Task 55: Fix PI to SO conversion -- transaction, factoryId validation, proper SO number.
Task 56: ProformaDetail.jsx -- full implementation replacing 18-line stub.
         Includes approval modal, convert-to-SO modal, financial summary.
         Fix: navigate to /orders/:id (was /sales-orders/:id).
Task 57: SO to Packing List -- POST /:id/create-packing-list endpoint + UI button.
Task 58: Background scheduler -- node-cron, 4 daily business jobs.
Task 59: Bulk Import UI -- 4-step wizard, CSV/XLSX, parse-then-confirm flow.
Task 60: Document approval system -- 256-bit token, expiry, IP audit trail.
         ApprovalPage.jsx (public, no login), approvalRoutes.js, DocumentApproval model.
Task 61: RBAC enforcement -- RoleGuard upgraded to permission keys, usePermissions hook.
         App.jsx rewritten: every route now carries a permission prop.
         Unauthorized direct URL access now blocked with 403 screen.
"@
git commit -m $msg2
Write-Host "Commit 2 done." -ForegroundColor Green

# ── COMMIT 3: MCP server ──────────────────────────────────────────────────────
Write-Host "Staging MCP server..." -ForegroundColor Cyan

git add mcp-server/

$msg3 = @"
feat: add Sovern ERP MCP server (ERP-to-Claude integration)

TypeScript MCP server that wraps the ERP API and exposes 11 CRM/outreach tools
to Claude via the Model Context Protocol. Powers the sovern-erp plugin in Cowork
and Claude Code.

Tools: erp_list_leads, erp_get_lead, erp_create_lead, erp_update_lead,
erp_delete_lead, erp_send_outreach_email, erp_list_email_templates,
erp_create_email_template, erp_list_email_signatures, erp_create_email_signature,
erp_list_customers.

node_modules/ and dist/ excluded by .gitignore -- run npm install && npm run build
after cloning.
"@
git commit -m $msg3
Write-Host "Commit 3 done." -ForegroundColor Green

# ── Push ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Pushing to origin/main..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "All done. 3 commits pushed to origin/main." -ForegroundColor Green
