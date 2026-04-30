/**
 * BulkImport.jsx
 *
 * Three-step wizard for importing:
 *   - CRM Leads (from CSV/Excel)
 *   - Products (CSV/Excel → preview → column map → confirm)
 *
 * Step 1: Choose import type
 * Step 2: Upload file — drag-and-drop or click
 * Step 3: Preview + column mapping
 * Step 4: Run import + show results
 *
 * All API calls go through the shared api service (JWT auth interceptor).
 */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import {
  ArrowLeft,
  Upload,
  Users,
  Package,
  CheckCircle,
  AlertTriangle,
  Loader,
  FileText,
  ChevronRight,
  X,
} from 'lucide-react'
import api from '../../services/api'

// Thin wrappers — multipart upload doesn't go through the api service auto-unwrap
const crmImportAPI = {
  preview: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/crm/leads/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  confirm: (rows, columnMapping) =>
    api.post('/crm/leads/import/confirm', { rows, columnMapping }),
}

const productImportAPI = {
  preview: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/personalization/products/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  confirm: (rows, columnMapping) =>
    api.post('/personalization/products/import/confirm', { rows, columnMapping }),
}

// ─── Import type definitions ─────────────────────────────────────────────────
const IMPORT_TYPES = [
  {
    id: 'leads',
    label: 'CRM Leads',
    description: 'Import prospects and leads from a CSV or Excel file',
    icon: Users,
    color: 'blue',
    fields: ['companyName*', 'contactName', 'email*', 'phone', 'country', 'vertical', 'status', 'source', 'website', 'notes'],
    requiredFields: ['companyName', 'email'],
  },
  {
    id: 'products',
    label: 'Products',
    description: 'Import product catalog from a CSV or Excel file',
    icon: Package,
    color: 'green',
    fields: ['name*', 'sku', 'description', 'category', 'unit', 'price', 'cost'],
    requiredFields: ['name'],
  },
]

// ─── Step indicators ──────────────────────────────────────────────────────────
const STEPS = ['Choose Type', 'Upload File', 'Preview & Map', 'Results']

function StepBar({ current }) {
  return (
    <div className="flex items-center space-x-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
              i < current
                ? 'bg-green-600 text-white'
                : i === current
                ? 'bg-primary-600 text-white'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          <span
            className={`ml-1.5 text-sm ${
              i === current ? 'font-semibold text-slate-900' : 'text-slate-500'
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <ChevronRight className="w-4 h-4 text-slate-300 mx-2" />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Drag-and-drop file upload area ──────────────────────────────────────────
function FileDropZone({ onFile, isLoading }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile]
  )

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !isLoading && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-primary-500 bg-primary-50'
          : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
      <p className="text-slate-700 font-medium mb-1">
        {isLoading ? 'Parsing file...' : 'Drop your file here'}
      </p>
      <p className="text-sm text-slate-500">or click to browse — CSV, XLSX, XLS up to 5MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  )
}

// ─── Column mapping row ───────────────────────────────────────────────────────
function ColumnMapRow({ header, value, onChange, targetFields }) {
  return (
    <div className="flex items-center space-x-3 py-2 border-b border-slate-100 last:border-0">
      <div className="w-48 text-sm font-medium text-slate-700 truncate" title={header}>
        {header}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
      <select
        value={value || ''}
        onChange={(e) => onChange(header, e.target.value || null)}
        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
        <option value="">-- ignore --</option>
        {targetFields.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export default function BulkImport() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [importType, setImportType] = useState(null)
  const [preview, setPreview] = useState(null) // { headers, sampleRows, allRows, totalRows }
  const [columnMapping, setColumnMapping] = useState({})
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [showImportConfirm, setShowImportConfirm] = useState(false)

  const typeConfig = IMPORT_TYPES.find((t) => t.id === importType)

  // ── Step 0: choose type ──────────────────────────────────────────────────────
  const handleChooseType = (typeId) => {
    setImportType(typeId)
    setPreview(null)
    setColumnMapping({})
    setResults(null)
    setStep(1)
  }

  // ── Step 1: upload ───────────────────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    setFileName(file.name)
    setIsLoading(true)
    try {
      const apiModule = importType === 'leads' ? crmImportAPI : productImportAPI
      const res = await apiModule.preview(file)
      const data = res.data

      setPreview(data)

      // Auto-map columns where names obviously match
      const autoMap = {}
      const targets = typeConfig.fields.map((f) => f.replace('*', ''))
      for (const header of data.headers) {
        const norm = header.toLowerCase().replace(/[^a-z]/g, '')
        const match = targets.find(
          (t) => t.toLowerCase() === norm || norm.includes(t.toLowerCase())
        )
        if (match) autoMap[header] = match
      }
      setColumnMapping(autoMap)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to parse file')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: column mapping → confirm ─────────────────────────────────────────
  const handleRequestConfirm = () => {
    setShowImportConfirm(true)
  }

  const handleConfirmImport = async () => {
    setShowImportConfirm(false)
    setIsLoading(true)
    try {
      const apiModule = importType === 'leads' ? crmImportAPI : productImportAPI
      const rows = preview.allRows || preview.sampleRows
      const res = await apiModule.confirm(rows, columnMapping)
      setResults(res.data)
      setStep(3)
      const created = res.data?.created || 0
      if (created > 0) toast.success(`Successfully imported ${created} record${created !== 1 ? 's' : ''}.`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed')
    } finally {
      setIsLoading(false)
    }
  }

  const updateMapping = (header, target) => {
    setColumnMapping((prev) => {
      const next = { ...prev }
      if (target) next[header] = target
      else delete next[header]
      return next
    })
  }

  const handleReset = () => {
    setStep(0)
    setImportType(null)
    setPreview(null)
    setColumnMapping({})
    setResults(null)
    setFileName('')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bulk Import</h1>
          <p className="text-sm text-slate-500 mt-0.5">Import leads, products, or price lists from CSV or Excel</p>
        </div>
      </div>

      <StepBar current={step} />

      {/* Step 0 — Choose type */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">What would you like to import?</p>
          <div className="grid grid-cols-2 gap-4">
            {IMPORT_TYPES.map((type) => {
              const Icon = type.icon
              const colorMap = {
                blue: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
                green: 'border-green-200 hover:border-green-400 hover:bg-green-50',
              }
              return (
                <button
                  key={type.id}
                  onClick={() => handleChooseType(type.id)}
                  className={`p-6 border-2 rounded-xl text-left transition-colors ${colorMap[type.color]}`}
                >
                  <Icon className={`w-8 h-8 mb-3 ${type.color === 'blue' ? 'text-blue-600' : 'text-green-600'}`} />
                  <p className="font-semibold text-slate-900 mb-1">{type.label}</p>
                  <p className="text-sm text-slate-500">{type.description}</p>
                  <div className="mt-3 text-xs text-slate-400">
                    Columns: {type.fields.join(', ')}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                Importing: <span className="text-primary-600">{typeConfig?.label}</span>
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Required columns: {typeConfig?.requiredFields.join(', ')}
              </p>
            </div>
            <button
              onClick={() => setStep(0)}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center space-x-1"
            >
              <X className="w-4 h-4" />
              <span>Change type</span>
            </button>
          </div>

          <FileDropZone onFile={handleFileUpload} isLoading={isLoading} />

          {/* Template download hint */}
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <FileText className="w-4 h-4 inline mr-1 align-text-bottom text-slate-400" />
            <strong>Tip:</strong> Your file can use any column names — you will map them to the
            correct fields in the next step. The only requirements are that{' '}
            <strong>{typeConfig?.requiredFields.join(' and ')}</strong> columns are present.
          </div>

          {isLoading && (
            <div className="flex items-center justify-center space-x-2 py-4 text-slate-500">
              <Loader className="w-5 h-5 animate-spin" />
              <span>Parsing {fileName}...</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Preview and column mapping */}
      {step === 2 && preview && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                {preview.totalRows || preview.allRows?.length || 0} rows found in{' '}
                <span className="text-primary-600">{fileName}</span>
              </p>
              <p className="text-sm text-slate-500">Map your file columns to the correct fields below</p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center space-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Re-upload</span>
            </button>
          </div>

          {/* Column mapping */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">Column Mapping</h3>
              <p className="text-xs text-slate-500 mt-0.5">Columns that couldn't be auto-detected are set to "ignore"</p>
            </div>
            <div className="p-4">
              {preview.headers.map((header) => (
                <ColumnMapRow
                  key={header}
                  header={header}
                  value={columnMapping[header]}
                  onChange={updateMapping}
                  targetFields={typeConfig?.fields.map((f) => f.replace('*', '')) || []}
                />
              ))}
            </div>
          </div>

          {/* Sample data */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">
                Preview (first {preview.sampleRows?.length} rows)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {preview.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                        {h}
                        {columnMapping[h] && (
                          <span className="ml-1 text-primary-500">→ {columnMapping[h]}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(preview.sampleRows || []).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleRequestConfirm}
              disabled={isLoading}
              className="flex items-center space-x-2 px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>
                {isLoading
                  ? 'Importing...'
                  : `Import ${preview.allRows?.length || preview.totalRows || 0} rows`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Results */}
      {step === 3 && results && (
        <div className="space-y-6">
          {/* Summary card */}
          <div
            className={`rounded-xl p-6 border-2 ${
              results.skipped === 0
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex items-center space-x-3 mb-4">
              {results.skipped === 0 ? (
                <CheckCircle className="w-7 h-7 text-green-600" />
              ) : (
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              )}
              <h2 className="text-lg font-semibold text-slate-900">Import Complete</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-green-700">{results.created || 0}</p>
                <p className="text-sm text-slate-600 mt-0.5">Created</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-600">{results.skipped || 0}</p>
                <p className="text-sm text-slate-600 mt-0.5">Skipped</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600">
                  {(results.errors || []).length}
                </p>
                <p className="text-sm text-slate-600 mt-0.5">Errors</p>
              </div>
            </div>
          </div>

          {/* Error list */}
          {results.errors?.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900 text-sm">
                  Skipped / Errors ({results.errors.length})
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {results.errors.map((e, i) => (
                  <div key={i} className="flex items-start space-x-3 px-4 py-3 border-b border-slate-100 last:border-0">
                    <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{e.row}</p>
                      <p className="text-xs text-slate-500">{e.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Import Another File
            </button>
            <button
              onClick={() =>
                navigate(importType === 'leads' ? '/crm/leads' : '/products')
              }
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              View {typeConfig?.label}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showImportConfirm}
        title="Confirm Import"
        message={`You are about to import ${preview?.allRows?.length || preview?.totalRows || 0} ${typeConfig?.label || 'records'} into the system. This action cannot be undone. Proceed?`}
        confirmLabel="Import Now"
        onConfirm={handleConfirmImport}
        onCancel={() => setShowImportConfirm(false)}
      />
    </div>
  )
}
