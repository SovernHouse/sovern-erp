import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import FileUpload from '../../components/FileUpload';
import { Button } from '../../components/FormFields';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import { shippingAPI } from '../../services/api';
import { formatDate, formatFileSize } from '../../utils/formatters';
import { DOCUMENT_TYPES, DOCUMENT_LABELS } from '../../utils/constants';
import toast from 'react-hot-toast';

function DocumentUpload() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, docId: null });
  const [selectedDocType, setSelectedDocType] = useState(Object.values(DOCUMENT_TYPES)[0]);

  useEffect(() => {
    loadShipment();
  }, [id]);

  const loadShipment = async () => {
    setIsLoading(true);
    try {
      const response = await shippingAPI.getShipment(id);
      setShipment(response.data);
    } catch (error) {
      toast.error('Failed to load shipment');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentUpload = async (files) => {
    if (!files || files.length === 0) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading({ ...isUploading, [selectedDocType]: true });
    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      await shippingAPI.uploadDocument(id, selectedDocType, formData);
      toast.success('Document uploaded successfully');
      await loadShipment();
      setSelectedDocType(Object.values(DOCUMENT_TYPES)[0]);
    } catch (error) {
      toast.error('Failed to upload document');
      console.error(error);
    } finally {
      setIsUploading({ ...isUploading, [selectedDocType]: false });
    }
  };

  const handleDeleteDocument = async () => {
    setIsUploading({ ...isUploading, [deleteConfirm.docId]: true });
    try {
      await shippingAPI.deleteDocument(id, deleteConfirm.docId);
      toast.success('Document deleted successfully');
      setDeleteConfirm({ open: false, docId: null });
      await loadShipment();
    } catch (error) {
      toast.error('Failed to delete document');
      console.error(error);
    } finally {
      setIsUploading({ ...isUploading, [deleteConfirm.docId]: false });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!shipment) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Shipment not found</p>
      </div>
    );
  }

  const documentTypes = Object.entries(DOCUMENT_TYPES).map(([key, value]) => ({
    value: value,
    label: DOCUMENT_LABELS[value] || value,
  }));

  const uploadedDocs = shipment.documents || [];

  // Group documents by type
  const docsByType = {};
  documentTypes.forEach((type) => {
    docsByType[type.value] = uploadedDocs.filter((d) => d.type === type.value);
  });

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate(`/shipping/${id}`)}
        className="flex items-center gap-2 text-factory-600 hover:text-factory-700 font-medium mb-2"
      >
        <ChevronLeft size={20} />
        Back to Shipment
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-800">Shipping Documents</h1>
        <p className="text-gray-600 mt-1">Manage shipping and customs documents for shipment {shipment.shipmentId}</p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Required Documents</h3>
        <p className="text-sm text-blue-800">
          Ensure all required shipping documents are uploaded before shipment departure. Missing documents may delay customs clearance.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="col-span-1 bg-white rounded-lg shadow p-6 h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Upload Document</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Type
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <FileUpload
              onFilesSelected={handleDocumentUpload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              maxSize={50 * 1024 * 1024}
              isLoading={isUploading[selectedDocType]}
            />
          </div>
        </div>

        {/* Documents List */}
        <div className="col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Uploaded Documents</h2>

          <div className="space-y-4">
            {Object.entries(docsByType).map(([docType, docs]) => (
              <div key={docType}>
                <h3 className="font-semibold text-gray-800 text-sm mb-3">
                  {DOCUMENT_LABELS[docType] || docType}
                </h3>

                {docs.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {docs.map((doc, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">
                              {doc.fileName}
                            </p>
                            <p className="text-xs text-gray-600">
                              {formatFileSize(doc.fileSize)} • Uploaded{' '}
                              {formatDate(doc.uploadDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = doc.fileUrl;
                              link.download = doc.fileName;
                              link.click();
                            }}
                            className="p-2 hover:bg-gray-200 rounded-lg text-blue-600 transition-colors"
                            title="Download"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                open: true,
                                docId: doc.id,
                              })
                            }
                            className="p-2 hover:bg-gray-200 rounded-lg text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-4 p-3 bg-gray-50 rounded-lg">
                    <AlertCircle size={16} />
                    Not uploaded
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Document Checklist */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">Document Checklist</h3>
            <div className="space-y-2 text-sm">
              {[
                { type: 'commercial_invoice', required: true },
                { type: 'packing_list', required: true },
                { type: 'bill_of_lading', required: true },
                { type: 'certificate_of_origin', required: true },
                { type: 'insurance_certificate', required: false },
                { type: 'customs_declaration', required: false },
                { type: 'fumigation_certificate', required: false },
              ].map((item) => {
                const uploaded = docsByType[item.type]?.length > 0;
                return (
                  <div
                    key={item.type}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={uploaded}
                      disabled
                      className="w-4 h-4"
                    />
                    <span className={uploaded ? 'text-gray-800' : 'text-gray-500'}>
                      {DOCUMENT_LABELS[item.type] || item.type}
                    </span>
                    {item.required && (
                      <span className="text-xs text-red-600 font-semibold">
                        Required
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, docId: null })}
        onConfirm={handleDeleteDocument}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        isDangerous={true}
      />
    </div>
  );
}

export default DocumentUpload;
