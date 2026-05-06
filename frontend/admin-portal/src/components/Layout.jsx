import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Menu,
  X,
  Bell,
  LogOut,
  Settings,
  ChevronDown,
  Home,
  Users,
  Users2,
  Building2,
  Package,
  FileText,
  DollarSign,
  Truck,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Inbox,
  BarChart3,
  Cog,
  TrendingUp,
  HelpCircle,
  ExternalLink,
  Layers,
  MessageCircle,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { getAllowedNavItems } from '../config/rbacConfig'
// LanguageSwitcher removed — react-i18next is not initialized in admin-portal
import HelpPanel, { useHelpPanel } from './HelpPanel'
import InstallPWA from './InstallPWA'
import ActivityBanner from './ActivityBanner'
import ActivityIndicator from './ActivityIndicator'
import ChatBubble from './chat/ChatBubble'
import Breadcrumb from './Breadcrumb'
import { BreadcrumbProvider } from '../contexts/BreadcrumbContext'

// ── Brand tokens ─────────────────────────────────────────────────────────────
const INK     = '#0E0D0C'
const CREAM   = '#F1EEE7'
const FOREST  = '#1D5A32'
const c = (hex, opacity) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

// ── Brand wordmark — rendered with actual brand fonts, no PNG ────────────────
// Brand rule: SOVERN, the forest-green rule, and HOUSE must all share the same
// horizontal width — this is the defining geometry of the Sovern House lockup.
// "HOUSE" is NOT simply letter-spaced to taste; its 5 letters are spread via
// justify-content: space-between so they always match SOVERN's rendered width exactly.
// Source: official logo PNG (3200×1100). Height ratio SOVERN:HOUSE ≈ 4:1.
function SovernWordmark() {
  return (
    <div style={{ lineHeight: 1, userSelect: 'none', display: 'inline-block' }}>
      {/* SOVERN — Big Shoulders Display Bold, dominant element */}
      <div style={{
        fontFamily: "'Big Shoulders Display', sans-serif",
        fontWeight: 700,
        fontSize: 28,
        color: CREAM,
        letterSpacing: '0.04em',
        lineHeight: 1,
      }}>
        SOVERN
      </div>
      {/* Forest rule — full width of the SOVERN text (block-level, 100% of container) */}
      <div style={{ height: 2, background: FOREST, margin: '4px 0 4px' }} />
      {/* HOUSE — Arsenal SC Regular, spread across full width via flex space-between.
          This is the correct implementation: the 5 letters always align to SOVERN's edges. */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: "'Arsenal SC', serif",
        fontWeight: 400,
        fontSize: 8,
        color: c(CREAM, 0.55),
        textTransform: 'uppercase',
        letterSpacing: 0,
        lineHeight: 1,
        width: '100%',
      }}>
        {'HOUSE'.split('').map((ch, i) => <span key={i}>{ch}</span>)}
      </div>
    </div>
  )
}

const iconMap = {
  Home, ShoppingCart, Inbox, Truck, DollarSign, CheckCircle,
  BarChart3, Cog, Users, Users2, Building2, Package, TrendingUp, FileText, MessageCircle, Sparkles,
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen]       = useState(true)
  const [expandedMenu, setExpandedMenu]     = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu]     = useState(false)
  const [menuItems, setMenuItems]           = useState([])
  const { isOpen: helpOpen, toggle: toggleHelp, close: closeHelp } = useHelpPanel()

  const { user, logout }                        = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const location  = useLocation()
  const navigate  = useNavigate()

  useEffect(() => {
    if (user?.role) setMenuItems(getAllowedNavItems(user.role))
  }, [user])

  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 768)
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }
  const toggleMenu   = (label) => setExpandedMenu(expandedMenu === label ? null : label)
  const isActive     = (path) => location.pathname === path

  // Formatted breadcrumb
  const crumb = location.pathname === '/'
    ? 'Dashboard'
    : location.pathname.slice(1).split('/').map(s => s.replace(/-/g,' ')).join(' › ')

  // User initials
  const initials = user
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'U'
    : 'U'
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F7F4', fontSize: '15px' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden" style={{ background: c(INK, 0.55) }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside
        className={`fixed md:static left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          width: sidebarOpen ? 228 : 60,
          minWidth: sidebarOpen ? 228 : 60,
          background: INK,
          borderRight: `1px solid ${c(CREAM, 0.07)}`,
        }}
      >

        {/* Logo area */}
        <div style={{
          padding: sidebarOpen ? '22px 20px 18px' : '22px 14px 18px',
          borderBottom: `1px solid ${c(CREAM, 0.09)}`,
          minHeight: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
        }}>
          {sidebarOpen ? (
            <>
              <div>
                <SovernWordmark />
                <div style={{
                  marginTop: 6,
                  fontFamily: "'Arsenal SC', serif",
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: c(CREAM, 0.30),
                  fontWeight: 400,
                }}>
                  SOVERN PORTAL
                </div>
              </div>
              <button
                className="md:hidden"
                onClick={() => setSidebarOpen(false)}
                style={{ color: c(CREAM, 0.5), padding: 4, marginLeft: 8 }}
              >
                <X size={16} />
              </button>
            </>
          ) : (
            /* Collapsed — "S" initial in forest circle */
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: FOREST,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Big Shoulders Display', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              color: CREAM,
              letterSpacing: 0,
            }}>
              S
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {menuItems.map((item) => {
            const Icon = iconMap[item.icon]
            const isExpanded = expandedMenu === item.label
            const anyChildActive = item.submenu?.some(s => isActive(s.path))

            return (
              <div key={item.label} style={{ marginBottom: 2 }}>

                {item.submenu ? (
                  /* ── Section with children ── */
                  <button
                    onClick={() => toggleMenu(item.label)}
                    title={!sidebarOpen ? item.label : undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: sidebarOpen ? '8px 10px' : '8px 0',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      borderRadius: 7,
                      border: 'none',
                      cursor: 'pointer',
                      background: (isExpanded || anyChildActive) ? c(CREAM, 0.07) : 'transparent',
                      color: (isExpanded || anyChildActive) ? CREAM : c(CREAM, 0.55),
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!isExpanded && !anyChildActive)
                        e.currentTarget.style.background = c(CREAM, 0.05)
                        e.currentTarget.style.color = c(CREAM, 0.85)
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = (isExpanded || anyChildActive) ? c(CREAM, 0.07) : 'transparent'
                      e.currentTarget.style.color = (isExpanded || anyChildActive) ? CREAM : c(CREAM, 0.55)
                    }}
                  >
                    {Icon && <Icon size={16} style={{ flexShrink: 0, opacity: (isExpanded || anyChildActive) ? 1 : 0.7 }} />}
                    {sidebarOpen && (
                      <>
                        <span style={{
                          flex: 1,
                          textAlign: 'left',
                          fontSize: 14,
                          fontWeight: 500,
                          letterSpacing: '0.02em',
                        }}>
                          {item.label}
                        </span>
                        <ChevronDown size={13} style={{
                          opacity: 0.45,
                          transform: isExpanded ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s',
                          flexShrink: 0,
                        }} />
                      </>
                    )}
                  </button>
                ) : (
                  /* ── Direct link ── */
                  <Link
                    to={item.path}
                    title={!sidebarOpen ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: sidebarOpen ? '8px 10px' : '8px 0',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      borderRadius: 7,
                      textDecoration: 'none',
                      background: isActive(item.path) ? FOREST : 'transparent',
                      color: isActive(item.path) ? CREAM : c(CREAM, 0.55),
                      transition: 'background 0.15s, color 0.15s',
                      borderLeft: isActive(item.path) ? `3px solid ${c(CREAM, 0.4)}` : '3px solid transparent',
                    }}
                    onMouseEnter={e => {
                      if (!isActive(item.path)) {
                        e.currentTarget.style.background = c(CREAM, 0.05)
                        e.currentTarget.style.color = c(CREAM, 0.85)
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = isActive(item.path) ? FOREST : 'transparent'
                      e.currentTarget.style.color = isActive(item.path) ? CREAM : c(CREAM, 0.55)
                    }}
                  >
                    {Icon && <Icon size={16} style={{ flexShrink: 0 }} />}
                    {sidebarOpen && (
                      <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.02em' }}>
                        {item.label}
                      </span>
                    )}
                  </Link>
                )}

                {/* Submenu */}
                {item.submenu && isExpanded && sidebarOpen && (
                  <div style={{
                    marginTop: 2,
                    marginLeft: 14,
                    paddingLeft: 12,
                    borderLeft: `1.5px solid ${c(FOREST, 0.6)}`,
                  }}>
                    {item.submenu.map(sub => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        style={{
                          display: 'block',
                          padding: '7px 10px',
                          borderRadius: 6,
                          textDecoration: 'none',
                          fontSize: 13.5,
                          fontWeight: isActive(sub.path) ? 600 : 400,
                          letterSpacing: '0.01em',
                          color: isActive(sub.path) ? CREAM : c(CREAM, 0.50),
                          background: isActive(sub.path) ? c(FOREST, 0.30) : 'transparent',
                          marginBottom: 1,
                          transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={e => {
                          if (!isActive(sub.path)) {
                            e.currentTarget.style.background = c(CREAM, 0.06)
                            e.currentTarget.style.color = c(CREAM, 0.85)
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = isActive(sub.path) ? c(FOREST, 0.30) : 'transparent'
                          e.currentTarget.style.color = isActive(sub.path) ? CREAM : c(CREAM, 0.50)
                        }}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User identity strip */}
        {sidebarOpen && user && (
          <div style={{
            padding: '12px 16px',
            borderTop: `1px solid ${c(CREAM, 0.09)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: FOREST,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: CREAM,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: c(CREAM, 0.90), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 10.5, color: c(CREAM, 0.40), letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {user?.role}
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div style={{ padding: '8px', borderTop: `1px solid ${c(CREAM, 0.06)}` }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: c(CREAM, 0.35),
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = c(CREAM, 0.06); e.currentTarget.style.color = c(CREAM, 0.7) }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c(CREAM, 0.35) }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header style={{
          background: '#FFFFFF',
          borderBottom: '1px solid rgba(14,13,12,0.09)',
          padding: '0 24px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          boxShadow: '0 1px 3px rgba(14,13,12,0.05)',
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ color: c(INK, 0.5), padding: '4px', marginRight: 8 }}
            >
              <Menu size={18} />
            </button>
            <span style={{ fontSize: 13, color: c(INK, 0.40), letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
              {crumb}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Install as desktop app (PWA) — only visible when browser supports it */}
            <InstallPWA />

            {/* Help panel toggle */}
            <button
              onClick={toggleHelp}
              title="Help & User Guide"
              aria-label="Open help panel"
              style={{
                padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: helpOpen ? c(FOREST, 0.10) : 'transparent',
                color: helpOpen ? FOREST : c(INK, 0.50),
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = c(FOREST, 0.08); e.currentTarget.style.color = FOREST }}
              onMouseLeave={e => { e.currentTarget.style.background = helpOpen ? c(FOREST, 0.10) : 'transparent'; e.currentTarget.style.color = helpOpen ? FOREST : c(INK, 0.50) }}
            >
              <HelpCircle size={18} />
            </button>

            {/* Activity indicator — clock icon with colour-coded badge */}
            <ActivityIndicator />

            {/* Notifications */}
            <div style={{ position: 'relative', marginLeft: 4 }}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false) }}
                style={{
                  position: 'relative', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: c(INK, 0.50),
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = c(INK, 0.05)}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 17, height: 17,
                    background: FOREST, color: CREAM,
                    borderRadius: '50%', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 320, background: '#fff',
                  border: '1px solid rgba(14,13,12,0.10)', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(14,13,12,0.12)', zIndex: 40,
                }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(14,13,12,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} style={{ fontSize: 11, color: FOREST, border: 'none', background: 'none', cursor: 'pointer' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: c(INK, 0.40) }}>
                        No notifications
                      </div>
                    ) : notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        style={{
                          padding: '12px 16px', borderBottom: '1px solid rgba(14,13,12,0.06)',
                          cursor: 'pointer', background: n.read ? 'transparent' : c(FOREST, 0.04),
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 500, color: INK, marginBottom: 2 }}>{n.title}</p>
                        <p style={{ fontSize: 12, color: c(INK, 0.55) }}>{n.message}</p>
                        <p style={{ fontSize: 11, color: c(INK, 0.35), marginTop: 4 }}>
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div style={{ position: 'relative', marginLeft: 8, paddingLeft: 12, borderLeft: '1px solid rgba(14,13,12,0.10)' }}>
              <button
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px', borderRadius: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = c(INK, 0.04)}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: FOREST, color: CREAM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {initials}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>{displayName}</span>
                <ChevronDown size={13} style={{ color: c(INK, 0.40) }} />
              </button>

              {showUserMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 210, background: '#fff',
                  border: '1px solid rgba(14,13,12,0.10)', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(14,13,12,0.12)', zIndex: 40, overflow: 'hidden',
                }}>
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', fontSize: 13, color: INK, textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = c(INK, 0.04)}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Settings size={14} style={{ color: c(INK, 0.50) }} /> Settings
                  </Link>

                  {/* Modules — admin only */}
                  {user?.role === 'admin' && (
                    <Link
                      to="/settings/modules"
                      onClick={() => setShowUserMenu(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', fontSize: 13, color: INK, textDecoration: 'none', borderBottom: '1px solid rgba(14,13,12,0.06)' }}
                      onMouseEnter={e => e.currentTarget.style.background = c(INK, 0.04)}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Layers size={14} style={{ color: c(INK, 0.50) }} /> Modules
                    </Link>
                  )}

                  {/* Portal switcher — TODO: wire up client.sovernhouse.co + factory.sovernhouse.co (DNS + deploy) on 2026-05-05 */}

                  <button
                    onClick={handleLogout}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', fontSize: 13, color: '#C0392B', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,57,43,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scheduled activity reminder banner — Odoo-style */}
        <ActivityBanner />

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '24px 28px 48px' }}>
            <BreadcrumbProvider>
              <Breadcrumb />
              {children}
            </BreadcrumbProvider>
          </div>
        </main>
      </div>

      {/* Help panel — slides in from right, portal-level z-index */}
      <HelpPanel open={helpOpen} onClose={closeHelp} />

      {/* Chat bubble — fixed bottom-right, always visible on all pages */}
      <ChatBubble />
    </div>
  )
}
