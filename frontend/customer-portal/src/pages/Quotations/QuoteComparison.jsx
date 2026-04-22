import { useState, useEffect } from 'react'
import { ChevronRight, CheckCircle, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * QuoteComparison - Allow customers to compare 2-4 quotations side-by-side
 */
export default function QuoteComparison() {
  const navigate = useNavigate()
  const [availableQuotes, setAvailableQuotes] = useState([])
  const [selectedQuotes, setSelectedQuotes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [comparisonData, setComparisonData] = useState(null)

  // Mock available quotes
  useEffect(() => {
    const mockQuotes = [
      {
        id: 'Q-2026-001',
        vendor: 'Supplier A Inc.',
        date: '2026-03-10',
        validUntil: '2026-04-10',
        items: [
          { product: 'Product A', sku: 'SKU-001', quantity: 100, unitPrice: 25.50, total: 2550 },
          { product: 'Product B', sku: 'SKU-002', quantity: 50, unitPrice: 15.75, total: 787.50 }
        ],
        subtotal: 3337.50,
        tax: 250.31,
        total: 3587.81,
        paymentTerms: 'Net 30',
        deliveryTerms: 'FOB Shanghai, 30 days',
        leadTime: '25 days',
        status: 'Valid'
      },
      {
        id: 'Q-2026-002',
        vendor: 'Supplier B Ltd.',
        date: '2026-03-12',
        validUntil: '2026-04-12',
        items: [
          { product: 'Product A', sku: 'SKU-001', quantity: 100, unitPrice: 24.00, total: 2400 },
          { product: 'Product B', sku: 'SKU-002', quantity: 50, unitPrice: 16.50, total: 825 }
        ],
        subtotal: 3225,
        tax: 241.88,
        total: 3466.88,
        paymentTerms: 'Net 45',
        deliveryTerms: 'CIF Port, 28 days',
        leadTime: '23 days',
        status: 'Valid'
      },
      {
        id: 'Q-2026-003',
        vendor: 'Supplier C International',
        date: '2026-03-08',
        validUntil: '2026-04-08',
        items: [
          { product: 'Product A', sku: 'SKU-001', quantity: 100, unitPrice: 26.25, total: 2625 },
          { product: 'Product B', sku: 'SKU-002', quantity: 50, unitPrice: 15.00, total: 750 }
        ],
        subtotal: 3375,
        tax: 253.13,
        total: 3628.13,
        paymentTerms: 'Net 60',
        deliveryTerms: 'FOB Port, 35 days',
        leadTime: '30 days',
        status: 'Valid'
      },
      {
        id: 'Q-2026-004',
        vendor: 'Supplier D Trading',
        date: '2026-03-11',
        validUntil: '2026-04-11',
        items: [
          { product: 'Product A', sku: 'SKU-001', quantity: 100, unitPrice: 23.50, total: 2350 },
          { product: 'Product B', sku: 'SKU-002', quantity: 50, unitPrice: 17.00, total: 850 }
        ],
        subtotal: 3200,
        tax: 240,
        total: 3440,
        paymentTerms: 'Net 30',
        deliveryTerms: 'CIF Port, 32 days',
        leadTime: '28 days',
        status: 'Valid'
      }
    ]

    setAvailableQuotes(mockQuotes)
    setIsLoading(false)
  }, [])

  // Handle quote selection
  const toggleQuote = (quoteId) => {
    if (selectedQuotes.includes(quoteId)) {
      setSelectedQuotes(selectedQuotes.filter(id => id !== quoteId))
    } else if (selectedQuotes.length < 4) {
      setSelectedQuotes([...selectedQuotes, quoteId])
    }
  }

  // Generate comparison data
  const handleCompare = () => {
    if (selectedQuotes.length < 2) {
      alert('Please select at least 2 quotes to compare')
      return
    }

    const selected = availableQuotes.filter(q => selectedQuotes.includes(q.id))
    setComparisonData(selected)
  }

  // Find lowest price for highlighting
  const getLowestPrice = () => {
    if (!comparisonData || comparisonData.length === 0) return null
    return Math.min(...comparisonData.map(q => q.total))
  }

  // Get price status (green for low, red for high)
  const getPriceStatus = (total) => {
    if (!comparisonData) return ''
    const lowestPrice = getLowestPrice()
    const highestPrice = Math.max(...comparisonData.map(q => q.total))

    if (total === lowestPrice) return 'lowest'
    if (total === highestPrice) return 'highest'
    return 'middle'
  }

  const lowestPrice = getLowestPrice()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Compare Quotations</h1>
          <p className="text-slate-600 mt-2">
            Select 2-4 quotations to compare prices, terms, and delivery details side-by-side
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">Loading quotations...</p>
          </div>
        ) : !comparisonData ? (
          // Quote Selection
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Select Quotations ({selectedQuotes.length}/4)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableQuotes.map(quote => (
                  <div
                    key={quote.id}
                    onClick={() => toggleQuote(quote.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedQuotes.includes(quote.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{quote.vendor}</h3>
                        <p className="text-sm text-slate-600 mt-1">Quote: {quote.id}</p>
                        <p className="text-sm text-slate-600">Date: {quote.date}</p>
                      </div>
                      {selectedQuotes.includes(quote.id) && (
                        <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Quote Summary */}
                    <div className="mt-4 grid grid-cols-2 gap-2 pt-4 border-t border-slate-200">
                      <div>
                        <p className="text-xs text-slate-600">Total Price</p>
                        <p className="text-lg font-bold text-slate-900">${quote.total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Valid Until</p>
                        <p className="text-sm font-medium text-slate-900">{quote.validUntil}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center space-x-3 justify-end">
                <button
                  onClick={() => setSelectedQuotes([])}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleCompare}
                  disabled={selectedQuotes.length < 2}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    selectedQuotes.length < 2
                      ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Compare ({selectedQuotes.length})
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Comparison View
          <div className="space-y-6">
            {/* Header with Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setComparisonData(null)}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
              >
                <span>← Back to Selection</span>
              </button>
              <p className="text-sm text-slate-600">Comparing {comparisonData.length} quotations</p>
            </div>

            {/* Comparison Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 w-48 sticky left-0 bg-slate-50">
                      Details
                    </th>
                    {comparisonData.map(quote => (
                      <th key={quote.id} className="px-4 py-3 text-center min-w-max">
                        <div className="text-sm font-semibold text-slate-900">{quote.vendor}</div>
                        <div className="text-xs text-slate-600">{quote.id}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Total Price */}
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 sticky left-0 bg-slate-50">
                      Total Price
                    </td>
                    {comparisonData.map(quote => {
                      const status = getPriceStatus(quote.total)
                      const priceColor =
                        status === 'lowest'
                          ? 'bg-green-50 text-green-700'
                          : status === 'highest'
                          ? 'bg-red-50 text-red-700'
                          : ''

                      return (
                        <td
                          key={quote.id}
                          className={`px-4 py-3 text-center text-lg font-bold ${priceColor}`}
                        >
                          <div className="flex items-center justify-center space-x-2">
                            <span>${quote.total.toFixed(2)}</span>
                            {status === 'lowest' && <TrendingDown className="w-4 h-4 text-green-600" />}
                            {status === 'highest' && <TrendingUp className="w-4 h-4 text-red-600" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>

                  {/* Subtotal */}
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-600 sticky left-0 bg-white">Subtotal</td>
                    {comparisonData.map(quote => (
                      <td key={quote.id} className="px-4 py-3 text-center text-sm text-slate-900">
                        ${quote.subtotal.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Tax */}
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-600 sticky left-0 bg-white">Tax</td>
                    {comparisonData.map(quote => (
                      <td key={quote.id} className="px-4 py-3 text-center text-sm text-slate-900">
                        ${quote.tax.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Payment Terms */}
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-600 sticky left-0 bg-white">Payment Terms</td>
                    {comparisonData.map(quote => (
                      <td key={quote.id} className="px-4 py-3 text-center text-sm text-slate-900">
                        {quote.paymentTerms}
                      </td>
                    ))}
                  </tr>

                  {/* Delivery Terms */}
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-600 sticky left-0 bg-white">Delivery Terms</td>
                    {comparisonData.map(quote => (
                      <td key={quote.id} className="px-4 py-3 text-center text-sm text-slate-900">
                        {quote.deliveryTerms}
                      </td>
                    ))}
                  </tr>

                  {/* Lead Time */}
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-600 sticky left-0 bg-white">Lead Time</td>
                    {comparisonData.map(quote => (
                      <td key={quote.id} className="px-4 py-3 text-center text-sm text-slate-900">
                        {quote.leadTime}
                      </td>
                    ))}
                  </tr>

                  {/* Valid Until */}
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-600 sticky left-0 bg-white">Valid Until</td>
                    {comparisonData.map(quote => (
                      <td key={quote.id} className="px-4 py-3 text-center text-sm text-slate-900">
                        <div className="flex items-center justify-center space-x-1">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{quote.validUntil}</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Action */}
                  <tr>
                    <td className="px-4 py-3 sticky left-0 bg-white"></td>
                    {comparisonData.map(quote => (
                      <td key={quote.id} className="px-4 py-3 text-center">
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Accept This Quote
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Comparison Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">Lowest Price</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">${lowestPrice?.toFixed(2)}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {comparisonData.find(q => q.total === lowestPrice)?.vendor}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium">Average Price</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    ${(comparisonData.reduce((sum, q) => sum + q.total, 0) / comparisonData.length).toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Across all quotes</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 font-medium">Highest Price</p>
                  <p className="text-2xl font-bold text-red-900 mt-1">
                    ${Math.max(...comparisonData.map(q => q.total)).toFixed(2)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {comparisonData.find(q => q.total === Math.max(...comparisonData.map(q => q.total)))?.vendor}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
