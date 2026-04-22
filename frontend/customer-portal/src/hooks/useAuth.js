import { useState, useCallback } from 'react'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

export const useAuth = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authAPI.login({ email, password })
      const responseData = response.data.data || response.data
      const user = responseData.user
      const token = responseData.tokens?.accessToken || responseData.token
      localStorage.setItem('authToken', token)
      localStorage.setItem('user', JSON.stringify(user))
      return { user, token }
    } catch (err) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Login failed'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const forgotPassword = useCallback(async (email) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authAPI.forgotPassword(email)
      toast.success('Password reset email sent')
      return response.data
    } catch (err) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send reset email'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const resetPassword = useCallback(async (token, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authAPI.resetPassword(token, password)
      toast.success('Password reset successfully')
      return response.data
    } catch (err) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to reset password'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getProfile = useCallback(async () => {
    try {
      const response = await authAPI.getProfile()
      return response.data
    } catch (err) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to fetch profile'
      setError(message)
      throw err
    }
  }, [])

  const updateProfile = useCallback(async (data) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authAPI.updateProfile(data)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      toast.success('Profile updated successfully')
      return response.data
    } catch (err) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update profile'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authAPI.changePassword({ oldPassword, newPassword })
      toast.success('Password changed successfully')
      return response.data
    } catch (err) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to change password'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    login,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile,
    changePassword,
    loading,
    error,
  }
}
