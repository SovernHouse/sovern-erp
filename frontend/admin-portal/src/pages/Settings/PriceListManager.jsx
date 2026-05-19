import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Eye,
  X,
  ChevronDown,
  Save,
  AlertCircle,
  Check,
  GripVertical
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { customersAPI, factoriesAPI } from '../../services/api'
import BrandPicker from '../../components/BrandPicker'
import LoadingSpinner from '../../components/LoadingSpinner'

// Single source of truth for the standard item columns. `k` is the
// stable key stored in PriceList.hiddenColumns / columnLabels and the
// key the PDF renderer's COL_ORDER uses. `field` is the PriceListItem
// property the input edits. `required: true` means the column cannot
// be hidden (only renamed); SKU, Product Name, Selling Price.
const STANDARD_ITEM_COLS = [
  { k: 'sku',         label: 'SKU',           field: 'sku',          type: 'text',   align: 'left',  required: true },
  { k: 'productName', label: 'Product Name',  field: 'productName',  type: 'text',   align: 'left',  required: true },
  { k: 'price',       label: 'Selling Price', field: 'sellingPrice', type: 'number', align: 'right', required: true, step: '0.01' },
  { k: 'cost',        label: 'FOB Price',     field: 'costPrice',    type: 'number', align: 'right', step: '0.01' },
  { k: 'moq',         label: 'Min Order',     field: 'minimumOrder', type: 'number', align: 'right', step: '1' },
  { k: 'lead',        label: 'Lead Time',     field: 'leadTimeDays', type: 'number', align: 'right', step: '1' },
  { k: 'unit',        label: 'Unit',          field: 'unit',         type: 'text',   align: 'left' },
  { k: 'notes',       label: 'Notes',         field: 'notes',        type: 'text',   align: 'left' },
]

const PriceListManager = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // State management
  const [priceLists, setPriceLists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPriceList, setSelectedPriceList] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showItemsView, setShowItemsView] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importMode, setImportMode] = useState('append')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    currencyCode: 'USD',
    brandCode: '',
    validFrom: '',
    validTo: '',
    customerId: '',
    factoryId: '',
    isActive: true,
    items: []
  })

  const [items, setItems] = useState([])
  // Phase 4.28d follow-up: parent option lists for the form's pickers
  // (replaces the raw UUID text inputs). Loaded once on mount; each
  // option shows the companyName + brand context so the operator picks
  // by name not by UUID.
  const [customers, setCustomers] = useState([])
  const [factories, setFactories] = useState([])
  const [columnDefs, setColumnDefs] = useState([])
  // Phase 4.28d follow-up: which standard PDF columns to HIDE. Set of
  // 'unit' / 'moq' / 'lead' / 'cost' / 'notes'. SKU + Product + Price
  // are required (never hidden).
  const [hiddenStandardCols, setHiddenStandardCols] = useState([])
  // Phase 4.28d second follow-up (2026-05-17): per-PriceList overrides
  // for standard column headers (e.g. cost: 'FOB'). Empty / missing key
  // falls back to the default label from STANDARD_ITEM_COLS.
  const [columnLabels, setColumnLabels] = useState({})
  // Phase 4.28m: per-list manual width override for each column. Shape:
  // { sku: 0.30, productName: 0.32, price: 0.18, ... }. Empty / missing
  // key falls back to the renderer's default ratio. Number 0.05–0.50.
  const [columnWidths, setColumnWidths] = useState({})
  // Free-text block rendered at the bottom of the PDF (payment terms,
  // duty breakdown, Incoterm caveat, sample policy).
  //
  // Phase 4.28n: new PriceLists pre-fill with the standard Incoterm
  // flexibility note. Editable / clearable per list.
  const DEFAULT_FOOTER_NOTES =
    'Payment: 30% T/T deposit, 70% before shipment.\n'
    + 'DDP, CIF available upon request.\n'
    + 'Lead times exclude ocean freight.'
  const [footerNotes, setFooterNotes] = useState(DEFAULT_FOOTER_NOTES)

  useEffect(() => {
    customersAPI.getAll({ limit: 500 }).then(r => setCustomers(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => {})
    factoriesAPI.getAll({ limit: 500 }).then(r => setFactories(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => {})
  }, [])

  // Load price lists on mount
  useEffect(() => {
    loadPriceLists()
  }, [])

  // Phase 4.28d follow-up: when the detail page sends user back here with
  // ?edit=<id>, auto-open the edit modal for that PriceList after the
  // list loads. Clears the query param afterwards so refreshes don't
  // re-trigger.
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || isLoading || priceLists.length === 0) return
    const target = priceLists.find((p) => p.id === editId)
    if (target) {
      handleEditPriceList(target).then(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('edit')
        setSearchParams(next, { replace: true })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, priceLists])

  const loadPriceLists = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('/personalization/price-lists')
      setPriceLists(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load price lists:', error)
      toast.error('Failed to load price lists')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPriceListDetails = async (id) => {
    try {
      const response = await api.get(`/personalization/price-lists/${id}`)
      const priceList = response.data
      setSelectedPriceList(priceList)
      setFormData({
        name: priceList.name || '',
        description: priceList.description || '',
        currencyCode: priceList.currencyCode || 'USD',
        brandCode: priceList.brandCode || '',
        validFrom: priceList.validFrom ? String(priceList.validFrom).slice(0, 10) : '',
        validTo:   priceList.validTo   ? String(priceList.validTo).slice(0, 10)   : '',
        customerId: priceList.customerId || '',
        factoryId: priceList.factoryId || '',
        isActive: priceList.isActive !== false,
        items: []
      })
      // customColumns on each PriceListItem is a DataTypes.JSON field
      // and comes back stringified per L-047 / L-053. Parse it eagerly
      // so the custom-column inputs can bind without each input doing
      // its own JSON.parse.
      const normalizedItems = (priceList.items || []).map((it) => {
        let cc = it.customColumns
        if (typeof cc === 'string') {
          try { cc = JSON.parse(cc) } catch (_) { cc = {} }
        }
        return { ...it, customColumns: cc && typeof cc === 'object' && !Array.isArray(cc) ? cc : {} }
      })
      setItems(normalizedItems)
      // columnDefinitions + hiddenColumns are DataTypes.JSON on SQLite and
      // come back stringified per L-047 / L-053. Without this parse the
      // Array.isArray check below fails and the form defaults to []; the
      // user sees zero custom columns even when the DB has some, adds new
      // ones, saves, then on reopen the list is empty again — looks like
      // "add works but delete doesn't" (2026-05-17 Alex feedback).
      let colDefs = priceList.columnDefinitions
      if (typeof colDefs === 'string') {
        try { colDefs = JSON.parse(colDefs) } catch (_) { colDefs = [] }
      }
      setColumnDefs(Array.isArray(colDefs) ? colDefs : [])
      let hidden = priceList.hiddenColumns
      if (typeof hidden === 'string') {
        try { hidden = JSON.parse(hidden) } catch (_) { hidden = [] }
      }
      setHiddenStandardCols(Array.isArray(hidden) ? hidden : [])
      // columnLabels comes back as a stringified JSON per L-053.
      let labels = priceList.columnLabels
      if (typeof labels === 'string') {
        try { labels = JSON.parse(labels) } catch (_) { labels = {} }
      }
      setColumnLabels(labels && typeof labels === 'object' && !Array.isArray(labels) ? labels : {})
      let widths = priceList.columnWidths
      if (typeof widths === 'string') {
        try { widths = JSON.parse(widths) } catch (_) { widths = {} }
      }
      setColumnWidths(widths && typeof widths === 'object' && !Array.isArray(widths) ? widths : {})
      // Phase 4.28n: load whatever's saved on the row; do not fall back
      // to the default when editing — the operator may have intentionally
      // cleared it. New lists pre-fill via the useState initial value.
      setFooterNotes(priceList.footerNotes != null ? priceList.footerNotes : '')
    } catch (error) {
      console.error('Failed to load price list details:', error)
      toast.error('Failed to load price list details')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      currencyCode: 'USD',
      brandCode: '',
      validFrom: '',
      validTo: '',
      customerId: '',
      factoryId: '',
      isActive: true,
      items: []
    })
    setItems([])
    setColumnDefs([])
    setHiddenStandardCols([])
    setColumnLabels({})
    setColumnWidths({})
    setFooterNotes(DEFAULT_FOOTER_NOTES)
    setSelectedPriceList(null)
  }

  const handleOpenCreateModal = () => {
    resetForm()
    setShowModal(true)
    setShowItemsView(false)
  }

  const handleEditPriceList = async (priceList) => {
    await loadPriceListDetails(priceList.id)
    setShowModal(true)
    setShowItemsView(false)
  }

  const handleViewItems = async (priceList) => {
    await loadPriceListDetails(priceList.id)
    setShowItemsView(true)
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleAddItem = () => {
    // Seed customColumns from the current columnDefinitions so the
    // custom-column inputs render bound to a defined key from the very
    // first keystroke (otherwise React inputs flicker between
    // uncontrolled and controlled).
    const seedCustom = {}
    for (const c of columnDefs) {
      if (c && c.key) seedCustom[c.key] = ''
    }
    setItems(prev => [...prev, {
      id: Date.now(),
      sku: '',
      productName: '',
      sellingPrice: '',
      costPrice: '',
      minimumOrder: '',
      leadTimeDays: '',
      unit: '',
      notes: '',
      customColumns: seedCustom,
    }])
  }

  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // Phase 4.28k: drag-and-drop row reorder. Uses native HTML5 DnD so no
  // new deps. dragSrcIdRef is a ref because onDragStart/onDragOver/onDrop
  // fire on different rows and React state would lag the pointer.
  const dragSrcIdRef = useRef(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const handleRowDragStart = (id) => (e) => {
    dragSrcIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    // Firefox needs a non-empty payload to fire drop
    try { e.dataTransfer.setData('text/plain', String(id)) } catch (_) {}
  }
  const handleRowDragOver = (id) => (e) => {
    if (dragSrcIdRef.current == null || dragSrcIdRef.current === id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropTargetId !== id) setDropTargetId(id)
  }
  const handleRowDragLeave = () => setDropTargetId(null)
  const handleRowDrop = (id) => (e) => {
    e.preventDefault()
    const srcId = dragSrcIdRef.current
    dragSrcIdRef.current = null
    setDropTargetId(null)
    if (srcId == null || srcId === id) return
    setItems(prev => {
      const next = [...prev]
      const fromIdx = next.findIndex(it => it.id === srcId)
      const toIdx   = next.findIndex(it => it.id === id)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }
  const handleRowDragEnd = () => {
    dragSrcIdRef.current = null
    setDropTargetId(null)
  }

  // Edit a value in the item's customColumns bucket. The columnDefinitions
  // editor on this page defines the available custom keys; each item
  // stores its values keyed by the column key.
  const handleCustomColumnChange = (id, key, value) => {
    setItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, customColumns: { ...(item.customColumns || {}), [key]: value } }
        : item
    ))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Price list name is required')
      return false
    }
    if (!formData.currencyCode.trim()) {
      toast.error('Currency code is required')
      return false
    }
    if (items.length === 0) {
      toast.error('At least one item is required')
      return false
    }
    // Validate items
    for (let item of items) {
      if (!item.sku.trim()) {
        toast.error('All items must have a SKU')
        return false
      }
      if (!item.productName.trim()) {
        toast.error('All items must have a product name')
        return false
      }
      if (!item.sellingPrice) {
        toast.error('All items must have a selling price')
        return false
      }
    }
    return true
  }

  const handleSavePriceList = async () => {
    if (!validateForm()) return

    try {
      setIsSaving(true)
      // Phase 4.28d follow-up: scrub items to only the writable columns
      // before sending. The list-load includes nested Product objects,
      // createdAt/updatedAt, and DB-managed id — passing those through
      // confuses bulkCreate on the server (duplicate id conflicts,
      // Sequelize warnings about unknown attributes). Whitelist the
      // editable fields explicitly.
      const ITEM_FIELDS = [
        'productId', 'sku', 'productName',
        'sellingPrice', 'costPrice', 'minimumOrder', 'leadTimeDays',
        'margin', 'unit', 'customColumns', 'notes',
      ]
      const cleanItems = items.map((it) => {
        const out = {}
        for (const k of ITEM_FIELDS) {
          if (it[k] !== undefined) out[k] = it[k]
        }
        // customColumns can come back from the API as a JSON string per
        // L-053 — coerce to an object so Sequelize JSON column accepts it.
        if (typeof out.customColumns === 'string') {
          try { out.customColumns = JSON.parse(out.customColumns) } catch (_) { out.customColumns = {} }
        }
        return out
      })

      const payload = {
        name: formData.name,
        description: formData.description || null,
        currencyCode: formData.currencyCode || 'USD',
        brandCode: formData.brandCode || null,
        validFrom: formData.validFrom || null,
        validTo: formData.validTo || null,
        customerId: formData.customerId || null,
        factoryId: formData.factoryId || null,
        isActive: !!formData.isActive,
        columnDefinitions: columnDefs,
        hiddenColumns: hiddenStandardCols,
        columnLabels: columnLabels,
        columnWidths: columnWidths,
        footerNotes: footerNotes || null,
        items: cleanItems,
      }

      if (selectedPriceList) {
        await api.put(`/personalization/price-lists/${selectedPriceList.id}`, payload)
        toast.success('Price list updated successfully')
      } else {
        await api.post('/personalization/price-lists', payload)
        toast.success('Price list created successfully')
      }

      setShowModal(false)
      setShowItemsView(false)
      loadPriceLists()
    } catch (error) {
      console.error('Failed to save price list:', error)
      const apiMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message
      toast.error(`Save failed: ${apiMsg || 'unknown error — check console'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePriceList = async (id) => {
    if (!window.confirm('Are you sure you want to delete this price list?')) return

    try {
      await api.delete(`/personalization/price-lists/${id}`)
      toast.success('Price list deleted successfully')
      loadPriceLists()
    } catch (error) {
      console.error('Failed to delete price list:', error)
      toast.error('Failed to delete price list')
    }
  }

  const handleExport = async (id) => {
    try {
      const response = await api.get(`/personalization/price-lists/${id}/export`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `price-list-${id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Price list exported successfully')
    } catch (error) {
      console.error('Failed to export price list:', error)
      toast.error('Failed to export price list')
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['xlsx', 'xls', 'csv'].some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast.error('Please upload a .xlsx, .xls, or .csv file')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', importMode)

      if (selectedPriceList) {
        await api.post(`/personalization/price-lists/${selectedPriceList.id}/import`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        toast.success(`Items ${importMode === 'append' ? 'added' : 'replaced'} successfully`)
        await loadPriceListDetails(selectedPriceList.id)
      }

      setShowImportModal(false)
      e.target.value = ''
    } catch (error) {
      console.error('Failed to import price list:', error)
      toast.error(error.response?.data?.message || 'Failed to import price list')
    }
  }

  if (isLoading) return <LoadingSpinner message="Loading price lists..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Price List Manager</h1>
        <p className="text-slate-600 mt-1">Manage price lists and their items</p>
      </div>

      {/* Main View: Price Lists Table */}
      {!showItemsView ? (
        <div className="bg-white rounded-lg border border-slate-200">
          {/* Toolbar */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Price Lists</h2>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Price List</span>
            </button>
          </div>

          {/* Empty State */}
          {priceLists.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 mb-4">No price lists found</p>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create your first price list
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Currency</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Items</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Customer/Factory</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Valid Period</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {priceLists.map((priceList) => (
                    <tr
                      key={priceList.id}
                      className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/price-lists/${priceList.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">{priceList.name}</td>
                      <td className="px-6 py-4 text-slate-600">{priceList.currencyCode}</td>
                      <td className="px-6 py-4 text-slate-600">{priceList.itemCount || 0}</td>
                      <td className="px-6 py-4 text-slate-600">
                        <span className="text-sm">
                          {(() => {
                            // Odoo many2one display: render the linked
                            // company name(s), never the FK UUID. Fall
                            // back to em-dash when the row is unparented
                            // (template price list).
                            const cust = priceList.customerName
                            const fac  = priceList.factoryName
                            if (cust && fac) return `${cust} / ${fac}`
                            if (cust)        return cust
                            if (fac)         return fac
                            return '—'
                          })()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {priceList.validFrom && priceList.validTo
                          ? `${new Date(priceList.validFrom).toLocaleDateString()} - ${new Date(priceList.validTo).toLocaleDateString()}`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${
                          priceList.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {priceList.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          <span>{priceList.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewItems(priceList)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View items"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditPriceList(priceList)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExport(priceList.id)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Export"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePriceList(priceList.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Items View Modal */}
      {showItemsView && selectedPriceList && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Items - {selectedPriceList.name}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
              </button>
              <button
                onClick={() => setShowItemsView(false)}
                className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Back
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-6 overflow-x-auto">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p className="text-slate-600">No items in this price list</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">SKU</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Product Name</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Selling Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">FOB Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Min Order</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Lead Time (days)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Unit</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{item.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.productName}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {parseFloat(item.sellingPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {item.costPrice ? parseFloat(item.costPrice).toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.minimumOrder || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.leadTimeDays || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{item.unit || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm max-w-xs truncate">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && !showItemsView && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedPriceList ? 'Edit Price List' : 'New Price List'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Standard Price List Q1 2026"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Currency Code *
                    </label>
                    <input
                      type="text"
                      name="currencyCode"
                      value={formData.currencyCode}
                      onChange={handleFormChange}
                      maxLength="3"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      placeholder="USD"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      rows="2"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional description"
                    />
                  </div>
                </div>
              </div>

              {/* Dates and Scope */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Validity & Scope</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      name="validFrom"
                      value={formData.validFrom}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Valid To
                    </label>
                    <input
                      type="date"
                      name="validTo"
                      value={formData.validTo}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Client (optional)
                    </label>
                    <select
                      name="customerId"
                      value={formData.customerId}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— None —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Supplier (optional)
                    </label>
                    <select
                      name="factoryId"
                      value={formData.factoryId}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— None —</option>
                      {factories.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.companyName}{f.brandCode ? ` · ${f.brandCode}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    {/* Phase 4.28d non-negotiable #9 — brand is mandatory on
                        every PriceList. Resilient flooring must be FW
                        (Malaysia) or HH (China), never SH. */}
                    <BrandPicker
                      value={formData.brandCode}
                      onChange={(v) => setFormData(prev => ({ ...prev, brandCode: v }))}
                      label="Brand *"
                      required
                      helperText="SH for Sovern House general trade. FW for FlorWay (Malaysia-origin Resilient). HH for HanHua (China-origin Resilient)."
                    />
                  </div>
                </div>
              </div>

              {/* Columns — show/hide each standard column and override
                  its header label per-PriceList. Required columns (SKU,
                  Product Name, Selling Price) cannot be hidden, only
                  renamed. Toggle affects BOTH the items table below
                  AND the generated PDF (where applicable). 2026-05-17
                  feedback: international trade uses Incoterm-style
                  prices (FOB, CIF, DDP) so the FOB column needs to be
                  free-renameable per list. 2026-05-19: default label
                  is now "FOB Price" (was "Cost Price"). */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Columns</h3>
                <p className="text-xs text-slate-500 mb-3 italic">
                  Show or hide each standard column. Rename a column to fit your trade vocabulary
                  (e.g. <strong>FOB Price → CIF</strong>, <strong>Min Order → Min QTY</strong>).
                  SKU, Product Name, and Selling Price cannot be hidden but can be renamed.
                </p>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-white">
                  {STANDARD_ITEM_COLS.map((opt) => {
                    const hidden = hiddenStandardCols.includes(opt.k)
                    return (
                      <div key={opt.k} className="flex items-center gap-3 px-3 py-2">
                        <label className={`inline-flex items-center gap-2 text-sm select-none ${opt.required ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            disabled={opt.required}
                            checked={opt.required ? true : !hidden}
                            onChange={(e) => {
                              if (opt.required) return
                              const next = new Set(hiddenStandardCols)
                              if (e.target.checked) next.delete(opt.k)
                              else                  next.add(opt.k)
                              setHiddenStandardCols(Array.from(next))
                            }}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <span className="text-slate-700 w-20">{opt.required ? 'Required' : (hidden ? 'Hidden' : 'Show')}</span>
                        </label>
                        <span className="text-sm text-slate-500 w-32">{opt.label}</span>
                        <span className="text-xs text-slate-400">Label on PDF / table:</span>
                        <input
                          type="text"
                          value={columnLabels[opt.k] || ''}
                          placeholder={opt.label}
                          onChange={(e) => {
                            const next = { ...columnLabels }
                            const v = e.target.value
                            if (v && v.trim()) next[opt.k] = v
                            else delete next[opt.k]
                            setColumnLabels(next)
                          }}
                          className="flex-1 min-w-0 px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                        {/* Phase 4.28m: per-column width override. Empty
                            input = renderer default. Number 0.05–0.50
                            represents share of page width. */}
                        <span className="text-xs text-slate-400">Width:</span>
                        <input
                          type="number"
                          min={0.05} max={0.5} step={0.01}
                          value={columnWidths[opt.k] ?? ''}
                          placeholder="auto"
                          onChange={(e) => {
                            const next = { ...columnWidths }
                            const v = e.target.value
                            const n = parseFloat(v)
                            if (Number.isFinite(n) && n > 0) next[opt.k] = n
                            else delete next[opt.k]
                            setColumnWidths(next)
                          }}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                          title="Share of page width (0.05–0.50). Empty for renderer default."
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Phase 4.28d follow-up — column editor. Each entry { key,
                  label, type } extends every PriceListItem.customColumns
                  bucket. Remove with the trash icon; add with the +
                  button. PDF doesn't render custom columns yet (future). */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">Custom columns</h3>
                  <button
                    type="button"
                    onClick={() => setColumnDefs(prev => [...prev, { key: '', label: '', type: 'text' }])}
                    className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add column
                  </button>
                </div>
                {columnDefs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No custom columns. Add one for any per-item attribute that isn't in the standard set (SKU, name, prices, MOQ, lead, unit, notes).</p>
                ) : (
                  <div className="space-y-2">
                    {columnDefs.map((col, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          className="col-span-4 px-3 py-1.5 border border-slate-300 rounded text-sm"
                          placeholder="key (e.g. fire_rating)"
                          value={col.key || ''}
                          onChange={(e) => setColumnDefs(prev => prev.map((c, i) => i === idx ? { ...c, key: e.target.value } : c))}
                        />
                        <input
                          className="col-span-4 px-3 py-1.5 border border-slate-300 rounded text-sm"
                          placeholder="Label (e.g. Fire Rating)"
                          value={col.label || ''}
                          onChange={(e) => setColumnDefs(prev => prev.map((c, i) => i === idx ? { ...c, label: e.target.value } : c))}
                        />
                        <select
                          className="col-span-3 px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                          value={col.type || 'text'}
                          onChange={(e) => setColumnDefs(prev => prev.map((c, i) => i === idx ? { ...c, type: e.target.value } : c))}
                        >
                          <option value="text">text</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setColumnDefs(prev => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 p-1.5 text-red-600 hover:bg-red-50 rounded"
                          aria-label="Remove column"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Items *</h3>
                  <button
                    onClick={handleAddItem}
                    className="flex items-center space-x-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-300 rounded-lg">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                    <p className="text-slate-600 mb-4">No items added yet</p>
                    <button
                      onClick={handleAddItem}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add First Item
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    {(() => {
                      // Build the visible column set. Required standard
                      // cols (SKU, Product Name, Selling Price) always
                      // appear; optional ones are filtered by
                      // hiddenStandardCols. Custom cols come from
                      // columnDefinitions (with non-empty key). Action
                      // button is last. Each header pulls its display
                      // label from columnLabels[k] when set so the rename
                      // input above and the table here stay in sync.
                      const visibleStandardCols = STANDARD_ITEM_COLS.filter(c => c.required || !hiddenStandardCols.includes(c.k))
                      const visibleCustomCols = columnDefs.filter(c => c && c.key)
                      const labelFor = (col) => columnLabels[col.k] || col.label
                      return (
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {/* Phase 4.28k: drag handle column. Grip
                                  icon, no label. Drag the row up/down to
                                  reorder; the new order is sent to
                                  POST /reorder on save. */}
                              <th className="w-8" aria-label="Drag handle"></th>
                              {visibleStandardCols.map((c) => (
                                <th key={c.k} className={`px-4 py-3 font-semibold text-slate-900 text-sm ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                                  {labelFor(c)}
                                </th>
                              ))}
                              {visibleCustomCols.map((c) => (
                                <th key={`custom-${c.key}`} className={`px-4 py-3 font-semibold text-slate-900 text-sm ${c.type === 'number' ? 'text-right' : 'text-left'}`}>
                                  {c.label || c.key}
                                </th>
                              ))}
                              <th className="px-4 py-3 text-center font-semibold text-slate-900 text-sm">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr
                                key={item.id}
                                className={`border-b border-slate-200 hover:bg-slate-50 ${dropTargetId === item.id ? 'bg-blue-50 outline outline-2 outline-blue-400' : ''}`}
                                draggable
                                onDragStart={handleRowDragStart(item.id)}
                                onDragOver={handleRowDragOver(item.id)}
                                onDragLeave={handleRowDragLeave}
                                onDrop={handleRowDrop(item.id)}
                                onDragEnd={handleRowDragEnd}
                              >
                                <td className="w-8 px-1 text-slate-400 cursor-grab active:cursor-grabbing select-none" title="Drag to reorder">
                                  <GripVertical className="w-4 h-4 mx-auto" />
                                </td>
                                {visibleStandardCols.map((c) => (
                                  <td key={c.k} className="px-4 py-3">
                                    <input
                                      type={c.type}
                                      value={item[c.field] ?? ''}
                                      onChange={(e) => handleItemChange(item.id, c.field, e.target.value)}
                                      step={c.step}
                                      className={`w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${c.align === 'right' ? 'text-right' : ''}`}
                                      placeholder={c.type === 'number' ? '0' : labelFor(c)}
                                    />
                                  </td>
                                ))}
                                {visibleCustomCols.map((c) => {
                                  const raw = (item.customColumns && item.customColumns[c.key]) ?? ''
                                  const inputType =
                                    c.type === 'number'  ? 'number'   :
                                    c.type === 'boolean' ? 'checkbox' :
                                                          'text'
                                  if (inputType === 'checkbox') {
                                    return (
                                      <td key={`custom-${c.key}`} className="px-4 py-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!raw}
                                          onChange={(e) => handleCustomColumnChange(item.id, c.key, e.target.checked)}
                                          className="w-4 h-4 rounded border-slate-300"
                                        />
                                      </td>
                                    )
                                  }
                                  return (
                                    <td key={`custom-${c.key}`} className="px-4 py-3">
                                      <input
                                        type={inputType}
                                        value={raw}
                                        onChange={(e) => handleCustomColumnChange(item.id, c.key, e.target.value)}
                                        className={`w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${inputType === 'number' ? 'text-right' : ''}`}
                                        placeholder={c.label || c.key}
                                      />
                                    </td>
                                  )
                                })}
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Footer notes — rendered below the items table on the PDF.
                  Free text: payment terms, duty breakdown, Incoterm
                  caveat, sample policy, anything that doesn't fit a
                  per-item column. */}
              <div>
                <label className="block text-lg font-semibold text-slate-900 mb-1">
                  Footer notes (rendered at the bottom of the PDF)
                </label>
                <p className="text-xs text-slate-500 mb-2 italic">
                  Use for payment terms, duty breakdown, Incoterm clarification, sample policy, lead-time caveats.
                  Plain text. Line breaks preserved.
                </p>
                <textarea
                  value={footerNotes}
                  onChange={(e) => setFooterNotes(e.target.value)}
                  rows={5}
                  placeholder={DEFAULT_FOOTER_NOTES}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Status */}
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleFormChange}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-900">Active</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="px-6 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePriceList}
                disabled={isSaving}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Price List'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && selectedPriceList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Import Items</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Import Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4 border-slate-300 text-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700">Append items (keep existing)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4 border-slate-300 text-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700">Replace all items</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  File (Excel or CSV)
                </label>
                <label className="flex items-center justify-center px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-900">Choose file or drag here</p>
                    <p className="text-xs text-slate-600 mt-1">.xlsx, .xls, or .csv</p>
                  </div>
                  <input
                    type="file"
                    onChange={handleImportFile}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Note:</strong> Ensure your file contains columns: SKU, Product Name, Selling Price, and optionally FOB Price (also accepts "Cost Price" for legacy files), Min Order, Lead Time Days, Unit, Notes.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Tips:</strong> Create price lists to manage different pricing strategies. Each list can be tied to specific customers or factories and has validity dates. Import/export items in bulk using Excel or CSV files.
        </p>
      </div>
    </div>
  )
}

export default PriceListManager
