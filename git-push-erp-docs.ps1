# git-push-erp-docs.ps1
# Tasks 66-69: Tooltip system, help panel, and documentation
# Run from the ERP repo root on Windows.

$ErrorActionPreference = "Stop"

# ── Commit 1: Tooltip primitive + content constants ────────────────────────────
git add frontend/admin-portal/src/components/Tooltip.jsx `
       frontend/admin-portal/src/constants/tooltipContent.js
git commit -m "feat(ui): add Tooltip, FieldTip, StatusTip components + full content constants

- Tooltip.jsx: hover/focus tooltip with 4 placements (top/bottom/left/right)
- FieldTip: label + HelpCircle icon shorthand for form fields
- StatusTip: wraps status badges with lifecycle descriptions
- tooltipContent.js: copy for all modules (CRM, Orders, POs, Shipments,
  Invoices, Payments, Approvals, Settings, Outreach, Bulk Import, Roles)
- STATUS_DESCRIPTIONS keyed as 'ModelName.status' for precise lookup

Task-66 Task-67"

# ── Commit 2: Help panel + content ────────────────────────────────────────────
git add frontend/admin-portal/src/components/HelpPanel.jsx `
       frontend/admin-portal/src/constants/helpContent.js
git commit -m "feat(ui): add slide-in HelpPanel with per-page content

- HelpPanel.jsx: right-side drawer, Escape to close, backdrop click, focus trap
- useHelpPanel() hook (isOpen / open / close / toggle)
- URL-based content resolution: exact -> base prefix -> __default__ fallback
- helpContent.js: sections, steps, tips, warnings, status glossary, links for
  all 20 routes (dashboard, CRM, orders, POs, shipments, invoices, etc.)
- GLOBAL_TIPS appended to every page

Task-68"

# ── Commit 3: Wire HelpPanel into Layout ──────────────────────────────────────
git add frontend/admin-portal/src/components/Layout.jsx
git commit -m "feat(ui): wire HelpPanel ? button into Layout header

- Import HelpPanel + useHelpPanel
- ? button top-right, highlights green when panel is open
- Renders HelpPanel at root level so it overlays all page content

Task-68"

# ── Commit 4: Developer guide ─────────────────────────────────────────────────
git add DEVELOPER_GUIDE.md
git commit -m "docs: add comprehensive DEVELOPER_GUIDE.md (20 sections)

Covers: architecture, tech stack, project structure, local setup, env vars,
model associations (critical no-duplicate rule), state machine transitions,
RBAC permission keys, API endpoints, scheduler, document approvals, MCP server,
frontend architecture, tooltip/help system, bulk import, email/outreach
(Egypt BCC rule), tenant config, security notes, deployment, known limitations.

Task-69"

# ── Push ───────────────────────────────────────────────────────────────────────
git push origin main

Write-Host ""
Write-Host "Tasks 66-69 pushed." -ForegroundColor Green
