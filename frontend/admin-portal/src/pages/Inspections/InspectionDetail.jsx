import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarClock } from 'lucide-react'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import ChatterPanel from '../../components/ChatterPanel'

export default function InspectionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showActivityModal, setShowActivityModal] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/inspections')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowActivityModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <CalendarClock className="w-4 h-4" />
          <span>Schedule Activity</span>
        </button>
      </div>
      <h1 className="text-3xl font-bold">Inspection Report</h1>
      <div className="bg-white rounded-lg shadow p-6 text-center py-12">
        <p className="text-slate-600">Inspection details and checklist</p>
      </div>

      <ChatterPanel entityType="Inspection" entityId={id} />

      <ScheduleActivityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onCreated={() => setShowActivityModal(false)}
        entityType="Inspection"
        entityId={id}
        entityLabel={`Inspection ${id}`}
      />
    </div>
  )
}
