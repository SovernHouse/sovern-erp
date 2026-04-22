import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import AuditFilters from './AuditFilters'
import AuditLogTable from './AuditLogTable'
import AuditStats from './AuditStats'
import LoadingSpinner from '../../components/LoadingSpinner'
import { auditAPI } from '../../services/api'

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    action: null,
    entity: null,
    hoursBack: 24
  })

  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [page, limit, filters])

  const fetchLogs = async () => {
    try {
      setIsLoading(true)
      const params = {
        page,
        limit,
        ...filters
      }
      const res = await auditAPI.getAll(params)
      // Interceptor unwraps { success, data } — res.data is the array, pagination on res.pagination
      setLogs(Array.isArray(res.data) ? res.data : (res.data?.data || []))
      setTotal(res.pagination?.totalCount || res.data?.total || 0)
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      toast.error('Failed to load audit logs')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await auditAPI.getStats(filters)
      setStats(Array.isArray(res.data) ? res.data : (res.data?.data || []))
    } catch (error) {
      console.error('Failed to fetch audit stats:', error)
    }
  }

  const handleExport = async () => {
    try {
      const res = await auditAPI.exportCSV(filters)
      const url = window.URL.createObjectURL(res)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Audit logs exported successfully')
    } catch (error) {
      console.error('Failed to export audit logs:', error)
      toast.error('Failed to export audit logs')
    }
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Audit Trail</h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <AuditStats stats={stats} />

      {/* Filters */}
      <AuditFilters filters={filters} onChange={handleFilterChange} />

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <AuditLogTable
            logs={logs}
            page={page}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>
    </div>
  )
}
