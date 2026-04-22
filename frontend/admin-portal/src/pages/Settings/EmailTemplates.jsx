import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import { settingsAPI } from '../../services/api'

export default function EmailTemplates() {
  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await settingsAPI.getEmailTemplates()
        setTemplates(res.data || [])
      } catch (e) {
        toast.error('Failed to load templates')
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Email Templates</h1>

      <div className="bg-white rounded-lg shadow">
        <DataTable columns={[{ key: 'name', label: 'Template Name' }, { key: 'description', label: 'Description' }]} data={templates} isLoading={isLoading} />
      </div>
    </div>
  )
}
