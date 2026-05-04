import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const CampaignForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(!!id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'other',
    status: 'draft',
    startDate: '',
    endDate: '',
    budget: '',
    actualCost: '',
    expectedRevenue: '',
    actualRevenue: '',
    description: '',
    targetAudience: '',
    leadsCount: '0',
    conversionsCount: '0',
  });

  useEffect(() => {
    if (id) {
      fetchCampaign();
    }
  }, [id]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/crm/campaigns/${id}`);
      const campaign = response.data;
      setFormData({
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
        endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
        budget: campaign.budget || '',
        actualCost: campaign.actualCost || '',
        expectedRevenue: campaign.expectedRevenue || '',
        actualRevenue: campaign.actualRevenue || '',
        description: campaign.description || '',
        targetAudience: campaign.targetAudience || '',
        leadsCount: campaign.leadsCount || '0',
        conversionsCount: campaign.conversionsCount || '0',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load campaign');
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
        budget: formData.budget ? parseFloat(formData.budget) : null,
        actualCost: formData.actualCost ? parseFloat(formData.actualCost) : 0,
        expectedRevenue: formData.expectedRevenue ? parseFloat(formData.expectedRevenue) : null,
        actualRevenue: formData.actualRevenue ? parseFloat(formData.actualRevenue) : 0,
        leadsCount: parseInt(formData.leadsCount),
        conversionsCount: parseInt(formData.conversionsCount),
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      };

      if (id) {
        await api.put(`/crm/campaigns/${id}`, submitData);
      } else {
        await api.post('/crm/campaigns', submitData);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/crm/campaigns');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save campaign');
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
            onClick={() => navigate('/crm/campaigns')}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Campaigns
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {id ? 'Edit Campaign' : 'New Campaign'}
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
            <p className="text-green-700">Campaign saved successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-8">
          {/* Campaign Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Campaign Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Campaign name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="trade_show">Trade Show</option>
                  <option value="advertisement">Advertisement</option>
                  <option value="social_media">Social Media</option>
                  <option value="referral">Referral</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Campaign Dates */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Campaign Duration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Budget & Revenue */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Budget & Revenue</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600">$</span>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Actual Cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600">$</span>
                  <input
                    type="number"
                    name="actualCost"
                    value={formData.actualCost}
                    onChange={handleChange}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Revenue</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600">$</span>
                  <input
                    type="number"
                    name="expectedRevenue"
                    value={formData.expectedRevenue}
                    onChange={handleChange}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Actual Revenue</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-600">$</span>
                  <input
                    type="number"
                    name="actualRevenue"
                    value={formData.actualRevenue}
                    onChange={handleChange}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results & Metrics */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Results & Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Leads Generated</label>
                <input
                  type="number"
                  name="leadsCount"
                  value={formData.leadsCount}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conversions</label>
                <input
                  type="number"
                  name="conversionsCount"
                  value={formData.conversionsCount}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Description & Target Audience */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Details</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Campaign description and objectives..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                <textarea
                  name="targetAudience"
                  value={formData.targetAudience}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description of target audience..."
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : id ? 'Update Campaign' : 'Create Campaign'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/campaigns')}
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

export default CampaignForm;
