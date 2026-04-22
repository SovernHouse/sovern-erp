import io from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

let socket = null

export const initializeSocket = (token) => {
  if (socket && socket.connected) {
    return socket
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  })

  socket.on('connect', () => {
    console.log('Socket connected')
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected')
  })

  socket.on('error', (error) => {
    console.error('Socket error:', error)
  })

  return socket
}

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('authToken')
    if (token) {
      initializeSocket(token)
    }
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect()
    socket = null
  }
}

// Event listeners
export const onOrderUpdate = (callback) => {
  const s = getSocket()
  if (s) s.on('order:updated', callback)
}

export const onInquiryUpdate = (callback) => {
  const s = getSocket()
  if (s) s.on('inquiry:updated', callback)
}

export const onShipmentUpdate = (callback) => {
  const s = getSocket()
  if (s) s.on('shipment:updated', callback)
}

export const onInvoiceUpdate = (callback) => {
  const s = getSocket()
  if (s) s.on('invoice:updated', callback)
}

export const onNotification = (callback) => {
  const s = getSocket()
  if (s) s.on('notification', callback)
}

export const onPaymentReceived = (callback) => {
  const s = getSocket()
  if (s) s.on('payment:received', callback)
}

// Event emitters
export const emitOrderStatusChange = (orderId, status) => {
  const s = getSocket()
  if (s) s.emit('order:status-change', { orderId, status })
}

export const emitShipmentUpdate = (shipmentId, data) => {
  const s = getSocket()
  if (s) s.emit('shipment:update', { shipmentId, ...data })
}
