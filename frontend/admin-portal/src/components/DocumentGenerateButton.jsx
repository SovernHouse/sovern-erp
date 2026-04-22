import { useState, useEffect } from 'react'
import { FileText, Download, X, Loader, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentTemplatesAPI } from '../services/api'

/**
 * DocumentGenerateButton - A button + modal combo for generating documents from templates
 *
 * @param {string} documentType - e.g., 'sales_order', 'quotation', 'invoice', 'purchase_order', 'packing_list'
 * @param {number|string} entityId - The ID of the entity to generate the document for
 * @param {object} entityData - Optional preloaded entity data to pass to the template
 * @param {string} label - Optional button label override
 */
export default function DocumentGenerateButton({
  documentType,
  entityId,
  entityData = {},
  label = 'Generate Document',
}) {
  const [showModal, setShowModal] = useState(false)
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Map documentType to the template category used in the backend
  const categoryMap = {
    sales_order: 'Sales Notes',
    quotation: 'Quotations',
    invoice: 'Invoices',
    purchase_order: 'Purchase Orders',
    packing_list: 'Packing Lists',
    proforma_invoice: 'Proforma Invoices',
    credit_note: 'Credit Notes',
  }

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const category = categoryMap[documentType] || ''
      const response = await documentTemplatesAPI.getAll({ category })
      const data = response.data
      setTemplates(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load templates:', err)
      toast.error('Failed to load document templates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpen = () => {
    setShowModal(true)
    fetchTemplates()
  }

  const handlePreview = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template first')
      return
    }
    try {
      setIsGenerating(true)
      const response = await documentTemplatesAPI.preview(selectedTemplate, {
        entityType: documentType,
        entityId,
        values: entityData,
      })
      setPreviewHtml(response.data?.html || response.data || '<p>Preview not available</p>')
      setShowPreview(true)
    } catch (err) {
      console.error('Preview failed:', err)
      toast.error('Failed to generate preview')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template first')
      return
    }
    try {
      setIsGenerating(true)
      const response = await documentTemplatesAPI.generate(selectedTemplate, {
        entityType: documentType,
        entityId,
        values: entityData,
      })

      // Download the generated file
      const blob = response.data
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${documentType}-${entityId}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Document generated and downloaded')
      setShowModal(false)
    } catch (err) {
      console.error('Generate failed:', err)
      toast.error('Failed to generate document. Make sure the template is configured correctly.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
      >
        <FileText className="w-4 h-4" />
        {label}
      </button>

      {/* Generate Document Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Generate Document</h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setShowPreview(false)
                  setPreviewHtml('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Select Template
                </label>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    No templates found for this document type. Go to Documents &gt; Document Templates to create one.
                  </div>
                ) : (
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Choose a template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="text-xs text-slate-500">
                Document type: <span className="font-medium">{categoryMap[documentType] || documentType}</span>
                {' | '}Entity ID: <span className="font-medium">{entityId}</span>
              </div>

              {/* Preview area */}
              {showPreview && previewHtml && (
                <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-auto bg-slate-50">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                  setShowPreview(false)
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={!selectedTemplate || isGenerating}
                className="px-4 py-2 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 font-medium transition disabled:opacity-50"
              >
                Preview
              </button>
              <button
                onClick={handleGenerate}
                disabled={!selectedTemplate || isGenerating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Generate & Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
