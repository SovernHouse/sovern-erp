import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Home,
  ShoppingCart,
  Users,
  Building2,
  BarChart3,
  Settings,
  MoreHorizontal,
} from 'lucide-react'
import { useIsMobile, ResponsiveNav } from '@trading-erp/shared'

/**
 * AdminResponsiveLayout
 * Portal-specific responsive layout wrapper for Admin Portal
 *
 * Sidebar nav items: Dashboard, Orders, Customers, Factories, Products, Reports, Settings
 * Mobile bottom bar: Dashboard, Orders, Customers, More
 */
export default function AdminResponsiveLayout({ children, sidebarOpen }) {
  const isMobile = useIsMobile()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/' },
    { label: 'Orders', icon: ShoppingCart, path: '/orders' },
    { label: 'Customers', icon: Users, path: '/customers' },
    { label: 'Factories', icon: Building2, path: '/factories' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ]

  // Add "active" property based on current location
  const itemsWithActive = navItems.map((item) => ({
    ...item,
    active: location.pathname === item.path,
  }))

  const handleNavigate = (path) => {
    // Navigation is typically handled by router links
    // This is a fallback for programmatic navigation if needed
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
