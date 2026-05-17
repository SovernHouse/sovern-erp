import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { getSocket, onNotification } from '../services/socket'

/**
 * Phase 4.26b: when an auto_chain notification arrives, dispatch a
 * window-level CustomEvent that list pages can subscribe to in order
 * to refetch their data. Also surface a toast so the actor sees the
 * downstream record landed.
 *
 * List pages listen via:
 *   useEffect(() => {
 *     const onChain = (e) => {
 *       if (e.detail.entityType === 'ProformaInvoice') refetchProformaList();
 *     };
 *     window.addEventListener('autoChain:created', onChain);
 *     return () => window.removeEventListener('autoChain:created', onChain);
 *   }, []);
 */

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const handleNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev])
      if (!notification.read) {
        setUnreadCount((prev) => prev + 1)
      }

      // Phase 4.26b: auto_chain notifications signal a downstream
      // record was just created (or status auto-transitioned). Toast
      // the actor and dispatch a window event so list pages refetch.
      if (notification.type === 'auto_chain' && notification.data) {
        const data = notification.data
        toast.success(notification.message || `${data.entityType} auto-created`, {
          duration: 4500,
        })
        try {
          window.dispatchEvent(new CustomEvent('autoChain:created', {
            detail: data,
          }))
        } catch (_) { /* CustomEvent unsupported in this browser; silently skip */ }
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
