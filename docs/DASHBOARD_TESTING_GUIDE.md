# Dashboard Implementation Testing Guide

## Quick Verification Checklist

### Backend Endpoints Verification
Run these curl commands to verify all backend endpoints are working:

```bash
# Test role-based dashboard configuration
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/dashboard/role/ceo

# Test available widgets endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/dashboard/widgets

# Test KPI endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/dashboard/kpi

# Test save layout endpoint (POST)
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"widgets": ["revenue", "profit"], "layout": "grid"}' \
  http://localhost:5000/api/dashboard/layout
```

### Frontend Component Files Verification

Run these commands to verify all files are in place:

```bash
# Check admin portal dashboard
ls -la /sessions/eager-stoic-wozniak/mnt/Trading\ ERP/frontend/admin-portal/src/components/dashboard/DashboardWidgets.jsx

# Check customer portal dashboard
ls -la /sessions/eager-stoic-wozniak/mnt/Trading\ ERP/frontend/customer-portal/src/components/dashboard/CustomerDashboard.jsx

# Check factory portal dashboard
ls -la /sessions/eager-stoic-wozniak/mnt/Trading\ ERP/frontend/factory-portal/src/components/dashboard/FactoryDashboard.jsx
```

---

## Frontend Component Testing

### 1. Admin Portal Dashboard Widget Tests

#### Test Case 1: Load with CEO Role
```jsx
import DashboardWidgets from './components/dashboard/DashboardWidgets'

render(<DashboardWidgets userRole="ceo" />)

// Verify:
// - CEO Dashboard title appears
// - Revenue, Profit, Top Customers, Pipeline widgets are displayed
// - KPI cards show correct metrics
// - Overview tab is active by default
```

#### Test Case 2: Switch Between Tabs
```jsx
// Click on "Widgets" tab
fireEvent.click(screen.getByText('Widgets'))

// Verify:
// - Widget list displays
// - Each widget shows category and size
// - "Overview" tab is no longer active
```

#### Test Case 3: Loading State
```jsx
// Should show loading spinner while fetching data
render(<DashboardWidgets userRole="cfo" />)

// Verify:
// - LoadingSpinner component appears
// - "Loading dashboard..." message shows
```

#### Test Case 4: Error Handling
```jsx
// Mock API error
mockAPI.getRoleConfig.mockRejectedValue(new Error('API Error'))

render(<DashboardWidgets userRole="coo" />)

// Verify:
// - Toast error notification appears
// - Error message is displayed
// - No crash or white screen
```

#### Test Case 5: Different Roles
Test all supported roles:
- CEO ✓
- CFO ✓
- COO ✓
- CMO ✓
- Sales ✓
- Operations ✓
- Finance ✓
- Admin ✓

```jsx
const roles = ['ceo', 'cfo', 'coo', 'cmo', 'sales', 'operations', 'finance', 'admin']

roles.forEach(role => {
  render(<DashboardWidgets userRole={role} />)
  // Verify role-specific widgets appear
})
```

---

### 2. Customer Portal Dashboard Tests

#### Test Case 1: Orders Display
```jsx
import CustomerDashboard from './components/dashboard/CustomerDashboard'

render(<CustomerDashboard />)

// Verify:
// - "My Dashboard" title appears
// - Pending Orders, Shipped Orders, Delivered Orders cards show
// - Recent Orders table populated
```

#### Test Case 2: Outstanding Invoices Alert
```jsx
// Mock outstanding invoices > 0
mockAPI.invoicesAPI.getAll.mockResolvedValue({
  data: { data: [{ balance: 5000, status: 'sent' }] }
})

render(<CustomerDashboard />)

// Verify:
// - Red alert banner appears
// - Outstanding balance is displayed
// - "View Invoices" button is clickable
```

#### Test Case 3: Active Shipments Section
```jsx
// Mock active shipments
mockAPI.shipmentsAPI.getAll.mockResolvedValue({
  data: { data: [{ status: 'in_transit', shipmentNumber: 'SHP-001' }] }
})

render(<CustomerDashboard />)

// Verify:
// - Shipment cards appear
// - ETA date is displayed
// - "Track Shipment" button is present
```

#### Test Case 4: Empty States
```jsx
// Mock empty data
mockAPI.ordersAPI.getAll.mockResolvedValue({ data: { data: [] } })
mockAPI.invoicesAPI.getAll.mockResolvedValue({ data: { data: [] } })
mockAPI.shipmentsAPI.getAll.mockResolvedValue({ data: { data: [] } })

render(<CustomerDashboard />)

// Verify:
// - "No orders found" message in orders table
// - "No outstanding invoices" message
// - Shipments section disappears or shows empty state
```

#### Test Case 5: Overdue Invoice Indicator
```jsx
// Create overdue invoice (dueDate < today)
const overdueInvoice = {
  dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  status: 'sent'
}

// Verify:
// - Red "Overdue" badge appears
// - Row is highlighted in red (bg-red-50)
// - "Pay Now" button is visible
```

---

### 3. Factory Portal Dashboard Tests

#### Test Case 1: PO Status Summary
```jsx
import FactoryDashboard from './components/dashboard/FactoryDashboard'

render(<FactoryDashboard />)

// Verify:
// - "Factory Dashboard" title appears
// - PO status cards (New, Confirmed, In Production, Shipped) show
// - Upcoming Inspections card appears
```

#### Test Case 2: Production Timeline
```jsx
render(<FactoryDashboard />)

// Verify:
// - Production timeline appears
// - Each stage shows progress bar
// - Status badges (completed, in_progress, pending) are color-coded
// - Dates are formatted correctly
```

#### Test Case 3: Activity Feed
```jsx
render(<FactoryDashboard />)

// Verify:
// - Recent activity items appear
// - Icons are color-coded (blue, orange, green)
// - Timestamps are displayed
// - Activity type messages are clear
```

#### Test Case 4: Purchase Orders Table
```jsx
render(<FactoryDashboard />)

// Verify:
// - PO table displays
// - Columns: PO #, Order Date, Quantity, Amount, Status, Action
// - Status badges are correct
// - "View Details" buttons are clickable
```

#### Test Case 5: Responsive Layout
```jsx
// Test mobile viewport
renderWithWindowSize({ width: 375, height: 667 })

// Verify:
// - Grid collapses to 1 column
// - Cards are full width
// - Tables are scrollable horizontally
// - All text is readable

// Test tablet viewport
renderWithWindowSize({ width: 768, height: 1024 })

// Verify:
// - Grid shows 2 columns
// - Layout is balanced

// Test desktop viewport
renderWithWindowSize({ width: 1920, height: 1080 })

// Verify:
// - Grid shows 4 columns
// - Maximum readability
```

---

## API Integration Testing

### Test API Service Methods

#### Admin Portal API Methods
```javascript
import { dashboardAPI } from './services/api'

// Test getRoleConfig
const config = await dashboardAPI.getRoleConfig('ceo')
expect(config.data.role).toBe('ceo')
expect(config.data.widgets).toBeDefined()
expect(Array.isArray(config.data.widgets)).toBe(true)

// Test getAvailableWidgets
const widgets = await dashboardAPI.getAvailableWidgets()
expect(Array.isArray(widgets.data.widgets)).toBe(true)
expect(widgets.data.widgets[0]).toHaveProperty('id')
expect(widgets.data.widgets[0]).toHaveProperty('name')

// Test getKPIs
const kpis = await dashboardAPI.getKPIs()
expect(kpis.data.kpis).toBeDefined()
expect(kpis.data.kpis.revenueGrowthRate).toBeDefined()

// Test saveLayout
const layout = await dashboardAPI.saveLayout({
  widgets: ['revenue', 'profit'],
  layout: 'grid'
})
expect(layout.data).toBeDefined()
```

#### Customer Portal API Methods
```javascript
import { ordersAPI, invoicesAPI, shipmentsAPI } from './services/api'

// Test getAll on ordersAPI
const orders = await ordersAPI.getAll({ limit: 5 })
expect(Array.isArray(orders.data.data)).toBe(true)

// Test getAll on invoicesAPI with filters
const invoices = await invoicesAPI.getAll({
  filters: { status: ['draft', 'sent'] }
})
expect(Array.isArray(invoices.data.data)).toBe(true)

// Test list on shipmentsAPI
const shipments = await shipmentsAPI.list({
  filters: { status: ['pending', 'in_transit'] }
})
expect(Array.isArray(shipments.data.data)).toBe(true)
```

#### Factory Portal API Methods
```javascript
import { purchaseOrdersAPI } from './services/api'

// Test getAll on purchaseOrdersAPI
const pos = await purchaseOrdersAPI.getAll({ limit: 10 })
expect(Array.isArray(pos.data.data)).toBe(true)
expect(pos.data.data[0]).toHaveProperty('poNumber')
expect(pos.data.data[0]).toHaveProperty('status')
```

---

## Performance Testing

### Load Time Testing
```bash
# Use Chrome DevTools Performance tab or Lighthouse

# Expected metrics:
# - First Contentful Paint (FCP): < 1.5s
# - Largest Contentful Paint (LCP): < 2.5s
# - Time to Interactive (TTI): < 3.5s
# - Cumulative Layout Shift (CLS): < 0.1
```

### Chart Rendering Performance
```jsx
import { render } from '@testing-library/react'
import DashboardWidgets from './components/dashboard/DashboardWidgets'

// Measure render time
const startTime = performance.now()
render(<DashboardWidgets userRole="ceo" />)
const endTime = performance.now()

console.log(`Render time: ${endTime - startTime}ms`)

// Should be < 500ms for initial render
expect(endTime - startTime).toBeLessThan(500)
```

### API Call Optimization
```jsx
// Verify Promise.all is used for parallel requests
// Check Network tab in DevTools

// Should see multiple requests happening simultaneously
// Not sequential (which would be slower)
```

---

## Accessibility Testing

### Keyboard Navigation
```jsx
// Test Tab key navigation
user.tab()
expect(document.activeElement).toBe(tabButtons[0])

user.tab()
expect(document.activeElement).toBe(tabButtons[1])

// Test Enter key on buttons
user.keyboard('{Enter}')
// Verify action is triggered
```

### Screen Reader Testing
```jsx
// Verify ARIA labels
expect(screen.getByLabelText(/revenue/i)).toBeInTheDocument()

// Verify role attributes
expect(screen.getByRole('tablist')).toBeInTheDocument()
expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()

// Verify semantic HTML
expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/dashboard/i)
```

---

## Browser Compatibility Testing

### Test on these browsers:
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 8+)

### Verify:
- ✓ Chart rendering
- ✓ Table scrolling
- ✓ Responsive layout
- ✓ Form inputs
- ✓ Modal dialogs
- ✓ Toast notifications

---

## User Acceptance Testing (UAT) Scenarios

### Scenario 1: CEO Views Company Overview
1. Login with CEO credentials
2. Navigate to Dashboard
3. Verify CEO-specific widgets appear
4. Check KPI cards display correct data
5. Switch to Widgets tab
6. Verify available widgets are shown

### Scenario 2: Customer Tracks Orders and Invoices
1. Login with Customer credentials
2. Navigate to Dashboard
3. Verify order summary shows
4. Check Recent Orders table
5. Verify Outstanding Invoices section
6. Check for overdue invoice alerts
7. Verify Active Shipments tracking

### Scenario 3: Factory Manager Reviews Production
1. Login with Factory credentials
2. Navigate to Dashboard
3. Verify PO status summary
4. Check Upcoming Inspections list
5. Review Production Timeline
6. Check Recent Activity feed
7. Verify Active Purchase Orders table

---

## Known Issues & Workarounds

### Issue 1: Mock Data in Factory Dashboard
**Status**: Expected (Production data to be connected)
**Workaround**: Replace mock data with real API calls when inspections API is ready

### Issue 2: Chart Data Empty
**Status**: Expected (Demo charts need data)
**Solution**: Connect to actual data endpoints from reports API

### Issue 3: Slow Initial Load
**Status**: May occur with large datasets
**Solution**: Implement pagination and lazy loading

---

## Bug Report Template

```
Title: [Component] Issue Description

Component: DashboardWidgets / CustomerDashboard / FactoryDashboard
Role: [Role tested with]
Browser: [Chrome/Firefox/Safari/Edge] Version
Device: [Desktop/Tablet/Mobile]

Steps to Reproduce:
1. Login with [role]
2. Navigate to [page]
3. [Action that causes issue]

Expected Result:
[What should happen]

Actual Result:
[What actually happens]

Screenshots:
[Attach if applicable]

Console Errors:
[Any JavaScript errors from DevTools]
```

---

## Sign-Off Checklist

- [ ] All backend endpoints verified working
- [ ] All frontend components created and placed correctly
- [ ] API service methods integrated
- [ ] Components render without errors
- [ ] All roles display correct widgets
- [ ] Responsive design works on all screen sizes
- [ ] Error handling tested
- [ ] Loading states work correctly
- [ ] Empty states display appropriately
- [ ] Accessibility requirements met
- [ ] Performance is acceptable
- [ ] Browser compatibility verified
- [ ] UAT scenarios completed
- [ ] Code review completed
- [ ] Ready for production deployment

---

## Support Contact

For issues or questions regarding dashboard implementation:
1. Check DASHBOARD_IMPLEMENTATION_SUMMARY.md for detailed documentation
2. Review component JSDoc comments in source files
3. Check browser console for error messages
4. Review backend logs for API errors

---

## Version History

- **v1.0** (2026-03-16) - Initial implementation
  - Admin Portal DashboardWidgets component
  - Customer Portal CustomerDashboard component
  - Factory Portal FactoryDashboard component
  - API service integration
  - Responsive design with Tailwind CSS

