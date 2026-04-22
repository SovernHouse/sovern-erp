import React, { useMemo } from 'react'
import { MapPin, Ship } from 'lucide-react'

export default function ShipmentMap({ origin, destination, currentLocation, progress = 0 }) {
  const points = useMemo(() => {
    return [origin, currentLocation, destination].filter(Boolean)
  }, [origin, currentLocation, destination])

  // Calculate positions for SVG visualization
  const startX = 80
  const endX = 520
  const y = 100

  const getXPosition = (index) => {
    if (points.length === 1) return (startX + endX) / 2
    return startX + (index / (points.length - 1)) * (endX - startX)
  }

  return (
    <div className="w-full">
      <div className="relative bg-gradient-to-b from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-200">
        {/* SVG Container */}
        <svg width="100%" height="200" viewBox="0 0 600 200" className="mb-6">
          {/* Ocean background */}
          <defs>
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#87CEEB" />
              <stop offset="100%" stopColor="#4A90E2" />
            </linearGradient>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>

          {/* Water waves decoration */}
          <rect width="600" height="200" fill="url(#oceanGradient)" opacity="0.2" />

          {/* Connection line */}
          <line x1={startX} y1={y} x2={endX} y2={y} stroke="#d1d5db" strokeWidth="2" />

          {/* Progress line */}
          <line
            x1={startX}
            y1={y}
            x2={startX + (endX - startX) * (progress / 100)}
            y2={y}
            stroke="url(#progressGradient)"
            strokeWidth="3"
            className="transition-all duration-500"
          />

          {/* Origin Point */}
          {origin && (
            <>
              <circle cx={startX} cy={y} r="8" fill="#4f46e5" />
              <circle cx={startX} cy={y} r="12" fill="#4f46e5" opacity="0.2" />
            </>
          )}

          {/* Current Location (animated) */}
          {currentLocation && (
            <>
              <g>
                <circle
                  cx={getXPosition(1)}
                  cy={y}
                  r="8"
                  fill="#f59e0b"
                  className="animate-pulse"
                />
                <circle
                  cx={getXPosition(1)}
                  cy={y}
                  r="15"
                  fill="#f59e0b"
                  opacity="0.2"
                  className="animate-ping"
                />
              </g>
              {/* Ship icon */}
              <text
                x={getXPosition(1)}
                y={y - 25}
                textAnchor="middle"
                fontSize="20"
                className="animate-bounce-gentle"
              >
                🚢
              </text>
            </>
          )}

          {/* Destination Point */}
          {destination && (
            <>
              <circle cx={endX} cy={y} r="8" fill="#22c55e" />
              <circle cx={endX} cy={y} r="12" fill="#22c55e" opacity="0.2" />
            </>
          )}
        </svg>

        {/* Location Labels */}
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          {/* Origin */}
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <MapPin size={16} className="text-primary-600" />
              <span className="font-semibold text-gray-900">Origin</span>
            </div>
            <p className="text-gray-600">{origin?.name || origin?.code || 'Loading...'}</p>
            {origin?.country && (
              <p className="text-xs text-gray-500">{origin.country}</p>
            )}
          </div>

          {/* Current Location */}
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Ship size={16} className="text-amber-600 animate-bounce-gentle" />
              <span className="font-semibold text-gray-900">Current</span>
            </div>
            <p className="text-gray-600">
              {currentLocation?.name || currentLocation?.code || 'In Transit'}
            </p>
            {currentLocation?.country && (
              <p className="text-xs text-gray-500">{currentLocation.country}</p>
            )}
          </div>

          {/* Destination */}
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <MapPin size={16} className="text-accent-600" />
              <span className="font-semibold text-gray-900">Destination</span>
            </div>
            <p className="text-gray-600">{destination?.name || destination?.code || 'Loading...'}</p>
            {destination?.country && (
              <p className="text-xs text-gray-500">{destination.country}</p>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Journey Progress</span>
            <span className="text-sm font-bold text-primary-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}
