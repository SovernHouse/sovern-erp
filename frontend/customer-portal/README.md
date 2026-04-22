# Sovern House - Customer Portal

A professional, feature-rich customer portal for the Sovern House ERP system (international trading company). Built with React 18, React Router v6, Tailwind CSS, and modern best practices.

## Features

### Dashboard
- Welcome greeting with company metrics
- Active orders summary cards with visual status
- Recent quotations overview
- Shipments in transit with tracking visualization
- Pending claims dashboard
- Quick action buttons
- Recent activity feed

### Products
- Beautiful product catalog grid with category filtering
- Product search functionality
- Price range filtering
- Product detail pages with image galleries
- Specifications display
- Quotation request integration

### Quotations
- Multi-step quotation request form
- Product selection with quantities
- Special requirements and notes
- Quotation list with filtering
- Detailed quotation view
- Accept/Reject functionality
- PDF download capability
- Pricing breakdown

### Orders
- Complete order list with filtering and search
- Order detail page with:
  - Visual order tracker (Confirmed → Delivered)
  - Order items table
  - Payment status tracking
  - Document downloads (PI, packing list, etc.)
  - Shipment tracking integration
  - Shipping address display

### Shipments
- Real-time shipment tracking
- Visual map visualization of shipment journey
- Container details (number, type, vessel, voyage)
- Tracking timeline with events
- Port arrival/departure tracking
- ETA countdown
- Progress visualization

### Claims
- Claim filing form with multi-step process
- Order selection
- Claim type selection (damage, delay, quality, etc.)
- Photo/evidence upload
- Claim detail view with:
  - Status tracking
  - Comments and notes
  - Resolution details
  - Attachment viewing

### Profile
- Company information management
- Contact details
- Address management
- Password change functionality
- Order history with statistics
- Account status display

## Tech Stack

- **Frontend Framework**: React 18
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Real-time**: Socket.IO client
- **Build Tool**: Vite
- **Date Handling**: date-fns

## Project Structure

```
src/
├── components/          # Shared reusable components
│   ├── Layout.jsx      # Main layout with sidebar
│   ├── ProductCard.jsx # Product display card
│   ├── OrderTracker.jsx # Visual order progress tracker
│   ├── ShipmentMap.jsx # Shipment visualization
│   ├── ShipmentTimeline.jsx
│   ├── StatusBadge.jsx
│   ├── DataTable.jsx   # Reusable table component
│   ├── Modal.jsx
│   ├── ConfirmDialog.jsx
│   ├── LoadingSpinner.jsx
│   ├── EmptyState.jsx
│   └── FileUpload.jsx
├── pages/              # Page components
│   ├── Auth/           # Login, forgot password
│   ├── Dashboard.jsx
│   ├── Products/       # Product catalog and detail
│   ├── Quotations/     # Quotation request, list, detail
│   ├── Orders/         # Order list and detail
│   ├── Shipments/      # Shipment tracking
│   ├── Claims/         # Claims management
│   └── Profile/        # Profile and order history
├── hooks/              # Custom React hooks
│   ├── useAuth.js      # Authentication hook
│   ├── useNotifications.js
│   └── useCart.js      # Shopping cart for quotations
├── services/           # API service layer
│   └── api.js          # Axios instance and API methods
├── utils/              # Utility functions
│   ├── constants.js    # App constants
│   └── formatters.js   # Data formatting functions
├── App.jsx             # Main app with routing
├── index.jsx           # React DOM render
└── index.css           # Global styles
```

## Installation

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment variables** (if needed)
Create a `.env` file:
```
VITE_API_URL=http://localhost:5000/api
```

3. **Start development server**
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Building for Production

```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## API Integration

The portal communicates with a backend API. Key endpoints include:

### Authentication
- `POST /auth/login` - User login
- `POST /auth/forgot-password` - Password reset request
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile

### Products
- `GET /products` - List products with filters
- `GET /products/:id` - Get product details
- `GET /products/search` - Search products

### Quotations
- `GET /quotations` - List quotations
- `POST /quotations` - Create new quotation
- `GET /quotations/:id` - Get quotation details
- `POST /quotations/:id/accept` - Accept quotation
- `GET /quotations/:id/pdf` - Download quotation PDF

### Orders
- `GET /orders` - List orders
- `GET /orders/:id` - Get order details
- `GET /orders/:id/documents` - Get order documents
- `GET /orders/:id/shipments` - Get related shipments

### Shipments
- `GET /shipments` - List shipments
- `GET /shipments/:id` - Get shipment tracking details

### Claims
- `GET /claims` - List claims
- `POST /claims` - Create new claim
- `GET /claims/:id` - Get claim details
- `POST /claims/:id/attachments` - Upload claim attachment
- `POST /claims/:id/comments` - Add claim comment

## Authentication

The application uses JWT token-based authentication:
1. Tokens are stored in localStorage
2. Axios interceptor automatically adds Authorization header
3. Unauthorized requests redirect to login page
4. Login mock data: `customer@sovernhouse.co` / `demo123`

## Features Implemented

### Components
- ✅ Responsive sidebar navigation
- ✅ Top navigation bar with notifications
- ✅ User profile dropdown menu
- ✅ Product cards with hover effects
- ✅ Order progress tracker visualization
- ✅ Shipment map visualization
- ✅ Timeline components
- ✅ Data tables with sorting and pagination
- ✅ Modal dialogs
- ✅ Loading spinners
- ✅ Empty states
- ✅ File upload component

### Pages
- ✅ Login and authentication
- ✅ Dashboard with metrics
- ✅ Product catalog with filtering
- ✅ Product detail pages
- ✅ Quotation request workflow (multi-step)
- ✅ Quotation list and detail
- ✅ Order list with search/filter
- ✅ Order detail with tracker
- ✅ Shipment tracking with visualization
- ✅ Claims management (file, list, detail)
- ✅ User profile management
- ✅ Order history

### Styling
- ✅ Tailwind CSS with custom color theme (indigo/emerald)
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Gradient backgrounds
- ✅ Smooth animations and transitions
- ✅ Custom button styles
- ✅ Form input styling
- ✅ Card components with shadows

### Functionality
- ✅ API error handling with toast notifications
- ✅ Loading states
- ✅ Form validation
- ✅ Multi-step form flows
- ✅ File uploads
- ✅ Data export (PDF)
- ✅ Search and filtering
- ✅ Sorting and pagination
- ✅ Responsive notifications
- ✅ Date/time formatting

## Customization

### Branding
- Update company name in `Layout.jsx`
- Customize colors in `tailwind.config.js`
- Change logo in HTML/components

### API Endpoints
- Modify `src/services/api.js` to match your backend
- Update endpoints in individual page components

### Color Theme
The app uses a custom color scheme:
- Primary: Indigo (600-900)
- Accent: Emerald (500-600)
- Customize in `tailwind.config.js`

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Optimizations

- Code splitting with React Router
- Lazy loading of route components
- Image optimization
- Efficient state management
- Memoization for heavy components
- Debounced search

## Security

- JWT token authentication
- Axios interceptors for auth
- Environment variable protection
- XSS protection via React
- CSRF protection via SameSite cookies

## Troubleshooting

### API Connection Issues
- Verify backend is running on correct port
- Check VITE_API_URL environment variable
- Check browser console for CORS errors

### Style Issues
- Clear browser cache and rebuild
- Ensure Tailwind CSS is properly compiled
- Check that PostCSS is configured correctly

### Authentication Issues
- Check localStorage for authToken
- Verify token format in API response
- Check Authorization header format

## Future Enhancements

- Real-time updates with WebSockets
- Advanced analytics dashboard
- Custom reporting tools
- Document management system
- Invoice management
- Payment processing integration
- Mobile app version
- Multi-language support
- Dark mode theme

## License

Proprietary - Sovern House

## Support

For issues or questions, contact: support@sovernhouse.co
