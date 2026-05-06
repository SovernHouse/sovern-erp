// ─── useBreadcrumbs ───────────────────────────────────────────────────────────
// Call from any detail page to set the record name in the breadcrumb bar.
// Safe to call with null/undefined while the record is still loading — the
// breadcrumb will show a "..." placeholder until the title resolves.
//
// Usage:
//   useBreadcrumbs(quotation?.quotationNumber)   // updates when quotation loads
//   useBreadcrumbs('Purchase Order')              // static label for stub pages

import { useEffect } from 'react'
import { useBreadcrumbContext } from '../contexts/BreadcrumbContext'

export function useBreadcrumbs(title) {
  const { setPageTitle } = useBreadcrumbContext()
  useEffect(() => {
    setPageTitle(title ?? null)
    return () => setPageTitle(null)
  }, [title])
}
