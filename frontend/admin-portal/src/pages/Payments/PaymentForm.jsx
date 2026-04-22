import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { TextInput, CurrencyInput, DateInput } from '../../components/FormFields'

export default function PaymentForm() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/payments')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">Record Payment</h1>
      </div>
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={(e) => { e.preventDefault(); toast.success('Payment recorded'); navigate('/payments'); }} className="space-y-4">
          <TextInput label="Invoice" required />
          <CurrencyInput label="Amount" required />
          <DateInput label="Payment Date" required />
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg">Record</button>
        </form>
      </div>
    </div>
  )
}
