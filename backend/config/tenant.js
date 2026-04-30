/**
 * tenant.js — single source of truth for all tenant / whitelabel configuration
 * on the backend side.
 *
 * Every value reads from an environment variable first, then falls back to
 * the Sovern House defaults. To white-label this ERP, a new tenant only needs
 * to set these env vars — no source-code changes required.
 *
 * Import this module instead of reading process.env directly for any
 * tenant-specific value. This keeps every override in one place and makes
 * future SaaS multi-tenancy (per-request tenant lookup) a single-file change.
 */

const tenant = {
  // ── Identity ────────────────────────────────────────────────────────────────
  companyName:   process.env.COMPANY_NAME   || 'Sovern House',
  companyDomain: process.env.COMPANY_DOMAIN || 'sovernhouse.co',
  adminEmail:    process.env.ADMIN_EMAIL    || 'admin@sovernhouse.co',

  // ── Email / outreach ─────────────────────────────────────────────────────────
  /**
   * Comma-separated list of domains from which outreach emails may be sent.
   * Parsed once at startup so the array is available synchronously.
   */
  allowedSendingDomains: process.env.ALLOWED_SENDING_DOMAINS
    ? process.env.ALLOWED_SENDING_DOMAINS.split(',').map(d => d.trim())
    : ['sovernhouse.co', 'sovern-house.com'],
};

module.exports = tenant;
