import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Search,
  Plus,
  BarChart3,
  AlertCircle,
  Edit2,
  Trash2,
  Eye,
  TrendingUp,
} from 'lucide-react';

const CampaignList = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: null,
    type: null,
  });

  const statuses = ['draft', 'active', 'paused', 'completed', 'cancelled'];
  const types = ['email', 'trade_show', 'advertisement', 'social_media', 'referral', 'other'];

  useEffect(() => {
    fetchCampaigns();
  }, [filters]);

  useEffect(() => {
    filterCampaigns();
  }, [campaigns, searchTerm]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      params.append('limit', 100);

      const response = await api.get(`/api/crm/campaigns?${params.toString()}`);
      setCampaigns(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load campaigns');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterCampaigns = () => {
    let filtered = campaigns;

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCampaigns(filtered);
  };

  const handleDeleteCampaign = async (id) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      try {
        await api.delete(`/api/crm/campaigns/${id}`);
        setCampaigns(campaigns.filter(c => c.id !== id));
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete campaign');
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type) => {
    const colors = {
      email: 'bg-purple-50',
      trade_show: 'bg-pink-50',
      advertisement: 'bg-blue-50',
      social_media: 'bg-cyan-50',
      referral: 'bg-green-50',
      other: 'bg-gray-50',
    };
    return colors[type] || 'bg-gray-50';
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading campaigns...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
            <p className="text-gray-600 mt-2">{filteredCampaigns.length} campaigns</p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center">
            <Plus size={20} className="mr-2" />
            New Campaign
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
              ))}
            </select>

            <select
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {types.map(type => (
                <option key={type} value={type}>{type.replace('_', ' ').charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Campaigns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map(campaign => (
            <div key={campaign.id} className={`rounded-lg shadow hover:shadow-lg transition p-6 ${getTypeColor(campaign.type)}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{campaign.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{campaign.type.replace('_', ' ')}</p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(campaign.status)}`}>
                  {campaign.status}
                </span>
              </div>

              {/* Campaign Dates */}
              {campaign.startDate && (
                <div className="mb-4 p-3 bg-white rounded border border-gray-200">
                  <p className="text-xs text-gray-600">Duration</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(campaign.startDate).toLocaleDateString()} - {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'Ongoing'}
                  </p>
                </div>
              )}

              {/* Campaign Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded p-3">
                  <p className="text-xs text-gray-600">Budget</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${campaign.budget ? parseFloat(campaign.budget).toLocaleString() : '0'}
                  </p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-xs text-gray-600">Spent</p>
                  <p className="text-lg font-bold text-blue-600">
                    ${parseFloat(campaign.actualCost).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-xs text-gray-600">Leads</p>
                  <p className="text-lg font-bold text-gray-900">{campaign.leadsCount}</p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-xs text-gray-600">Conversions</p>
                  <p className="text-lg font-bold text-green-600">{campaign.conversionsCount}</p>
                </div>
              </div>

              {/* ROI */}
              <div className="mb-4 p-3 bg-white rounded border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">ROI</p>
                  <p className="text-lg font-bold text-blue-600">
                    {campaign.roi}%
                  </p>
                </div>
              </div>

              {campaign.description && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-1">Description</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{campaign.description}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button className="flex-1 flex items-center justify-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded text-sm font-medium">
                  <Eye size={16} />
                  View
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded text-sm font-medium">
                  <Edit2 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="text-red-600 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCampaigns.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No campaigns found. Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignList;
