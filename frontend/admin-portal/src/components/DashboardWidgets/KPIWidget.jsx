import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * KPIWidget - Displays key performance indicators
 */
export default function KPIWidget({ config }) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        // Simulated KPI data - in production, fetch from specific API
        const mockData = {
          'kpi-stats': [
            { label: 'Total Orders', value: '1,234', trend: 12, up: true },
            { label: 'Revenue', value: '$45,230', trend: 8, up: true },
            { label: 'Pending', value: '23', trend: 5, up: false },
            { label: 'Conversion Rate', value: '34.2%', trend: 2, up: true }
          ],
          'my-stats': [
            { label: 'My Orders', value: '89', trend: 15, up: true },
            { label: 'My Pipeline', value: '$78,900', trend: 22, up: true },
            { label: 'Follow-ups', value: '12', trend: 3, up: false },
            { label: 'Win Rate', value: '42%', trend: 5, up: true }
          ],
          'financial-stats': [
            { label: 'Total Invoices', value: '456', trend: 6, up: true },
            { label: 'Outstanding', value: '$12,340', trend: 3, up: false },
            { label: 'Overdue', value: '$2,100', trend: 2, up: false },
            { label: 'Collection Rate', value: '92%', trend: 4, up: true }
          ],
          'active-orders': [
            { label: 'Active Orders', value: '234', trend: 8, up: true },
            { label: 'In Production', value: '45', trend: 2, up: true },
            { label: 'Ready to Ship', value: '18', trend: 5, up: true },
            { label: 'In Transit', value: '67', trend: 12, up: true }
          ]
        }

        setData(mockData[config.widget] || mockData['kpi-stats'])
      } catch (error) {
        console.error('Failed to fetch KPI data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchKPIs()
  }, [config.widget])

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {data?.map((kpi, idx) => (
        <div key={idx} className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600 font-medium">{kpi.label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{kpi.value}</p>
          <div className="flex items-center mt-2 space-x-1">
            {kpi.up ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">+{kpi.trend}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">{kpi.trend}%</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
