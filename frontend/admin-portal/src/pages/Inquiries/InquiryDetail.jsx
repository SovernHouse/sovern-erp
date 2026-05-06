import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, CalendarClock } from 'lucide-react'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import ChatterPanel from '../../components/ChatterPanel'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'

export default function InquiryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  useBreadcrumbs('Inquiry')
  const [showActivityModal, setShowActivityModal] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/inquiries')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Inquiry INQ-001</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowActivityModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Schedule Activity</span>
          </button>
          <button onClick={() => navigate(`/inquiries/${id}/edit`)} className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-600">Customer</p>
            <p className="text-lg font-semibold text-slate-900">Sample Customer</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Date</p>
            <p className="text-lg font-semibold text-slate-900">2024-01-15</p>
          </div>
        </div>
      </div>

      <ChatterPanel entityType="Inquiry" entityId={id} />

      <ScheduleActivityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onCreated={() => setShowActivityModal(false)}
        entityType="Inquiry"
        entityId={id}
        entityLabel={`Inquiry ${id}`}
      />
    </div>
  )
}
