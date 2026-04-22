import { useState, useContext, createContext, useCallback } from 'react'
import { authAPI } from '../services/api'
import { initializeSocket, disconnectSocket } from '../services/socket'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
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
