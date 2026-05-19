// ─── useBreadcrumbs ───────────────────────────────────────────────────────────
// Call from any detail page to set the record name in the breadcrumb bar.
// Safe to call with null/undefined while the record is still loading. The
// breadcrumb shows a "..." placeholder until the title resolves.
//
// Usage:
//   useBreadcrumbs(quotation?.quotationNumber)              // record only
//   useBreadcrumbs(customer?.companyName, activeTab)        // record + tab
//   useBreadcrumbs('Purchase Order')                        // static label
//
// Phase 4.28t: optional second arg renders the active tab label after a
// chevron when the user is anywhere but the Overview tab, so the
// breadcrumb reads e.g. 'IronLite Core ... May 2026 › Items'. Pass the
// raw activeTab key (e.g. 'items', 'approvals', 'chatter'); 'overview'
// (case-insensitive) and falsy values suppress the suffix.

import { useEffect } from 'react'
import { useBreadcrumbContext } from '../contexts/BreadcrumbContext'

export function useBreadcrumbs(title, activeTab) {
  const { setPageTitle } = useBreadcrumbContext()
  useEffect(() => {
    const suffix = activeTab && String(activeTab).toLowerCase() !== 'overview'
      ? ' › ' + String(activeTab).charAt(0).toUpperCase() + String(activeTab).slice(1)
      : ''
    const composed = title ? (title + suffix) : null
    setPageTitle(composed)
    return () => setPageTitle(null)
  }, [title, activeTab])
}
