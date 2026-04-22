import React from 'react'
import { useAuth } from '../hooks/useAuth'

const RoleGuard = ({ allowedRoles, fallback, children }) => {
  const { user } = useAuth()

  // If user is not loaded yet
  if (!user) {
    return fallback ? (
      fallback
    ) : (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  // Check if user's role is in allowedRoles
  const hasAccess = allowedRoles.includes(user.role) || allowedRoles.includes('*')

  if (!hasAccess) {
    return fallback ? (
      fallback
    ) : (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-6xl text-slate-300">⛔</div>
          <h1 className="text-2xl font-bold text-slate-900">Unauthorized Access</h1>
          <p className="text-slate-600">
            You do not have permission to access this resource.
          </p>
          <p className="text-sm text-slate-500">
            Your role: <span className="font-semibold">{user.role}</span>
          </p>
        </div>
      </div>
    )
  }

  return children
}

export default RoleGuard
