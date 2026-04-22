import React, { useState, useCallback } from 'react'
import { X, AlertCircle, CheckCircle, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import BarcodeScanner from '@shared/components/BarcodeScanner'
import LoadingSpinner from '../../components/LoadingSpinner'

/**
 * Warehouse Scan Receive Page
 * Workflow for receiving goods and creating GRN
 */
const ScanReceive = () => {
  const [showScanner, setShowScanner] = useState(false)
  const [poNumber, setPoNumber] = useState('')
  const [poLoaded, setPoLoaded] = useState(false)
  const [poDetails, setPoDetails] = useState(null)
  const [scannedItems, setScannedItems] = useState([])
  const [currentBarcode, setCurrentBarcode] = useState('')
  const [discrepancies, setDiscrepancies] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Sample PO data (in production, fetch from API)
  const mockPOData = {
    'PO-001': {
      poNumber: 'PO-001',
      supplier: 'ABC Tile Suppliers',
      orderDate: '2024-03-10',
      expectedDelivery: '2024-03-20',
      items: [
        { id: 1, sku: 'TILE-001', name: 'Beige Marble 60x60', expectedQty: 100, unit: 'boxes' },
        { id: 2, sku: 'TILE-002', name: 'Gray Slate 45x45', expectedQty: 50, unit: 'boxes' },
        { id: 3, sku: 'TILE-003', name: 'White Pearl 30x30', expectedQty: 75, unit: 'boxes' },
      ],
    },
    'PO-002': {
      poNumber: 'PO-002',
      supplier: 'Premium Flooring Co',
      orderDate: '2024-03-12',
      expectedDelivery: '2024-03-22',
      items: [
        { id: 1, sku: 'FLOORING-001', name: 'Oak Hardwood 1m', expectedQty: 200, unit: 'pieces' },
        { id: 2, sku: 'FLOORING-002', name: 'Walnut Finish 1m', expectedQty: 150, unit: 'pieces' },
      ],
    },
  }

  // Load PO
  const handleLoadPO = async () => {
    if (!poNumber.trim()) {
      toast.error('Please enter a PO number')
      return
    }

    setLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      const po = mockPOData[poNumber.toUpperCase()]
      if (!po) {
        toast.error('PO not found')
        setLoading(false)
        return
      }

      setPoDetails(po)
      setPoLoaded(true)
      setScannedItems([])
      setDiscrepancies([])
      toast.success('PO loaded successfully')
    } catch (error) {
      toast.error('Error loading PO: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle barcode scan
  const handleBarcodeScan = useCallback(
    (scan) => {
      if (!poLoaded || !poDetails) {
        toast.error('Please load a PO first')
        setShowScanner(false)
        return
      }

      setCurrentBarcode(scan.value)

      // Find matching item by barcode/SKU
      const matchingItem = poDetails.items.find((item) => item.sku === scan.value)

      if (!matchingItem) {
        toast.error(`SKU ${scan.value} not found in PO`)
        return
      }

      // Check if already scanned
      const existingScanned = scannedItems.find((s) => s.id === matchingItem.id)

      if (existingScanned) {
        // Increase quantity
        setScannedItems((prev) =>
          prev.map((item) =>
            item.id === matchingItem.id ? { ...item, scannedQty: item.scannedQty + 1 } : item
          )
        )
      } else {
        // Add new scanned item
        setScannedItems((prev) => [
          ...prev,
          {
            ...matchingItem,
            scannedQty: 1,
            barcode: scan.value,
          },
        ])
      }

      toast.success(`Added: ${matchingItem.name}`)
      setShowScanner(false)
    },
    [poLoaded, poDetails, scannedItems]
  )

  // Update scanned quantity
  const updateScannedQty = (itemId, newQty) => {
    if (newQty < 0) return

    setScannedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, scannedQty: newQty } : item))
    )

    // Check for discrepancies
    checkDiscrepancies()
  }

  // Check for discrepancies
  const checkDiscrepancies = () => {
    const found = []

    scannedItems.forEach((scannedItem) => {
      if (scannedItem.scannedQty < scannedItem.expectedQty) {
        found.push({
          type: 'shortage',
          item: scannedItem.name,
          expected: scannedItem.expectedQty,
          scanned: scannedItem.scannedQty,
          diff: scannedItem.expectedQty - scannedItem.scannedQty,
        })
      } else if (scannedItem.scannedQty > scannedItem.expectedQty) {
        found.push({
          type: 'surplus',
          item: scannedItem.name,
          expected: scannedItem.expectedQty,
          scanned: scannedItem.scannedQty,
          diff: scannedItem.scannedQty - scannedItem.expectedQty,
        })
      }
    })

    // Check for missing items
    poDetails.items.forEach((expectedItem) => {
      const wasScanned = scannedItems.some((s) => s.id === expectedItem.id)
      if (!wasScanned) {
        found.push({
          type: 'missing',
          item: expectedItem.name,
          expected: expectedItem.expectedQty,
          scanned: 0,
          diff: expectedItem.expectedQty,
        })
      }
    })

    setDiscrepancies(found)
  }

  // Submit GRN
  const handleSubmitGRN = async () => {
    if (scannedItems.length === 0) {
      toast.error('Please scan at least one item')
      return
    }

    setSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const grnData = {
        grnNumber: `GRN-${Date.now()}`,
        poNumber: poDetails.poNumber,
        supplier: poDetails.supplier,
        receivedItems: scannedItems,
        discrepancies,
        receivedDate: new Date().toISOString(),
        remarks: '',
      }

      // In production, send to API
      console.log('GRN Data:', grnData)

      toast.success(`GRN created: ${grnData.grnNumber}`)

      // Reset form
      setPoNumber('')
      setPoLoaded(false)
      setPoDetails(null)
      setScannedItems([])
      setDiscrepancies([])
    } catch (error) {
      toast.error('Error creating GRN: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Remove scanned item
  const removeScannedItem = (itemId) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== itemId))
    checkDiscrepancies()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Goods Receipt - Scan Receive</h1>
          <p className="text-gray-600">Scan items as they arrive to create a Goods Received Note (GRN)</p>
        </div>

        {/* PO Selection Section */}
        {!poLoaded ? (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Load Purchase Order</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">PO Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Enter or scan PO number (e.g., PO-001)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleLoadPO()}
                  />
                  <button
                    onClick={() => setShowScanner(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    Scan
                  </button>
                  <button
                    onClick={handleLoadPO}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    Load PO
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold mb-2">Demo PO Numbers:</p>
                <p>PO-001 (Tile Products) or PO-002 (Flooring Products)</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* PO Details Section */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Step 2: Scan Items</h2>
                  <p className="text-gray-600">PO: {poDetails.poNumber}</p>
                </div>
                <button
                  onClick={() => {
                    setPoLoaded(false)
                    setPoDetails(null)
                    setScannedItems([])
                  }}
                  className="text-red-600 hover:text-red-700 font-semibold"
                >
                  Change PO
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <span className="text-sm text-gray-600">Supplier:</span>
                  <p className="font-semibold">{poDetails.supplier}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Order Date:</span>
                  <p className="font-semibold">{poDetails.orderDate}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Expected Delivery:</span>
                  <p className="font-semibold">{poDetails.expectedDelivery}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total Items:</span>
                  <p className="font-semibold">{poDetails.items.length}</p>
                </div>
              </div>

              <button
                onClick={() => setShowScanner(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Package size={20} />
                Start Scanning Items
              </button>
            </div>

            {/* Scanned Items Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Received Items Table */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Received Items ({scannedItems.length})
                </h3>

                {scannedItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No items scanned yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Item</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Expected</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Received</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Variance</th>
                          <th className="text-center py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {scannedItems.map((item) => {
                          const variance = item.scannedQty - item.expectedQty;
                          const varianceColor =
                            variance === 0 ? 'text-green-600' : variance > 0 ? 'text-orange-600' : 'text-red-600';

                          return (
                            <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="py-3 px-3">
                                <div>
                                  <p className="font-semibold text-gray-900">{item.name}</p>
                                  <p className="text-xs text-gray-500">{item.sku}</p>
                                </div>
                              </td>
                              <td className="text-center py-3 px-3">
                                <span className="font-semibold">{item.expectedQty}</span>
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.scannedQty}
                                  onChange={(e) => updateScannedQty(item.id, parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                                />
                              </td>
                              <td className={`text-center py-3 px-3 font-semibold ${varianceColor}`}>
                                {variance > 0 ? `+${variance}` : variance}
                              </td>
                              <td className="text-center py-3 px-3">
                                <button
                                  onClick={() => removeScannedItem(item.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X size={18} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Discrepancies Section */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Discrepancies ({discrepancies.length})
                </h3>

                {discrepancies.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle size={48} className="mx-auto text-green-500 mb-2" />
                    <p className="text-green-600 font-semibold">No discrepancies</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {discrepancies.map((disc, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border-l-4 ${
                          disc.type === 'shortage'
                            ? 'bg-red-50 border-red-500'
                            : disc.type === 'surplus'
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-yellow-50 border-yellow-500'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle
                            size={18}
                            className={`mt-0.5 flex-shrink-0 ${
                              disc.type === 'shortage'
                                ? 'text-red-600'
                                : disc.type === 'surplus'
                                ? 'text-orange-600'
                                : 'text-yellow-600'
                            }`}
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-sm">{disc.item}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {disc.type === 'shortage'
                                ? `Short: ${disc.diff} units`
                                : disc.type === 'surplus'
                                ? `Extra: ${disc.diff} units`
                                : `Missing: ${disc.diff} units`}
                            </p>
                            <p className="text-xs text-gray-600">
                              Expected: {disc.expected} | Received: {disc.scanned}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <button
                onClick={handleSubmitGRN}
                disabled={submitting || scannedItems.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {submitting ? 'Creating GRN...' : 'Create Goods Received Note (GRN)'}
              </button>
            </div>
          </>
        )}

        {/* Barcode Scanner Modal */}
        {showScanner && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setShowScanner(false)}
            supportedFormats={['code_128', 'ean_13', 'qr_code']}
          />
        )}
      </div>
    </div>
  )
}

export default ScanReceive
