import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const DealForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(!!id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    customerId: '',
    contactId: '',
    assignedToId: '',
    stage: 'prospecting',
    value: '',
    currency: 'USD',
    probability: '50',
    expectedCloseDate: '',
    source: '',
    description: '',
    notes: '',
    tags: '',
  });

  useEffect(() => {
    fetchCustomersContactsUsers();
    if (id) {
      fetchDeal();
    }
  }, [id]);

  const fetchCustomersContactsUsers = async () => {
    try {
      const [customersRes, contactsRes, usersRes] = await Promise.all([
        api.get('/api/customers?limit=100'),
        api.get('/api/crm/contacts?limit=100'),
        api.get('/api/users?limit=100'),
      ]);
      setCustomers(customersRes.data || []);
      setContacts(contactsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const fetchDeal = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/crm/deals/${id}`);
      const deal = response.data;
      setFormData({
        title: deal.title,
        customerId: deal.customerId || '',
        contactId: deal.contactId || '',
        assignedToId: deal.assignedToId || '',
        stage: deal.stage,
        value: deal.value || '',
        currency: deal.currency || 'USD',
        probability: deal.probability || '50',
        expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
        source: deal.source || '',
        description: deal.description || '',
        notes: deal.notes || '',
        tags: Array.isArray(deal.tags) ? deal.tags.join(', ') : '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load deal');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
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
        value: parseFloat(formData.value),
        probability: parseInt(formData.probability),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        expectedCloseDate: formData.expectedCloseDate || null,
      };

      if (id) {
        await api.put(`/api/crm/deals/${id}`, submitData);
      } else {
        await api.post('/api/crm/deals', submitData);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/crm/deals');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save deal');
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
            onClick={() => navigate('/crm/deals')}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Deals
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {id ? 'Edit Deal' : 'New Deal'}
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
            <p className="text-green-700">Deal saved successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-8">
          {/* Deal Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Deal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Deal Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Deal title or description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
                <select
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact</label>
                <select
                  name="contactId"
                  value={formData.contactId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a contact</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To *</label>
                <select
                  name="assignedToId"
                  value={formData.assignedToId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select assignee</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Deal source"
                />
              </div>
            </div>
          </div>

          {/* Deal Value & Stage */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Deal Value & Stage</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deal Value *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="value"
                    value={formData.value}
                    onChange={handleChange}
                    required
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="prospecting">Prospecting</option>
                  <option value="qualification">Qualification</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Probability (%)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    name="probability"
                    value={formData.probability}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-gray-700 w-12 text-right">{formData.probability}%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Close Date</label>
                <input
                  type="date"
                  name="expectedCloseDate"
                  value={formData.expectedCloseDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Deal description and details..."
            />
          </div>

          {/* Notes & Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Internal notes..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter tags separated by commas"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : id ? 'Update Deal' : 'Create Deal'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/deals')}
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

export default DealForm;
