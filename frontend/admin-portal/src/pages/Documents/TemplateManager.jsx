import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Star,
  Copy,
  Download,
  Edit2,
  Trash2,
  Search,
  Filter,
  X,
  File,
  FileSpreadsheet,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';
import api from '../../services/api';

const CATEGORIES = [
  'Sales Notes',
  'Purchase Orders',
  'Invoices',
  'Quotations',
  'Packing Lists',
  'Certificates of Origin',
  'Credit Notes',
  'Proforma Invoices'
];

const FIELD_TYPES = [
  'Text',
  'Number',
  'Date',
  'Currency',
  'Boolean',
  'Select',
  'Email',
  'Phone'
];

export default function TemplateManager() {
  // State management
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'Sales Notes',
    description: '',
    isDefault: false,
    customFields: []
  });
  const [uploadFile, setUploadFile] = useState(null);

  // Generate document state
  const [generateForm, setGenerateForm] = useState({
    templateId: '',
    values: {},
    entityType: 'customer',
    entityId: ''
  });

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (activeCategory !== 'All') {
        params.category = activeCategory;
      }
      const response = await api.get('/personalization/templates', { params });
      setTemplates(Array.isArray(response.data) ? response.data : (response.data?.data || []));
    } catch (err) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [activeCategory]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('Please select a file');
      return;
    }
    if (!uploadForm.name.trim()) {
      setError('Please enter a template name');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadForm.name);
      formData.append('category', uploadForm.category);
      formData.append('description', uploadForm.description);
      formData.append('isDefault', uploadForm.isDefault);
      if (uploadForm.customFields.length > 0) {
        formData.append('customFields', JSON.stringify(uploadForm.customFields));
      }

      const response = await api.post('/personalization/templates', formData);

      setSuccess('Template uploaded successfully');
      resetUploadForm();
      setShowUploadModal(false);
      fetchTemplates();
    } catch (err) {
      setError(err.message || 'Failed to upload template');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTemplate.name.trim()) {
      setError('Please enter a template name');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await api.put(`/personalization/templates/${editingTemplate.id}`, {
        name: editingTemplate.name,
        description: editingTemplate.description,
        category: editingTemplate.category,
        customFields: editingTemplate.customFields || [],
        headerHtml: editingTemplate.headerHtml || '',
        bodyHtml: editingTemplate.bodyHtml || '',
        footerHtml: editingTemplate.footerHtml || '',
        customCss: editingTemplate.customCss || '',
        companyInfo: editingTemplate.companyInfo || {},
        pageSettings: editingTemplate.pageSettings || {},
      });

      setSuccess('Template updated successfully');
      setShowEditModal(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      setError(err.message || 'Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (templateId) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.post(`/personalization/templates/${templateId}/duplicate`);

      setSuccess('Template duplicated successfully');
      fetchTemplates();
    } catch (err) {
      setError(err.message || 'Failed to duplicate template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.delete(`/personalization/templates/${templateId}`);

      setSuccess('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      setError(err.message || 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (templateId) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.put(`/personalization/templates/${templateId}`, { isDefault: true });

      setSuccess('Default template updated');
      fetchTemplates();
    } catch (err) {
      setError(err.message || 'Failed to set default template');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDocument = async (e) => {
    e.preventDefault();
    if (!generateForm.templateId) {
      setError('Please select a template');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await api.post(`/personalization/templates/${generateForm.templateId}/generate`, {
        values: generateForm.values,
        entityType: generateForm.entityType,
        entityId: generateForm.entityId
      }, {
        responseType: 'blob'
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('Document generated successfully');
      setShowGenerateModal(false);
    } catch (err) {
      setError(err.message || 'Failed to generate document');
    } finally {
      setLoading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      name: '',
      category: 'Sales Notes',
      description: '',
      isDefault: false,
      customFields: []
    });
    setUploadFile(null);
  };

  const addCustomField = () => {
    setUploadForm(prev => ({
      ...prev,
      customFields: [
        ...prev.customFields,
        { name: '', type: 'Text', defaultValue: '' }
      ]
    }));
  };

  const updateCustomField = (index, field) => {
    const newFields = [...uploadForm.customFields];
    newFields[index] = { ...newFields[index], ...field };
    setUploadForm(prev => ({ ...prev, customFields: newFields }));
  };

  const removeCustomField = (index) => {
    setUploadForm(prev => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index)
    }));
  };

  const addEditCustomField = () => {
    setEditingTemplate(prev => ({
      ...prev,
      customFields: [
        ...(prev.customFields || []),
        { name: '', type: 'Text', defaultValue: '' }
      ]
    }));
  };

  const updateEditCustomField = (index, field) => {
    const newFields = [...(editingTemplate.customFields || [])];
    newFields[index] = { ...newFields[index], ...field };
    setEditingTemplate(prev => ({ ...prev, customFields: newFields }));
  };

  const removeEditCustomField = (index) => {
    setEditingTemplate(prev => ({
      ...prev,
      customFields: (prev.customFields || []).filter((_, i) => i !== index)
    }));
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Invoices':
      case 'Credit Notes':
        return <FileText className="w-5 h-5" />;
      case 'Purchase Orders':
      case 'Quotations':
      case 'Proforma Invoices':
        return <File className="w-5 h-5" />;
      case 'Packing Lists':
      case 'Certificates of Origin':
        return <FileSpreadsheet className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Document Template Manager</h1>
            <p className="text-slate-600 mt-1">Create, manage, and generate documents from templates</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Upload className="w-5 h-5" />
            Upload Template
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">Success</p>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
            <button
              onClick={() => setSuccess('')}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory('All')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
            activeCategory === 'All'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
          }`}
        >
          All Templates
        </button>
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
              activeCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading && !templates.length ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No templates found</p>
          <p className="text-slate-500 text-sm mt-1">
            {searchQuery ? 'Try adjusting your search' : 'Start by uploading your first template'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Upload Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div key={template.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition">
              {/* Card Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    {getCategoryIcon(template.category)}
                    <h3 className="font-semibold text-slate-900 flex-1">{template.name}</h3>
                  </div>
                  {template.isDefault && (
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" title="Default template" />
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 mb-2">{template.category}</p>
                {template.description && (
                  <p className="text-sm text-slate-600 line-clamp-2">{template.description}</p>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Created</p>
                    <p className="font-medium text-slate-700">{formatDate(template.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Modified</p>
                    <p className="font-medium text-slate-700">{formatDate(template.updatedAt)}</p>
                  </div>
                </div>

                {template.customFields && template.customFields.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Variables</p>
                    <div className="flex flex-wrap gap-1">
                      {template.customFields.map((field, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs"
                        >
                          {`{${field.name}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
                <button
                  onClick={() => {
                    setEditingTemplate(template);
                    setShowEditModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                  title="Edit template"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicate(template.id)}
                  className="flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                  title="Duplicate template"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-white border border-slate-300 rounded hover:bg-red-50 transition"
                  title="Delete template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom Actions */}
              <div className="px-4 py-3 border-t border-slate-200 flex gap-2">
                {!template.isDefault && (
                  <button
                    onClick={() => handleSetDefault(template.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                  >
                    <Star className="w-3 h-3" />
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => {
                    const selected = templates.find(t => t.id === template.id);
                    setGenerateForm({
                      templateId: template.id,
                      values: {},
                      entityType: 'customer',
                      entityId: ''
                    });
                    setShowGenerateModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  <FileText className="w-3 h-3" />
                  Generate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Template Modal */}
      {showUploadModal && (
        <UploadTemplateModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            resetUploadForm();
          }}
          form={uploadForm}
          setForm={setUploadForm}
          file={uploadFile}
          setFile={setUploadFile}
          onSubmit={handleUploadSubmit}
          addCustomField={addCustomField}
          updateCustomField={updateCustomField}
          removeCustomField={removeCustomField}
          loading={loading}
          categories={CATEGORIES}
          fieldTypes={FIELD_TYPES}
        />
      )}

      {/* Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <EditTemplateModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
          }}
          template={editingTemplate}
          setTemplate={setEditingTemplate}
          onSubmit={handleEditSubmit}
          addCustomField={addEditCustomField}
          updateCustomField={updateEditCustomField}
          removeCustomField={removeEditCustomField}
          loading={loading}
          categories={CATEGORIES}
          fieldTypes={FIELD_TYPES}
        />
      )}

      {/* Generate Document Modal */}
      {showGenerateModal && (
        <GenerateDocumentModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          templates={templates}
          form={generateForm}
          setForm={setGenerateForm}
          onSubmit={handleGenerateDocument}
          loading={loading}
        />
      )}
    </div>
  );
}

// Upload Template Modal Component
function UploadTemplateModal({
  isOpen,
  onClose,
  form,
  setForm,
  file,
  setFile,
  onSubmit,
  addCustomField,
  updateCustomField,
  removeCustomField,
  loading,
  categories,
  fieldTypes
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-2xl my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Upload Template</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={onSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Template File
            </label>
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition"
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile && ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(droppedFile.type)) {
                  setFile(droppedFile);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <File className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-auto text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-700 font-medium">Drag and drop your template file here</p>
                  <p className="text-sm text-slate-600 mt-1">or</p>
                  <label className="text-blue-600 font-medium cursor-pointer hover:text-blue-700">
                    click to browse
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx"
                      onChange={(e) => e.target.files && setFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">PDF, DOCX, or XLSX</p>
                </>
              )}
            </div>
          </div>

          {/* Template Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Template Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Invoice Template 2024"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe this template..."
              rows="3"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-slate-900">
                Custom Fields / Variables
              </label>
              <button
                type="button"
                onClick={addCustomField}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-3">Define variables that will be replaced in the document (e.g., {{customer_name}}, {{order_number}})</p>
            <div className="space-y-3">
              {form.customFields.map((field, idx) => (
                <div key={idx} className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateCustomField(idx, { name: e.target.value })}
                      placeholder="Field name (e.g., customer_name)"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateCustomField(idx, { type: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {fieldTypes.map(ft => (
                        <option key={ft} value={ft}>{ft}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={field.defaultValue}
                      onChange={(e) => updateCustomField(idx, { defaultValue: e.target.value })}
                      placeholder="Default value (optional)"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomField(idx)}
                    className="text-red-600 hover:text-red-700 mt-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Default Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isDefault"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-slate-900">
              Set as default template for this category
            </label>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Upload Template
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Template Modal Component (with HTML template editor)
function EditTemplateModal({
  isOpen,
  onClose,
  template,
  setTemplate,
  onSubmit,
  addCustomField,
  updateCustomField,
  removeCustomField,
  loading,
  categories,
  fieldTypes
}) {
  const [activeTab, setActiveTab] = useState('general');

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'header', label: 'Header HTML' },
    { id: 'body', label: 'Body HTML' },
    { id: 'footer', label: 'Footer HTML' },
    { id: 'css', label: 'Custom CSS' },
    { id: 'fields', label: 'Variables' },
    { id: 'company', label: 'Company Info' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-4xl my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Edit Template</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <form onSubmit={onSubmit} className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Template Name</label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                  placeholder="e.g., Invoice Template 2024"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Category</label>
                <select
                  value={template.category}
                  onChange={(e) => setTemplate({ ...template, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Description</label>
                <textarea
                  value={template.description || ''}
                  onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                  placeholder="Describe this template..."
                  rows="3"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Page Size</label>
                  <select
                    value={template.pageSettings?.size || 'A4'}
                    onChange={(e) => setTemplate({
                      ...template,
                      pageSettings: { ...(template.pageSettings || {}), size: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Orientation</label>
                  <select
                    value={template.pageSettings?.orientation || 'portrait'}
                    onChange={(e) => setTemplate({
                      ...template,
                      pageSettings: { ...(template.pageSettings || {}), orientation: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Header HTML Tab */}
          {activeTab === 'header' && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Header HTML
              </label>
              <p className="text-xs text-slate-500 mb-3">
                HTML content for the document header. Use Handlebars placeholders like {'{{company.name}}'}, {'{{company.logo}}'}.
              </p>
              <textarea
                value={template.headerHtml || ''}
                onChange={(e) => setTemplate({ ...template, headerHtml: e.target.value })}
                placeholder={'<div class="header">\n  <h1>{{company.name}}</h1>\n  <p>{{company.address}}</p>\n</div>'}
                rows="12"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Body HTML Tab */}
          {activeTab === 'body' && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Body HTML
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Main document body. Use placeholders like {'{{orderNumber}}'}, {'{{customerName}}'}, {'{{#each items}}...{{/each}}'} for line items.
              </p>
              <textarea
                value={template.bodyHtml || ''}
                onChange={(e) => setTemplate({ ...template, bodyHtml: e.target.value })}
                placeholder={'<div class="body">\n  <h2>Sales Order: {{orderNumber}}</h2>\n  <table>\n    <thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead>\n    <tbody>\n      {{#each items}}\n      <tr><td>{{this.product}}</td><td>{{this.qty}}</td><td>{{this.price}}</td></tr>\n      {{/each}}\n    </tbody>\n  </table>\n  <p>Total: {{total}}</p>\n</div>'}
                rows="16"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Footer HTML Tab */}
          {activeTab === 'footer' && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Footer HTML
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Footer content. Use {'{{pageNumber}}'}, {'{{totalPages}}'}, {'{{company.phone}}'}, etc.
              </p>
              <textarea
                value={template.footerHtml || ''}
                onChange={(e) => setTemplate({ ...template, footerHtml: e.target.value })}
                placeholder={'<div class="footer">\n  <p>{{company.name}} | {{company.phone}} | {{company.email}}</p>\n  <p>Page {{pageNumber}} of {{totalPages}}</p>\n</div>'}
                rows="8"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Custom CSS Tab */}
          {activeTab === 'css' && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Custom CSS
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Custom styles for the template. Controls fonts, colors, spacing, table styles, etc.
              </p>
              <textarea
                value={template.customCss || ''}
                onChange={(e) => setTemplate({ ...template, customCss: e.target.value })}
                placeholder={'body { font-family: Arial, sans-serif; color: #333; }\n.header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; }\n.footer { border-top: 1px solid #ccc; padding-top: 10px; font-size: 10px; }\ntable { width: 100%; border-collapse: collapse; }\ntable th, table td { border: 1px solid #ddd; padding: 8px; text-align: left; }\ntable th { background-color: #f8f9fa; font-weight: bold; }'}
                rows="14"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Variables Tab */}
          {activeTab === 'fields' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-slate-900">
                  Custom Fields / Variables
                </label>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </button>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Define variables that will be replaced in the document (e.g., {'{{customer_name}}'}, {'{{order_number}}'})
              </p>
              <div className="space-y-3">
                {(template.customFields || []).map((field, idx) => (
                  <div key={idx} className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateCustomField(idx, { name: e.target.value })}
                        placeholder="Field name"
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <select
                          value={field.type}
                          onChange={(e) => updateCustomField(idx, { type: e.target.value })}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {fieldTypes.map(ft => (
                            <option key={ft} value={ft}>{ft}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={field.defaultValue || ''}
                          onChange={(e) => updateCustomField(idx, { defaultValue: e.target.value })}
                          placeholder="Default value"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomField(idx)}
                      className="text-red-600 hover:text-red-700 mt-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!template.customFields || template.customFields.length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-4">No custom fields defined. Click "Add Field" to create one.</p>
                )}
              </div>
            </div>
          )}

          {/* Company Info Tab */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 mb-2">
                Company information that will be available as {'{{company.name}}'}, {'{{company.address}}'}, etc. in the template.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={template.companyInfo?.name || ''}
                    onChange={(e) => setTemplate({
                      ...template,
                      companyInfo: { ...(template.companyInfo || {}), name: e.target.value }
                    })}
                    placeholder="Your Company Ltd."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={template.companyInfo?.phone || ''}
                    onChange={(e) => setTemplate({
                      ...template,
                      companyInfo: { ...(template.companyInfo || {}), phone: e.target.value }
                    })}
                    placeholder="+1 234 567 8900"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={template.companyInfo?.email || ''}
                    onChange={(e) => setTemplate({
                      ...template,
                      companyInfo: { ...(template.companyInfo || {}), email: e.target.value }
                    })}
                    placeholder="info@company.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={template.companyInfo?.website || ''}
                    onChange={(e) => setTemplate({
                      ...template,
                      companyInfo: { ...(template.companyInfo || {}), website: e.target.value }
                    })}
                    placeholder="www.company.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={template.companyInfo?.address || ''}
                  onChange={(e) => setTemplate({
                    ...template,
                    companyInfo: { ...(template.companyInfo || {}), address: e.target.value }
                  })}
                  placeholder="123 Business St, Suite 100, City, State 12345"
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax ID / Registration Number</label>
                <input
                  type="text"
                  value={template.companyInfo?.taxId || ''}
                  onChange={(e) => setTemplate({
                    ...template,
                    companyInfo: { ...(template.companyInfo || {}), taxId: e.target.value }
                  })}
                  placeholder="Tax ID or registration number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
                <input
                  type="text"
                  value={template.companyInfo?.logo || ''}
                  onChange={(e) => setTemplate({
                    ...template,
                    companyInfo: { ...(template.companyInfo || {}), logo: e.target.value }
                  })}
                  placeholder="https://your-domain.com/logo.png"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Generate Document Modal Component
function GenerateDocumentModal({
  isOpen,
  onClose,
  templates,
  form,
  setForm,
  onSubmit,
  loading
}) {
  if (!isOpen) return null;

  const selectedTemplate = templates.find(t => t.id === form.templateId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-2xl my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Generate Document</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={onSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Select Template
            </label>
            <select
              value={form.templateId}
              onChange={(e) => {
                setForm({
                  ...form,
                  templateId: e.target.value,
                  values: {}
                });
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </option>
              ))}
            </select>
          </div>

          {/* Custom Fields Form */}
          {selectedTemplate && selectedTemplate.customFields && selectedTemplate.customFields.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Template Variables
              </label>
              <div className="space-y-3">
                {selectedTemplate.customFields.map((field, idx) => (
                  <div key={idx}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {field.name}
                      <span className="text-slate-500 text-xs ml-1">({field.type})</span>
                    </label>
                    <input
                      type={field.type === 'Date' ? 'date' : field.type === 'Number' ? 'number' : 'text'}
                      value={form.values[field.name] || ''}
                      onChange={(e) => setForm({
                        ...form,
                        values: {
                          ...form.values,
                          [field.name]: e.target.value
                        }
                      })}
                      placeholder={field.defaultValue || `Enter ${field.name}`}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entity Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Link Entity Type
              </label>
              <select
                value={form.entityType}
                onChange={(e) => setForm({ ...form, entityType: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="customer">Customer</option>
                <option value="order">Order</option>
                <option value="invoice">Invoice</option>
                <option value="supplier">Supplier</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Entity ID
              </label>
              <input
                type="text"
                value={form.entityId}
                onChange={(e) => setForm({ ...form, entityId: e.target.value })}
                placeholder="Enter ID (optional)"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !form.templateId}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Generate Document
          </button>
        </div>
      </div>
    </div>
  );
}
