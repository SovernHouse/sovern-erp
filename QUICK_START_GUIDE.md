# Quick Start Guide - Zustand Stores & i18n

## For Developers

### 1. Initialize i18n (Do This Once Per Portal)

In your `main.jsx` or `App.jsx`:

```javascript
import './i18n/config.js'
```

That's it! i18n is now ready to use.

### 2. Use Stores in Components

**Orders Management:**
```javascript
import { useOrdersStore } from '../stores'

function OrdersList() {
  const { orders, fetchOrders, isLoading } = useOrdersStore()

  useEffect(() => {
    fetchOrders()
  }, [])

  return orders.map(order => <OrderCard key={order.id} order={order} />)
}
```

**Customers Management:**
```javascript
import { useCustomersStore } from '../stores'

function CustomerForm() {
  const { createCustomer, isLoading } = useCustomersStore()

  const handleSubmit = async (data) => {
    await createCustomer(data)
  }
}
```

**Dashboard Metrics:**
```javascript
import { useDashboardStore } from '../stores'

function Dashboard() {
  const { metrics, refreshAllData } = useDashboardStore()

  useEffect(() => {
    refreshAllData()
  }, [])

  return (
    <div>
      <MetricCard label="Revenue" value={metrics.totalRevenue} />
      <MetricCard label="Orders" value={metrics.totalOrders} />
    </div>
  )
}
```

**Notifications:**
```javascript
import { useNotificationStore } from '@trading-erp/shared'

function SaveButton() {
  const { success, error } = useNotificationStore()

  const handleSave = async (data) => {
    try {
      await api.save(data)
      success('Saved successfully!')
    } catch (err) {
      error('Failed to save: ' + err.message)
    }
  }
}
```

**Auth State:**
```javascript
import { useAuthStore } from '@trading-erp/shared'

function Profile() {
  const { user, logout } = useAuthStore()

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}
```

### 3. Use Translations

```javascript
import { useTranslation } from 'react-i18next'

function Dashboard() {
  const { t, i18n } = useTranslation('admin')

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <div>{t('dashboard.totalRevenue')}</div>

      <select onChange={(e) => i18n.changeLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="zh">中文</option>
        <option value="es">Español</option>
        <option value="ar">العربية</option>
      </select>
    </div>
  )
}
```

### 4. Add Language Switcher

```javascript
import { LanguageSwitcher } from '@trading-erp/shared'

function Header() {
  return (
    <header className="flex justify-between items-center">
      <h1>Trading ERP</h1>
      <LanguageSwitcher />
    </header>
  )
}
```

---

## Common Patterns

### Fetch Data on Component Mount

```javascript
useEffect(() => {
  const load = async () => {
    await fetchOrders({ page: 1, limit: 10 })
  }
  load()
}, [])
```

### Handle Errors and Loading

```javascript
const { orders, isLoading, error } = useOrdersStore()

if (isLoading) return <LoadingSpinner />
if (error) return <ErrorMessage message={error} />
return <OrdersList orders={orders} />
```

### Manage Filters and Pagination

```javascript
const { filters, setFilters, pagination, setPagination, fetchOrders } = useOrdersStore()

const handleFilterChange = (newFilters) => {
  setFilters(newFilters)
  fetchOrders({ ...newFilters, page: 1, limit: pagination.limit })
}

const handlePageChange = (page) => {
  setPagination(page, pagination.limit)
  fetchOrders({ page, limit: pagination.limit, ...filters })
}
```

### Use Multiple Stores Together

```javascript
function OrderForm() {
  const { createOrder } = useOrdersStore()
  const { customers } = useCustomersStore()
  const { success, error } = useNotificationStore()

  const handleSubmit = async (formData) => {
    try {
      await createOrder(formData)
      success('Order created!')
    } catch (err) {
      error('Failed to create order')
    }
  }
}
```

---

## Translation Keys

### Common Keys (All Portals)

```
navigation.dashboard
navigation.orders
navigation.customers
common.save
common.cancel
common.delete
forms.email
forms.password
status.pending
status.processing
errors.loginFailed
messages.createdSuccessfully
```

### Admin-Specific Keys

```
admin:dashboard.title
admin:dashboard.totalRevenue
admin:orders.title
admin:customers.title
admin:products.title
```

### Customer-Specific Keys

```
customer:dashboard.myOrders
customer:orders.viewDetails
customer:quotations.acceptQuotation
customer:profile.editProfile
```

### Factory-Specific Keys

```
factory:production.title
factory:quality.approveQuality
factory:inventory.adjustStock
factory:shipments.markAsShipped
```

---

## Store Methods Summary

### Orders Store

```javascript
const {
  // State
  orders,
  totalOrders,
  currentOrder,
  isLoading,
  error,
  filters,
  pagination,

  // Actions
  fetchOrders,
  fetchOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  changeOrderStatus,
  setFilters,
  clearFilters,
  setPagination,
  clearError,
  reset
} = useOrdersStore()
```

### Customers Store

```javascript
const {
  // State
  customers,
  totalCustomers,
  currentCustomer,
  isLoading,
  error,
  filters,
  pagination,

  // Actions
  fetchCustomers,
  fetchCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  setFilters,
  clearFilters,
  setPagination,
  clearError,
  reset
} = useCustomersStore()
```

### Dashboard Store

```javascript
const {
  // State
  metrics,
  revenueChart,
  ordersChart,
  topCustomers,
  recentInquiries,
  recentOrders,
  upcomingShipments,
  kpis,
  isLoading,
  error,
  lastRefresh,

  // Actions
  fetchMetrics,
  fetchRevenueChart,
  fetchOrdersChart,
  fetchTopCustomers,
  fetchRecentInquiries,
  fetchRecentOrders,
  fetchUpcomingShipments,
  fetchKPIs,
  refreshAllData,
  clearError,
  reset
} = useDashboardStore()
```

### Auth Store

```javascript
const {
  // State
  user,
  token,
  refreshToken,
  isAuthenticated,
  isLoading,
  error,

  // Actions
  login,
  logout,
  refreshTokenFn,
  setUser,
  setToken,
  clearError,
  clearAuth
} = useAuthStore()
```

### Notification Store

```javascript
const {
  // State
  notifications,

  // Actions
  addNotification,
  removeNotification,
  clearNotifications,

  // Convenience Methods
  success(message, options),
  error(message, options),
  warning(message, options),
  info(message, options)
} = useNotificationStore()
```

### UI Store

```javascript
const {
  // State
  sidebarCollapsed,
  theme,
  modals,

  // Actions
  toggleSidebar,
  setSidebarCollapsed,
  setTheme,
  toggleTheme,
  openModal,
  closeModal,
  toggleModal,
  closeAllModals
} = useUIStore()
```

---

## Troubleshooting

**Translations not showing?**
- Ensure i18n config is imported in main.jsx
- Check translation file paths
- Verify i18n namespace name in useTranslation()

**Store not updating?**
- Check if you're calling the action (e.g., fetchOrders())
- Verify API service is working
- Check error state for error messages

**RTL not working?**
- Language switcher automatically sets dir="rtl"
- Verify CSS supports RTL (Tailwind does by default)
- Clear browser cache if needed

**State not persisting?**
- Auth and UI stores use localStorage
- Check if localStorage is enabled
- Clear localStorage if seeing stale data

---

## File Locations

**Stores to Import From:**
```
../stores/index.js           (admin-portal specific stores)
@trading-erp/shared          (shared stores)
```

**i18n to Import From:**
```
react-i18next                (useTranslation hook)
../i18n/config.js            (initialize in main.jsx)
```

**Components to Import From:**
```
@trading-erp/shared          (LanguageSwitcher)
```

---

## Performance Tips

1. **Use shallow comparison** for multiple properties:
   ```javascript
   import { useShallow } from 'zustand/react/shallow'

   const { orders, isLoading } = useOrdersStore(
     useShallow(state => ({ orders: state.orders, isLoading: state.isLoading }))
   )
   ```

2. **Fetch data in useEffect**, not on render:
   ```javascript
   useEffect(() => {
     fetchOrders()
   }, []) // Empty dependency array
   ```

3. **Memoize expensive components**:
   ```javascript
   export const OrderCard = memo(function OrderCard({ order }) {
     return <div>{order.id}</div>
   })
   ```

---

## For Questions or Issues

See the full integration guide:
`frontend/admin-portal/STORES_I18N_INTEGRATION_GUIDE.md`
