import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { canAccessRoute } from '../config/rbacConfig'

/**
 * RoleGuard — enforces RBAC at the component level.
 *
 * Usage options (mutually exclusive; `permission` takes precedence):
 *   <RoleGuard permission="customers">...</RoleGuard>
 *       Uses ROLE_PERMISSIONS from rbacConfig to check the current user's role.
 *
 *   <RoleGuard allowedRoles={['admin', 'manager']}>...</RoleGuard>
 *       Explicit role list (legacy, still supported).
 *
 * When neither prop is provided, any authenticated user is allowed through.
 */
const RoleGuard = ({ permission, allowedRoles, fallback, children }) => {
  const { user } = useAuth()

  if (!user) {
    return fallback ?? (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  let hasAccess = true

  // super_admin is founder/CEO level — always grants access regardless of
  // permission or role whitelist. Strict superset of admin by definition.
  if (user.role === 'super_admin') {
    hasAccess = true
  } else if (permission) {
    // Primary check: permission key against ROLE_PERMISSIONS map
    hasAccess = canAccessRoute(user.role, permission, user.permissions || null)
  } else if (allowedRoles && !allowedRoles.includes('*')) {
    // Legacy check: explicit role whitelist. Treat 'admin' in the list as
    // implicitly including super_admin (handled above as a blanket allow).
    hasAccess = allowedRoles.includes(user.role)
  }

  if (!hasAccess) {
    return fallback ?? (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div
            className="text-8xl font-bold"
            style={{ color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}
          >
            403
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-500 max-w-sm">
            You don&rsquo;t have permission to view this page. Contact your administrator if you
            think this is a mistake.
          </p>
          <p className="text-sm text-slate-400">
            Your role:{' '}
            <span className="font-semibold text-slate-600 capitalize">
              {user.role?.replace(/_/g, ' ')}
            </span>
          </p>
        </div>
      </div>
    )
  }

  return children
}

export default RoleGuard
