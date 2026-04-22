import { useEffect, useRef, useCallback } from 'react'
import io from 'socket.io-client'

// Socket event constants for type safety
export const SOCKET_EVENTS = {
  // Order events
  ORDER_STATUS_CHANGED: 'order:statusChanged',
  // Shipment events
  SHIPMENT_UPDATED: 'shipment:updated',
  // Payment events
  PAYMENT_RECEIVED: 'payment:received',
  // Purchase order events
  PURCHASE_ORDER_UPDATED: 'purchaseOrder:updated',
  // Inspection events
  INSPECTION_SCHEDULED: 'inspection:scheduled',
  // Inquiry events
  INQUIRY_NEW: 'inquiry:new',
  // Document events
  DOCUMENT_UPLOADED: 'document:uploaded',
  // Dashboard events
  DASHBOARD_REFRESH: 'dashboard:refresh',
  // Generic notification
  NOTIFICATION: 'notification'
}

/**
 * Custom hook for WebSocket communication using Socket.IO
 * Handles connection, auto-reconnection, and event management
 *
 * @param {string} token - JWT authentication token
 * @returns {Object} Socket instance and helper methods
 */
export const useSocket = (token) => {
  const socketRef = useRef(null)
  const subscribersRef = useRef(new Map())

  // Connect to Socket.IO server
  useEffect(() => {
    if (!token) {
      console.warn('No token provided for Socket.IO connection')
      return
    }

    if (socketRef.current?.connected) {
      return // Already connected
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000'

    socketRef.current = io(socketUrl, {
      auth: {
        token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling']
    })

    socketRef.current.on('connect', () => {
      console.log('Socket.IO connected:', socketRef.current.id)
    })

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason)
    })

    socketRef.current.on('error', (error) => {
      console.error('Socket.IO error:', error)
    })

    // Cleanup on unmount
    return () => {
      if (socketRef.current?.connected) {
        socketRef.current.disconnect()
      }
    }
  }, [token])

  /**
   * Subscribe to a socket event
   * @param {string} event - Event name (use SOCKET_EVENTS constants)
   * @param {function} callback - Callback function for event data
   */
  const subscribe = useCallback((event, callback) => {
    if (!socketRef.current) {
      console.warn('Socket not initialized')
      return
    }

    // Store subscriber for cleanup
    if (!subscribersRef.current.has(event)) {
      subscribersRef.current.set(event, [])
    }
    subscribersRef.current.get(event).push(callback)

    // Set up listener
    socketRef.current.on(event, callback)

    // Return unsubscribe function
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback)
      }
      const subscribers = subscribersRef.current.get(event)
      if (subscribers) {
        const index = subscribers.indexOf(callback)
        if (index > -1) {
          subscribers.splice(index, 1)
        }
      }
    }
  }, [])

  /**
   * Unsubscribe from a socket event
   * @param {string} event - Event name
   * @param {function} callback - Callback function to remove (optional, removes all if not provided)
   */
  const unsubscribe = useCallback((event, callback) => {
    if (!socketRef.current) return

    if (callback) {
      socketRef.current.off(event, callback)
    } else {
      socketRef.current.removeAllListeners(event)
    }

    const subscribers = subscribersRef.current.get(event)
    if (subscribers) {
      if (callback) {
        const index = subscribers.indexOf(callback)
        if (index > -1) {
          subscribers.splice(index, 1)
        }
      } else {
        subscribersRef.current.delete(event)
      }
    }
  }, [])

  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {*} data - Data to emit
   */
  const emit = useCallback((event, data) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket not connected, cannot emit:', event)
      return
    }
    socketRef.current.emit(event, data)
  }, [])

  /**
   * Check if socket is connected
   */
  const isConnected = useCallback(() => {
    return socketRef.current?.connected || false
  }, [])

  return {
    socket: socketRef.current,
    subscribe,
    unsubscribe,
    emit,
    isConnected
  }
}

/**
 * Pre-configured hooks for common socket events
 */

export const useOrderUpdates = (onOrderStatusChanged) => {
  const { subscribe, unsubscribe } = useSocket(localStorage.getItem('authToken'))

  useEffect(() => {
    if (!onOrderStatusChanged) return
    return subscribe(SOCKET_EVENTS.ORDER_STATUS_CHANGED, onOrderStatusChanged)
  }, [subscribe, onOrderStatusChanged])
}

export const useShipmentUpdates = (onShipmentUpdated) => {
  const { subscribe, unsubscribe } = useSocket(localStorage.getItem('authToken'))

  useEffect(() => {
    if (!onShipmentUpdated) return
    return subscribe(SOCKET_EVENTS.SHIPMENT_UPDATED, onShipmentUpdated)
  }, [subscribe, onShipmentUpdated])
}

export const usePaymentUpdates = (onPaymentReceived) => {
  const { subscribe, unsubscribe } = useSocket(localStorage.getItem('authToken'))

  useEffect(() => {
    if (!onPaymentReceived) return
    return subscribe(SOCKET_EVENTS.PAYMENT_RECEIVED, onPaymentReceived)
  }, [subscribe, onPaymentReceived])
}

export const useInquiryUpdates = (onNewInquiry) => {
  const { subscribe, unsubscribe } = useSocket(localStorage.getItem('authToken'))

  useEffect(() => {
    if (!onNewInquiry) return
    return subscribe(SOCKET_EVENTS.INQUIRY_NEW, onNewInquiry)
  }, [subscribe, onNewInquiry])
}

export const useDashboardRefresh = (onDashboardRefresh) => {
  const { subscribe, unsubscribe } = useSocket(localStorage.getItem('authToken'))

  useEffect(() => {
    if (!onDashboardRefresh) return
    return subscribe(SOCKET_EVENTS.DASHBOARD_REFRESH, onDashboardRefresh)
  }, [subscribe, onDashboardRefresh])
}

export const useNotifications = (onNotification) => {
  const { subscribe, unsubscribe } = useSocket(localStorage.getItem('authToken'))

  useEffect(() => {
    if (!onNotification) return
    return subscribe(SOCKET_EVENTS.NOTIFICATION, onNotification)
  }, [subscribe, onNotification])
}

export default useSocket
