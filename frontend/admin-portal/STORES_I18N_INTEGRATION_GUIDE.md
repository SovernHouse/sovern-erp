# Stores & i18n Integration Guide

This guide shows how to integrate the new Zustand stores and i18next internationalization into your React components.

## Setup

### 1. Initialize i18n in your main.jsx or App.jsx

```javascript
import './i18n/config.js'
import i18n from 'i18next'
```

The i18n configuration will automatically detect the user's browser language and set up translations.

### 2. Enable RTL Support

For Arabic language support, the LanguageSwitcher automatically sets `dir="rtl"` on the document element. No additional setup needed.

## Using Zustand Stores

### Authentication Store (useAuthStore)

Example usage in a component:

```javascript
import { useAuthStore } from '@trading-erp/shared'
import { authAPI } from '../services/api'

function LoginForm() {
  const { login, isLoading, error, clearError } = useAuthStore()

  const handleLogin = async (credentials) => {
    try {
      await login(credentials, authAPI.login)
      // Navigate to dashboard
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleLogin({ email: 'user@example.com', password: 'pass' })
    }}>
      {error && <div className="text-red-500">{error}</div>}
      <button disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  )
}
```

### Notification Store (useNotificationStore)

Example usage:

```javascript
import { useNotificationStore } from '@trading-erp/shared'

function OrderForm() {
  const { success, error } = useNotificationStore()

  const handleSave = async (data) => {
    try {
      await ordersAPI.create(data)
      success('Order created successfully', { duration: 3000 })
    } catch (err) {
      error('Failed to create order', { duration: 5000 })
    }
  }

  return <button onClick={() => handleSave({})}>Save Order</button>
}
```

### UI Store (useUIStore)

Example usage:

```javascript
import { useUIStore } from '@trading-erp/shared'
import { useShallow } from 'zustand/react/shallow'

function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, theme, setTheme } = useUIStore(
    useShallow((state) => ({
      sidebarCollapsed: state.sidebarCollapsed,
      toggleSidebar: state.toggleSidebar,
      theme: state.theme,
      setTheme: state.setTheme,
    }))
  )

  return (
    <div className={sidebarCollapsed ? 'w-16' : 'w-64'}>
      <button onClick={toggleSidebar}>Toggle</button>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  )
}
```

### Orders Store (useOrdersStore)

Example usage:

```javascript
import { useOrdersStore } from '../stores'

function OrdersList() {
  const { orders, isLoading, error, fetchOrders, pagination, setPagination } =
    useOrdersStore()

  useEffect(() => {
    fetchOrders({
      page: pagination.page,
      limit: pagination.limit,
    })
  }, [pagination.page, pagination.limit])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div>
      {orders.map((order) => (
        <div key={order.id}>
          <h3>{order.id}</h3>
          <p>Status: {order.status}</p>
        </div>
      ))}
      <button onClick={() => setPagination(pagination.page + 1)}>
        Next Page
      </button>
    </div>
  )
}
```

### Customers Store (useCustomersStore)

Example usage:

```javascript
import { useCustomersStore } from '../stores'

function CustomerForm() {
  const { createCustomer, isLoading } = useCustomersStore()

  const handleSubmit = async (formData) => {
    try {
      await createCustomer(formData)
      // Success!
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit({ name: 'Acme Inc', email: 'contact@acme.com' })
    }}>
      <button disabled={isLoading}>Save Customer</button>
    </form>
  )
}
```

### Dashboard Store (useDashboardStore)

Example usage:

```javascript
import { useDashboardStore } from '../stores'

function Dashboard() {
  const { metrics, isLoading, refreshAllData } = useDashboardStore()

  useEffect(() => {
    refreshAllData()
  }, [])

  if (isLoading) return <div>Loading dashboard...</div>

  return (
    <div className="grid grid-cols-4 gap-4">
      <div>Total Revenue: ${metrics.totalRevenue}</div>
      <div>Orders: {metrics.totalOrders}</div>
      <div>Customers: {metrics.totalCustomers}</div>
      <div>Pending: {metrics.pendingOrders}</div>
      <button onClick={() => refreshAllData()}>Refresh</button>
    </div>
  )
}
```

## Using i18next for Translations

### Basic Usage with useTranslation Hook

```javascript
import { useTranslation } from 'react-i18next'

function Dashboard() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <h1>{t('admin:dashboard.title')}</h1>
      <p>{t('admin:dashboard.totalRevenue')}</p>
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

### Using with Interpolation

```javascript
function OrderDetails({ orderId, customerName }) {
  const { t } = useTranslation()

  return (
    <p>
      {t('common:messages.loadingData', {
        defaultValue: 'Loading data...'
      })}
    </p>
  )
}
```

### Using Language Switcher Component

```javascript
import { LanguageSwitcher } from '@trading-erp/shared'

function Header() {
  return (
    <header className="flex justify-between items-center">
      <h1>Trading ERP</h1>
      <LanguageSwitcher className="ml-auto" />
    </header>
  )
}
```

## Translation Key Structure

### Common Keys (shared across all portals)

- `navigation.*` - Navigation items
- `common.*` - Common actions (Save, Cancel, Delete, etc.)
- `forms.*` - Form labels and validation messages
- `status.*` - Status labels (Pending, Processing, etc.)
- `errors.*` - Error messages
- `messages.*` - General messages

### Admin-Specific Keys

- `admin:dashboard.*` - Dashboard metrics and charts
- `admin:orders.*` - Order management
- `admin:customers.*` - Customer management
- `admin:factories.*` - Factory management
- `admin:products.*` - Product management
- `admin:reports.*` - Reporting
- `admin:users.*` - User management
- `admin:settings.*` - Settings

### Customer-Specific Keys

- `customer:dashboard.*` - Customer dashboard
- `customer:orders.*` - My orders
- `customer:quotations.*` - Quotations
- `customer:inquiries.*` - Create inquiries
- `customer:invoices.*` - Invoices
- `customer:shipments.*` - Shipments
- `customer:profile.*` - Profile management

### Factory-Specific Keys

- `factory:dashboard.*` - Factory dashboard
- `factory:purchaseOrders.*` - Purchase orders
- `factory:production.*` - Production schedule
- `factory:inventory.*` - Inventory management
- `factory:quality.*` - Quality control
- `factory:shipments.*` - Shipments
- `factory:reports.*` - Reports

## Best Practices

1. **Use namespaces** for better organization:
   ```javascript
   const { t } = useTranslation('admin')
   // Then use t('dashboard.title')
   ```

2. **Cache store selectors** to avoid unnecessary re-renders:
   ```javascript
   import { useShallow } from 'zustand/react/shallow'

   const { orders, isLoading } = useOrdersStore(
     useShallow((state) => ({
       orders: state.orders,
       isLoading: state.isLoading,
     }))
   )
   ```

3. **Separate data fetching from rendering**:
   ```javascript
   useEffect(() => {
     fetchOrders() // Fetch data on mount
   }, [])
   ```

4. **Always handle loading and error states**:
   ```javascript
   if (isLoading) return <LoadingSpinner />
   if (error) return <ErrorMessage message={error} />
   ```

5. **Use localStorage persistence for auth and UI**:
   The stores are already configured with persistence middleware, so user preferences and auth tokens will survive page refreshes.

## Migration Guide

To migrate existing components from useState to Zustand:

1. Replace `useState` with store hooks:
   ```javascript
   // Before
   const [orders, setOrders] = useState([])

   // After
   const { orders } = useOrdersStore()
   ```

2. Replace individual functions with store actions:
   ```javascript
   // Before
   const handleFetch = async () => {
     try {
      const data = await ordersAPI.getAll()
      setOrders(data)
    } catch (e) {
      setError(e.message)
    }
   }

   // After
   const { fetchOrders } = useOrdersStore()
   ```

3. Add i18n keys gradually - no need to replace all strings at once.

## RTL (Right-to-Left) Support

The LanguageSwitcher component automatically handles RTL for Arabic:

```javascript
// When switching to Arabic, these are automatically set:
document.documentElement.setAttribute('dir', 'rtl')
document.documentElement.lang = 'ar'

// CSS automatically adjusts for RTL
// Flexbox and Grid handle the direction change
```

Add this to your Tailwind config for better RTL support:

```javascript
module.exports = {
  plugins: [
    require('tailwindcss-rtl'),
  ],
}
```

## Troubleshooting

### Translations not updating
- Ensure i18n is initialized before rendering components
- Check that translation files are in the correct path
- Verify namespace names match in `useTranslation('namespace')`

### Store not persisting
- Check localStorage is not disabled
- Verify persist middleware is enabled
- Clear localStorage if stale data exists

### RTL not working
- Ensure `dir="rtl"` is set on html element
- Use CSS that respects text direction
- Test with right-aligned layout components
