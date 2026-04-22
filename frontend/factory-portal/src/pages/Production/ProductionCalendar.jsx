import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { productionAPI } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

function ProductionCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCalendarData();
  }, [currentDate]);

  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const response = await productionAPI.getCalendar({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      setSchedules(response.data);
    } catch (error) {
      toast.error('Failed to load calendar data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getSchedulesForDate = (day) => {
    const dateStr = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return schedules.filter((s) => s.date === dateStr);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Production Calendar</h1>
        <p className="text-gray-600 mt-1">View production schedules and deadlines</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Calendar */}
        <div className="col-span-3 bg-white rounded-lg shadow p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-2xl font-bold text-gray-800 text-center flex-1">
              {monthName}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-gray-600 text-sm py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const daySchedules = day ? getSchedulesForDate(day) : [];
              const isToday =
                day &&
                new Date().getDate() === day &&
                new Date().getMonth() === currentDate.getMonth() &&
                new Date().getFullYear() === currentDate.getFullYear();

              return (
                <div
                  key={index}
                  className={`min-h-32 p-2 rounded-lg border-2 transition-colors ${
                    day === null
                      ? 'bg-gray-50 border-gray-100'
                      : isToday
                      ? 'bg-factory-50 border-factory-600'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {day && (
                    <>
                      <div
                        className={`text-lg font-bold mb-2 ${
                          isToday ? 'text-factory-600' : 'text-gray-800'
                        }`}
                      >
                        {day}
                      </div>
                      <div className="space-y-1">
                        {daySchedules.slice(0, 2).map((schedule, i) => (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1 rounded truncate font-semibold text-white ${
                              schedule.status === 'on_track'
                                ? 'bg-green-500'
                                : schedule.status === 'at_risk'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            title={schedule.itemName}
                          >
                            {schedule.itemName}
                          </div>
                        ))}
                        {daySchedules.length > 2 && (
                          <div className="text-xs text-gray-600 px-2">
                            +{daySchedules.length - 2} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend & Stats */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-800 mb-3">Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-700">On Track</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-sm text-gray-700">At Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-sm text-gray-700">Delayed</span>
              </div>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-800 mb-3">This Month</h3>
            <div className="space-y-2 text-sm">
              {schedules.length === 0 ? (
                <p className="text-gray-600">No scheduled items</p>
              ) : (
                <>
                  <p className="text-gray-700">
                    <span className="font-semibold">{schedules.length}</span> scheduled items
                  </p>
                  <div className="pt-2 border-t border-gray-200 space-y-2">
                    {schedules.slice(0, 3).map((s, i) => (
                      <div key={i} className="text-xs">
                        <p className="font-semibold text-gray-800">{s.itemName}</p>
                        <p className="text-gray-600">Due: {formatDate(s.date)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Critical Items */}
          {schedules.some((s) => s.status === 'delayed') && (
            <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <h3 className="font-bold text-red-900 text-sm">Delayed Items</h3>
                  <p className="text-red-800 text-xs mt-1">
                    {schedules.filter((s) => s.status === 'delayed').length} item(s) behind schedule
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductionCalendar;
