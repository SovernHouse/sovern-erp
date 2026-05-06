import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Chatter from '../../components/Chatter'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'

export default function ShipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  useBreadcrumbs('Shipment')
  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/shipments')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-3xl font-bold">Shipment</h1>
      <div className="bg-white rounded-lg shadow p-6 text-center py-12">
        <p className="text-slate-600">Shipment details and tracking information</p>
      </div>
      <Chatter entityType="Shipment" entityId={id} className="mt-6" />
    </div>
  )
}
