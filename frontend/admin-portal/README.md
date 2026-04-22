# Trading ERP - Admin Portal

A complete, production-grade React 18 admin portal for a Trading Company ERP system (flooring business). Built with modern technologies and best practices.

## Features

### Core Modules

#### Sales Management
- **Customers**: Full CRUD, credit limits, payment terms, contact management
- **Inquiries**: Track customer inquiries, convert to quotations
- **Quotations**: Create, send, and manage customer quotations
- **Proforma Invoices**: Issue and track proforma invoices
- **Sales Orders**: Complete order lifecycle management

#### Procurement
- **Factories**: Supplier management, location tracking, performance metrics
- **Products**: Comprehensive product catalog with pricing and history
- **Purchase Orders**: Automated PO generation from sales orders

#### Logistics & Operations
- **Packing Lists**: Order fulfillment with weight/volume calculations
- **Shipments**: Real-time tracking with carrier integration
- **Inspections**: Quality assurance with checklist and photo uploads

#### Financial Management
- **Invoices**: Invoice generation with payment tracking
- **Payments**: Payment recording and reconciliation
- **Claims**: Issue tracking and resolution management
- **Inventory**: Stock level management with low-stock alerts

#### Analytics & Reporting
- **Sales Reports**: Revenue trends, customer analysis
- **Purchase Reports**: Supplier performance, cost analysis
- **Financial Reports**: P&L, AR/AP aging analysis
- **Inventory Reports**: Stock valuation, turnover metrics
- **Customer Analytics**: RFM analysis, customer segmentation
- **Factory Performance**: Supplier KPIs and ratings

#### System Administration
- **User Management**: Role-based access control (RBAC)
- **Settings**: Company information, email templates
- **Audit Logs**: Complete system activity tracking

### Technical Features

- **Authentication**: JWT-based auth with refresh tokens
- **Real-time Updates**: Socket.IO for live notifications and order updates
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS
- **Data Visualization**: Charts using Recharts
- **Form Validation**: Comprehensive client-side validation
- **Error Handling**: Global error handling with toast notifications
- **API Integration**: Axios with interceptors for secure API calls
- **Pagination**: Advanced pagination with customizable page sizes
- **Search & Filter**: Global search and advanced filtering
- **Status Management**: Color-coded status badges for all entities

## Tech Stack

- **Frontend Framework**: React 18
- **Routing**: React Router v6
- **Styling**: Tailwind CSS + @tailwindcss/forms
- **HTTP Client**: Axios
- **Real-time**: Socket.IO client
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Date Handling**: dayjs
- **Build Tool**: Vite

## Project Structure

```
admin-portal/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Layout.jsx       # Main layout with sidebar
│   │   ├── DataTable.jsx    # Reusable table component
│   │   ├── Modal.jsx        # Modal dialog
│   │   ├── StatusBadge.jsx  # Status indicator
│   │   ├── FormFields.jsx   # Reusable form inputs
│   │   ├── LoadingSpinner.jsx
│   │   ├── EmptyState.jsx
│   │   ├── Pagination.jsx
│   │   └── ...
│   ├── pages/               # Page components
│   │   ├── Dashboard.jsx    # Home dashboard
│   │   ├── Customers/       # Customer management
│   │   ├── Factories/       # Factory management
│   │   ├── Products/        # Product catalog
│   │   ├── Inquiries/       # Inquiry management
│   │   ├── Quotations/      # Quotation management
│   │   ├── ProformaInvoices/# PI management
│   │   ├── SalesOrders/     # Order management
│   │   ├── PurchaseOrders/  # PO management
│   │   ├── Shipments/       # Shipment tracking
│   │   ├── Inspections/     # Quality checks
│   │   ├── Claims/          # Claims management
│   │   ├── Invoices/        # Invoice management
│   │   ├── Payments/        # Payment tracking
│   │   ├── Inventory/       # Stock management
│   │   ├── Reports/         # Analytics & reports
│   │   ├── Settings/        # System settings
│   │   └── Auth/            # Login & auth pages
│   ├── services/
│   │   ├── api.js           # Axios instance + endpoints
│   │   └── socket.js        # Socket.IO configuration
│   ├── hooks/
│   │   ├── useAuth.js       # Authentication context
│   │   └── useNotifications.js # Real-time notifications
│   ├── utils/
│   │   ├── constants.js     # Status, roles, countries
│   │   └── formatters.js    # Date, currency, formatting
│   ├── App.jsx              # Main app with routing
│   ├── index.jsx            # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind configuration
├── postcss.config.js        # PostCSS configuration
└── package.json             # Dependencies
```

## Installation

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment**
Create a `.env.local` file:
```
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

3. **Start Development Server**
```bash
npm run dev
```

The portal will be available at `http://localhost:5173`

## Build for Production

```bash
npm run build
```

This creates a production-optimized build in the `dist/` folder.

## API Integration

All API calls are centralized in `src/services/api.js`:

```javascript
import { customersAPI, ordersAPI, invoicesAPI } from './services/api'

// Usage in components
const fetchCustomers = async () => {
  const response = await customersAPI.getAll({ search: 'query' })
  setCustomers(response.data)
}
```

### Available API Endpoints

- **Auth**: Login, logout, password reset
- **Customers**: CRUD, orders, invoices, quotations
- **Factories**: CRUD, products, purchase orders
- **Products**: CRUD, price history, order history
- **Inquiries**: CRUD, convert to quotation
- **Quotations**: CRUD, send, convert to PI, duplicate
- **Proforma Invoices**: CRUD, convert to order
- **Sales Orders**: CRUD, status changes, shipments
- **Purchase Orders**: CRUD, status tracking
- **Shipments**: CRUD, tracking updates
- **Inspections**: Schedule, record results
- **Claims**: File, investigate, resolve
- **Invoices**: CRUD, payment recording
- **Payments**: Record, tracking
- **Inventory**: Stock levels, adjustments
- **Reports**: Sales, purchase, financial, inventory
- **Users**: CRUD, role assignment
- **Settings**: Company info, email templates, logs

## Authentication

The portal uses JWT-based authentication:

1. User logs in with email/password
2. Backend returns JWT token
3. Token is stored in localStorage
4. Token is sent with every API request via Authorization header
5. Invalid tokens trigger automatic logout

**Demo Credentials**:
- Email: `admin@example.com`
- Password: `password123`

## Real-time Features

Using Socket.IO for live updates:

```javascript
import { onOrderUpdate, onShipmentUpdate } from './services/socket'

// Listen for real-time updates
useEffect(() => {
  onOrderUpdate((order) => {
    console.log('Order updated:', order)
  })
}, [])
```

Supported real-time events:
- `order:updated` - Order status changes
- `inquiry:updated` - Inquiry updates
- `shipment:updated` - Shipment tracking
- `invoice:updated` - Invoice changes
- `payment:received` - Payment confirmations
- `notification` - General notifications

## Customization

### Colors & Theming

Edit `tailwind.config.js` to customize colors:
```javascript
theme: {
  extend: {
    colors: {
      primary: { /* your colors */ },
      slate: { /* your colors */ }
    }
  }
}
```

### Menu Items

Edit `src/components/Layout.jsx` to customize the sidebar menu:
```javascript
const menuItems = [
  { label: 'Dashboard', icon: Home, path: '/' },
  // Add more items...
]
```

### Status Colors

Edit `src/utils/constants.js` to customize status colors:
```javascript
export const STATUS_COLOR_MAP = {
  draft: 'gray',
  sent: 'blue',
  // Add more mappings...
}
```

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
CMD ["serve", "-s", "dist"]
```

### Traditional Hosting
1. Run `npm run build`
2. Upload `dist/` folder to your web server
3. Configure server to route all requests to `index.html`

## Performance Optimizations

- Code splitting with React Router
- Lazy loading of components
- Image optimization
- Bundle analysis
- CSS optimization with Tailwind

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### CORS Issues
If you get CORS errors, ensure the backend is configured to accept requests from your frontend URL.

### API Connection Failed
Check:
- Backend server is running
- API URL in `.env.local` is correct
- Network tab in browser dev tools for actual errors

### Socket.IO Connection Failed
- Verify WebSocket is not blocked by firewall
- Check Socket.IO server configuration
- Ensure backend is listening on correct port

## Contributing

This is a complete, production-ready codebase. For modifications:

1. Follow existing code patterns
2. Use Tailwind CSS for styling
3. Keep components small and reusable
4. Add proper error handling
5. Test in multiple browsers

## License

Proprietary - Trading Company Internal Use Only

## Support

For issues or questions, contact the development team.

---

**Last Updated**: 2024
**Version**: 1.0.0
