import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import { settingsAPI } from '../../services/api'
import { formatDateTime } from '../../utils/formatters'

export default function SystemLog() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await settingsAPI.getSystemLogs()
        setLogs(res.data || [])
      } catch (e) {
        toast.error('Failed to load logs')
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">System Audit Log</h1>

      <div className="bg-white rounded-lg shadow">
        <DataTable 
          columns={[
            { key: 'timestamp', label: 'Time', render: (r) => formatDateTime(r.timestamp) },
            { key: 'user', label: 'User' },
            { key: 'action', label: 'Action' },
            { key: 'entity', label: 'Entity' },
          ]}
          data={logs}
          isLoading={isLoading}
          paginated={true}
        />
      </div>
    </div>
  )
}
