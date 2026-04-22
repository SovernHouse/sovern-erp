import { STATUS_COLOR_MAP } from '../utils/constants'

const colorClasses = {
  gray: 'bg-gray-100 text-gray-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  purple: 'bg-purple-100 text-purple-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  orange: 'bg-orange-100 text-orange-800',
}

export default function StatusBadge({ status, className = '' }) {
  const colorKey = STATUS_COLOR_MAP[status] || 'gray'
  const colorClass = colorClasses[colorKey] || colorClasses.gray

  const displayText =
    status
      ?.replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Unknown'

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClass} ${className}`}
    >
      {displayText}
    </span>
  )
}
