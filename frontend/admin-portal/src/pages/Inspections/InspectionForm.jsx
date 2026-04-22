import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { TextInput } from '../../components/FormFields'

export default function InspectionForm() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/inspections')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">Schedule Inspection</h1>
      </div>
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={(e) => { e.preventDefault(); toast.success('Created'); navigate('/inspections'); }} className="space-y-4">
          <TextInput label="Order" required />
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg">Schedule</button>
        </form>
      </div>
    </div>
  )
}
