import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Home,
  ShoppingCart,
  Users,
  Building2,
  BarChart3,
  Settings,
  TrendingUp,
  CalendarCheck,
  CheckSquare,
  Target,
} from 'lucide-react'
import { useIsMobile, ResponsiveNav } from '@trading-erp/shared'

/**
 * AdminResponsiveLayout
 * Portal-specific responsive layout wrapper for Admin Portal.
 *
 * Desktop sidebar: grouped sections (CRM group with header label, then Operations).
 * Mobile bottom bar: Dashboard, Leads, Orders, Settings + More overflow.
 */

// One nav item rendered in the custom desktop sidebar
function SidebarItem({ item, onNavigate }) {
  const isActive = item.active
  const Icon = item.icon
  return (
    <button
      onClick={() => onNavigate(item.path)}
      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${
        isActive
          ? 'bg-blue-600 text-white font-medium'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 text-left truncate">{item.label}</span>
    </button>
  )
}

// Non-clickable section header in the sidebar
function SidebarSection({ label }) {
  return (
    <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-500 select-none">
      {label}
    </p>
  )
}

export default function AdminResponsiveLayout({ children, sidebarOpen }) {
  const isMobile = useIsMobile()
  const location = useLocation()

  // Helper: is this path "active"?
  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  // ── Desktop sidebar sections ──────────────────────────────────────────────

  const crmItems = [
    { label: 'Leads',      icon: Target,        path: '/crm/leads' },
    { label: 'Pipeline',   icon: CheckSquare,   path: '/crm/pipeline' },
    { label: 'Activities', icon: CalendarCheck, path: '/crm/activities' },
  ].map((i) => ({ ...i, active: isActive(i.path) }))

  const opsItems = [
    { label: 'Dashboard',  icon: Home,          path: '/' },
    { label: 'Orders',     icon: ShoppingCart,  path: '/orders' },
    { label: 'Customers',  icon: Users,         path: '/customers' },
    { label: 'Factories',  icon: Building2,     path: '/factories' },
    { label: 'Reports',    icon: BarChart3,     path: '/reports' },
    { label: 'Settings',   icon: Settings,      path: '/settings' },
  ].map((i) => ({ ...i, active: isActive(i.path) }))

  // ── Mobile bottom-bar items (flat list, overflow goes to "More") ──────────

  const mobileItems = [
    { label: 'Dashboard',  icon: <Home size={20} />,         path: '/', active: isActive('/') },
    { label: 'Leads',      icon: <Target size={20} />,       path: '/crm/leads', active: isActive('/crm/leads') },
    { label: 'Orders',     icon: <ShoppingCart size={20} />, path: '/orders', active: isActive('/orders') },
    { label: 'Customers',  icon: <Users size={20} />,        path: '/customers', active: isActive('/customers') },
    // Below become "More" overflow
    { label: 'Pipeline',   icon: <CheckSquare size={20} />,  path: '/crm/pipeline', active: isActive('/crm/pipeline') },
    { label: 'Activities', icon: <CalendarCheck size={20} />,path: '/crm/activities', active: isActive('/crm/activities') },
    { label: 'Factories',  icon: <Building2 size={20} />,    path: '/factories', active: isActive('/factories') },
    { label: 'Reports',    icon: <BarChart3 size={20} />,    path: '/reports', active: isActive('/reports') },
    { label: 'Settings',   icon: <Settings size={20} />,     path: '/settings', active: isActive('/settings') },
  ]

  const handleNavigate = (path) => {
    window.location.pathname = path
  }

  return (
    <>
      {/* Mobile Navigation - Bottom Bar */}
      {isMobile && (
        <ResponsiveNav
          items={mobileItems}
          onNavigate={handleNavigate}
          maxVisibleItems={4}
          variant="bottom-bar"
        />
      )}

      {/* Desktop/Tablet Navigation - Grouped Sidebar */}
      {!isMobile && sidebarOpen !== false && (
        <div className="hidden md:flex md:flex-col w-64 bg-slate-900 text-white p-4 min-h-0 overflow-y-auto">

          {/* CRM group */}
          <div className="flex items-center space-x-2 mb-1 px-3">
            <TrendingUp size={14} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">CRM</span>
          </div>
          <div className="space-y-0.5 mb-2">
            {crmItems.map((item) => (
              <SidebarItem key={item.path} item={item} onNavigate={handleNavigate} />
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700 my-2" />

          {/* Operations group */}
          <div className="space-y-0.5">
            {opsItems.map((item) => (
              <SidebarItem key={item.path} item={item} onNavigate={handleNavigate} />
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </div>
    </>
  )
}
