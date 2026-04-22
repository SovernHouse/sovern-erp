import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDate } from '../utils/formatters';

function Timeline({ events, isLoading }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={24} className="text-green-600" />;
      case 'in_progress':
        return <Clock size={24} className="text-factory-600 animate-spin" />;
      case 'pending':
        return <Clock size={24} className="text-gray-400" />;
      default:
        return <AlertCircle size={24} className="text-red-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-factory-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events && events.length > 0 ? (
        events.map((event, index) => (
          <div key={index} className="flex gap-4">
            {/* Timeline line and icon */}
            <div className="flex flex-col items-center">
              {getStatusIcon(event.status)}
              {index < events.length - 1 && (
                <div className="w-0.5 h-12 bg-gray-300 my-2"></div>
              )}
            </div>

            {/* Event content */}
            <div className="flex-1 pb-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-800">{event.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    {formatDate(event.date)}
                  </span>
                  {event.details && (
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {event.details}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="text-center text-gray-500 py-8">No events yet</p>
      )}
    </div>
  );
}

export default Timeline;
