import React, { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'
import { useIsMobile, useIsTablet } from '../utils/responsive'
import Pagination from './Pagination'

export default function ResponsiveTable({
  columns = [],
  data = [],
  keyColumn = 'id',
  onRowClick,
  sortable = true,
  filterable = true,
  paginated = true,
  itemsPerPage = 10,
  expandable = true,
  cardTitleColumn = null,
  cardSubtitleColumn = null,
}) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [expandedRows, setExpandedRows] = useState({})
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc',
  })
  const [currentPage, setCurrentPage] = useState(1)

  // Determine visible columns based on breakpoint
  const getVisibleColumns = () => {
    if (isMobile) {
      return columns.filter((col) => col.mobileVisible !== false && col.responsive !== 'desktop-only')
    }
    if (isTablet) {
      return columns.filter((col) => col.tabletVisible !== false)
    }
    return columns
  }

  const visibleColumns = getVisibleColumns()

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0

    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]

    if (aValue === bValue) return 0

    const comparison = aValue < bValue ? -1 : 1
    return sortConfig.direction === 'asc' ? comparison : -comparison
  })

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = paginated
    ? sortedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      )
    : sortedData

  const handleSort = (key) => {
    if (!sortable) return

    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleRowExpanded = (rowKey) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }))
  }

  // Desktop Table View
  if (!isMobile && !isTablet) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                      sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                    }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{col.label}</span>
                      {sortable && sortConfig.key === col.key && (
                        <>
                          {sortConfig.direction === 'asc' ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </>
                      )}
                      {sortable && sortConfig.key !== col.key && (
                        <ArrowUpDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr
                    key={row[keyColumn] || idx}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onRowClick?.(row)}
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={`${row[keyColumn]}-${col.key}`}
                        className="px-6 py-4 text-sm text-gray-900"
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {paginated && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    )
  }

  // Tablet/Mobile Card View
  return (
    <div className="space-y-3">
      {paginatedData.length === 0 ? (
        <div className="bg-white rounded-lg p-6 text-center text-gray-500">
          No data available
        </div>
      ) : (
        paginatedData.map((row, idx) => {
          const rowKey = row[keyColumn] || idx
          const isExpanded = expandedRows[rowKey]

          return (
            <div
              key={rowKey}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Card Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  if (expandable) toggleRowExpanded(rowKey)
                  onRowClick?.(row)
                }}
              >
                <div className="flex-1 min-w-0">
                  {cardTitleColumn && (
                    <div className="font-semibold text-gray-900 truncate">
                      {row[cardTitleColumn] || 'No title'}
                    </div>
                  )}
                  {cardSubtitleColumn && (
                    <div className="text-sm text-gray-600 truncate">
                      {row[cardSubtitleColumn]}
                    </div>
                  )}
                </div>

                {expandable && (
                  <button
                    className="ml-2 p-1 flex-shrink-0 text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleRowExpanded(rowKey)
                    }}
                  >
                    {isExpanded ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>
                )}
              </div>

              {/* Card Body - Visible Columns */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2">
                {visibleColumns.map((col) => (
                  <div
                    key={col.key}
                    className="flex justify-between items-start gap-2 text-sm"
                  >
                    <span className="font-medium text-gray-700">
                      {col.label}:
                    </span>
                    <span className="text-gray-900 text-right flex-1">
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Expanded Additional Columns */}
              {expandable && isExpanded && visibleColumns.length < columns.length && (
                <div className="px-4 py-3 bg-white border-t border-gray-200 space-y-2">
                  {columns
                    .filter((col) => !visibleColumns.includes(col))
                    .map((col) => (
                      <div
                        key={col.key}
                        className="flex justify-between items-start gap-2 text-sm"
                      >
                        <span className="font-medium text-gray-700">
                          {col.label}:
                        </span>
                        <span className="text-gray-900 text-right flex-1">
                          {col.render
                            ? col.render(row[col.key], row)
                            : row[col.key]}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="px-4 py-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            variant="mobile"
          />
        </div>
      )}
    </div>
  )
}
