import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, Filter } from 'lucide-react';
import FileUpload from '../../components/FileUpload';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { Button, Select } from '../../components/FormFields';
import ConfirmDialog from '../../components/ConfirmDialog';
import { documentsAPI } from '../../services/api';
import { formatDate, formatFileSize } from '../../utils/formatters';
import { DOCUMENT_LABELS } from '../../utils/constants';
import toast from 'react-hot-toast';

function DocumentCenter() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({ type: 'other', poNumber: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, docId: null });

  useEffect(() => {
    loadDocuments();
  }, [filterType, searchTerm]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await documentsAPI.list({
        type: filterType === 'all' ? undefined : filterType,
        search: searchTerm,
      });
      setDocuments(response.data);
    } catch (error) {
      toast.error('Failed to load documents');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('documentType', uploadData.type);
      formData.append('poNumber', uploadData.poNumber);

      await documentsAPI.upload(formData);
      toast.success('Document uploaded successfully');
      setUploadModal(false);
      setUploadData({ type: 'other', poNumber: '' });
      await loadDocuments();
    } catch (error) {
      toast.error('Failed to upload document');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await documentsAPI.delete(deleteConfirm.docId);
      toast.success('Document deleted');
      setDeleteConfirm({ open: false, docId: null });
      await loadDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
      console.error(error);
    }
  };

  const columns = [
    { key: 'fileName', label: 'File Name', sortable: true },
    { key: 'documentType', label: 'Type', sortable: true, render: (type) => DOCUMENT_LABELS[type] || type },
    { key: 'poNumber', label: 'PO Number', sortable: true, render: (po) => po || '-' },
    {
      key: 'fileSize',
      label: 'Size',
      render: (size) => formatFileSize(size),
    },
    {
      key: 'uploadDate',
      label: 'Uploaded',
      render: (date) => formatDate(date),
      sortable: true,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const link = document.createElement('a');
              link.href = row.fileUrl;
              link.download = row.fileName;
              link.click();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg text-blue-600 transition-colors"
            title="Download"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() =>
              setDeleteConfirm({ open: true, docId: row.id })
            }
            className="p-2 hover:bg-gray-100 rounded-lg text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  const docTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...Object.entries(DOCUMENT_LABELS).map(([key, label]) => ({
      value: key,
      label,
    })),
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Document Center</h1>
          <p className="text-gray-600 mt-1">Manage and organize all business documents</p>
        </div>
        <Button
          onClick={() => setUploadModal(true)}
          className="flex items-center gap-2"
        >
          <Upload size={20} />
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by file name or PO number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
        />
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          options={docTypeOptions}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-factory-600">
          <p className="text-sm text-gray-600">Total Documents</p>
          <p className="text-2xl font-bold text-gray-800">{documents.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
          <p className="text-sm text-gray-600">This Month</p>
          <p className="text-2xl font-bold text-gray-800">
            {
              documents.filter((d) => {
                const docDate = new Date(d.uploadDate);
                const now = new Date();
                return (
                  docDate.getMonth() === now.getMonth() &&
                  docDate.getFullYear() === now.getFullYear()
                );
              }).length
            }
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-600">
          <p className="text-sm text-gray-600">Total Size</p>
          <p className="text-2xl font-bold text-gray-800">
            {formatFileSize(
              documents.reduce((sum, d) => sum + (d.fileSize || 0), 0)
            )}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-600">
          <p className="text-sm text-gray-600">By PO</p>
          <p className="text-2xl font-bold text-gray-800">
            {new Set(documents.map((d) => d.poNumber)).size}
          </p>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={documents}
          isLoading={isLoading}
          emptyMessage="No documents found"
        />
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={uploadModal}
        onClose={() => setUploadModal(false)}
        title="Upload Document"
        size="md"
        footer={
          <Button
            variant="outline"
            onClick={() => setUploadModal(false)}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <Select
              value={uploadData.type}
              onChange={(e) =>
                setUploadData({ ...uploadData, type: e.target.value })
              }
              options={Object.entries(DOCUMENT_LABELS).map(([key, label]) => ({
                value: key,
                label,
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Associated PO Number (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., PO-2024-001"
              value={uploadData.poNumber}
              onChange={(e) =>
                setUploadData({ ...uploadData, poNumber: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
            />
          </div>

          <FileUpload
            onFilesSelected={handleUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
            maxSize={100 * 1024 * 1024}
            isLoading={isUploading}
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, docId: null })}
        onConfirm={handleDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        isDangerous={true}
      />
    </div>
  );
}

export default DocumentCenter;
