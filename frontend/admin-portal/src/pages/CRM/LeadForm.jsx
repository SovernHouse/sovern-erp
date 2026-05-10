import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { ArrowLeft, AlertCircle, CheckCircle, Mail, Copy, Check, Edit2, Lock, X as XIcon } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Chatter from '../../components/Chatter';
import LeadAIPanel from '../../components/LeadAIPanel';
import { useAuth } from '../../hooks/useAuth';

const LeadForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(!!id);
  // New leads start in edit mode; existing leads start read-only.
  const [editMode, setEditMode] = useState(!id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    source: 'other',
    status: 'new',
    assignedToId: '',
    industry: '',
    estimatedValue: '',
    currency: 'USD',
    probability: '50',
    expectedCloseDate: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: '',
    tags: '',
    draftEmailSubject: '',
    draftEmailBody: '',
  });
  const [copiedField, setCopiedField] = useState(null);
  const [createdBy, setCreatedBy] = useState(null);
  const [createdById, setCreatedById] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [createdBySource, setCreatedBySource] = useState('manual');
  const [originalFormData, setOriginalFormData] = useState(null);
  const [responsibleUserIds, setResponsibleUserIds] = useState([]);
  const [originalResponsibleUserIds, setOriginalResponsibleUserIds] = useState([]);

  // RBAC: super_admin + admin always edit. Creator + currently-assigned owner
  // can edit. Everyone else gets read-only. New leads (no id) bypass — anyone
  // with outreach permission can create.
  const canEdit = useMemo(() => {
    if (!id) return true;
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin' || currentUser.role === 'admin') return true;
    if (createdById && createdById === currentUser.id) return true;
    if (formData.assignedToId && formData.assignedToId === currentUser.id) return true;
    return false;
  }, [id, currentUser, createdById, formData.assignedToId]);

  useEffect(() => {
    fetchUsers();
    if (id) {
      fetchLead();
    }
  }, [id]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users?limit=100');
      setUsers(response.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const fetchLead = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get(`/crm/leads/${id}`);
      const lead = response.data;
      setFormData({
        companyName: lead.companyName,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone || '',
        source: lead.source,
        status: lead.status,
        assignedToId: lead.assignedToId || '',
        industry: lead.industry || '',
        estimatedValue: lead.estimatedValue || '',
        currency: lead.currency || 'USD',
        probability: lead.probability || '50',
        expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.split('T')[0] : '',
        description: lead.description || '',
        address: lead.address || '',
        city: lead.city || '',
        state: lead.state || '',
        country: lead.country || '',
        tags: Array.isArray(lead.tags) ? lead.tags.join(', ') : '',
        draftEmailSubject: lead.draftEmailSubject || '',
        draftEmailBody: lead.draftEmailBody || '',
      });
      setCreatedBy(lead.createdBy || null);
      setCreatedById(lead.createdById || null);
      setCreatedAt(lead.createdAt || null);
      setCreatedBySource(lead.createdBySource || 'manual');
      const respIds = Array.isArray(lead.responsibleUserIds) ? lead.responsibleUserIds : [];
      setResponsibleUserIds(respIds);
      setOriginalResponsibleUserIds(respIds);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load lead');
    } finally {
      if (!silent) setLoading(false);
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
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : null,
        probability: parseInt(formData.probability),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        expectedCloseDate: formData.expectedCloseDate || null,
        responsibleUserIds,
      };

      if (id) {
        await api.put(`/crm/leads/${id}`, submitData);
        // Stay on the same page after edit; just exit edit mode and refresh.
        setEditMode(false);
        setOriginalFormData(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 1500);
        await fetchLead();
        setSubmitting(false);
        return;
      }
      await api.post('/crm/leads', submitData);

      setSuccess(true);
      setTimeout(() => {
        navigate('/crm/leads');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save lead');
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
            onClick={() => navigate('/crm/leads')}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Leads
          </button>
        </div>

        <div className="flex items-start justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {id ? (formData.companyName || 'Lead') : 'New Lead'}
          </h1>
          {id && (
            <div className="flex items-center gap-2">
              {!canEdit ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">
                  <Lock size={14} />
                  Read-only
                </span>
              ) : !editMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setOriginalFormData(formData);
                    setEditMode(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (originalFormData) setFormData(originalFormData);
                    setResponsibleUserIds(originalResponsibleUserIds);
                    setEditMode(false);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  <XIcon size={16} />
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start">
            <CheckCircle className="text-green-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-green-700">Lead saved successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-8">
          {id && !editMode && canEdit && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
              <Lock size={14} />
              Read-only. Click <strong>Edit</strong> in the header to change anything.
            </div>
          )}
          {id && !canEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2">
              <Lock size={14} />
              You don't have permission to edit this lead. Contact the assigned owner or a Super Admin to make changes.
            </div>
          )}

          <fieldset disabled={!!(id && !editMode)} className={id && !editMode ? 'opacity-95' : ''}>
            <div className="space-y-8">
          {/* Company Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Industry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Street address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State / Province</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="State or Province"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Country"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name *</label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contact name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Lead Details */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Lead Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="trade_show">Trade Show</option>
                  <option value="cold_call">Cold Call</option>
                  <option value="social_media">Social Media</option>
                  <option value="advertisement">Advertisement</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To (Responsible)</label>
                <select
                  name="assignedToId"
                  value={formData.assignedToId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {users.map(user => {
                    const label = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                    return <option key={user.id} value={user.id}>{label}</option>;
                  })}
                </select>
              </div>

              {id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Created By</label>
                  <div className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                    {createdBySource === 'ai_research' ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">🤖 AI Assistant</span>
                        {createdBy ? (
                          <span className="text-gray-600">
                            on behalf of {`${createdBy.firstName || ''} ${createdBy.lastName || ''}`.trim() || createdBy.email}
                          </span>
                        ) : null}
                      </span>
                    ) : createdBy ? (
                      `${createdBy.firstName || ''} ${createdBy.lastName || ''}`.trim() || createdBy.email || createdBy.id
                    ) : (
                      <span className="text-gray-400">Unknown (legacy lead — not tracked)</span>
                    )}
                    {createdAt ? (
                      <span className="text-xs text-gray-500 ml-2">
                        on {new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Followers / additional responsible team members */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Team Followers (additional responsibility)</label>
                <div className="px-3 py-3 border border-gray-200 rounded-lg bg-white">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {responsibleUserIds.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">No additional followers. The Assigned To owner is the primary responsible person.</span>
                    ) : (
                      responsibleUserIds.map(uid => {
                        const u = users.find(x => x.id === uid);
                        const label = u
                          ? (u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || uid)
                          : uid;
                        return (
                          <span key={uid} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                            {label}
                            <button
                              type="button"
                              disabled={!editMode}
                              onClick={() => setResponsibleUserIds(prev => prev.filter(x => x !== uid))}
                              className="hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Remove follower"
                            >
                              <XIcon size={12} />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                  <select
                    value=""
                    disabled={!editMode}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && !responsibleUserIds.includes(v)) {
                        setResponsibleUserIds(prev => [...prev, v]);
                      }
                      e.target.value = '';
                    }}
                    className="text-xs px-2 py-1 border border-gray-200 rounded disabled:bg-gray-50"
                  >
                    <option value="">+ Add team member…</option>
                    {users
                      .filter(u => !responsibleUserIds.includes(u.id) && u.id !== formData.assignedToId)
                      .map(u => {
                        const label = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                        return <option key={u.id} value={u.id}>{label}</option>;
                      })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Value</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="estimatedValue"
                    value={formData.estimatedValue}
                    onChange={handleChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
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

          {/* Draft Cold Email — populated by /new-clients research, editable, never sent automatically */}
          {(formData.draftEmailSubject || formData.draftEmailBody || id) && (
            <div className="border-2 border-emerald-200 bg-emerald-50/50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Mail className="w-5 h-5 text-emerald-700 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900">Draft Cold Email</h2>
                </div>
                <span className="text-xs text-gray-500">Review and edit before sending. Nothing sends automatically.</span>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    {formData.draftEmailSubject && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formData.draftEmailSubject);
                          setCopiedField('subject');
                          setTimeout(() => setCopiedField(null), 1500);
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center"
                      >
                        {copiedField === 'subject' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                        {copiedField === 'subject' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    name="draftEmailSubject"
                    value={formData.draftEmailSubject}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    placeholder="(no draft subject — generate via /new-clients)"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Body</label>
                    {formData.draftEmailBody && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formData.draftEmailBody);
                          setCopiedField('body');
                          setTimeout(() => setCopiedField(null), 1500);
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center"
                      >
                        {copiedField === 'body' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                        {copiedField === 'body' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <textarea
                    name="draftEmailBody"
                    value={formData.draftEmailBody}
                    onChange={handleChange}
                    rows="10"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono text-sm"
                    placeholder="(no draft body — generate via /new-clients)"
                  />
                </div>
              </div>
            </div>
          )}

          {/* AI Assistant — refine the draft email live; only visible on saved leads */}
          {id && canEdit && (
            <LeadAIPanel
              lead={{
                id,
                companyName: formData.companyName,
                contactName: formData.contactName,
                email: formData.email,
                country: formData.country,
                industry: formData.industry,
                vertical: formData.vertical,
                draftEmailSubject: formData.draftEmailSubject,
                draftEmailBody: formData.draftEmailBody,
              }}
              onLeadChanged={() => fetchLead(true)}
            />
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Lead details and notes..."
            />
          </div>

          {/* Tags */}
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

            </div>
          </fieldset>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting || (id && !editMode) || !canEdit}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : id ? 'Save Changes' : 'Create Lead'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/leads')}
              className="flex-1 border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-50"
            >
              Back to List
            </button>
          </div>
        </form>

        {/* Chatter — only shown when editing an existing lead */}
        {id && (
          <Chatter entityType="Lead" entityId={id} className="mt-6" />
        )}
      </div>
    </div>
  );
};

export default LeadForm;
