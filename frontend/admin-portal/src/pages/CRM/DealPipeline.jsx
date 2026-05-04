import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  ArrowRight,
  DollarSign,
  Plus,
  Filter,
  AlertCircle,
} from 'lucide-react';

const DealPipeline = () => {
  const [deals, setDeals] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [filters, setFilters] = useState({
    assignedToId: null,
    minValue: null,
    maxValue: null,
  });
  const [users, setUsers] = useState([]);

  const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const stageLabels = {
    prospecting: 'Prospecting',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  };

  useEffect(() => {
    fetchDeals();
    fetchUsers();
  }, [filters]);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/crm/pipeline');
      setDeals(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load deals');
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

  const handleDragStart = (e, deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    if (!draggedDeal || draggedDeal.stage === targetStage) {
      setDraggedDeal(null);
      return;
    }

    try {
      await api.put(`/crm/deals/${draggedDeal.id}/stage`, { stage: targetStage });
      setDraggedDeal(null);
      fetchDeals();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update deal');
    }
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
  };

  const getStageColor = (stage) => {
    const colors = {
      prospecting: 'bg-blue-50 border-blue-200',
      qualification: 'bg-purple-50 border-purple-200',
      proposal: 'bg-indigo-50 border-indigo-200',
      negotiation: 'bg-orange-50 border-orange-200',
      closed_won: 'bg-green-50 border-green-200',
      closed_lost: 'bg-red-50 border-red-200',
    };
    return colors[stage] || 'bg-gray-50 border-gray-200';
  };

  const getHeaderBg = (stage) => {
    const colors = {
      prospecting: 'bg-blue-500',
      qualification: 'bg-purple-500',
      proposal: 'bg-indigo-500',
      negotiation: 'bg-orange-500',
      closed_won: 'bg-green-500',
      closed_lost: 'bg-red-500',
    };
    return colors[stage] || 'bg-gray-500';
  };

  const calculateStageTotal = (stage) => {
    return deals[stage]?.reduce((sum, deal) => sum + parseFloat(deal.value || 0), 0) || 0;
  };

  if (loading && Object.keys(deals).length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Deal Pipeline</h1>
          <p className="text-gray-600 mt-2">Drag and drop deals to move between stages</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Assignee</label>
            <select
              value={filters.assignedToId || ''}
              onChange={(e) => setFilters({ ...filters, assignedToId: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Assignees</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchDeals}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Filter size={18} />
            Refresh
          </button>
        </div>

        {/* Pipeline Columns */}
        <div className="overflow-x-auto">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(350px, 1fr))` }}>
            {stages.map(stage => (
              <div
                key={stage}
                className={`rounded-lg border-2 ${getStageColor(stage)} min-h-[600px] flex flex-col`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {/* Column Header */}
                <div className={`${getHeaderBg(stage)} text-white p-4 rounded-t-md`}>
                  <h2 className="font-semibold text-lg mb-2">{stageLabels[stage]}</h2>
                  <div className="flex justify-between items-center text-sm">
                    <span>{deals[stage]?.length || 0} deals</span>
                    <span className="font-bold">
                      ${parseFloat(calculateStageTotal(stage)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Deal Cards */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {deals[stage]?.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white rounded-lg p-4 shadow hover:shadow-lg transition cursor-move border-l-4 border-blue-500 ${
                        draggedDeal?.id === deal.id ? 'opacity-50' : ''
                      }`}
                    >
                      <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                        {deal.title}
                      </h3>

                      <p className="text-xs text-gray-600 mb-2">{deal.Customer?.name}</p>

                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-lg font-bold text-blue-600">
                          ${parseFloat(deal.value).toLocaleString()}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {deal.probability}%
                        </span>
                      </div>

                      {deal.expectedCloseDate && (
                        <p className="text-xs text-gray-600 mb-3">
                          Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}
                        </p>
                      )}

                      {deal.assignedTo && (
                        <div className="mb-3 text-xs">
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {deal.assignedTo.name}
                          </span>
                        </div>
                      )}

                      <button className="w-full text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded hover:bg-blue-100 font-medium">
                        View Details
                      </button>
                    </div>
                  ))}

                  {(!deals[stage] || deals[stage].length === 0) && (
                    <div className="flex items-center justify-center h-32 text-gray-400">
                      <p className="text-sm text-center">No deals in this stage</p>
                    </div>
                  )}
                </div>

                {/* Add Deal Button */}
                <div className="p-4 border-t border-gray-200">
                  <button className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 py-2 px-3 rounded hover:bg-gray-100 transition">
                    <Plus size={16} />
                    Add Deal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Bar */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stages.map(stage => (
              <div key={stage} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">{stageLabels[stage]}</p>
                <p className="text-2xl font-bold text-gray-900">${parseFloat(calculateStageTotal(stage)).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-500 mt-1">{deals[stage]?.length || 0} deals</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealPipeline;
