import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2 } from 'lucide-react'

export default function InquiryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/inquiries')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Inquiry INQ-001</h1>
        </div>
        <button onClick={() => navigate(`/inquiries/${id}/edit`)} className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Edit2 className="w-4 h-4" />
          <span>Edit</span>
        </button>
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
    </div>
  )
}
