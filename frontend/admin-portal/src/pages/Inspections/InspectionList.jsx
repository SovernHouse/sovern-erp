import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { inspectionsAPI } from '../../services/api'

export default function InspectionList() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await inspectionsAPI.getAll()
        setData(res.data || [])
      } catch (e) {
        toast.error('Failed to load')
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Inspections</h1>
        <button onClick={() => navigate('/inspections/new')} className="px-4 py-2 bg-primary-600 text-white rounded-lg">
          <Plus className="w-4 h-4 inline mr-2" />
          New Inspection
        </button>
      </div>
      <div className="bg-white rounded-lg shadow">
        <DataTable columns={[{ key: 'inspectionNumber', label: 'ID' }, { key: 'order', label: 'Order' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} data={data} isLoading={isLoading} onEdit={(i) => navigate(`/inspections/${i.id}`)} />
      </div>
    </div>
  )
}
