import { useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
} from 'lucide-react'
import Pagination from './Pagination'
import LoadingSpinner from './LoadingSpinner'
import EmptyState from './EmptyState'

export default function DataTable({
  columns,
  data,
  isLoading,
  onEdit,
  onDelete,
  selectable = false,
  sortable = true,
  paginated = true,
  pageSize: initialPageSize = 10,
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selectedRows, setSelectedRows] = useState(new Set())

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0

    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // Paginate data
  const paginatedData = paginated
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (key) => {
    if (!sortable) return

    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === 'asc'
          ? 'desc'
          : 'asc',
    })
  }

  const handleSelectRow = (rowId) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId)
    } else {
      newSelected.add(rowId)
    }
    setSelectedRows(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(
        new Set(paginatedData.map((_, idx) => idx.toString()))
      )
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (data.length === 0) return <EmptyState />

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {selectable && (
                <th className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedData.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className={`px-6 py-3 text-left text-sm font-semibold text-slate-900 ${
                    sortable && column.sortable !== false
                      ? 'cursor-pointer hover:bg-slate-100'
                      : ''
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{column.label}</span>
                    {sortable && column.sortable !== false && (
                      <div className="w-4">
                        {sortConfig.key === column.key ? (
                          sortConfig.direction === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        ) : (
                          <span className="text-slate-300">↕</span>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-6 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                {selectable && (
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(idx.toString())}
                      onChange={() => handleSelectRow(idx.toString())}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={`${idx}-${column.key}`}
                    className="px-6 py-4 text-sm text-slate-900"
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginated && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          totalItems={sortedData.length}
        />
      )}
    </div>
  )
}
