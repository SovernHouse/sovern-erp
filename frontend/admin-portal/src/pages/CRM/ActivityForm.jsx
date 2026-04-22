import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const ActivityForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(!!id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    type: 'call',
    subject: '',
    description: '',
    contactId: '',
    customerId: '',
    leadId: '',
    userId: '',
    scheduledAt: '',
    duration: '',
    outcome: '',
    isCompleted: false,
    priority: 'medium',
    reminder: '',
  });

  useEffect(() => {
    fetchData();
    if (id) {
      fetchActivity();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [contactsRes, customersRes, leadsRes, usersRes] = await Promise.all([
        axios.get('/api/crm/contacts?limit=100'),
        axios.get('/api/customers?limit=100'),
        axios.get('/api/crm/leads?limit=100'),
        axios.get('/api/users?limit=100'),
      ]);
      setContacts(contactsRes.data.data || []);
      setCustomers(customersRes.data.data || []);
      setLeads(leadsRes.data.data || []);
      setUsers(usersRes.data.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/crm/activities/${id}`);
      const activity = response.data.data;
      setFormData({
        type: activity.type,
        subject: activity.subject,
        description: activity.description || '',
        contactId: activity.contactId || '',
        customerId: activity.customerId || '',
        leadId: activity.leadId || '',
        userId: activity.userId || '',
        scheduledAt: activity.scheduledAt ? activity.scheduledAt.slice(0, 16) : '',
        duration: activity.duration || '',
        outcome: activity.outcome || '',
        isCompleted: activity.isCompleted || false,
        priority: activity.priority || 'medium',
        reminder: activity.reminder ? activity.reminder.slice(0, 16) : '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      setSubmitting(true);

      const submitData = {
        ...formData,
        userId: formData.userId || null,
        contactId: formData.contactId || null,
        customerId: formData.customerId || null,
        leadId: formData.leadId || null,
        duration: formData.duration ? parseInt(formData.duration) : null,
        scheduledAt: formData.scheduledAt || null,
        reminder: formData.reminder || null,
      };

      if (id) {
        await axios.put(`/api/crm/activities/${id}`, submitData);
      } else {
        await axios.post('/api/crm/activities', submitData);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/crm/activities');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save activity');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/crm/activities')}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Activities
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {id ? 'Edit Activity' : 'Log Activity'}
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start">
            <CheckCircle className="text-green-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-green-700">Activity saved successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-8">
          {/* Activity Type */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Activity Type</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {['call', 'email', 'meeting', 'note', 'task', 'follow_up'].map(type => (
                <label key={type} className="relative flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-blue-50"
                  style={{ borderColor: formData.type === type ? '#3b82f6' : '#e5e7eb' }}>
                  <input
                    type="radio"
                    name="type"
                    value={type}
                    checked={formData.type === type}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="ml-3 font-medium text-gray-900">{type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Subject & Description */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Details</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Activity subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Activity details..."
                />
              </div>
            </div>
          </div>

          {/* Related Records */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Related To</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact</label>
                <select
                  name="contactId"
                  value={formData.contactId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select contact</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                <select
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lead</label>
                <select
                  name="leadId"
                  value={formData.leadId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select lead</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.companyName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Scheduling */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Scheduling</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled For *</label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Set Reminder</label>
                <input
                  type="datetime-local"
                  name="reminder"
                  value={formData.reminder}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Priority & Assignment */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Priority & Assignment</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To *</label>
                <select
                  name="userId"
                  value={formData.userId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30"
                />
              </div>
            </div>
          </div>

          {/* Completion Details */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Completion Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
                <textarea
                  name="outcome"
                  value={formData.outcome}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Outcome of the activity..."
                />
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isCompleted"
                  checked={formData.isCompleted}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Mark as Completed</span>
              </label>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : id ? 'Update Activity' : 'Create Activity'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/activities')}
              className="flex-1 border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityForm;
