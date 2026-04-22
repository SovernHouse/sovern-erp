import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import LoadingSpinner from '../LoadingSpinner'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

/**
 * ChartWidget - Displays configurable charts
 */
export default function ChartWidget({ config }) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        // Simulated chart data - in production, fetch from specific API
        const mockData = {
          'revenue-chart': [
            { month: 'Jan', revenue: 45000 },
            { month: 'Feb', revenue: 52000 },
            { month: 'Mar', revenue: 48000 },
            { month: 'Apr', revenue: 61000 },
            { month: 'May', revenue: 55000 },
            { month: 'Jun', revenue: 67000 }
          ],
          'orders-chart': [
            { status: 'Pending', count: 24 },
            { status: 'In Progress', count: 45 },
            { status: 'Ready', count: 18 },
            { status: 'Shipped', count: 89 }
          ],
          'monthly-revenue-chart': [
            { month: 'Jan', revenue: 45000, cost: 28000 },
            { month: 'Feb', revenue: 52000, cost: 31000 },
            { month: 'Mar', revenue: 48000, cost: 29000 },
            { month: 'Apr', revenue: 61000, cost: 35000 },
            { month: 'May', revenue: 55000, cost: 32000 },
            { month: 'Jun', revenue: 67000, cost: 38000 }
          ],
          'payment-status-chart': [
            { status: 'Paid', value: 65, fill: '#10b981' },
            { status: 'Pending', value: 25, fill: '#f59e0b' },
            { status: 'Overdue', value: 10, fill: '#ef4444' }
          ]
        }

        setData(mockData[config.widget] || mockData['revenue-chart'])
      } catch (error) {
        console.error('Failed to fetch chart data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChartData()
  }, [config.widget])

  if (isLoading) return <LoadingSpinner />

  const renderChart = () => {
    switch (config.widget) {
      case 'orders-chart':
      case 'payment-status-chart':
        // Pie chart for status data
        if (data?.[0]?.fill) {
          return (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, name, value }) => `${status || name}: ${value}${typeof value === 'number' && value < 100 ? '%' : ''}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )
        }
        // Bar chart for order status
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )

      case 'monthly-revenue-chart':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" />
              <Bar dataKey="cost" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        )

      default:
        // Line chart for revenue/trend data
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )
    }
  }

  return <div className="w-full">{renderChart()}</div>
}
