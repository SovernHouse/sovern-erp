// ─── Breadcrumb ───────────────────────────────────────────────────────────────
// Odoo-style breadcrumb rendered at the top of every page's content area.
// Auto-derives the root label from the URL segment via SEGMENT_LABELS.
// Detail pages push their record name via useBreadcrumbs(title).
//
// Examples:
//   /quotations            →  Quotations
//   /quotations/123        →  Quotations  >  QT-2026-001
//   /quotations/123/edit   →  Quotations  >  QT-2026-001  >  Edit
//   /quotations/new        →  Quotations  >  New
//   /products/categories   →  Products  >  Categories

import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useBreadcrumbContext } from '../contexts/BreadcrumbContext'

// ── Route segment → display label ────────────────────────────────────────────
const SEGMENT_LABELS = {
  customers:          'Clients',
  factories:          'Suppliers',
  products:           'Products',
  inquiries:          'Inquiries',
  leads:              'Leads',
  quotations:         'Quotations',
  'proforma-invoices': 'Proforma Invoices',
  orders:             'Sales Orders',
  'purchase-orders':  'Purchase Orders',
  'packing-lists':    'Packing Lists',
  shipments:          'Shipments',
  inspections:        'Inspections',
  claims:             'Claims',
  invoices:           'Invoices',
  payments:           'Payments',
  inventory:          'Inventory',
  grns:               'Goods Receipts',
  'audit-trail':      'Audit Trail',
  triage:             'Triage Inbox',
  approvals:          'Approvals',
  activities:         'Activities',
  chat:               'Chat',
  settings:           'Settings',
  reports:            'Reports',
  'price-lists':      'Price Lists',
  'price-list':       'Price Lists',
}

// Known named sub-routes that aren't record IDs
const NAMED_SUBS = {
  new:              'New',
  categories:       'Categories',
  'spec-templates': 'Spec Templates',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const FOREST = '#1D5A32'
const MUTED  = '#9CA3AF'
const INK    = '#0E0D0C'

function BreadcrumbLink({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        color: FOREST,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
    >
      {children}
    </Link>
  )
}

function BreadcrumbText({ children }) {
  return (
    <span style={{ color: INK, fontSize: 13, fontWeight: 500 }}>
      {children}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Breadcrumb() {
  const location = useLocation()
  const { pageTitle } = useBreadcrumbContext()

  const segments = location.pathname.split('/').filter(Boolean)
  const root   = segments[0]  // e.g. 'quotations'
  const sub    = segments[1]  // e.g. '123-abc', 'new', 'categories'
  const subsub = segments[2]  // e.g. 'edit'

  // No breadcrumb if we don't recognise this route
  if (!root || !SEGMENT_LABELS[root]) return null

  const rootLabel = SEGMENT_LABELS[root]
  const rootPath  = `/${root}`

  // Build items array: { label, to? }
  const items = []

  if (!sub) {
    // List page — just the module name, not a link
    items.push({ label: rootLabel })
  } else if (NAMED_SUBS[sub]) {
    // /products/new, /products/categories, etc.
    items.push({ label: rootLabel, to: rootPath })
    items.push({ label: NAMED_SUBS[sub] })
  } else {
    // Detail page — sub is a UUID/ID
    const recordLabel = pageTitle || '...'
    if (subsub === 'edit') {
      items.push({ label: rootLabel,    to: rootPath })
      items.push({ label: recordLabel,  to: `${rootPath}/${sub}` })
      items.push({ label: 'Edit' })
    } else {
      items.push({ label: rootLabel,   to: rootPath })
      items.push({ label: recordLabel })
    }
  }

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 20,
      }}
    >
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && (
            <ChevronRight
              size={13}
              style={{ color: MUTED, flexShrink: 0 }}
            />
          )}
          {item.to
            ? <BreadcrumbLink to={item.to}>{item.label}</BreadcrumbLink>
            : <BreadcrumbText>{item.label}</BreadcrumbText>
          }
        </span>
      ))}
    </nav>
  )
}
