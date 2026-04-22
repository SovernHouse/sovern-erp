import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatsCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  color = 'primary',
}) {
  const colorClasses = {
    primary: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  }

  const trendColor = trend > 0 ? 'text-green-600' : 'text-red-600'
  const TrendIcon = trend > 0 ? TrendingUp : TrendingDown

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600 font-medium">{label}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
          {trend !== undefined && (
            <div className="flex items-center mt-2">
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className={`ml-1 text-sm ${trendColor}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && (
                <span className="text-xs text-slate-500 ml-2">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  )
}
