// ─── BreadcrumbContext ────────────────────────────────────────────────────────
// Detail pages call useBreadcrumbs(title) to push their record name into the
// breadcrumb bar rendered by Layout. The context resets on page unmount so
// stale titles never leak across navigations.

import { createContext, useContext, useState } from 'react'

const BreadcrumbContext = createContext({ pageTitle: null, setPageTitle: () => {} })

export function BreadcrumbProvider({ children }) {
  const [pageTitle, setPageTitle] = useState(null)
  return (
    <BreadcrumbContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext)
}
