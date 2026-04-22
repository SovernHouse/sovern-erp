# Factory Portal - Trading Company ERP

A complete, production-ready Factory/Supplier Portal for managing products, prices, purchase orders, production, shipping, and quality inspections in a flooring trading business.

## 📋 Project Overview

This is a comprehensive React 18 application built for factory partners to manage their operations within a Trading Company ERP system. The portal provides real-time tracking, document management, and seamless communication between factories and the trading company.

### Key Features

- **Product Management**: Add/edit products with full specifications (thickness, material, finish, color, grade, wear layer)
- **Price Management**: Update individual or bulk prices with effective dates
- **Purchase Order Management**: View, confirm, and track purchase orders from customers
- **Production Tracking**: Monitor production progress with visual progress bars and status updates
- **Shipping Management**: Create shipments, upload required documents, manage packing lists
- **Quality Inspections**: Schedule inspections, prepare with checklists, view results
- **Document Center**: Centralized repository for all business documents
- **Profile Management**: Company information, certifications, team management
- **Real-time Notifications**: Socket.IO integration for live updates

## 🛠️ Tech Stack

- **React 18**: Modern React with hooks
- **React Router v6**: Client-side routing
- **Vite**: Fast build tool and dev server
- **Axios**: HTTP client with interceptors
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Beautiful charts and graphs
- **Lucide React**: Icon library
- **React Hot Toast**: Toast notifications
- **Socket.IO Client**: Real-time communication
- **date-fns**: Date manipulation

## 📁 Project Structure

```
factory-portal/
├── index.html                          # HTML entry point
├── package.json                        # Dependencies
├── vite.config.js                      # Vite configuration
├── tailwind.config.js                  # Tailwind configuration
├── postcss.config.js                   # PostCSS configuration
│
└── src/
    ├── index.jsx                       # React entry point
    ├── index.css                       # Global styles
    ├── App.jsx                         # Root component with routing
    │
    ├── services/
    │   └── api.js                      # Axios API client with all endpoints
    │
    ├── hooks/
    │   ├── useAuth.js                  # Authentication hook
    │   └── useNotifications.js         # Socket.IO notifications hook
    │
    ├── utils/
    │   ├── constants.js                # App constants and enums
    │   └── formatters.js               # Utility formatters (currency, date, etc.)
    │
    ├── components/                     # Shared components
    │   ├── Layout.jsx                  # Main app layout with sidebar
    │   ├── DataTable.jsx               # Sortable data table
    │   ├── StatusBadge.jsx             # Status badge component
    │   ├── Modal.jsx                   # Modal dialog
    │   ├── ConfirmDialog.jsx           # Confirmation dialog
    │   ├── FileUpload.jsx              # Drag-drop file upload
    │   ├── FormFields.jsx              # Form input components
    │   ├── LoadingSpinner.jsx          # Loading indicator
    │   ├── EmptyState.jsx              # Empty state placeholder
    │   ├── Timeline.jsx                # Timeline component
    │   └── StatsCard.jsx               # KPI card
    │
    └── pages/
        ├── Auth/
        │   ├── Login.jsx               # Factory login page
        │   └── ForgotPassword.jsx      # Password reset
        │
        ├── Dashboard.jsx               # Dashboard with KPIs and charts
        │
        ├── Products/
        │   ├── ProductList.jsx         # All products with search/filter
        │   ├── ProductForm.jsx         # Add/edit product form
        │   └── BulkPriceUpdate.jsx     # Bulk price update interface
        │
        ├── PriceManagement/
        │   ├── PriceList.jsx           # Current price list with history
        │   ├── PriceUpdateForm.jsx     # Single price update
        │   └── PriceHistory.jsx        # Price history with charts
        │
        ├── PurchaseOrders/
        │   ├── POList.jsx              # All POs with filters
        │   ├── PODetail.jsx            # PO details with items
        │   └── POConfirmation.jsx      # Confirm PO with commitment
        │
        ├── Production/
        │   ├── ProductionTracker.jsx   # Track production progress
        │   └── ProductionCalendar.jsx  # Calendar view of schedules
        │
        ├── Shipping/
        │   ├── ShipmentList.jsx        # All shipments
        │   ├── ShipmentForm.jsx        # Create/edit shipment
        │   ├── DocumentUpload.jsx      # Upload shipping documents
        │   └── PackingListEntry.jsx    # Manage packing list
        │
        ├── Inspections/
        │   ├── InspectionSchedule.jsx  # View scheduled inspections
        │   ├── InspectionResults.jsx   # View inspection reports
        │   └── InspectionPrep.jsx      # Preparation checklists
        │
        ├── Documents/
        │   └── DocumentCenter.jsx      # Document repository
        │
        └── Profile/
            ├── FactoryProfile.jsx      # Company info and certifications
            └── Settings.jsx            # Notifications and team management
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend API running at `http://localhost:3000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:3001`

## 🔑 Key API Endpoints

All API calls are centralized in `src/services/api.js`:

### Authentication
- `POST /auth/factory-login` - Factory login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Products
- `GET /factory/products` - List all products
- `POST /factory/products` - Create product
- `PUT /factory/products/:id` - Update product
- `DELETE /factory/products/:id` - Delete product
- `POST /factory/products/:id/images` - Upload product images

### Prices
- `GET /factory/prices` - List prices
- `PUT /factory/prices/:id` - Update single price
- `POST /factory/prices/bulk-update` - Bulk price update
- `GET /factory/prices/history/:productId` - Price history

### Purchase Orders
- `GET /factory/purchase-orders` - List POs
- `GET /factory/purchase-orders/:id` - Get PO details
- `POST /factory/purchase-orders/:id/confirm` - Confirm PO
- `POST /factory/purchase-orders/:id/reject` - Reject PO
- `PUT /factory/purchase-orders/:id/items/:itemId` - Update item status

### Production
- `GET /factory/production/po/:poId` - Get production data
- `PUT /factory/production/:id` - Update production progress
- `GET /factory/production/calendar` - Calendar data

### Shipping
- `GET /factory/shipments` - List shipments
- `POST /factory/shipments` - Create shipment
- `POST /factory/shipments/:id/documents/:type` - Upload document
- `POST /factory/shipments/:id/packing-list` - Update packing list

### Inspections
- `GET /factory/inspections/schedule` - Inspection schedule
- `GET /factory/inspections/results` - Inspection results
- `GET /factory/inspections/:id/checklist` - Preparation checklist

### Dashboard
- `GET /factory/dashboard/kpis` - Dashboard KPIs
- `GET /factory/dashboard/revenue` - Revenue chart
- `GET /factory/dashboard/po-status-distribution` - PO distribution

## 🎨 Design System

### Color Scheme
- **Primary (Factory)**: Amber/Orange (#e67e22)
- **Secondary**: Blue, Green, Red for various status indicators
- **Neutral**: Gray shades for backgrounds and text

### Component Patterns

#### Forms
```jsx
<FormGroup label="Field Name" required error={errors.field}>
  <Input
    placeholder="Enter value"
    value={value}
    onChange={handleChange}
    error={!!errors.field}
  />
</FormGroup>
```

#### Data Tables
```jsx
<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'value', label: 'Value', render: (val) => formatCurrency(val) }
  ]}
  data={items}
  onRowClick={handleRowClick}
/>
```

#### Status Badge
```jsx
<StatusBadge status="confirmed" />  // Shows colored badge
```

## 📊 State Management

- **Local State**: React hooks (useState) for component state
- **Authentication**: `useAuth` hook manages auth state and persistence
- **API Calls**: Axios with automatic token injection via interceptor
- **Notifications**: React Hot Toast for user feedback
- **Real-time**: Socket.IO for live updates

## 🔐 Security

- JWT token stored in localStorage
- Automatic token injection in all API requests
- 401 redirect on token expiry
- Form validation on client and server
- XSS protection with React escaping
- CSRF protection via API

## 📱 Responsive Design

The application is fully responsive:
- **Mobile**: Single column layouts, collapsible sidebar
- **Tablet**: Adjusted grid layouts
- **Desktop**: Full featured multi-column layouts

## 🧪 Testing

No test files included (add Jest/React Testing Library as needed):

```bash
npm install --save-dev jest @testing-library/react
```

## 🚢 Deployment

### Build
```bash
npm run build
```

### Production Server
The `dist/` folder contains production-ready files.

### Environment Variables
Create `.env.production`:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

## 📝 Features Detail

### Dashboard
- Real-time KPIs (Active POs, Production In Progress, Pending Shipments)
- Revenue trend charts
- PO status distribution pie chart
- Upcoming deadlines list
- Recent purchase orders
- Inspection schedule
- Action items and alerts

### Products Module
- Complete product catalog management
- Advanced specifications (material, thickness, finish, color, grade, wear layer)
- Bulk price updates with effective dates
- Product images management
- MOQ and lead time tracking

### Purchase Orders
- Full PO workflow (pending → confirmed → in progress → shipped)
- Item-level status tracking
- Production estimates
- Special instructions
- Delivery commitment tracking

### Production
- Real-time production progress tracking
- Visual progress bars per item
- Production notes and photos
- Calendar view with deadline tracking
- Risk indicators (on-track, at-risk, delayed)

### Shipping
- Complete shipment lifecycle
- Carrier and vessel tracking
- Required document checklist
- Shipping document uploads (BoL, CoO, Invoice, etc.)
- Packing list management

### Inspections
- Scheduled inspection calendar
- Inspection result tracking
- Pass/Fail/Rework status
- Pre-inspection preparation checklists
- Detailed inspection reports

## 🔧 Maintenance

### Code Style
- ES6+ JavaScript
- Functional React components with hooks
- Consistent naming conventions
- Component modularization

### Adding New Features
1. Create page component in `src/pages/`
2. Add API endpoint in `src/services/api.js`
3. Add route in `src/App.jsx`
4. Add navigation in `src/components/Layout.jsx`

## 📞 Support

For issues or questions about the Factory Portal:
1. Check existing documentation
2. Review code comments
3. Check API endpoint contracts
4. Verify backend integration

## 📄 License

Built for Trading Company ERP System - Flooring Division

---

**Version**: 1.0.0
**Last Updated**: 2024
**Status**: Production Ready
