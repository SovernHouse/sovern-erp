import { useState, useEffect, useCallback } from 'react'
import { getSocket, onNotification } from '../services/socket'

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const handleNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev])
      if (!notification.read) {
        setUnreadCount((prev) => prev + 1)
      }
    }

    onNotification(handleNotification)

    return () => {
      const socket = getSocket()
      if (socket) {
        socket.off('notification', handleNotification)
      }
    }
  }, [])

  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    )
    setUnreadCount(0)
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  }
}
