import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Copy, FileText, Save, X, Search, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { productSpecsAPI, productsAPI } from '../../services/api'

const FLOORING_TYPES = ['SPC', 'WPC', 'LVT', 'Laminate', 'Engineered Wood', 'Solid Wood', 'Bamboo', 'Vinyl Dry Back']
const CORE_TYPES = ['Stone Plastic Composite', 'Wood Plastic Composite', 'HDF', 'Plywood', 'Solid Wood', 'None']
const CONSTRUCTIONS = ['2-ply', '3-ply', 'Multiply', 'Strand Woven', 'Horizontal', 'Vertical', 'Solid', 'N/A']
const AC_RATINGS = ['', 'AC1', 'AC2', 'AC3', 'AC4', 'AC5']
const SURFACE_FINISHES = ['EIR', 'Synchronized', 'Embossed', 'Matt', 'Piano', 'Crystal', 'Hand-scraped', 'Brushed', 'Oiled', 'Lacquered', 'UV Lacquered', 'Natural Oil']
const SURFACE_TEXTURES = ['Wood Grain', 'Stone', 'Tile Look', 'Hand Scraped', 'Wire Brushed', 'Smooth', 'Registered Emboss']
const EDGE_TYPES = ['Micro-bevel', 'Square Edge', 'Painted Bevel', 'V-groove', 'Beveled 4 Sides', 'Eased Edge']
const WOOD_SPECIES = ['European Oak', 'American Oak', 'American Black Walnut', 'Birch', 'Hickory', 'Maple', 'Cherry', 'Acacia', 'Teak', 'Bamboo']
const WOOD_GRADES = ['', 'AB', 'BC', 'CD', 'EF', 'Character', 'Select', 'Prime', 'Rustic', 'Natural']
const INSTALL_METHODS = ['Click-lock', 'Glue-down', 'Nail-down', 'Floating', 'Loose Lay']
const CLICK_SYSTEMS = ['Uniclick', 'Valinge', 'Drop-lock', 'Angle-angle', 'I4F', 'Uniclic', 'N/A']
const UNDERLAY_REQ = ['Attached', 'Required', 'Optional', 'Not Required']
const UNDERLAY_TYPES = ['IXPE', 'Cork', 'EVA', 'EPE', 'Rubber', 'Foam', 'N/A']
const FORMATS = ['Plank', 'Herringbone', 'Chevron', 'Wide Plank', 'Long Plank', 'Parquet', 'Standard']
const FIRE_RATINGS = ['', 'Bfl-s1', 'Cfl-s1', 'Dfl-s1', 'Efl']
const SLIP_RATINGS = ['', 'R9', 'R10', 'R11', 'R12', 'R13']

const emptyForm = {
  name: '', flooringType: '', description: '',
  coreType: '', construction: '',
  dimensionLength: '', dimensionWidth: '', dimensionThickness: '',
  wearLayerThickness: '', wearLayerMil: '',
  acRating: '', waterproof: false, fireRating: '', slipRating: '',
  surfaceFinish: '', surfaceTexture: '', edgeType: '',
  woodSpecies: '', woodGrade: '',
  installationMethod: '', clickSystem: '', underlaymentRequired: '', underlaymentType: '',
  sqftPerBox: '', sqmPerBox: '', planksPerBox: '',
  warrantyResidential: '', warrantyCommercial: '',
  certifications: [], format: ''
}

function SelectField({ label, value, onChange, options, name }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select name={name} value={value || ''} onChange={onChange}
        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  )
}

function TextField({ label, value, onChange, name, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} name={name} value={value || ''} onChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
    </div>
  )
}

export default function SpecTemplates() {
  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [isSaving, setIsSaving] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')

  // Apply-to-product modal
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyTemplateId, setApplyTemplateId] = useState(null)
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => { fetchTemplates() }, [filterType])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const params = { limit: 50 }
      if (filterType) params.flooringType = filterType
      const res = await productSpecsAPI.getTemplates(params)
      setTemplates(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      toast.error('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleCertToggle = (cert) => {
    setForm(prev => {
      const certs = Array.isArray(prev.certifications) ? [...prev.certifications] : []
      const idx = certs.indexOf(cert)
      if (idx >= 0) certs.splice(idx, 1)
      else certs.push(cert)
      return { ...prev, certifications: certs }
    })
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (tpl) => {
    setEditingId(tpl.id)
    setForm({
      name: tpl.name || '',
      flooringType: tpl.flooringType || '',
      description: tpl.description || '',
      coreType: tpl.coreType || '',
      construction: tpl.construction || '',
      dimensionLength: tpl.dimensionLength || '',
      dimensionWidth: tpl.dimensionWidth || '',
      dimensionThickness: tpl.dimensionThickness || '',
      wearLayerThickness: tpl.wearLayerThickness || '',
      wearLayerMil: tpl.wearLayerMil || '',
      acRating: tpl.acRating || '',
      waterproof: tpl.waterproof || false,
      fireRating: tpl.fireRating || '',
      slipRating: tpl.slipRating || '',
      surfaceFinish: tpl.surfaceFinish || '',
      surfaceTexture: tpl.surfaceTexture || '',
      edgeType: tpl.edgeType || '',
      woodSpecies: tpl.woodSpecies || '',
      woodGrade: tpl.woodGrade || '',
      installationMethod: tpl.installationMethod || '',
      clickSystem: tpl.clickSystem || '',
      underlaymentRequired: tpl.underlaymentRequired || '',
      underlaymentType: tpl.underlaymentType || '',
      sqftPerBox: tpl.sqftPerBox || '',
      sqmPerBox: tpl.sqmPerBox || '',
      planksPerBox: tpl.planksPerBox || '',
      warrantyResidential: tpl.warrantyResidential || '',
      warrantyCommercial: tpl.warrantyCommercial || '',
      certifications: tpl.certifications || [],
      format: tpl.format || ''
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Template name is required')
    try {
      setIsSaving(true)
      if (editingId) {
        await productSpecsAPI.updateTemplate(editingId, form)
        toast.success('Template updated')
      } else {
        await productSpecsAPI.createTemplate(form)
        toast.success('Template created')
      }
      setShowModal(false)
      fetchTemplates()
    } catch (err) {
      toast.error('Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return
    try {
      await productSpecsAPI.deleteTemplate(id)
      toast.success('Template deleted')
      fetchTemplates()
    } catch (err) {
      toast.error('Failed to delete template')
    }
  }

  const openApply = async (templateId) => {
    setApplyTemplateId(templateId)
    setSelectedProduct('')
    setProductSearch('')
    setShowApplyModal(true)
    try {
      const res = await productsAPI.getAll({ limit: 100 })
      setProducts(Array.isArray(res.data) ? res.data : [])
    } catch {
      toast.error('Failed to load products')
    }
  }

  const handleApply = async () => {
    if (!selectedProduct) return toast.error('Select a product')
    try {
      await productSpecsAPI.applyTemplate(applyTemplateId, selectedProduct)
      toast.success('Template applied to product')
      setShowApplyModal(false)
    } catch (err) {
      toast.error('Failed to apply template')
    }
  }

  const filteredTemplates = templates.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.flooringType?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredProducts = products.filter(p =>
    !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

  const CERT_OPTIONS = ['FSC', 'PEFC', 'EUDR', 'UKTR', 'FloorScore', 'CARB2', 'CE', 'ISO 9001', 'ISO 14001', 'GreenGuard', 'EPD']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Flooring Spec Templates</h1>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="">All Flooring Types</option>
          {FLOORING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
          <Loader className="w-5 h-5 animate-spin" /> Loading templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No spec templates found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map(tpl => (
            <div key={tpl.id} className="bg-white rounded-lg shadow p-5 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-slate-900">{tpl.name}</h3>
                  {tpl.flooringType && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">{tpl.flooringType}</span>
                  )}
                </div>
                {tpl.description && <p className="text-sm text-slate-500 mb-2">{tpl.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {tpl.dimensionLength && <span>{tpl.dimensionLength}x{tpl.dimensionWidth}x{tpl.dimensionThickness}mm</span>}
                  {tpl.wearLayerMil && <span>Wear: {tpl.wearLayerMil}mil</span>}
                  {tpl.wearLayerThickness && <span>({tpl.wearLayerThickness}mm)</span>}
                  {tpl.acRating && <span>{tpl.acRating}</span>}
                  {tpl.waterproof && <span className="text-blue-600 font-medium">Waterproof</span>}
                  {tpl.clickSystem && <span>{tpl.clickSystem}</span>}
                  {tpl.surfaceFinish && <span>{tpl.surfaceFinish}</span>}
                  {tpl.installationMethod && <span>{tpl.installationMethod}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button onClick={() => openApply(tpl.id)} title="Apply to Product"
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Apply to product">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(tpl)} title="Edit"
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(tpl.id)} title="Delete"
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit' : 'Create'} Spec Template</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Template Name *" name="name" value={form.name} onChange={handleChange} placeholder="SPC 5.5mm Standard" />
                <SelectField label="Flooring Type" name="flooringType" value={form.flooringType} onChange={handleChange} options={['', ...FLOORING_TYPES]} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea name="description" value={form.description || ''} onChange={handleChange} rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="Template description..." />
              </div>

              {/* Construction */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Construction</p>
                <div className="grid grid-cols-3 gap-3">
                  <SelectField label="Core Type" name="coreType" value={form.coreType} onChange={handleChange} options={['', ...CORE_TYPES]} />
                  <SelectField label="Construction" name="construction" value={form.construction} onChange={handleChange} options={['', ...CONSTRUCTIONS]} />
                  <SelectField label="Format" name="format" value={form.format} onChange={handleChange} options={['', ...FORMATS]} />
                </div>
              </div>

              {/* Dimensions */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Dimensions</p>
                <div className="grid grid-cols-3 gap-3">
                  <TextField label="Length (mm)" name="dimensionLength" value={form.dimensionLength} onChange={handleChange} type="number" placeholder="1220" />
                  <TextField label="Width (mm)" name="dimensionWidth" value={form.dimensionWidth} onChange={handleChange} type="number" placeholder="181" />
                  <TextField label="Thickness (mm)" name="dimensionThickness" value={form.dimensionThickness} onChange={handleChange} type="number" placeholder="5.5" />
                  <TextField label="Wear Layer (mm)" name="wearLayerThickness" value={form.wearLayerThickness} onChange={handleChange} type="number" placeholder="0.5" />
                  <TextField label="Wear Layer (mil)" name="wearLayerMil" value={form.wearLayerMil} onChange={handleChange} type="number" placeholder="20" />
                </div>
              </div>

              {/* Performance */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Performance</p>
                <div className="grid grid-cols-3 gap-3">
                  <SelectField label="AC Rating" name="acRating" value={form.acRating} onChange={handleChange} options={AC_RATINGS} />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Waterproof</label>
                    <label className="flex items-center gap-2 mt-1">
                      <input type="checkbox" name="waterproof" checked={form.waterproof || false} onChange={handleChange} className="rounded" />
                      <span className="text-sm text-slate-700">100% Waterproof</span>
                    </label>
                  </div>
                  <SelectField label="Fire Rating" name="fireRating" value={form.fireRating} onChange={handleChange} options={FIRE_RATINGS} />
                  <SelectField label="Slip Rating" name="slipRating" value={form.slipRating} onChange={handleChange} options={SLIP_RATINGS} />
                </div>
              </div>

              {/* Surface */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Surface & Appearance</p>
                <div className="grid grid-cols-3 gap-3">
                  <SelectField label="Surface Finish" name="surfaceFinish" value={form.surfaceFinish} onChange={handleChange} options={['', ...SURFACE_FINISHES]} />
                  <SelectField label="Surface Texture" name="surfaceTexture" value={form.surfaceTexture} onChange={handleChange} options={['', ...SURFACE_TEXTURES]} />
                  <SelectField label="Edge Type" name="edgeType" value={form.edgeType} onChange={handleChange} options={['', ...EDGE_TYPES]} />
                </div>
              </div>

              {/* Wood */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Wood Species & Grade</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Wood Species" name="woodSpecies" value={form.woodSpecies} onChange={handleChange} options={['', ...WOOD_SPECIES]} />
                  <SelectField label="Wood Grade" name="woodGrade" value={form.woodGrade} onChange={handleChange} options={WOOD_GRADES} />
                </div>
              </div>

              {/* Installation */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Installation</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Installation Method" name="installationMethod" value={form.installationMethod} onChange={handleChange} options={['', ...INSTALL_METHODS]} />
                  <SelectField label="Click System" name="clickSystem" value={form.clickSystem} onChange={handleChange} options={['', ...CLICK_SYSTEMS]} />
                  <SelectField label="Underlayment" name="underlaymentRequired" value={form.underlaymentRequired} onChange={handleChange} options={['', ...UNDERLAY_REQ]} />
                  <SelectField label="Underlayment Type" name="underlaymentType" value={form.underlaymentType} onChange={handleChange} options={['', ...UNDERLAY_TYPES]} />
                </div>
              </div>

              {/* Packaging */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Packaging</p>
                <div className="grid grid-cols-3 gap-3">
                  <TextField label="SF per Box" name="sqftPerBox" value={form.sqftPerBox} onChange={handleChange} type="number" placeholder="23.64" />
                  <TextField label="SQM per Box" name="sqmPerBox" value={form.sqmPerBox} onChange={handleChange} type="number" placeholder="2.20" />
                  <TextField label="Planks per Box" name="planksPerBox" value={form.planksPerBox} onChange={handleChange} type="number" placeholder="10" />
                </div>
              </div>

              {/* Warranty */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Warranty</p>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Residential Warranty" name="warrantyResidential" value={form.warrantyResidential} onChange={handleChange} placeholder="Lifetime" />
                  <TextField label="Commercial Warranty" name="warrantyCommercial" value={form.warrantyCommercial} onChange={handleChange} placeholder="15 Years" />
                </div>
              </div>

              {/* Certifications */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {CERT_OPTIONS.map(cert => (
                    <button key={cert} type="button" onClick={() => handleCertToggle(cert)}
                      className={`px-2 py-1 text-xs rounded-full border transition ${
                        (form.certifications || []).includes(cert)
                          ? 'bg-primary-100 border-primary-400 text-primary-800 font-semibold'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {cert}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50">
                {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Product Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Apply Template to Product</h2>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => setSelectedProduct(p.id)}
                    className={`w-full text-left px-4 py-2 text-sm border-b border-slate-100 hover:bg-slate-50 ${
                      selectedProduct === p.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700'
                    }`}>
                    {p.name} <span className="text-slate-400">({p.sku})</span>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">No products found</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowApplyModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                Cancel
              </button>
              <button onClick={handleApply} disabled={!selectedProduct}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50">
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
