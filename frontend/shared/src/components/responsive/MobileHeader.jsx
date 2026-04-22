import React, { useState } from 'react'
import { Menu, X, Bell } from 'lucide-react'
import { useIsMobile } from '../../utils/responsive'

/**
 * MobileHeader Component
 * Mobile-only header with hamburger menu, title, and notifications bell
 *
 * Props:
 *  - title: string
 *  - onMenuToggle: () => void
 *  - onNotificationsClick: () => void
 *  - notificationCount: number
 *  - showMenu: boolean
 */
export default function MobileHeader({
  title = 'Dashboard',
  onMenuToggle,
  onNotificationsClick,
  notificationCount = 0,
  showMenu = false,
}) {
  const isMobile = useIsMobile()

  if (!isMobile) {
    return null
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 h-14 shadow-sm z-30 safe-area-top">
      <div className="flex items-center justify-between h-full px-4 gap-4">
        {/* Hamburger Menu Button */}
        <button
          onClick={onMenuToggle}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Toggle menu"
        >
          {showMenu ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
        </div>

        {/* Notifications Bell */}
        <button
          onClick={onNotificationsClick}
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Notifications"
        >
          <Bell size={20} className="text-gray-600" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center h-5 w-5 text-xs font-semibold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
