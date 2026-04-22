import { useEffect, useState } from 'react'
import { Eye, ArrowUpRight } from 'lucide-react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * TableWidget - Displays recent data in table format
 */
export default function TableWidget({ config }) {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTableData = async () => {
      try {
        // Simulated table data - in production, fetch from specific API
        const mockData = {
          'recent-orders': [
            { id: 'SO-001', customer: 'Acme Corp', amount: '$12,500', status: 'shipped', date: '2024-03-15' },
            { id: 'SO-002', customer: 'Tech Solutions', amount: '$8,750', status: 'processing', date: '2024-03-14' },
            { id: 'SO-003', customer: 'Global Trade', amount: '$15,300', status: 'confirmed', date: '2024-03-13' },
            { id: 'SO-004', customer: 'Export Co', amount: '$9,200', status: 'pending', date: '2024-03-12' },
            { id: 'SO-005', customer: 'Logistics Ltd', amount: '$11,800', status: 'shipped', date: '2024-03-11' }
          ],
          'pending-followups': [
            { customer: 'Acme Corp', inquiry: 'INQ-001', days: 3, status: 'urgent' },
            { customer: 'Tech Solutions', inquiry: 'INQ-002', days: 5, status: 'pending' },
            { customer: 'Global Trade', inquiry: 'INQ-003', days: 1, status: 'new' },
            { customer: 'Export Co', inquiry: 'INQ-004', days: 7, status: 'overdue' }
          ],
          'low-stock': [
            { sku: 'SKU-001', product: 'Component A', stock: 5, reorder: 20 },
            { sku: 'SKU-002', product: 'Component B', stock: 8, reorder: 25 },
            { sku: 'SKU-003', product: 'Part C', stock: 3, reorder: 15 },
            { sku: 'SKU-004', product: 'Assembly D', stock: 12, reorder: 30 }
          ],
          'outstanding-invoices': [
            { id: 'INV-001', customer: 'Acme Corp', amount: '$5,200', dueDate: '2024-02-28', days: 15 },
            { id: 'INV-002', customer: 'Tech Solutions', amount: '$3,800', dueDate: '2024-03-05', days: 10 },
            { id: 'INV-003', customer: 'Global Trade', amount: '$7,500', dueDate: '2024-02-15', days: 29 },
            { id: 'INV-004', customer: 'Export Co', amount: '$2,100', dueDate: '2024-03-10', days: 5 }
          ],
          'shipments': [
            { id: 'SHIP-001', destination: 'New York', status: 'in-transit', eta: '2024-03-18' },
            { id: 'SHIP-002', destination: 'Los Angeles', status: 'in-transit', eta: '2024-03-20' },
            { id: 'SHIP-003', destination: 'Chicago', status: 'delivered', eta: '2024-03-15' }
          ],
          'recent-inquiries': [
            { id: 'INQ-001', company: 'Acme Corp', products: 'Component A, B', created: '2024-03-15' },
            { id: 'INQ-002', company: 'Tech Solutions', products: 'Assembly D', created: '2024-03-14' },
            { id: 'INQ-003', company: 'Global Trade', products: 'Part C', created: '2024-03-13' }
          ]
        }

        setData(mockData[config.widget] || mockData['recent-orders'])
      } catch (error) {
        console.error('Failed to fetch table data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTableData()
  }, [config.widget])

  if (isLoading) return <LoadingSpinner />

  const getStatusColor = (status) => {
    switch (status) {
      case 'shipped':
      case 'delivered':
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'processing':
      case 'in-transit':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
      case 'new':
        return 'bg-yellow-100 text-yellow-800'
      case 'urgent':
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'confirmed':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {data.length > 0 && Object.keys(data[0]).map(key => (
              <th key={key} className="px-4 py-2 text-left font-semibold text-slate-900">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </th>
            ))}
            <th className="px-4 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              {Object.entries(row).map(([key, value]) => (
                <td key={key} className="px-4 py-3">
                  {['status'].includes(key) ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(value)}`}>
                      {typeof value === 'string' ? value.replace(/([A-Z])/g, ' $1') : value}
                    </span>
                  ) : (
                    <span className="text-slate-900">{value}</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <button className="p-1 hover:bg-blue-100 rounded transition-colors">
                  <Eye className="w-4 h-4 text-blue-600" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
