import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Truck,
  AlertCircle,
  User,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  DollarSign,
  Grid3x3,
} from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { LanguageSwitcher } from '@shared/components'
import { formatTimeAgo } from '../utils/formatters'

export default function Layout({ children, user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead } = useNotifications()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile) setSidebarOpen(false)
  }, [location.pathname])

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/products', label: 'Products', icon: ShoppingCart },
    { path: '/visualizer', label: 'Room Visualizer', icon: Grid3x3 },
    { path: '/quotations', label: 'Quotations', icon: FileText },
    { path: '/orders', label: 'Orders', icon: FileText },
    { path: '/invoices', label: 'Invoices', icon: DollarSign },
    { path: '/samples', label: 'Samples', icon: ShoppingCart },
    { path: '/shipments', label: 'Shipments', icon: Truck },
    { path: '/claims', label: 'Claims', icon: AlertCircle },
    { path: '/profile', label: 'Profile', icon: User },
  ]

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id)
    if (notification.link) {
      navigate(notification.link)
      setNotificationsOpen(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-gradient-to-b from-primary-800 to-primary-900 text-white transition-all duration-300 z-40 w-64 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-primary-700">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
              SH
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-lg truncate">Sovern House</h1>
                <p className="text-xs text-primary-200 truncate">Customer Portal</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-primary-700 rounded md:hidden ml-2 flex-shrink-0"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 space-y-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  active
                    ? 'bg-accent-500 text-white shadow-lg'
                    : 'text-primary-100 hover:bg-primary-700'
                }`}
                title={!sidebarOpen ? item.label : ''}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Info */}
        {sidebarOpen && user && (
          <div className="border-t border-primary-700 p-4 mt-auto bg-primary-900">
            <div className="text-sm">
              <p className="font-semibold text-white truncate">{user.company}</p>
              <p className="text-primary-300 text-xs truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 md:px-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg md:hidden"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2 md:gap-4 ml-auto">
              {/* Language Switcher */}
              <LanguageSwitcher className="hidden md:block" />

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {Math.min(unreadCount, 9)}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No notifications
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                              !notif.read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {notif.title}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {notif.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {formatTimeAgo(notif.createdAt)}
                                </p>
                              </div>
                              {!notif.read && (
                                <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {notifications.length > 10 && (
                      <div className="p-3 text-center border-t border-gray-200">
                        <Link to="/notifications" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                          View all notifications
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Menu */}
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium text-gray-700">
                    {user?.name || 'User'}
                  </span>
                  <ChevronDown size={16} className="text-gray-500" />
                </button>

                {/* Profile Dropdown */}
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <Link
                      to="/profile"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      My Profile
                    </Link>
                    <Link
                      to="/profile/history"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Order History
                    </Link>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false)
                        handleLogout()
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 pb-20 md:pb-6" style={{ fontSize: '16px' }}>
            {children}
          </div>
        </main>
      </div>

    </div>
  )
}
