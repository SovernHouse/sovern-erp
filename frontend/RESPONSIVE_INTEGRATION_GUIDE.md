# Responsive Design Integration Guide

## Quick Start

### 1. Import Responsive Components in Your Pages

```jsx
import {
  ResponsiveLayout,
  ResponsiveNav,
  ResponsiveModal,
  ResponsiveGrid,
  MobileHeader,
  SwipeableList,
  PullToRefresh,
  FloatingActionButton,
  useIsMobile,
  useBreakpoint
} from '@trading-erp/shared'
```

### 2. Wrap Your Layout with Responsive Components

**Example: Admin Portal Dashboard**

```jsx
import { ResponsiveLayout } from '@trading-erp/shared'
import { Home, Settings } from 'lucide-react'

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/' },
    { label: 'Orders', icon: ShoppingCart, path: '/orders' },
    // ... more items
  ]

  return (
    <ResponsiveLayout
      sidebarContent={<Navigation items={navItems} />}
      headerContent={<h1>Admin Dashboard</h1>}
      logoContent={<Logo />}
      showBottomNav={true}
    >
      {/* Page content here */}
    </ResponsiveLayout>
  )
}
```

## Component Integration Checklist

### For Each Portal

- [ ] Import responsive hooks in layout component
- [ ] Use `useIsMobile()` to conditionally render mobile/desktop UI
- [ ] Replace hardcoded navigation with ResponsiveNav
- [ ] Update modals to use ResponsiveModal
- [ ] Add PullToRefresh to list pages
- [ ] Add FloatingActionButton for primary actions
- [ ] Test on mobile, tablet, and desktop viewports
- [ ] Verify touch interactions work smoothly
- [ ] Check safe area insets on notched devices
- [ ] Test keyboard navigation

### Migration Steps

#### Step 1: Update Layout File
```jsx
// Before
export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Manual sidebar logic...
  return (
    <div className="flex">
      {/* Manual sidebar */}
      {/* Manual mobile nav */}
    </div>
  )
}

// After
import { ResponsiveLayout, ResponsiveNav } from '@trading-erp/shared'

export default function Layout({ children }) {
  return (
    <ResponsiveLayout
      sidebarContent={<ResponsiveNav items={navItems} />}
      headerContent={<h1>Title</h1>}
    >
      {children}
    </ResponsiveLayout>
  )
}
```

#### Step 2: Update List Pages with SwipeableList
```jsx
// Before
<table>
  {items.map(item => (
    <tr>
      <td>{item.name}</td>
      <td>
        <button onClick={() => edit(item)}>Edit</button>
        <button onClick={() => delete(item)}>Delete</button>
      </td>
    </tr>
  ))}
</table>

// After
import { SwipeableList, useIsMobile } from '@trading-erp/shared'

const isMobile = useIsMobile()

if (isMobile) {
  return (
    <SwipeableList
      items={items}
      onEdit={edit}
      onDelete={delete}
      renderItem={(item) => <div>{item.name}</div>}
    />
  )
}

// Desktop table view
return (
  <table>
    {/* ... */}
  </table>
)
```

#### Step 3: Add Pull-to-Refresh to List Pages
```jsx
import { PullToRefresh } from '@trading-erp/shared'

export default function OrdersPage() {
  const handleRefresh = async () => {
    await fetchOrders()
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4">
        {/* Orders list */}
      </div>
    </PullToRefresh>
  )
}
```

#### Step 4: Add FloatingActionButton for Primary Actions
```jsx
import { FloatingActionButton } from '@trading-erp/shared'
import { Plus } from 'lucide-react'

export default function OrdersPage() {
  const handleCreate = () => {
    navigate('/orders/create')
  }

  return (
    <div>
      {/* Orders list */}
      <FloatingActionButton
        label="Create Order"
        onClick={handleCreate}
        icon={<Plus size={24} />}
        color="primary"
      />
    </div>
  )
}
```

#### Step 5: Use ResponsiveGrid for Card Layouts
```jsx
import { ResponsiveGrid } from '@trading-erp/shared'

export default function StatsPage() {
  return (
    <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }} gap="1.5rem">
      <StatsCard title="Total Orders" value={1234} />
      <StatsCard title="Pending" value={45} />
      <StatsCard title="Shipped" value={189} />
      <StatsCard title="Delivered" value={1000} />
    </ResponsiveGrid>
  )
}
```

#### Step 6: Use ResponsiveModal for Dialogs
```jsx
import { ResponsiveModal } from '@trading-erp/shared'

export default function OrderForm() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)}>Create Order</button>

      <ResponsiveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Create New Order"
        size="lg"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)}>Cancel</button>
            <button onClick={handleSave}>Create</button>
          </div>
        }
      >
        {/* Form fields */}
      </ResponsiveModal>
    </>
  )
}
```

## Styling Guidelines

### Using Responsive CSS Classes

```jsx
// Show/hide classes
<div className="mobile-only">Mobile View</div>
<div className="desktop-only">Desktop View</div>

// Responsive spacing
<div className="p-mobile md:p-tablet lg:p-desktop">
  Content with responsive padding
</div>

// Responsive grid
<div className="grid-responsive">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

// Safe area for notched devices
<div className="safe-area-bottom">
  Content respects iPhone notch
</div>

// Touch-friendly targets
<button className="tap-target min-h-11 min-w-11">
  Touch-friendly button
</button>
```

### Tailwind Integration

The responsive components work seamlessly with Tailwind CSS:

```jsx
// Combine responsive utilities
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid using Tailwind */}
</div>

// Use Tailwind breakpoint utilities
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

## Common Patterns

### Responsive Form
```jsx
import { ResponsiveForm, FormField } from '@trading-erp/shared'

export default function OrderForm() {
  const [formData, setFormData] = useState({})

  return (
    <ResponsiveForm onSubmit={handleSubmit}>
      <FormField
        label="Customer"
        type="select"
        name="customerId"
        options={customers}
      />
      <FormField
        label="Order Date"
        type="date"
        name="orderDate"
      />
      {/* More fields */}
    </ResponsiveForm>
  )
}
```

### Responsive Table
```jsx
import { ResponsiveTable } from '@trading-erp/shared'

export default function OrdersTable() {
  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ]

  const mobileFields = ['orderNumber', 'customer', 'status']

  return (
    <ResponsiveTable
      columns={columns}
      data={orders}
      mobileFields={mobileFields}
    />
  )
}
```

### Responsive Chart
```jsx
import { ResponsiveChart } from '@trading-erp/shared'

export default function RevenueChart() {
  return (
    <ResponsiveChart
      type="line"
      data={chartData}
      options={{ responsive: true }}
    />
  )
}
```

## Testing Responsive Layouts

### Manual Testing Checklist

- [ ] Test on iPhone 12 (390px)
- [ ] Test on iPhone 12 Pro Max (428px)
- [ ] Test on Samsung Galaxy S21 (360px)
- [ ] Test on iPad (768px)
- [ ] Test on iPad Pro (1024px)
- [ ] Test on desktop (1920px)
- [ ] Test landscape orientation
- [ ] Test with safe area insets (notched devices)
- [ ] Test touch interactions (swipe, tap)
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Check color contrast

### Automated Testing

```jsx
// Example test with responsive hook
import { renderHook } from '@testing-library/react'
import { useIsMobile } from '@trading-erp/shared'

test('useIsMobile returns correct value', () => {
  // Mock window.innerWidth
  global.innerWidth = 500
  window.dispatchEvent(new Event('resize'))

  const { result } = renderHook(() => useIsMobile())
  expect(result.current).toBe(true)
})
```

## Performance Tips

1. **Lazy Load Components**
   ```jsx
   const SwipeableList = lazy(() =>
     import('@trading-erp/shared').then(m => ({ default: m.SwipeableList }))
   )
   ```

2. **Debounce Resize Events**
   - Already handled by useBreakpoint hook

3. **Use CSS Media Queries Over JavaScript**
   - Prefer `.mobile-only` class over `if (isMobile) return null`

4. **Optimize Bundle Size**
   - Only import needed components
   - Tree-shake unused responsive utilities

5. **Cache Breakpoint Checks**
   - Hooks memoize results, avoid recalculation

## Troubleshooting

### Components Not Responsive
- [ ] Check if responsive CSS is imported in your page
- [ ] Verify breakpoints match expected widths
- [ ] Check browser window width with DevTools
- [ ] Clear browser cache

### Touch Interactions Not Working
- [ ] Verify touch events are not blocked by CSS
- [ ] Check if `touch-action: none` is set appropriately
- [ ] Test on actual touch device (not just mouse in DevTools)

### Safe Area Insets Not Applied
- [ ] Check if `@supports (padding: max(0px))` is supported
- [ ] Verify `.safe-area-*` classes are added to correct elements
- [ ] Test on notched device (iPhone X+)

### Modal Not Fullscreen on Mobile
- [ ] Check if ResponsiveModal is receiving `isOpen={true}`
- [ ] Verify `useIsMobile()` is correctly detecting mobile
- [ ] Check CSS z-index layering

## Support

For issues or questions:
1. Check the main RESPONSIVE_DESIGN_IMPLEMENTATION.md
2. Review component documentation in JSDoc comments
3. Check example usage patterns above
4. Test with responsive debugging tools
