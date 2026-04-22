import React, { useState, useCallback } from 'react'
import { X, AlertCircle, CheckCircle, Package, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'
import BarcodeScanner from '@shared/components/BarcodeScanner'
import LoadingSpinner from '../../components/LoadingSpinner'

/**
 * Warehouse Scan Inventory Page
 * For stock count operations
 */
const ScanInventory = () => {
  const [showScanner, setShowScanner] = useState(false)
  const [selectedZone, setSelectedZone] = useState('')
  const [zoneLoaded, setZoneLoaded] = useState(false)
  const [scannedProducts, setScannedProducts] = useState([])
  const [countVariances, setCountVariances] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Sample warehouse zones and inventory
  const warehouseZones = {
    'ZONE-A': {
      name: 'Zone A - Tiles Premium',
      location: 'Building 1, Row 1-5',
      expectedInventory: [
        { id: 1, sku: 'TILE-001', name: 'Beige Marble 60x60', expectedQty: 500 },
        { id: 2, sku: 'TILE-002', name: 'Gray Slate 45x45', expectedQty: 350 },
        { id: 3, sku: 'TILE-003', name: 'White Pearl 30x30', expectedQty: 600 },
      ],
    },
    'ZONE-B': {
      name: 'Zone B - Tiles Standard',
      location: 'Building 1, Row 6-10',
      expectedInventory: [
        { id: 4, sku: 'TILE-004', name: 'Cream Marble 60x60', expectedQty: 400 },
        { id: 5, sku: 'TILE-005', name: 'Natural Stone 45x45', expectedQty: 250 },
        { id: 6, sku: 'TILE-006', name: 'Black Slate 60x120', expectedQty: 200 },
      ],
    },
    'ZONE-C': {
      name: 'Zone C - Flooring',
      location: 'Building 2, Row 1-8',
      expectedInventory: [
        { id: 7, sku: 'FLOORING-001', name: 'Oak Hardwood 1m', expectedQty: 800 },
        { id: 8, sku: 'FLOORING-002', name: 'Walnut Finish 1m', expectedQty: 600 },
        { id: 9, sku: 'FLOORING-003', name: 'Cherry Wood 2m', expectedQty: 450 },
      ],
    },
  }

  // Load zone inventory
  const handleLoadZone = () => {
    if (!selectedZone) {
      toast.error('Please select a zone')
      return
    }

    setZoneLoaded(true)
    setScannedProducts([])
    setCountVariances([])
    toast.success(`Zone ${selectedZone} loaded`)
  }

  // Handle barcode scan
  const handleBarcodeScan = useCallback(
    (scan) => {
      if (!zoneLoaded) {
        toast.error('Please load a zone first')
        setShowScanner(false)
        return
      }

      const zone = warehouseZones[selectedZone]
      const matchingProduct = zone.expectedInventory.find((p) => p.sku === scan.value)

      if (!matchingProduct) {
        toast.error(`SKU ${scan.value} not found in zone`)
        return
      }

      // Check if already scanned
      const existingProduct = scannedProducts.find((p) => p.id === matchingProduct.id)

      if (existingProduct) {
        // Increase count
        updateProductCount(matchingProduct.id, existingProduct.actualCount + 1)
      } else {
        // Add new product
        setScannedProducts((prev) => [
          ...prev,
          {
            ...matchingProduct,
            actualCount: 1,
            barcode: scan.value,
          },
        ])
      }

      toast.success(`Scanned: ${matchingProduct.name}`)
      setShowScanner(false)
    },
    [zoneLoaded, selectedZone, scannedProducts]
  )

  // Update product count
  const updateProductCount = (productId, newCount) => {
    if (newCount < 0) return

    setScannedProducts((prev) =>
      prev.map((product) => (product.id === productId ? { ...product, actualCount: newCount } : product))
    )

    // Recalculate variances
    calculateVariances()
  }

  // Calculate count variances
  const calculateVariances = () => {
    const zone = warehouseZones[selectedZone]
    const variances = []

    zone.expectedInventory.forEach((expected) => {
      const scanned = scannedProducts.find((s) => s.id === expected.id)
      const actualCount = scanned ? scanned.actualCount : 0
      const variance = actualCount - expected.expectedQty

      if (variance !== 0) {
        variances.push({
          id: expected.id,
          sku: expected.sku,
          name: expected.name,
          expected: expected.expectedQty,
          actual: actualCount,
          variance,
          variancePercent: ((variance / expected.expectedQty) * 100).toFixed(1),
          status: variance > 0 ? 'surplus' : 'shortage',
        })
      }
    })

    setCountVariances(variances)
  }

  // Finish counting
  const handleFinishCounting = () => {
    const zone = warehouseZones[selectedZone]
    const missing = zone.expectedInventory.filter((exp) => !scannedProducts.find((s) => s.id === exp.id))

    if (missing.length > 0) {
      const missingNames = missing.map((m) => m.name).join(', ')
      toast.error(`Missing products not counted: ${missingNames}`)
    } else {
      calculateVariances()
      toast.success('Count complete. Review variances below.')
    }
  }

  // Submit stock count
  const handleSubmitCount = async () => {
    if (scannedProducts.length === 0) {
      toast.error('Please count at least one product')
      return
    }

    setSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const countData = {
        countNumber: `COUNT-${Date.now()}`,
        zone: selectedZone,
        countedAt: new Date().toISOString(),
        products: scannedProducts,
        variances: countVariances,
        totalVariance: countVariances.reduce((sum, v) => sum + Math.abs(v.variance), 0),
      }

      // In production, send to API
      console.log('Stock Count Data:', countData)

      toast.success(`Stock count submitted: ${countData.countNumber}`)

      // Reset form
      setSelectedZone('')
      setZoneLoaded(false)
      setScannedProducts([])
      setCountVariances([])
    } catch (error) {
      toast.error('Error submitting count: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Remove product from count
  const removeProduct = (productId) => {
    setScannedProducts((prev) => prev.filter((p) => p.id !== productId))
    calculateVariances()
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Count - Scan Inventory</h1>
          <p className="text-gray-600">Perform physical inventory count and track variances</p>
        </div>

        {/* Zone Selection */}
        {!zoneLoaded ? (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Select Warehouse Zone</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Zone</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(warehouseZones).map(([zoneCode, zoneData]) => (
                    <button
                      key={zoneCode}
                      onClick={() => setSelectedZone(zoneCode)}
                      className={`p-4 rounded-lg border-2 text-left transition ${
                        selectedZone === zoneCode
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{zoneData.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{zoneData.location}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        {zoneData.expectedInventory.length} products expected
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleLoadZone}
                disabled={!selectedZone}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                Load Zone
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Zone Info and Scanning */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Step 2: Count Products</h2>
                  <p className="text-gray-600">{warehouseZones[selectedZone].name}</p>
                </div>
                <button
                  onClick={() => {
                    setZoneLoaded(false)
                    setSelectedZone('')
                    setScannedProducts([])
                  }}
                  className="text-red-600 hover:text-red-700 font-semibold"
                >
                  Change Zone
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">Expected products: {warehouseZones[selectedZone].expectedInventory.length}</p>
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Package size={20} />
                  Scan Product
                </button>
              </div>
            </div>

            {/* Counted Products */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Counted Products ({scannedProducts.length}/{warehouseZones[selectedZone].expectedInventory.length})
                </h3>

                {scannedProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No products counted yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Product</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Expected</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Actual Count</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Variance</th>
                          <th className="text-center py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {scannedProducts.map((product) => {
                          const variance = product.actualCount - product.expectedQty
                          const variancePercent = ((variance / product.expectedQty) * 100).toFixed(1)
                          let varianceColor = 'text-green-600'
                          let varianceBg = 'bg-green-50'

                          if (variance > 0) {
                            varianceColor = 'text-orange-600'
                            varianceBg = 'bg-orange-50'
                          } else if (variance < 0) {
                            varianceColor = 'text-red-600'
                            varianceBg = 'bg-red-50'
                          }

                          return (
                            <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="py-3 px-3">
                                <div>
                                  <p className="font-semibold text-gray-900">{product.name}</p>
                                  <p className="text-xs text-gray-500">{product.sku}</p>
                                </div>
                              </td>
                              <td className="text-center py-3 px-3">
                                <span className="font-semibold">{product.expectedQty}</span>
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={product.actualCount}
                                  onChange={(e) => updateProductCount(product.id, parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-semibold"
                                />
                              </td>
                              <td className={`text-center py-3 px-3 font-semibold ${varianceColor} ${varianceBg} rounded`}>
                                {variance > 0 ? `+${variance}` : variance}
                                <div className="text-xs text-gray-600">({variancePercent}%)</div>
                              </td>
                              <td className="text-center py-3 px-3">
                                <button
                                  onClick={() => removeProduct(product.id)}
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

                {scannedProducts.length > 0 && (
                  <button
                    onClick={handleFinishCounting}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    Finish Counting
                  </button>
                )}
              </div>

              {/* Variances Summary */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Variances ({countVariances.length})
                </h3>

                {countVariances.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle size={48} className="mx-auto text-green-500 mb-2" />
                    <p className="text-green-600 font-semibold">No variances detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {countVariances.map((variance) => (
                      <div
                        key={variance.id}
                        className={`p-3 rounded-lg border-l-4 ${
                          variance.status === 'shortage' ? 'bg-red-50 border-red-500' : 'bg-orange-50 border-orange-500'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle
                            size={18}
                            className={`mt-0.5 flex-shrink-0 ${
                              variance.status === 'shortage' ? 'text-red-600' : 'text-orange-600'
                            }`}
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-sm">{variance.name}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {variance.status === 'shortage'
                                ? `Short: ${Math.abs(variance.variance)} units`
                                : `Surplus: ${variance.variance} units`}
                            </p>
                            <p className="text-xs text-gray-600">
                              Expected: {variance.expected} | Actual: {variance.actual}
                            </p>
                            <p className="text-xs font-semibold text-gray-600 mt-1">
                              Variance: {variance.variancePercent}%
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
            {scannedProducts.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <button
                  onClick={handleSubmitCount}
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Stock Count'}
                </button>
              </div>
            )}
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

export default ScanInventory
