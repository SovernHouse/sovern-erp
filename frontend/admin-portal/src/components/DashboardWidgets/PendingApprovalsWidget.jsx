import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import LoadingSpinner from '../LoadingSpinner'
import api from '../../services/api'

/**
 * PendingApprovalsWidget — items waiting for the current user.
 *
 * Sources, in this order:
 *   1. Internal approval requests routed to me (/api/internal-approvals?status=pending)
 *   2. ScheduledActivity items of type 'approve' assigned to me
 *      (/api/scheduled-activities/my, then filter type='approve')
 *
 * Each row is clickable: jumps to the entity detail page when we know
 * the type, or falls back to the master /internal-approvals list.
 */
export default function PendingApprovalsWidget() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [internalRes, scheduledRes] = await Promise.allSettled([
          api.get('/internal-approvals', { params: { status: 'pending', limit: 50 } }),
          api.get('/scheduled-activities/my'),
        ])

        if (cancelled) return

        const internal = (internalRes.status === 'fulfilled' && Array.isArray(internalRes.value.data))
          ? internalRes.value.data.map((row) => ({
              key: `ia-${row.id}`,
              kind: 'internal',
              type: row.entityType || 'Approval',
              description: row.description || row.title || `${row.entityType} #${row.entityId}`,
              priority: row.priority || 'medium',
              createdAt: row.createdAt,
              entityType: row.entityType,
              entityId: row.entityId,
            }))
          : []

        const sched = (scheduledRes.status === 'fulfilled' && Array.isArray(scheduledRes.value.data))
          ? scheduledRes.value.data
              .filter((a) => a.type === 'approve')
              .map((row) => ({
                key: `sa-${row.id}`,
                kind: 'scheduled',
                type: row.entityType || 'Task',
                description: row.summary || row.notes || `${row.entityType} #${row.entityId}`,
                priority: row.priority || 'medium',
                createdAt: row.createdAt,
                entityType: row.entityType,
                entityId: row.entityId,
              }))
          : []

        setItems([...internal, ...sched])
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error?.message || 'Failed to load approvals')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function ageInDays(dateStr) {
    if (!dateStr) return 0
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
  }

  // Map the entity type to its detail route. Keep this simple — anything
  // we don't have an explicit route for falls back to the central
  // /internal-approvals list.
  function routeFor(item) {
    if (!item.entityType || !item.entityId) return '/internal-approvals'
    const t = String(item.entityType).toLowerCase()
    if (t === 'product')           return `/products/${item.entityId}`
    if (t === 'quotation')         return `/quotations/${item.entityId}`
    if (t === 'salesorder' || t === 'order') return `/orders/${item.entityId}`
    if (t === 'purchaseorder')     return `/purchase-orders/${item.entityId}`
    if (t === 'invoice')           return `/invoices/${item.entityId}`
    if (t === 'lead')              return `/crm/leads/${item.entityId}`
    return '/internal-approvals'
  }

  function priorityClasses(priority) {
    switch (priority) {
      case 'high':   return 'bg-red-50 border-red-200'
      case 'medium': return 'bg-yellow-50 border-yellow-200'
      default:       return 'bg-green-50 border-green-200'
    }
  }
  function priorityChip(priority) {
    switch (priority) {
      case 'high':   return 'bg-red-200 text-red-900'
      case 'medium': return 'bg-yellow-200 text-yellow-900'
      default:       return 'bg-green-200 text-green-900'
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  const totalCount = items.length
  const highPriority = items.filter((i) => i.priority === 'high').length

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 mb-2">
        <button
          onClick={() => navigate('/internal-approvals')}
          className="p-3 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 text-left transition-colors"
        >
          <p className="text-xs text-red-700 font-medium">Pending</p>
          <p className="text-2xl font-bold text-red-900">{totalCount}</p>
        </button>
        <button
          onClick={() => navigate('/internal-approvals?priority=high')}
          className="p-3 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 text-left transition-colors"
        >
          <p className="text-xs text-orange-700 font-medium">High Priority</p>
          <p className="text-2xl font-bold text-orange-900">{highPriority}</p>
        </button>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-6 text-slate-500">
          <CheckCircle2 className="w-8 h-8 mx-auto text-green-400 mb-2" />
          <p className="text-sm">Nothing waiting on you. Inbox zero.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.slice(0, 8).map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(routeFor(item))}
              className={`w-full text-left p-3 rounded-lg border transition-shadow hover:shadow-sm ${priorityClasses(item.priority)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-slate-200 rounded">
                      {item.type}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityChip(item.priority)}`}>
                      {String(item.priority).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-1.5 truncate">{item.description}</p>
                  <div className="flex items-center gap-1 mt-1 text-slate-600">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{ageInDays(item.createdAt)} day{ageInDays(item.createdAt) === 1 ? '' : 's'} old</span>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {totalCount > 0 && (
        <button
          onClick={() => navigate('/internal-approvals')}
          className="w-full pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600 hover:text-blue-600"
        >
          <span>Showing {Math.min(items.length, 8)} of {items.length}</span>
          <span className="flex items-center gap-1">View all <ArrowUpRight className="w-3 h-3" /></span>
        </button>
      )}
    </div>
  )
}
