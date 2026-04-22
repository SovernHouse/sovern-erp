import React, { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { useIsMobile, useBreakpoint } from '../utils/responsive'

export default function ResponsiveLayout({
  children,
  sidebarContent,
  headerContent,
  logoContent,
  onSidebarToggle,
  showBottomNav = true,
  sidebarOpen: externalSidebarOpen = null,
}) {
  const isMobile = useIsMobile()
  const breakpoint = useBreakpoint()
  const [sidebarOpen, setSidebarOpen] = useState(
    externalSidebarOpen !== null ? externalSidebarOpen : !isMobile
  )

  // Handle external sidebar state updates
  useEffect(() => {
    if (externalSidebarOpen !== null) {
      setSidebarOpen(externalSidebarOpen)
    }
  }, [externalSidebarOpen])

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile])

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen)
    onSidebarToggle?.(!sidebarOpen)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSidebarOpen(false)
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } fixed md:static left-0 top-0 h-full w-64 md:w-64 lg:w-72 bg-white shadow-lg md:shadow-md z-40 transition-transform duration-300 ease-in-out flex flex-col overflow-hidden`}
      >
        {/* Sidebar Header with Logo */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          {logoContent && <div className="flex-1">{logoContent}</div>}

          {/* Mobile Close Button */}
          <button
            onClick={handleSidebarToggle}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarContent && (
            <div className="px-4 md:px-6 py-4">{sidebarContent}</div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
          <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6 gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={handleSidebarToggle}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Header Content */}
            <div className="flex-1 min-w-0">{headerContent}</div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="w-full max-w-full px-3 py-4 md:px-6 md:py-6 pb-20 md:pb-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        {showBottomNav && isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 shadow-lg z-20">
            {/* Content can be injected here */}
          </nav>
        )}
      </div>
    </div>
  )
}
