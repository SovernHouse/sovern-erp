import { useEffect } from 'react'

/**
 * useAutoChainRefresh — Phase 4.26c.
 *
 * Subscribes the calling component to the window-level CustomEvent
 * `autoChain:created` (dispatched by useNotifications when a Socket.IO
 * notification arrives with type='auto_chain'). When the event matches
 * the entityType this list cares about, calls refetch() to pull the new
 * downstream record into the list view without a manual reload.
 *
 * Usage:
 *   useAutoChainRefresh('ProformaInvoice', fetchProformas)
 *   useAutoChainRefresh('SalesOrder', fetchSalesOrders)
 *   ...
 *
 * The entityType must match the value emitted by the backend
 * workflowService (see services/workflowService.js, the `notifyAutoChain`
 * helper). Current values used by the chain:
 *   ProformaInvoice, SalesOrder, PurchaseOrder, GoodsReceivedNote,
 *   Invoice, PackingList
 */
export const useAutoChainRefresh = (entityType, refetch) => {
  useEffect(() => {
    const handler = (e) => {
      if (e.detail && e.detail.entityType === entityType) {
        try { refetch() } catch (_) { /* ignore */ }
      }
    }
    window.addEventListener('autoChain:created', handler)
    return () => window.removeEventListener('autoChain:created', handler)
  }, [entityType, refetch])
}

export default useAutoChainRefresh
