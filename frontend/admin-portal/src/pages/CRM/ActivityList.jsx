import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';

const ActivityList = () => {
  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, activity: null });
  const [completeConfirm, setCompleteConfirm] = useState({ isOpen: false, activity: null });
  const [filters, setFilters] = useState({
    type: null,
    assignedToId: null,
    status: 'pending',
  });
  const [users, setUsers] = useState([]);

  const types = ['call', 'email', 'meeting', 'note', 'task', 'follow_up'];

  useEffect(() => {
    fetchActivities();
    fetchUsers();
  }, [filters]);

  useEffect(() => {
    filterActivities();
  }, [activities]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.assignedToId) params.append('assignedToId', filters.assignedToId);
      params.append('limit', 100);

      const response = await api.get(`/crm/activities?${params.toString()}`);
      setActivities(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activities');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users?limit=100');
      setUsers(response.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const filterActivities = () => {
    let filtered = activities;

    if (filters.status === 'pending') {
      filtered = filtered.filter(a => !a.isCompleted);
    } else if (filters.status === 'completed') {
      filtered = filtered.filter(a => a.isCompleted);
    }

    filtered.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
    setFilteredActivities(filtered);
  };

  const handleCompleteActivity = async (id) => {
    try {
      await api.post(`/crm/activities/${id}/complete`, {
        outcome: 'Completed',
      });
      setActivities(activities.map(a =>
        a.id === id ? { ...a, isCompleted: true, completedAt: new Date() } : a
      ));
      setCompleteConfirm({ isOpen: false, activity: null });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete activity');
    }
  };

  const handleDeleteActivity = async (id) => {
    try {
      await api.delete(`/crm/activities/${id}`);
      setActivities(activities.filter(a => a.id !== id));
      setDeleteConfirm({ isOpen: false, activity: null });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete activity');
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      call: Phone,
      email: Mail,
      meeting: Calendar,
      note: 'note',
      task: 'task',
      follow_up: Clock,
    };
    return icons[type];
  };

  const getTypeColor = (type) => {
    const colors = {
      call: 'bg-blue-100 text-blue-800',
      email: 'bg-purple-100 text-purple-800',
      meeting: 'bg-orange-100 text-orange-800',
      note: 'bg-gray-100 text-gray-800',
      task: 'bg-indigo-100 text-indigo-800',
      follow_up: 'bg-pink-100 text-pink-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const isOverdue = (activity) => {
    return !activity.isCompleted && new Date(activity.scheduledAt) < new Date();
  };

  const isToday = (activity) => {
    const today = new Date();
    const scheduled = new Date(activity.scheduledAt);
    return scheduled.toDateString() === today.toDateString();
  };

  if (loading && activities.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activities</h1>
            <p className="text-gray-600 mt-2">{filteredActivities.length} activities</p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center">
            <Plus size={20} className="mr-2" />
            New Activity
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {types.map(type => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>

            <select
              value={filters.assignedToId || ''}
              onChange={(e) => setFilters({ ...filters, assignedToId: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Assignees</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="">All</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded-lg border ${viewMode === 'calendar' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'}`}
                title="Calendar View"
              >
                <Calendar size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg border ${viewMode === 'list' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'}`}
                title="List View"
              >
                <LayoutList size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Scheduled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredActivities.map(activity => (
                  <tr key={activity.id} className={`hover:bg-gray-50 transition ${isOverdue(activity) ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getTypeColor(activity.type)}`}>
                        {activity.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{activity.subject}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {activity.Contact?.firstName} {activity.Contact?.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        {new Date(activity.scheduledAt).toLocaleDateString()}
                        {isToday(activity) && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Today</span>}
                        {isOverdue(activity) && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Overdue</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {activity.isCompleted ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle size={16} className="mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="text-gray-600">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      {!activity.isCompleted && (
                        <button
                          onClick={() => setCompleteConfirm({ isOpen: true, activity })}
                          className="text-green-600 hover:text-green-800"
                          title="Mark Complete"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, activity })}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filteredActivities.length === 0 && (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={Clock}
                  title="No activities found"
                  description={filters.status === 'pending' ? 'No pending activities. All caught up!' : 'No activities match the current filters.'}
                />
              </td></tr>
            )}
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Activity Calendar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upcoming */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Upcoming</h3>
                <div className="space-y-3">
                  {filteredActivities
                    .filter(a => !a.isCompleted && new Date(a.scheduledAt) >= new Date())
                    .slice(0, 10)
                    .map(activity => (
                      <div key={activity.id} className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 p-2">
                        <p className="text-sm font-medium text-gray-900">{activity.subject}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(activity.scheduledAt).toLocaleDateString()} {new Date(activity.scheduledAt).toLocaleTimeString()}
                        </p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-2 ${getTypeColor(activity.type)}`}>
                          {activity.type}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Overdue */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 text-red-600">Overdue</h3>
                <div className="space-y-3">
                  {filteredActivities
                    .filter(a => !a.isCompleted && new Date(a.scheduledAt) < new Date())
                    .map(activity => (
                      <div key={activity.id} className="border-l-4 border-red-500 pl-4 py-2 hover:bg-red-50 p-2 bg-red-50">
                        <p className="text-sm font-medium text-gray-900">{activity.subject}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(activity.scheduledAt).toLocaleDateString()} {new Date(activity.scheduledAt).toLocaleTimeString()}
                        </p>
                        <button
                          onClick={() => setCompleteConfirm({ isOpen: true, activity })}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded mt-2 hover:bg-blue-700"
                        >
                          Mark Complete
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Complete confirmation */}
      <ConfirmDialog
        isOpen={completeConfirm.isOpen}
        title="Mark Activity Complete"
        message={`Mark "${completeConfirm.activity?.subject}" as complete? It will be removed from your pending activities list.`}
        confirmLabel="Mark Complete"
        onConfirm={() => handleCompleteActivity(completeConfirm.activity?.id)}
        onCancel={() => setCompleteConfirm({ isOpen: false, activity: null })}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Activity"
        message={`Delete "${deleteConfirm.activity?.subject}"? This cannot be undone.`}
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => handleDeleteActivity(deleteConfirm.activity?.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, activity: null })}
      />
    </div>
  );
};

export default ActivityList;
