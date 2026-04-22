import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

export function useNotifications() {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Initialize Socket.IO connection
    socketRef.current = io(window.location.origin, {
      auth: {
        token,
      },
    });

    // Listen for purchase order notifications
    socketRef.current.on('po:status_changed', (data) => {
      toast(`PO ${data.poNumber} status changed to ${data.status}`, {
        icon: '📋',
      });
    });

    // Listen for production updates
    socketRef.current.on('production:completed', (data) => {
      toast(`Production for ${data.itemName} completed!`, {
        icon: '✅',
      });
    });

    // Listen for shipment updates
    socketRef.current.on('shipment:status_changed', (data) => {
      toast(`Shipment ${data.shipmentId} ${data.status}`, {
        icon: '📦',
      });
    });

    // Listen for inspection notifications
    socketRef.current.on('inspection:scheduled', (data) => {
      toast(`Inspection scheduled for ${data.date}`, {
        icon: '🔍',
      });
    });

    // Listen for price update notifications
    socketRef.current.on('price:updated', (data) => {
      toast(`Price updated for ${data.productName}`, {
        icon: '💰',
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    socket: socketRef.current,
  };
}
