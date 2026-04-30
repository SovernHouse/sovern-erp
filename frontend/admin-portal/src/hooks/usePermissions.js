import { useAuth } from './useAuth'
import { canAccessRoute, ROLE_PERMISSIONS } from '../config/rbacConfig'

/**
 * usePermissions — access-control helper for page components.
 *
 * const { hasPermission, hasRole, isAdmin, role } = usePermissions()
 *
 * hasPermission('invoices')   → true if the current user's role grants 'invoices'
 * hasRole('ceo')              → true if the user's role is exactly 'ceo'
 * isAdmin                     → shorthand for hasPermission('*') / role === 'admin'
 */
export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role ?? null
  // Custom roles from the DB may carry a `permissions` array on the user object.
  const dynamicPermissions = user?.permissions ?? null

  const hasPermission = (key) => {
    if (!role) return false
    return canAccessRoute(role, key, dynamicPermissions)
  }

  const hasRole = (r) => role === r

  // Admin is anyone whose role maps to the ['*'] permission set.
  const permissions = dynamicPermissions ?? ROLE_PERMISSIONS[role] ?? []
  const isAdmin = permissions.includes('*')

  return { hasPermission, hasRole, isAdmin, role, permissions }
}
