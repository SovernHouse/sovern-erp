import React from 'react'
import { formatDateTime } from '../utils/formatters'
import { MapPin, Calendar, CheckCircle } from 'lucide-react'

export default function ShipmentTimeline({ events = [] }) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  )

  return (
    <div className="space-y-4">
      {sortedEvents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No tracking events yet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-600 to-accent-500"></div>

          {/* Timeline Events */}
          <div className="space-y-6">
            {sortedEvents.map((event, index) => (
              <div key={event.id || index} className="relative pl-20">
                {/* Timeline Dot */}
                <div className="absolute left-0 top-2 w-12 h-12 bg-white border-4 border-primary-600 rounded-full flex items-center justify-center shadow-md">
                  <CheckCircle size={20} className="text-primary-600" />
                </div>

                {/* Content Card */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{event.status}</h4>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <MapPin size={16} className="text-primary-600 flex-shrink-0" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  {event.description && (
                    <p className="text-sm text-gray-700">{event.description}</p>
                  )}

                  {event.details && (
                    <div className="mt-3 bg-gray-50 rounded p-3 text-sm space-y-1">
                      {Object.entries(event.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-600">{key}:</span>
                          <span className="font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
