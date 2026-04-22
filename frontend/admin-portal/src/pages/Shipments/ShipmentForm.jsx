import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import {
  TextInput,
  SelectInput,
  DateInput,
  TextArea,
} from '../../components/FormFields'
import { shipmentsAPI, ordersAPI } from '../../services/api'

const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft Container' },
  { value: '40ft', label: '40ft Container' },
  { value: '40hc', label: '40ft High Cube' },
  { value: 'LCL', label: 'LCL (Less than Container Load)' },
]

export default function ShipmentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [salesOrders, setSalesOrders] = useState([])

  const [formData, setFormData] = useState({
    salesOrderId: '',
    carrier: '',
    vesselName: '',
    voyageNumber: '',
    containerNumber: '',
    containerType: '',
    portOfLoading: '',
    portOfDischarge: '',
    etd: '',
    eta: '',
    notes: '',
  })

  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ordRes = await ordersAPI.getAll({ limit: 100 })
        setSalesOrders(ordRes.data || [])

        if (isEditMode) {
          await fetchShipment()
        }
      } catch (err) {
        console.error('Failed to load form data:', err)
        setError('Failed to load form data')
        toast.error('Failed to load form data')
      }
    }

    fetchData()
  }, [isEditMode, id])

  const fetchShipment = async () => {
    try {
      setLoading(true)
      const response = await shipmentsAPI.getById(id)
      const shipment = response.data

      setFormData({
        salesOrderId: shipment.salesOrderId || '',
        carrier: shipment.carrier || '',
        vesselName: shipment.vesselName || '',
        voyageNumber: shipment.voyageNumber || '',
        containerNumber: shipment.containerNumber || '',
        containerType: shipment.containerType || '',
        portOfLoading: shipment.portOfLoading || '',
        portOfDischarge: shipment.portOfDischarge || '',
        etd: shipment.etd ? shipment.etd.split('T')[0] : '',
        eta: shipment.eta ? shipment.eta.split('T')[0] : '',
        notes: shipment.notes || '',
      })
    } catch (err) {
      console.error('Failed to load shipment:', err)
      setError('Failed to load shipment')
      toast.error('Failed to load shipment')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.salesOrderId) {
      errors.salesOrderId = 'Sales Order is required'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFieldChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      toast.error('Please fix form errors')
      return
    }

    try {
      setSubmitting(true)

      const submitData = {
        salesOrderId: formData.salesOrderId,
        carrier: formData.carrier || undefined,
        vesselName: formData.vesselName || undefined,
        voyageNumber: formData.voyageNumber || undefined,
        containerNumber: formData.containerNumber || undefined,
        containerType: formData.containerType || undefined,
        portOfLoading: formData.portOfLoading || undefined,
        portOfDischarge: formData.portOfDischarge || undefined,
        etd: formData.etd || undefined,
        eta: formData.eta || undefined,
        notes: formData.notes || undefined,
      }

      if (isEditMode) {
        await shipmentsAPI.update(id, submitData)
        toast.success('Shipment updated successfully')
      } else {
        await shipmentsAPI.create(submitData)
        toast.success('Shipment created successfully')
      }

      navigate('/shipments')
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to save shipment'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary-600 animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading shipment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/shipments')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Shipment' : 'New Shipment'}
        </h1>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Sales Order Section */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Shipment Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sales Order
                  <span className="text-red-500">*</span>
                </label>
                <select
                  name="salesOrderId"
                  value={formData.salesOrderId}
                  onChange={handleFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.salesOrderId
                      ? 'border-red-500'
                      : 'border-slate-300'
                  }`}
                >
                  <option value="">Select sales order</option>
                  {salesOrders.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber || order.id} -{' '}
                      {order.customerName || 'N/A'}
                    </option>
                  ))}
                </select>
                {fieldErrors.salesOrderId && (
                  <p className="text-red-500 text-sm mt-1">
                    {fieldErrors.salesOrderId}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Carrier Information Section */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              Carrier Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TextInput
                label="Carrier Name"
                name="carrier"
                value={formData.carrier}
                onChange={handleFieldChange}
                placeholder="e.g., Maersk, COSCO, CMA CGM"
              />

              <TextInput
                label="Vessel Name"
                name="vesselName"
                value={formData.vesselName}
                onChange={handleFieldChange}
                placeholder="e.g., MSC Gülsün"
              />

              <TextInput
                label="Voyage Number"
                name="voyageNumber"
                value={formData.voyageNumber}
                onChange={handleFieldChange}
                placeholder="e.g., 001S"
              />

              <SelectInput
                label="Container Type"
                name="containerType"
                value={formData.containerType}
                onChange={handleFieldChange}
                options={[{ value: '', label: 'Select container type' }, ...CONTAINER_TYPES]}
              />

              <TextInput
                label="Container Number"
                name="containerNumber"
                value={formData.containerNumber}
                onChange={handleFieldChange}
                placeholder="e.g., MSCU1234567"
              />
            </div>
          </div>

          {/* Port Information Section */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              Port Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TextInput
                label="Port of Loading"
                name="portOfLoading"
                value={formData.portOfLoading}
                onChange={handleFieldChange}
                placeholder="e.g., Shanghai (PVG)"
              />

              <TextInput
                label="Port of Discharge"
                name="portOfDischarge"
                value={formData.portOfDischarge}
                onChange={handleFieldChange}
                placeholder="e.g., Rotterdam (RTM)"
              />
            </div>
          </div>

          {/* Dates Section */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              Expected Timeline
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DateInput
                label="ETD (Estimated Time of Departure)"
                name="etd"
                value={formData.etd}
                onChange={handleFieldChange}
              />

              <DateInput
                label="ETA (Estimated Time of Arrival)"
                name="eta"
                value={formData.eta}
                onChange={handleFieldChange}
              />
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <TextArea
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleFieldChange}
              rows={4}
              placeholder="Add any special instructions, handling notes, or additional information..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center space-x-4 border-t border-slate-200 pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-400 transition font-medium"
            >
              {submitting
                ? 'Saving...'
                : isEditMode
                  ? 'Update Shipment'
                  : 'Create Shipment'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/shipments')}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
