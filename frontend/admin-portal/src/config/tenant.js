/**
 * tenant.js — single source of truth for all tenant / whitelabel configuration.
 *
 * Every value reads from a VITE_ environment variable first, then falls back to
 * the Sovern House defaults. To white-label this ERP, a new tenant only needs to
 * supply a .env file — no source-code changes required.
 *
 * All VITE_ vars must be defined at build time. For runtime changes (e.g. SaaS
 * multi-tenancy), fetch tenant config from `/api/tenant-config` instead and merge
 * the result into this object at app startup.
 */

const tenant = {
  // ── Identity ────────────────────────────────────────────────────────────────
  companyName:    import.meta.env.VITE_COMPANY_NAME    || 'Sovern House',
  companyDomain:  import.meta.env.VITE_COMPANY_DOMAIN  || 'sovernhouse.co',
  adminEmail:     import.meta.env.VITE_ADMIN_EMAIL     || 'admin@sovernhouse.co',

  // ── Branding ────────────────────────────────────────────────────────────────
  /** URL to the primary logo image (used in email previews, exports, white-label layouts). */
  logoUrl:        import.meta.env.VITE_LOGO_URL        || 'https://sovernhouse.co/logos/sovern-wordmark-email-light.png',
  /** Hex colour used as the primary brand accent (buttons, active states, links). */
  brandColor:     import.meta.env.VITE_BRAND_COLOR     || '#1D5A32',
  /** Contrast colour for text on brandColor backgrounds. */
  brandContrast:  import.meta.env.VITE_BRAND_CONTRAST  || '#F1EEE7',

  // ── API / Sockets ────────────────────────────────────────────────────────────
  apiUrl:         import.meta.env.VITE_API_URL         || '/api',
  socketUrl:      import.meta.env.VITE_SOCKET_URL      || 'http://localhost:5000',

  // ── Feature flags ────────────────────────────────────────────────────────────
  /** Disable features that don't make sense for all tenants. */
  enableCRM:      import.meta.env.VITE_ENABLE_CRM      !== 'false',
  enableOutreach: import.meta.env.VITE_ENABLE_OUTREACH !== 'false',
};

export default tenant;
