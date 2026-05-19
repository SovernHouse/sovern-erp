/**
 * EntityLink — Odoo-style clickable navigation to any entity's detail page.
 *
 * Phase 4.28p (2026-05-19). Single component every detail page uses to
 * render a clickable reference to another entity (Customer, Factory,
 * Product, Quotation, Lead, etc.). The entity-to-route map lives here
 * once; any new entity adopted in routes/App.jsx must be added to the
 * map below in the same commit (otherwise the link renders as plain
 * text rather than a 404-prone broken anchor).
 *
 * Usage:
 *   <EntityLink type="Factory"  id={pl.Factory.id}  label={pl.Factory.companyName} />
 *   <EntityLink type="Customer" id={pl.Customer.id} label={pl.Customer.companyName} />
 *   <EntityLink type="Product"  id={item.productId} label={item.productName} subtle />
 *
 * Props:
 *   type    — entity type matching ENTITY_ROUTES below
 *   id      — record UUID
 *   label   — visible text. Falls back to the type name when omitted.
 *   subtle  — render as muted text + underline-on-hover (for cells in
 *             a table). Without, renders as the standard link colour.
 *   className — optional extra classes
 *
 * Renders plain text (no <a>) when:
 *   - id is missing, OR
 *   - type is not in ENTITY_ROUTES (unmapped entity — log a warning)
 *
 * Reference for Odoo five-pillar conformance: trade-odoo-patterns.md.
 */

import { Link, useLocation } from 'react-router-dom'
import { useBreadcrumbContext } from '../contexts/BreadcrumbContext'

// One source of truth for entity → route mapping. When a new entity is
// added to App.jsx, add it here too. Keys are PascalCase model names
// matching the Sequelize models; values are route templates relative
// to /admin (the SPA base).
const ENTITY_ROUTES = {
  Customer:        (id) => `/customers/${id}`,
  Factory:         (id) => `/factories/${id}`,
  Supplier:        (id) => `/factories/${id}`,        // alias
  Lead:            (id) => `/crm/leads/${id}`,
  Contact:         (id) => `/contacts/${id}`,
  Product:         (id) => `/products/${id}`,
  Quotation:       (id) => `/quotations/${id}`,
  ProformaInvoice: (id) => `/proforma-invoices/${id}`,
  Proforma:        (id) => `/proforma-invoices/${id}`, // alias
  SalesOrder:      (id) => `/sales-orders/${id}`,
  Invoice:         (id) => `/invoices/${id}`,
  CreditNote:      (id) => `/credit-notes/${id}`,
  PurchaseOrder:   (id) => `/purchase-orders/${id}`,
  GoodsReceivedNote: (id) => `/grn/${id}`,
  PackingList:     (id) => `/packing-lists/${id}`,
  Shipment:        (id) => `/shipments/${id}`,
  Inspection:      (id) => `/inspections/${id}`,
  Payment:         (id) => `/payments/${id}`,
  Claim:           (id) => `/claims/${id}`,
  PriceList:       (id) => `/price-lists/${id}`,
  Brand:           (code) => `/settings/brands?code=${code}`,
  User:            (id) => `/settings/users?focus=${id}`,
}

export function entityRouteFor(type, id) {
  const fn = ENTITY_ROUTES[type]
  return fn && id ? fn(id) : null
}

export default function EntityLink({ type, id, label, subtle = false, className = '' }) {
  const href = entityRouteFor(type, id)
  const text = label || type || '—'

  // Phase 4.28bb (2026-05-19): capture the current page's context so the
  // destination page's breadcrumb can render "← <from>" as a clickable
  // segment prepended to the URL-derived crumb chain. Without this the
  // breadcrumb resets to the URL hierarchy and the user loses the
  // trail back to where they started (e.g. PriceList → Product hides
  // the PriceList path on the Product page).
  const location = useLocation()
  const { pageTitle } = useBreadcrumbContext()
  const from = pageTitle
    ? { label: pageTitle, to: location.pathname + (location.search || '') }
    : null

  // Unmapped or missing — render as plain text. Don't break the page.
  if (!href) {
    if (import.meta.env.DEV && type && !ENTITY_ROUTES[type]) {
      // eslint-disable-next-line no-console
      console.warn(`[EntityLink] no route mapped for entity type "${type}". Add it to components/EntityLink.jsx.`)
    }
    return <span className={className}>{text}</span>
  }

  const base = subtle
    ? 'text-slate-900 hover:text-primary-700 hover:underline cursor-pointer'
    : 'text-primary-700 hover:text-primary-800 hover:underline cursor-pointer font-medium'

  return (
    <Link
      to={href}
      state={from ? { from } : undefined}
      className={`${base} ${className}`}
      title={`Open ${type}: ${text}`}
    >
      {text}
    </Link>
  )
}
