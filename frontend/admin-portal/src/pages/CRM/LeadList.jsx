import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ConfirmDialog from '../../components/ConfirmDialog';
import KanbanBoard, { LEAD_KANBAN_COLUMNS } from '../../components/KanbanBoard';
import {
  Search,
  Plus,
  ChevronDown,
  Phone,
  Mail,
  ArrowRight,
  Trash2,
  Edit2,
  LayoutGrid,
  LayoutList,
  AlertCircle,
} from 'lucide-react';

const LeadList = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: null,
    source: null,
    assignedToId: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, lead: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  const sources = ['website', 'referral', 'trade_show', 'cold_call', 'social_media', 'advertisement', 'other'];

  useEffect(() => {
    fetchLeads();
  }, [filters]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, filters]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.source) params.append('source', filters.source);
      if (filters.assignedToId) params.append('assignedToId', filters.assignedToId);
      params.append('limit', 100);

      const response = await api.get(`/api/crm/leads?${params.toString()}`);
      setLeads(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leads');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(
        lead =>
          lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLeads(filtered);
  };

  const handleDeleteClick = (lead) => {
    setDeleteConfirm({ isOpen: true, lead });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.lead) return;
    try {
      setIsDeleting(true);
      await api.delete(`/api/crm/leads/${deleteConfirm.lead.id}`);
      setLeads(leads.filter(lead => lead.id !== deleteConfirm.lead.id));
      setDeleteConfirm({ isOpen: false, lead: null });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete lead');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      await api.put(`/api/crm/leads/${leadId}/status`, { status: newStatus });
      setLeads(leads.map(lead =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      ));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-indigo-100 text-indigo-800',
      qualified: 'bg-purple-100 text-purple-800',
      proposal: 'bg-orange-100 text-orange-800',
      negotiation: 'bg-yellow-100 text-yellow-800',
      won: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSourceColor = (source) => {
    const colors = {
      website: 'bg-blue-50',
      referral: 'bg-purple-50',
      trade_show: 'bg-pink-50',
      cold_call: 'bg-orange-50',
      social_media: 'bg-cyan-50',
      advertisement: 'bg-lime-50',
      other: 'bg-gray-50',
    };
    return colors[source] || 'bg-gray-50';
  };

  if (loading && leads.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading leads...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-600 mt-2">{filteredLeads.length} leads</p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center">
            <Plus size={20} className="mr-2" />
            New Lead
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search leads..."
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
              value={filters.source || ''}
              onChange={(e) => setFilters({ ...filters, source: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sources</option>
              {sources.map(source => (
                <option key={source} value={source}>{source.replace('_', ' ').charAt(0).toUpperCase() + source.slice(1)}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-lg border ${viewMode === 'kanban' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'}`}
                title="Kanban View"
              >
                <LayoutGrid size={20} />
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

        {/* Kanban View */}
        {viewMode === 'kanban' ? (
          <KanbanBoard
            columns={LEAD_KANBAN_COLUMNS}
            cards={filteredLeads}
            statusField="status"
            onMove={handleUpdateStatus}
            onCardClick={(lead) => navigate(`/crm/leads/${lead.id}/edit`)}
            groupValueFn={(lead) => parseFloat(lead.estimatedValue || 0)}
          />
        ) : (
          /* List View */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{lead.companyName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.contactName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.email}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                      ${parseFloat(lead.estimatedValue || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                        className={`text-xs font-semibold px-3 py-1 rounded-full border-0 ${getStatusColor(lead.status)}`}
                      >
                        {statuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${getSourceColor(lead.source)}`}>
                        {lead.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{lead.score}%</td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(lead)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLeads.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                <p>No leads found. Try adjusting your filters.</p>
              </div>
            )}
          </div>
        )}

        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title="Delete Lead"
          message={`Delete ${deleteConfirm.lead?.companyName}? This will also remove all associated outreach emails and activities.`}
     