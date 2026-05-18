import { useState, useContext, createContext, useCallback } from 'react'
import { authAPI } from '../services/api'
import { initializeSocket, disconnectSocket } from '../services/socket'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // 2026-05-18 hardening: don't trust localStorage.user without
    // localStorage.authToken. Otherwise the UI shows a stale "logged
    // in" state while every API call lands as anonymous, which is
    // exactly the situation that masked the BrandsContext failure
    // (UNKNOWN BRAND symptom). Clear both if either is missing.
    const savedUser = localStorage.getItem('user')
    const savedToken = localStorage.getItem('authToken')
    if (savedUser && savedToken) {
      try { return JSON.parse(savedUser) } catch (_) { /* fall through */ }
    }
    // Wipe inconsistent half-state so the next render sees a clean slate.
    localStorage.removeItem('user')
    localStorage.removeItem('authToken')
    return null
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = useCallback(async (email, password) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await authAPI.login({ email, password })
      // Response interceptor already unwraps { success, data } envelope
      const responseData = response.data
      const userData = responseData.user
      const token = responseData.tokens?.accessToken || responseData.token

      // 2026-05-18 hardening: refuse to "succeed" if the server didn't
      // hand back a token. The previous version stored undefined as the
      // string "undefined" in localStorage, which would later attach
      // `Authorization: Bearer undefined` to every request and look
      // like a logged-in session that the backend silently rejected.
      if (!token || !userData) {
        const message = 'Login response missing token or user — please try again.'
        setError(message)
        return { success: false, error: message }
      }

      localStorage.setItem('authToken', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)

      try { initializeSocket(token) } catch(e) { console.warn('Socket init failed:', e) }

      return { success: true }
    } catch (err) {
      let message
      if (err.code === 'ERR_NETWORK' || !err.response) {
        message = 'Cannot connect to server. Please ensure the backend is running on port 5000.'
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        message = err.response?.data?.error?.message || 'Invalid email or password'
      } else if (err.response?.status === 422 || err.response?.status === 400) {
        message = err.response?.data?.error?.message || err.response?.data?.message || 'Validation error. Check your input.'
      } else {
        message = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Login failed. Server returned status ' + (err.response?.status || 'unknown')
      }
      console.error('[Login Error]', { status: err.response?.status, code: err.code, data: err.response?.data, message: err.message })
      setError(message)
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authAPI.logout()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      disconnectSocket()
      setUser(null)
      setError(null)
      // Phase 5c: wipe the offline read cache so a different user
      // logging in on this browser can't see the previous user's data
      // (brand isolation must hold across logout, online or offline).
      try {
        const { clearAll } = await import('../services/offlineCache')
        await clearAll()
      } catch (_) { /* never block logout on cache wipe */ }
    }
  }, [])

  const updateUser = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const forgotPassword = useCallback(async (email) => {
    setIsLoading(true)
    setError(null)
    try {
      await authAPI.forgotPassword(email)
      return { success: true }
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to send reset email. Please try again.'
      setError(message)
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resetPassword = useCallback(async (token, password) => {
    setIsLoading(true)
    setError(null)
    try {
      await authAPI.resetPassword(token, password)
      return { success: true }
    } catch (err) {
      const message =
        err.response?.data?.error?.message || err.response?.data?.message || 'Failed to reset password.'
      setError(message)
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    updateUser,
    forgotPassword,
    resetPassword,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
