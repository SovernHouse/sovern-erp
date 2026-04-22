import { useState, useEffect } from 'react'
import { Save, Loader, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { productSpecsAPI } from '../services/api'

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
const CERTIFICATIONS_LIST = ['FSC', 'PEFC', 'EUDR', 'UKTR', 'FloorScore', 'CARB2', 'CE', 'ISO 9001', 'ISO 14001', 'GreenGuard', 'EPD']

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

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-lg">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-t-lg text-sm font-semibold text-slate-800">
        {title}
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>}
    </div>
  )
}

export default function ProductSpecEditor({ productId }) {
  const [specs, setSpecs] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')

  useEffect(() => {
    loadSpecs()
    loadTemplates()
  }, [productId])

  const loadSpecs = async () => {
    try {
      setIsLoading(true)
      const res = await productSpecsAPI.getSpecs(productId)
      setSpecs(res.data)
      setIsNew(false)
    } catch (err) {
      // 404 means no specs yet — start fresh
      setSpecs({
        flooringType: '', coreType: '', construction: '',
        length: '', width: '', thickness: '',
        wearLayerThickness: '', wearLayerMil: '',
        acRating: '', waterproof: false, fireRating: '', slipRating: '',
        surfaceFinish: '', surfaceTexture: '', colorPattern: '', edgeType: '',
        woodSpecies: '', woodGrade: '',
        installationMethod: '', clickSystem: '', underlaymentRequired: '', underlaymentType: '',
        sqftPerBox: '', sqmPerBox: '', planksPerBox: '', boxWeight: '',
        warrantyResidential: '', warrantyCommercial: '',
        certifications: [], origin: '', format: '', notes: ''
      })
      setIsNew(true)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const res = await productSpecsAPI.getTemplates({ limit: 50 })
      setTemplates(Array.isArray(res.data) ? res.data : [])
    } catch {
      // ignore
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSpecs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleCertToggle = (cert) => {
    setSpecs(prev => {
      const certs = Array.isArray(prev.certifications) ? [...prev.certifications] : []
      const idx = certs.indexOf(cert)
      if (idx >= 0) certs.splice(idx, 1)
      else certs.push(cert)
      return { ...prev, certifications: certs }
    })
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      if (isNew) {
        await productSpecsAPI.createSpecs(productId, specs)
        setIsNew(false)
        toast.success('Specifications created')
      } else {
        await productSpecsAPI.updateSpecs(productId, specs)
        toast.success('Specifications saved')
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save specifications')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return toast.error('Select a template first')
    try {
      setIsSaving(true)
      await productSpecsAPI.applyTemplate(selectedTemplate, productId)
      await loadSpecs()
      toast.success('Template applied')
    } catch (err) {
      toast.error('Failed to apply template')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex items-center gap-2 text-slate-500">
        <Loader className="w-5 h-5 animate-spin" /> Loading specifications...
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Flooring Specifications</h2>
        <div className="flex items-center gap-2">
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg">
            <option value="">Apply Template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button onClick={handleApplyTemplate} disabled={!selectedTemplate || isSaving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="w-3.5 h-3.5" /> Apply
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1 px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create Specs' : 'Save'}
          </button>
        </div>
      </div>

      {/* Type & Construction */}
      <Section title="Flooring Type & Construction">
        <SelectField label="Flooring Type" name="flooringType" value={specs.flooringType} onChange={handleChange} options={['', ...FLOORING_TYPES]} />
        <SelectField label="Core Type" name="coreType" value={specs.coreType} onChange={handleChange} options={['', ...CORE_TYPES]} />
        <SelectField label="Construction" name="construction" value={specs.construction} onChange={handleChange} options={['', ...CONSTRUCTIONS]} />
        <SelectField label="Format" name="format" value={specs.format} onChange={handleChange} options={['', ...FORMATS]} />
      </Section>

      {/* Dimensions */}
      <Section title="Dimensions & Wear Layer">
        <TextField label="Length (mm)" name="length" value={specs.length} onChange={handleChange} type="number" placeholder="1220" />
        <TextField label="Width (mm)" name="width" value={specs.width} onChange={handleChange} type="number" placeholder="181" />
        <TextField label="Total Thickness (mm)" name="thickness" value={specs.thickness} onChange={handleChange} type="number" placeholder="5.5" />
        <TextField label="Wear Layer (mm)" name="wearLayerThickness" value={specs.wearLayerThickness} onChange={handleChange} type="number" placeholder="0.5" />
        <TextField label="Wear Layer (mil)" name="wearLayerMil" value={specs.wearLayerMil} onChange={handleChange} type="number" placeholder="20" />
      </Section>

      {/* Performance */}
      <Section title="Performance Ratings">
        <SelectField label="AC Rating" name="acRating" value={specs.acRating} onChange={handleChange} options={AC_RATINGS} />
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Waterproof</label>
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" name="waterproof" checked={specs.waterproof || false} onChange={handleChange} className="rounded" />
            <span className="text-sm text-slate-700">100% Waterproof</span>
          </label>
        </div>
        <SelectField label="Fire Rating" name="fireRating" value={specs.fireRating} onChange={handleChange} options={FIRE_RATINGS} />
        <SelectField label="Slip Rating" name="slipRating" value={specs.slipRating} onChange={handleChange} options={SLIP_RATINGS} />
      </Section>

      {/* Surface */}
      <Section title="Surface & Appearance">
        <SelectField label="Surface Finish" name="surfaceFinish" value={specs.surfaceFinish} onChange={handleChange} options={['', ...SURFACE_FINISHES]} />
        <SelectField label="Surface Texture" name="surfaceTexture" value={specs.surfaceTexture} onChange={handleChange} options={['', ...SURFACE_TEXTURES]} />
        <TextField label="Color / Pattern" name="colorPattern" value={specs.colorPattern} onChange={handleChange} placeholder="Natural Oak" />
        <SelectField label="Edge Type" name="edgeType" value={specs.edgeType} onChange={handleChange} options={['', ...EDGE_TYPES]} />
      </Section>

      {/* Wood-Specific */}
      <Section title="Wood Species & Grade" defaultOpen={false}>
        <SelectField label="Wood Species" name="woodSpecies" value={specs.woodSpecies} onChange={handleChange} options={['', ...WOOD_SPECIES]} />
        <SelectField label="Wood Grade" name="woodGrade" value={specs.woodGrade} onChange={handleChange} options={WOOD_GRADES} />
      </Section>

      {/* Installation */}
      <Section title="Installation">
        <SelectField label="Installation Method" name="installationMethod" value={specs.installationMethod} onChange={handleChange} options={['', ...INSTALL_METHODS]} />
        <SelectField label="Click System" name="clickSystem" value={specs.clickSystem} onChange={handleChange} options={['', ...CLICK_SYSTEMS]} />
        <SelectField label="Underlayment" name="underlaymentRequired" value={specs.underlaymentRequired} onChange={handleChange} options={['', ...UNDERLAY_REQ]} />
        <SelectField label="Underlayment Type" name="underlaymentType" value={specs.underlaymentType} onChange={handleChange} options={['', ...UNDERLAY_TYPES]} />
      </Section>

      {/* Packaging */}
      <Section title="Packaging & Coverage" defaultOpen={false}>
        <TextField label="SF per Box" name="sqftPerBox" value={specs.sqftPerBox} onChange={handleChange} type="number" placeholder="23.64" />
        <TextField label="SQM per Box" name="sqmPerBox" value={specs.sqmPerBox} onChange={handleChange} type="number" placeholder="2.20" />
        <TextField label="Planks per Box" name="planksPerBox" value={specs.planksPerBox} onChange={handleChange} type="number" placeholder="10" />
        <TextField label="Box Weight (kg)" name="boxWeight" value={specs.boxWeight} onChange={handleChange} type="number" placeholder="15" />
      </Section>

      {/* Warranty */}
      <Section title="Warranty & Compliance" defaultOpen={false}>
        <TextField label="Residential Warranty" name="warrantyResidential" value={specs.warrantyResidential} onChange={handleChange} placeholder="Lifetime" />
        <TextField label="Commercial Warranty" name="warrantyCommercial" value={specs.warrantyCommercial} onChange={handleChange} placeholder="15 Years" />
        <TextField label="Country of Origin" name="origin" value={specs.origin} onChange={handleChange} placeholder="China" />
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs font-medium text-slate-600 mb-2">Certifications</label>
          <div className="flex flex-wrap gap-2">
            {CERTIFICATIONS_LIST.map(cert => (
              <button key={cert} type="button"
                onClick={() => handleCertToggle(cert)}
                className={`px-2 py-1 text-xs rounded-full border transition ${
                  (specs.certifications || []).includes(cert)
                    ? 'bg-primary-100 border-primary-400 text-primary-800 font-semibold'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}>
                {cert}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea name="notes" value={specs.notes || ''} onChange={handleChange} rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
          placeholder="Additional notes about this product's specifications..." />
      </div>
    </div>
  )
}
