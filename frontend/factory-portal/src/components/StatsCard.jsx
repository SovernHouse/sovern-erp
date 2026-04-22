import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  onClick,
  isLoading,
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow p-6 border-l-4 border-factory-600 ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {isLoading ? (
            <div className="mt-2 h-8 bg-gray-200 rounded animate-pulse w-24"></div>
          ) : (
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="bg-factory-100 p-3 rounded-lg">
            <Icon size={24} className="text-factory-600" />
          </div>
        )}
      </div>

      {trend && trendValue && (
        <div className="mt-4 flex items-center gap-2">
          {trend === 'up' ? (
            <TrendingUp size={16} className="text-green-600" />
          ) : (
            <TrendingDown size={16} className="text-red-600" />
          )}
          <span className={trend === 'up' ? 'text-green-600' : 'text-red-600'}>
            {trend === 'up' ? '+' : ''}{trendValue}%
          </span>
        </div>
      )}
    </div>
  );
}

export default StatsCard;
