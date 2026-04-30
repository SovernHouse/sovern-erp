# git-push-erp-audit-2.ps1
# Run from the ERP repo root in PowerShell:
#   .\git-push-erp-audit-2.ps1
#
# COMMIT 1 — Critical server fix (Task 62): remove duplicate Sequelize association
# COMMIT 2 — Dead code cleanup (Task 63)
# COMMIT 3 — Soft deletes + state machine guards (Tasks 64-65)

$env:GIT_AUTHOR_NAME    = "VendettaGamesHQ"
$env:GIT_AUTHOR_EMAIL   = "thevendettadao@gmail.com"
$env:GIT_COMMITTER_NAME  = "VendettaGamesHQ"
$env:GIT_COMMITTER_EMAIL = "thevendettadao@gmail.com"

# ── COMMIT 1: Critical server fix ─────────────────────────────────────────────
Write-Host "Staging server crash fix (Task 62)..." -ForegroundColor Cyan

git add backend/models/index.js

$msg1 = @"
fix: remove duplicate DocumentApproval.belongsTo(User) association (server crash)

Task 62: DocumentApproval.associate() already registers the belongsTo(User,
{ as: 'requestedBy' }) association when index.js calls model.associate(db).
The manual re-registration at index.js:505 made Sequelize define the same
alias twice, throwing SequelizeAssociationError on every startup and taking
the entire ERP offline.

Fix: remove the duplicate belongsTo line from index.js. Keep the hasMany
(User -> DocumentApproval) which is not covered by the model's associate().
approvalRoutes.js include { as: 'requestedBy' } references are unaffected.
"@
git commit -m $msg1
Write-Host "Commit 1 done." -ForegroundColor Green

# ── COMMIT 2: Dead code cleanup ────────────────────────────────────────────────
Write-Host "Staging dead code removal (Task 63)..." -ForegroundColor Cyan

git rm frontend/admin-portal/src/pages/Commissions/CommissionDashboard.jsx
git rm git-push-audit-fixes.sh
git rm git-push-erp-audit.sh

$msg2 = @"
chore: remove dead code -- orphaned CommissionDashboard + superseded scripts

Task 63: CommissionDashboard.jsx was never imported in App.jsx or any router.
git-push-audit-fixes.sh and git-push-erp-audit.sh are the original bash push
scripts from the audit sprint; superseded by the PowerShell equivalents.
"@
git commit -m $msg2
Write-Host "Commit 2 done." -ForegroundColor Green

# ── COMMIT 3: Soft deletes + state machine guards ─────────────────────────────
Write-Host "Staging soft deletes + state machine guards (Tasks 64-65)..." -ForegroundColor Cyan

git add backend/models/SalesOrder.js
git add backend/models/PurchaseOrder.js
git add backend/models/Customer.js
git add backend/models/Factory.js
git add backend/models/Payment.js
git add backend/models/ProformaInvoice.js
git add backend/models/Shipment.js
git add backend/models/Invoice.js
git add backend/utils/statusTransitions.js

$msg3 = @"
feat: soft deletes (paranoid) on 5 models + state machine guards on 5 models

Task 64: Add paranoid: true to SalesOrder, PurchaseOrder, Customer, Factory,
Payment. Sets deletedAt timestamp instead of hard-deleting rows. Sequelize
automatically filters deleted records from all queries.
Invoice already had an explicit deletedAt field; replaced with paranoid: true
for consistency (same behavior, Sequelize-managed).

Task 65: backend/utils/statusTransitions.js -- central transition map and
statusTransitionHook() factory for Sequelize beforeUpdate hooks.
Wired into: SalesOrder, PurchaseOrder, ProformaInvoice, Shipment, Invoice.
Any attempt to move a document to an illegal status (e.g. confirmed ->
delivered skipping in_production) throws a 422 with from/to/modelName details.
Same-state updates (no-ops) always pass through.
"@
git commit -m $msg3
Write-Host "Commit 3 done." -ForegroundColor Green

# ── Push ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Pushing to origin/main..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "All done. 3 commits pushed to origin/main." -ForegroundColor Green
