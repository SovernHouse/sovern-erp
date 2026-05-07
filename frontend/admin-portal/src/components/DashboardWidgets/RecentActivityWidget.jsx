import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, FileText, Package, Truck, DollarSign, AlertCircle,
  CalendarClock, Phone, Mail, MessageSquare, ClipboardList, ArrowUpRight,
} from 'lucide-react'
import LoadingSpinner from '../LoadingSpinner'
import api from '../../services/api'

/**
 * RecentActivityWidget — what's been happening lately. Sourced from
 * /api/scheduled-activities/my so it reflects real CRM/ERP work
 * (calls, meetings, follow-ups, approvals) rather than mock data.
 *
 * Each row jumps to the underlying entity (Lead, Order, Quotation, etc.).
 */
export default function RecentActivityWidget() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/scheduled-activities/my')
        if (cancelled) return
        const list = Array.isArray(res.data) ? res.data : []
        // Newest activity first (createdAt or dueDate, whichever is later).
        list.sort((a, b) => {
          const ta = new Date(a.createdAt || a.dueDate || 0).getTime()
          const tb = new Date(b.createdAt || b.dueDate || 0).getTime()
          return tb - ta
        })
        setActivities(list.slice(0, 8))
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error?.message || 'Failed to load activity')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function iconAndColor(activity) {
    const t = String(activity.type || '').toLowerCase()
    if (t === 'call')     return { Icon: Phone,         className: 'bg-blue-50 text-blue-600' }
    if (t === 'meeting')  return { Icon: CalendarClock, className: 'bg-indigo-50 text-indigo-600' }
    if (t === 'email')    return { Icon: Mail,          className: 'bg-purple-50 text-purple-600' }
    if (t === 'follow_up'|| t === 'task')
                          return { Icon: ClipboardList, className: 'bg-slate-50 text-slate-600' }
    if (t === 'approve')  return { Icon: AlertCircle,   className: 'bg-amber-50 text-amber-600' }
    if (t === 'note')     return { Icon: MessageSquare, className: 'bg-emerald-50 text-emerald-600' }
    // Fallback by entity type
    const e = String(activity.entityType || '').toLowerCase()
    if (e === 'salesorder' || e === 'order') return { Icon: Package,     className: 'bg-blue-50 text-blue-600' }
    if (e === 'shipment')                    return { Icon: Truck,       className: 'bg-green-50 text-green-600' }
    if (e === 'invoice'  || e === 'payment') return { Icon: DollarSign,  className: 'bg-emerald-50 text-emerald-600' }
    if (e === 'lead'     || e === 'contact') return { Icon: User,        className: 'bg-indigo-50 text-indigo-600' }
    if (e === 'document')                    return { Icon: FileText,    className: 'bg-purple-50 text-purple-600' }
    return { Icon: ClipboardList, className: 'bg-slate-50 text-slate-600' }
  }

  function routeFor(activity) {
    const e = String(activity.entityType || '').toLowerCase()
    const id = activity.entityId
    if (!id) return null
    if (e === 'lead')                       return `/crm/leads/${id}`
    if (e === 'contact')                    return `/crm/contacts/${id}`
    if (e === 'factory')                    return `/factories/${id}`
    if (e === 'customer')                   return `/customers/${id}`
    if (e === 'salesorder' || e === 'order')return `/orders/${id}`
    if (e === 'purchaseorder')              return `/purchase-orders/${id}`
    if (e === 'quotation')                  return `/quotations/${id}`
    if (e === 'invoice')                    return `/invoices/${id}`
    if (e === 'product')                    return `/products/${id}`
    return null
  }

  function relativeTime(dateStr) {
    if (!dateStr) return ''
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diffMs / 60000)
    if (min < 1)  return 'just now'
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24)  return `${hr}h ago`
    const d = Math.floor(hr / 24)
    if (d < 7)    return `${d}d ago`
    return new Date(dateStr).toLocaleDateString()
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

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <ClipboardList className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm">No scheduled activity yet.</p>
        <p className="text-xs mt-1">Schedule a follow-up from any lead, contact, or order.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => {
        const { Icon, className } = iconAndColor(activity)
        const route = routeFor(activity)
        return (
          <button
            key={activity.id}
            onClick={() => route && navigate(route)}
            disabled={!route}
            className={`w-full flex items-start gap-3 p-3 rounded transition-colors text-left ${
              route ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className={`p-2 rounded-lg flex-shrink-0 ${className}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {activity.summary || activity.type || 'Activity'}
              </p>
              {activity.notes && (
                <p className="text-xs text-slate-600 truncate">{activity.notes}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">
                  {activity.entityType || 'general'}{activity.entityType && activity.entityId ? ` · ${String(activity.entityId).slice(0, 8)}` : ''}
                </span>
                <span className="text-xs text-slate-400">{relativeTime(activity.createdAt || activity.dueDate)}</span>
              </div>
            </div>
            {route && <ArrowUpRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />}
          </button>
        )
      })}
    </div>
  )
}
