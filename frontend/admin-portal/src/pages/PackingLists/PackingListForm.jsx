import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { packingListsAPI } from '../../services/api'
import {
  TextInput,
  SelectInput,
  TextArea,
  DateInput,
  NumberInput,
} from '../../components/FormFields'

export default function PackingListForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(!!id)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [items, setItems] = useState([])
  const [formData, setFormData] = useState({
    orderNumber: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
  })

  useEffect(() => {
    if (id) {
      fetchPackingList()
    }
  }, [id])

  const fetchPackingList = async () => {
    try {
      const res = await packingListsAPI.getById(id)
      setFormData({
        orderNumber: res.data.orderNumber || '',
        date: res.data.date || new Date().toISOString().split('T')[0],
        status: res.data.status || 'pending',
        notes: res.data.notes || '',
      })
      setItems(res.data.items || [])
    } catch (error) {
      console.error('Failed to fetch packing list:', error)
      toast.error('Failed to load packing list')
      navigate('/packing-lists')
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.orderNumber) newErrors.orderNumber = 'Order number is required'
    if (items.length === 0) newErrors.items = 'At least one item is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product: '',
        productName: '',
        quantity: 1,
        unit: 'PCS',
        weight: 0,
        volume: 0,
        length: 0,
        width: 0,
        height: 0,
      },
    ])
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setIsSaving(true)
      const submitData = {
        ...formData,
        items: items,
      }

      if (id) {
        await packingListsAPI.update(id, submitData)
        toast.success('Packing list updated successfully')
      } else {
        await packingListsAPI.create(submitData)
        toast.success('Packing list created successfully')
      }
      navigate('/packing-lists')
    } catch (error) {
      console.error('Failed to save packing list:', error)
      toast.error(error.response?.data?.message || 'Failed to save packing list')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/packing-lists')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">
          {id ? 'Edit Packing List' : 'Create Packing List'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Packing List Information
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                label="Order Number"
                name="orderNumber"
                value={formData.orderNumber}
                onChange={handleChange}
                required
                error={errors.orderNumber}
              />
              <DateInput
                label="Date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>
            <SelectInput
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'packed', label: 'Packed' },
                { value: 'ready_for_shipment', label: 'Ready for Shipment' },
                { value: 'shipped', label: 'Shipped' },
              ]}
            />
            <TextArea
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Items</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>

          {errors.items && (
            <p className="text-red-600 text-sm mb-4">{errors.items}</p>
          )}

          {items.length > 0 ? (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 border border-slate-200 rounded-lg space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Item {index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <TextInput
                      label="Product Name"
                      value={item.productName}
                      onChange={(e) =>
                        handleItemChange(index, 'productName', e.target.value)
                      }
                      placeholder="Product name"
                    />
                    <NumberInput
                      label="Quantity"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, 'quantity', e.target.value)
                      }
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <TextInput
                      label="Unit"
                      value={item.unit}
                      onChange={(e) =>
                        handleItemChange(index, 'unit', e.target.value)
                      }
                      placeholder="PCS, KG, etc"
                    />
                    <NumberInput
                      label="Weight (kg)"
                      value={item.weight}
                      onChange={(e) =>
                        handleItemChange(index, 'weight', e.target.value)
                      }
                    />
                    <NumberInput
                      label="Volume (CBM)"
                      value={item.volume}
                      onChange={(e) =>
                        handleItemChange(index, 'volume', e.target.value)
                      }
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <NumberInput
                      label="Length (cm)"
                      value={item.length}
                      onChange={(e) =>
                        handleItemChange(index, 'length', e.target.value)
                      }
                    />
                    <NumberInput
                      label="Width (cm)"
                      value={item.width}
                      onChange={(e) =>
                        handleItemChange(index, 'width', e.target.value)
                      }
                    />
                    <NumberInput
                      label="Height (cm)"
                      value={item.height}
                      onChange={(e) =>
                        handleItemChange(index, 'height', e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-sm text-center py-8">
              No items added yet. Click "Add Item" to get started.
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : id ? 'Update Packing List' : 'Create Packing List'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/packing-lists')}
            className="px-6 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
