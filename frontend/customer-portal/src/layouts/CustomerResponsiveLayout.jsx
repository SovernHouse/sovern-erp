import React from 'react'
import { useLocation } from 'react-router-dom'
import {
  Home,
  ShoppingCart,
  FileText,
  Receipt,
  User,
} from 'lucide-react'
import { useIsMobile, ResponsiveNav } from '@trading-erp/shared'

/**
 * CustomerResponsiveLayout
 * Portal-specific responsive layout wrapper for Customer Portal
 *
 * Sidebar: Dashboard, Orders, Quotations, Invoices, Profile
 * Mobile bottom bar: Home, Orders, Invoices, Profile
 */
export default function CustomerResponsiveLayout({ children, sidebarOpen }) {
  const isMobile = useIsMobile()
  const location = useLocation()

  const navItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Orders', icon: ShoppingCart, path: '/orders' },
    { label: 'Quotations', icon: FileText, path: '/quotations' },
    { label: 'Invoices', icon: Receipt, path: '/invoices' },
    { label: 'Profile', icon: User, path: '/profile' },
  ]

  // Add "active" property based on current location
  const itemsWithActive = navItems.map((item) => ({
    ...item,
    active: location.pathname === item.path,
  }))

  const handleNavigate = (path) => {
    window.location.pathname = path
  }

  return (
    <>
      {/* Mobile Navigation - Bottom Bar */}
      {isMobile && (
        <ResponsiveNav
          items={itemsWithActive}
          onNavigate={handleNavigate}
          maxVisibleItems={4}
          variant="bottom-bar"
        />
      )}

      {/* Desktop/Tablet Navigation - Sidebar */}
      {!isMobile && sidebarOpen !== false && (
        <div className="hidden md:block w-64 bg-slate-900 text-white p-6">
          <ResponsiveNav
            items={itemsWithActive}
            onNavigate={handleNavigate}
            variant="sidebar"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </div>
    </>
  )
}
