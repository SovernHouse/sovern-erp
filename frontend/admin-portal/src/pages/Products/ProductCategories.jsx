import { useState } from 'react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import { Plus } from 'lucide-react'

export default function ProductCategories() {
  const [categories] = useState([
    { id: 1, name: 'Laminate Flooring', description: 'High-quality laminate products' },
    { id: 2, name: 'Vinyl Flooring', description: 'Durable vinyl flooring solutions' },
    { id: 3, name: 'Hardwood', description: 'Premium hardwood flooring' },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Product Categories</h1>
        <button className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" />
          <span>New Category</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'description', label: 'Description' },
          ]}
          data={categories}
          isLoading={false}
          paginated={false}
        />
      </div>
    </div>
  )
}
