import { Activity, Users, Database, TrendingUp } from 'lucide-react'

export default function AuditStats({ stats }) {
  if (!stats || stats.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Total Logs" value="Loading..." />
        <StatCard icon={TrendingUp} label="Create Actions" value="Loading..." />
        <StatCard icon={Database} label="Update Actions" value="Loading..." />
        <StatCard icon={Users} label="Delete Actions" value="Loading..." />
      </div>
    )
  }

  const calculateStats = () => {
    const actionCounts = {}
    stats.forEach(stat => {
      if (stat.action) {
        actionCounts[stat.action] = stat.count || 0
      }
    })
    return actionCounts
  }

  const actionCounts = calculateStats()
  const totalLogs = Object.values(actionCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        icon={Activity}
        label="Total Logs"
        value={totalLogs.toLocaleString()}
        description="All audit activities"
      />
      <StatCard
        icon={TrendingUp}
        label="Create Actions"
        value={(actionCounts['CREATE'] || 0).toLocaleString()}
        description="Records created"
      />
      <StatCard
        icon={Database}
        label="Update Actions"
        value={(actionCounts['UPDATE'] || 0).toLocaleString()}
        description="Records modified"
      />
      <StatCard
        icon={Users}
        label="Delete Actions"
        value={(actionCounts['DELETE'] || 0).toLocaleString()}
        description="Records removed"
      />
    </div>
  )
}

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>
      </div>
    </div>
  )
}
