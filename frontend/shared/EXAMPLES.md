# Shared Library Usage Examples

Examples of how to use components and utilities from `@trading-erp/shared` in your portal.

## Components

### DataTable

```jsx
import { DataTable } from '@shared/components'
import { useState, useEffect } from 'react'
import { useApi } from '@shared/hooks'

function UsersList() {
  const { get, loading } = useApi()
  const [users, setUsers] = useState([])

  useEffect(() => {
    const fetchUsers = async () => {
      const data = await get('/users')
      setUsers(data)
    }
    fetchUsers()
  }, [get])

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />
    }
  ]

  return (
    <DataTable
      columns={columns}
      data={users}
      isLoading={loading}
      paginated
      sortable
      onEdit={(user) => console.log('Edit', user)}
      onDelete={(user) => console.log('Delete', user)}
      onRowClick={(user) => navigate(`/users/${user.id}`)}
    />
  )
}
```

### Modal with Form

```jsx
import { Modal, TextInput, NumberInput, EmailInput, SelectInput } from '@shared/components'
import { useState } from 'react'

function CreateOrderModal({ isOpen, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    quantity: 1,
    status: 'pending'
  })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  const handleSubmit = async () => {
    if (!formData.customerName) {
      setErrors({ customerName: 'Name is required' })
      return
    }
    await onCreate(formData)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Order" size="lg">
      <div className="space-y-4">
        <TextInput
          label="Customer Name"
          name="customerName"
          value={formData.customerName}
          onChange={handleChange}
          error={errors.customerName}
          required
        />

        <EmailInput
          label="Email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <NumberInput
          label="Quantity"
          name="quantity"
          value={formData.quantity}
          onChange={handleChange}
          min="1"
          required
        />

        <SelectInput
          label="Status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'shipped', label: 'Shipped' }
          ]}
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Order
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

### ConfirmDialog

```jsx
import { ConfirmDialog } from '@shared/components'
import { useState } from 'react'

function UserActions({ userId }) {
  const [showDelete, setShowDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      await apiClient.delete(`/users/${userId}`)
      // Refresh users list
    } finally {
      setIsDeleting(false)
      setShowDelete(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowDelete(true)}
        className="text-red-600 hover:text-red-700"
      >
        Delete User
      </button>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
        isLoading={isDeleting}
      />
    </>
  )
}
```

### FileUpload

```jsx
import { FileUpload, Modal } from '@shared/components'
import { useState } from 'react'
import { useApi } from '@shared/hooks'

function DocumentUploadModal({ isOpen, onClose, orderId }) {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState([])
  const { post } = useApi()

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles)
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('orderId', orderId)

      await post(`/orders/${orderId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      onClose()
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Documents" size="lg">
      <FileUpload
        onFilesSelected={handleFilesSelected}
        maxSize={50}
        maxFiles={10}
        acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        isLoading={uploading}
      />

      <div className="mt-6 flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </Modal>
  )
}
```

### StatsCard with Dashboard

```jsx
import { StatsCard } from '@shared/components'
import { DollarSign, Package, Truck, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@shared/utils'

function Dashboard({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatsCard
        icon={DollarSign}
        label="Total Revenue"
        value={formatCurrency(stats.totalRevenue, 'USD')}
        trend={12.5}
        trendLabel="vs last month"
        color="green"
      />

      <StatsCard
        icon={Package}
        label="Orders"
        value={stats.totalOrders}
        trend={-2.4}
        trendLabel="vs last month"
        color="blue"
      />

      <StatsCard
        icon={Truck}
        label="Shipments"
        value={stats.activeShipments}
        trend={8.2}
        trendLabel="in transit"
        color="orange"
      />

      <StatsCard
        icon={AlertCircle}
        label="Pending Issues"
        value={stats.pendingIssues}
        trend={-15.3}
        trendLabel="resolved"
        color="red"
      />
    </div>
  )
}
```

### StatusBadge

```jsx
import { StatusBadge } from '@shared/components'

function OrderListItem({ order }) {
  return (
    <div className="flex justify-between items-center p-4 border rounded-lg">
      <div>
        <p className="font-semibold">{order.number}</p>
        <p className="text-gray-500">{order.customer}</p>
      </div>
      <StatusBadge status={order.status} />
    </div>
  )
}
```

## Hooks

### useApi Hook

```jsx
import { useApi } from '@shared/hooks'
import { useState, useEffect } from 'react'

function OrderDetails({ orderId }) {
  const { get, post, loading, error } = useApi()
  const [order, setOrder] = useState(null)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await get(`/orders/${orderId}`)
        setOrder(data)
      } catch (err) {
        console.error('Failed to fetch order:', err)
      }
    }
    fetchOrder()
  }, [orderId, get])

  const handleStatusUpdate = async (newStatus) => {
    try {
      const updated = await post(`/orders/${orderId}`, { status: newStatus })
      setOrder(updated)
    } catch (err) {
      console.error('Failed to update:', err)
    }
  }

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-red-600">Error: {error}</div>

  return (
    <div>
      <h2>{order.number}</h2>
      <button onClick={() => handleStatusUpdate('shipped')}>
        Mark as Shipped
      </button>
    </div>
  )
}
```

### useDebounce Hook

```jsx
import { useDebounce } from '@shared/hooks'
import { useEffect, useState } from 'react'

function SearchUsers() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const debouncedQuery = useDebounce(query, 300)
  const { get } = useApi()

  useEffect(() => {
    if (debouncedQuery) {
      const search = async () => {
        const data = await get(`/users/search?q=${debouncedQuery}`)
        setResults(data)
      }
      search()
    } else {
      setResults([])
    }
  }, [debouncedQuery, get])

  return (
    <div>
      <input
        type="text"
        placeholder="Search users..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      />
      {results.map(user => (
        <div key={user.id} className="p-2 border-t">
          {user.name} ({user.email})
        </div>
      ))}
    </div>
  )
}
```

### usePagination Hook

```jsx
import { usePagination } from '@shared/hooks'

function PaginatedList({ items }) {
  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage
  } = usePagination(items, 10)

  return (
    <div>
      <ul>
        {paginatedItems.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>

      <div className="flex gap-2 mt-4">
        <button
          onClick={prevPage}
          disabled={currentPage === 1}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`px-4 py-2 border rounded ${
              page === currentPage
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-100'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={nextPage}
          disabled={currentPage === totalPages}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
```

## Utils

### Formatters

```jsx
import {
  formatCurrency,
  formatDate,
  formatFileSize,
  formatNumber,
  formatPhone,
  truncateText,
  capitalizeWords
} from '@shared/utils'

function InvoiceDetails({ invoice }) {
  return (
    <div>
      <h2>{formatDate(invoice.createdAt, 'MMM DD, YYYY')}</h2>
      <p>Amount: {formatCurrency(invoice.amount, 'USD')}</p>
      <p>Contact: {formatPhone(invoice.phone)}</p>
      <p>Notes: {truncateText(invoice.notes, 50)}</p>
    </div>
  )
}
```

### Constants

```jsx
import { ORDER_STATUS, STATUS_COLOR_MAP, CURRENCIES } from '@shared/utils'

function CreateOrderForm() {
  return (
    <select>
      <option value="">Select Currency</option>
      {CURRENCIES.map(curr => (
        <option key={curr} value={curr}>{curr}</option>
      ))}
    </select>
  )
}

// Check status
if (order.status === ORDER_STATUS.IN_TRANSIT) {
  // Show tracking info
}
```

### API Client

```jsx
import { apiClient } from '@shared/utils'

// Direct usage without hook
async function fetchData() {
  try {
    const { data } = await apiClient.get('/orders')
    console.log(data)
  } catch (error) {
    console.error('Error:', error)
  }
}
```

## Error Boundary

```jsx
import { ErrorBoundary } from '@shared/components'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}
```

## SearchBar

```jsx
import { SearchBar, DataTable } from '@shared/components'
import { useState, useMemo } from 'react'

function SearchableList({ items }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [items, searchTerm])

  return (
    <div className="space-y-4">
      <SearchBar
        onSearch={setSearchTerm}
        placeholder="Search by name or email..."
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' }
        ]}
        data={filteredItems}
        paginated
      />
    </div>
  )
}
```

## Complete Page Example

```jsx
import {
  DataTable,
  Modal,
  ConfirmDialog,
  SearchBar,
  StatsCard,
  LoadingSpinner
} from '@shared/components'
import { useApi, useDebounce } from '@shared/hooks'
import { formatDate, STATUS_COLOR_MAP } from '@shared/utils'
import { useState, useEffect, useMemo } from 'react'
import { Package } from 'lucide-react'

function OrdersPage() {
  const { get, post, del, loading } = useApi()
  const [orders, setOrders] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [stats, setStats] = useState(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Fetch orders and stats
  useEffect(() => {
    const fetch = async () => {
      try {
        const [orderData, statData] = await Promise.all([
          get('/orders'),
          get('/orders/stats')
        ])
        setOrders(orderData)
        setStats(statData)
      } catch (err) {
        console.error('Error:', err)
      }
    }
    fetch()
  }, [get])

  // Filter based on search
  const filteredOrders = useMemo(() => {
    return orders.filter(order =>
      order.number.includes(debouncedSearch) ||
      order.customer.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
  }, [orders, debouncedSearch])

  const handleDelete = async () => {
    await del(`/orders/${selectedOrder.id}`)
    setOrders(orders.filter(o => o.id !== selectedOrder.id))
    setShowDelete(false)
  }

  if (loading) return <LoadingSpinner message="Loading orders..." />

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard
            icon={Package}
            label="Total Orders"
            value={stats.total}
            color="blue"
          />
          <StatsCard
            label="Pending"
            value={stats.pending}
            color="orange"
          />
          <StatsCard
            label="Shipped"
            value={stats.shipped}
            color="green"
          />
        </div>
      )}

      {/* Search */}
      <SearchBar
        onSearch={setSearchTerm}
        placeholder="Search by order number or customer..."
      />

      {/* Table */}
      <DataTable
        columns={[
          { key: 'number', label: 'Order #' },
          { key: 'customer', label: 'Customer' },
          { key: 'total', label: 'Total', render: (v) => `$${v}` },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) }
        ]}
        data={filteredOrders}
        onEdit={(order) => {
          setSelectedOrder(order)
          setShowModal(true)
        }}
        onDelete={(order) => {
          setSelectedOrder(order)
          setShowDelete(true)
        }}
      />

      {/* Modals */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Edit Order">
        {selectedOrder && <OrderForm order={selectedOrder} />}
      </Modal>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Order"
        message={`Delete order #${selectedOrder?.number}?`}
        isDangerous
      />
    </div>
  )
}

export default OrdersPage
```

These examples demonstrate the full range of components and utilities available in the shared library.
