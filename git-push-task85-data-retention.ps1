# git-push-task85-data-retention.ps1
# Task 85: Data retention hard-delete scheduler job
# Run from the ERP repo root on Windows.

$ErrorActionPreference = "Stop"

# ── Commit 1: Scheduler — data retention hard-delete job ─────────────────────
git add backend/services/schedulerService.js
git commit -m @"
feat(scheduler): add nightly data retention hard-delete job

purgeExpiredSoftDeletes runs at 02:00 and permanently removes soft-deleted
records (paranoid models) whose deletedAt is older than DATA_RETENTION_DAYS
(default 365). Covers: Customer, Factory, SalesOrder, PurchaseOrder, Invoice,
Payment, SpecTemplate. Supports GDPR right-to-erasure. Togglable via
SCHEDULER_DATA_RETENTION env var. Missing models warn and skip rather than
crash. Logs per-model counts on each run.

Task-85
"@

# ── Commit 2: .env.example — scheduler and retention vars ────────────────────
git add .env.example
git commit -m @"
chore(env): document scheduler and data retention env vars in .env.example

Added SCHEDULER_ACTIVITY_REMINDERS, SCHEDULER_FOLLOWUP_REMINDERS,
SCHEDULER_INVOICE_OVERDUE, SCHEDULER_PRODUCTION_ALERTS,
SCHEDULER_DATA_RETENTION, PRODUCTION_ALERT_DAYS, and DATA_RETENTION_DAYS
with defaults to .env.example.

Task-85
"@

# ── Commit 3: DEVELOPER_GUIDE — scheduler section updated ────────────────────
git add DEVELOPER_GUIDE.md
git commit -m @"
docs(guide): update scheduler section with Job 5 and data retention config

Section 10 now documents all five scheduler jobs with correct env flag names,
defaults, and schedules. Added dedicated sub-section for data retention:
paranoid model list, how to add new models, env config, and runtime behavior.

Task-85
"@

# ── Push ──────────────────────────────────────────────────────────────────────
git push origin main

Write-Host ""
Write-Host "Task 85 pushed. Data retention scheduler job complete." -ForegroundColor Green
