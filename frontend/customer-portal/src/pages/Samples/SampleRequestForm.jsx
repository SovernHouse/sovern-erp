import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { samplesAPI, productsAPI } from '../../services/api'

const SampleRequestForm = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [products, setProducts] = useState([])
  const [addresses, setAddresses] = useState([])
  const [showAddressForm, setShowAddressForm] = useState(false)

  const [formData, setFormData] = useState({
    items: [{ productId: '', quantity: 1 }],
    shippingAddress: null,
    newAddress: {
      recipientName: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      phone: '',
    },
    notes: '',
  })

  useEffect(() => {
    fetchProducts()
    fetchAddresses()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await productsAPI.list({ limit: 999 })
      setProducts(response.data.data || response.data)
    } catch (err) {
      console.error('Error fetching products:', err)
      toast.error('Failed to load products')
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchAddresses = async () => {
    try {
      const response = await samplesAPI.getAddressBook()
      setAddresses(response.data || [])
    } catch (err) {
      console.error('Error fetching addresses:', err)
    }
  }

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1 }],
    }))
  }

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items]
      newItems[index][field] = field === 'quantity' ? parseInt(value) || 1 : value
      return { ...prev, items: newItems }
    })
  }

  const handleAddressChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      newAddress: { ...prev.newAddress, [field]: value },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.items.some((item) => !item.productId)) {
      toast.error('Please select a product for all items')
      return
    }

    if (!formData.shippingAddress && !showAddressForm) {
      toast.error('Please select or create a shipping address')
      return
    }

    try {
      setLoading(true)

      const submitData = {
        items: formData.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        shippingAddress: showAddressForm ? formData.newAddress : formData.shippingAddress,
        notes: formData.notes,
      }

      await samplesAPI.create(submitData)
      toast.success('Sample request created successfully')
      navigate('/samples')
    } catch (err) {
      console.error('Error creating sample request:', err)
      toast.error(err.response?.data?.message || 'Failed to create sample request')
    } finally {
      setLoading(false)
    }
  }

  if (loadingProducts) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-8 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900">Request Samples</h1>
            <p className="text-gray-600 mt-2">Select products and provide delivery details</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Products Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                  1
                </span>
                Select Products
              </h2>

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                      <select
                        value={item.productId}
                        onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {product.code || product.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {formData.items.length > 1 && (
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="mt-4 px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition"
              >
                + Add Another Product
              </button>
            </div>

            {/* Shipping Address Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                  2
                </span>
                Shipping Address
              </h2>

              {!showAddressForm ? (
                <>
                  {addresses.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {addresses.map((address) => (
                        <label
                          key={address.id}
                          className="flex items-start p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition"
                        >
                          <input
                            type="radio"
                            name="address"
                            checked={formData.shippingAddress === address.id}
                            onChange={() => setFormData((prev) => ({ ...prev, shippingAddress: address.id }))}
                            className="mt-1 mr-3"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{address.recipientName}</p>
                            <p className="text-sm text-gray-600">{address.street}</p>
                            <p className="text-sm text-gray-600">
                              {address.city}, {address.state} {address.postalCode}, {address.country}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAddressForm(true)}
                    className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition"
                  >
                    + Use New Address
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Name</label>
                      <input
                        type="text"
                        value={formData.newAddress.recipientName}
                        onChange={(e) => handleAddressChange('recipientName', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                      <input
                        type="text"
                        value={formData.newAddress.street}
                        onChange={(e) => handleAddressChange('street', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={formData.newAddress.city}
                        onChange={(e) => handleAddressChange('city', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State/Province</label>
                      <input
                        type="text"
                        value={formData.newAddress.state}
                        onChange={(e) => handleAddressChange('state', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                      <input
                        type="text"
                        value={formData.newAddress.postalCode}
                        onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                      <input
                        type="text"
                        value={formData.newAddress.country}
                        onChange={(e) => handleAddressChange('country', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formData.newAddress.phone}
                        onChange={(e) => handleAddressChange('phone', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddressForm(false)}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Use Saved Address Instead
                  </button>
                </>
              )}
            </div>

            {/* Notes Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                  3
                </span>
                Special Instructions (Optional)
              </h2>

              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Any special handling, packaging, or other requirements..."
                rows="4"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/samples')}
                className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SampleRequestForm
