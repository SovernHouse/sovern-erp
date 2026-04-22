import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PurchaseOrderDetail() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/purchase-orders')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-3xl font-bold">Purchase Order</h1>
      <div className="bg-white rounded-lg shadow p-6 text-center py-12">
        <p className="text-slate-600">Details will be displayed here</p>
      </div>
    </div>
  )
}
