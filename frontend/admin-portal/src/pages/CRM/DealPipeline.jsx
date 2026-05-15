// Phase 4.8 Commit 3b (5a rewire) — Pipeline kanban now reads Leads.
//
// The page name + file name "DealPipeline" is kept for the route import
// chain in App.jsx (one fewer file rename). The visible heading reads
// "Pipeline" and every card is a Lead. The drag-drop writes Lead.status
// via PUT /leads/:id instead of PUT /crm/deals/:id/stage. Backend
// /api/crm/pipeline now returns Leads grouped by Lead.status under the
// same URL (see backend/controllers/crmDashboardController.js).
//
// See docs/phase-4.8-leads-pipeline-audit.md for the rationale.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AlertCircle, Plus, Filter } from 'lucide-react';
import BrandBadge from '../../components/BrandBadge';

const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

const STAGE_LABELS = {
  new:         'New',
  contacted:   'Contacted',
  qualified:   'Qualified',
  proposal:    'Proposal',
  negotiation: 'Negotiation',
  won:         'Won',
  lost:        'Lost',
};

// Per the audit recommendation (§7): brand-accent for open pipeline,
// green for won, bronze for lost, steel for top-of-funnel. We render
// the brand-accent at the row level (BrandBadge on each Lead card)
// rather than at the column header, since a column may contain Leads
// from both brands. Column colors here use neutral tokens that pair
// with the row-level brand accent.
const STAGE_BG = {
  new:         'bg-slate-50 border-slate-200',
  contacted:   'bg-slate-50 border-slate-200',
  qualified:   'bg-emerald-50 border-emerald-200',
  proposal:    'bg-emerald-50 border-emerald-200',
  negotiation: 'bg-emerald-50 border-emerald-200',
  won:         'bg-green-50 border-green-300',
  lost:        'bg-amber-50 border-amber-200',
};

const STAGE_HEADER_BG = {
  new:         'bg-slate-500',
  contacted:   'bg-slate-600',
  qualified:   'bg-emerald-600',
  proposal:    'bg-emerald-700',
  negotiation: 'bg-emerald-800',
  won:         'bg-green-700',
  lost:        'bg-amber-700',
};

const Pipeline = () => {
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedLead, setDraggedLead] = useState(null);
  const [filters, setFilters] = useState({ assignedToId: null });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchPipeline();
    fetchUsers();
  }, [filters]);

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      const response = await api.get('/crm/pipeline');
      setPipeline(response.data?.data || {});
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pipeline');
      console.error('Pipeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users?limit=100');
      setUsers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (!draggedLead || draggedLead.status === targetStatus) {
      setDraggedLead(null);
      return;
    }
    try {
      await api.put(`/leads/${draggedLead.id}`, { status: targetStatus });
      setDraggedLead(null);
      fetchPipeline();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to move lead');
    }
  };

  const calculateStageTotal = (stage) => (
    (pipeline[stage] || []).reduce((sum, lead) => sum + parseFloat(lead.estimatedValue || 0), 0)
  );

  const visibleLeadsForStage = (stage) => {
    const bucket = pipeline[stage] || [];
    if (!filters.assignedToId) return bucket;
    return bucket.filter((l) => l.assignedToId === filters.assignedToId);
  };

  if (loading && Object.keys(pipeline).length === 0) {
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
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pipeline</h1>
            <p className="text-gray-600 mt-2">Leads grouped by stage. Drag a card between columns to update its status.</p>
          </div>
          <button
            onClick={() => navigate('/crm/leads/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={18} />
            New Lead
          </button>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by assignee</label>
            <select
              value={filters.assignedToId || ''}
              onChange={(e) => setFilters({ ...filters, assignedToId: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All assignees</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchPipeline}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Filter size={18} />
            Refresh
          </button>
        </div>

        {/* Pipeline columns */}
        <div className="overflow-x-auto">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(300px, 1fr))` }}>
            {STAGES.map((stage) => {
              const visible = visibleLeadsForStage(stage);
              return (
                <div
                  key={stage}
                  className={`rounded-lg border-2 ${STAGE_BG[stage]} min-h-[600px] flex flex-col`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <div className={`${STAGE_HEADER_BG[stage]} text-white p-4 rounded-t-md`}>
                    <h2 className="font-semibold text-lg mb-2">{STAGE_LABELS[stage]}</h2>
                    <div className="flex justify-between items-center text-sm">
                      <span>{visible.length} {visible.length === 1 ? 'lead' : 'leads'}</span>
                      <span className="font-bold">
                        ${parseFloat(calculateStageTotal(stage)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                    {visible.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onDragEnd={() => setDraggedLead(null)}
                        onClick={() => navigate(`/crm/leads/${lead.id}`)}
                        className={`bg-white rounded-lg p-3 shadow hover:shadow-lg transition cursor-pointer border-l-4 border-blue-500 ${
                          draggedLead?.id === lead.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">
                            {lead.companyName}
                          </h3>
                          <BrandBadge code={lead.brandCode || 'SH'} size="sm" />
                        </div>
                        {lead.leadNumber && (
                          <p className="text-xs font-mono text-gray-500 mb-2">{lead.leadNumber}</p>
                        )}
                        {lead.contactName && (
                          <p className="text-xs text-gray-600 mb-2">{lead.contactName}</p>
                        )}
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-base font-bold text-blue-600">
                            ${parseFloat(lead.estimatedValue || 0).toLocaleString()}
                          </span>
                          {lead.probability != null && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {lead.probability}%
                            </span>
                          )}
                        </div>
                        {lead.expectedCloseDate && (
                          <p className="text-xs text-gray-600 mb-2">
                            Close: {new Date(lead.expectedCloseDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Taipei' })}
                          </p>
                        )}
                        {lead.assignedTo && (
                          <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                            {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                          </span>
                        )}
                      </div>
                    ))}

                    {visible.length === 0 && (
                      <div className="flex items-center justify-center h-32 text-gray-400">
                        <p className="text-sm text-center">No leads in this stage</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary bar */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {STAGES.map((stage) => (
              <div key={stage} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">{STAGE_LABELS[stage]}</p>
                <p className="text-xl font-bold text-gray-900">
                  ${parseFloat(calculateStageTotal(stage)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(pipeline[stage] || []).length} {(pipeline[stage] || []).length === 1 ? 'lead' : 'leads'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pipeline;
