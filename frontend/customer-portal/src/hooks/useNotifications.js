import { useState, useCallback, useEffect } from 'react'
import { notificationsAPI } from '../services/api'
import toast from 'react-hot-toast'

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await notificationsAPI.list()
      const data = response.data.notifications || []
      setNotifications(data)
      const unread = data.filter((n) => !n.read).length
      setUnreadCount(unread)
      return data
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch notifications'
      setError(message)
      console.error(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (err) {
      console.error('Failed to mark all as read:', err)
      toast.error('Failed to mark notifications as read')
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  }
}
