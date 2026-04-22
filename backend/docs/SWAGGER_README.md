# Trading ERP API - Swagger/OpenAPI Documentation

## Overview

The Trading ERP backend provides comprehensive Swagger/OpenAPI 3.0 documentation for all API endpoints. The documentation is automatically generated and served through a web-based UI.

## Accessing the Documentation

Once the backend server is running, access the interactive API documentation at:

```
http://localhost:5000/api-docs
```

## Structure

### Configuration File
- **Location:** `/backend/config/swagger.js`
- **Purpose:** Main Swagger/OpenAPI specification configuration
- **Includes:**
  - API title, version, and description
  - Server configurations (development and production)
  - Security schemes (Bearer JWT token)
  - All component schemas (models)
  - Common response formats

### Definitions File
- **Location:** `/backend/docs/swagger-definitions.js`
- **Purpose:** Detailed endpoint definitions for all API routes
- **Contains:** 115 documented endpoints across 20 modules

## API Modules

The API is organized into 20 modules, each with specific functionality:

### 1. **Auth**
Authentication and user management
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

### 2. **Customers**
Customer management and relationship tracking
- Create, read, update, delete customers
- Get customer balance
- View order history
- Customer dashboard analytics

### 3. **Factories**
Supplier/Factory management
- Create and manage factories
- View factory products
- Update product prices
- Factory performance metrics

### 4. **Products**
Product catalog management
- Create and update products
- Search products
- Price history tracking
- Category-based filtering
- Bulk product updates

### 5. **Inquiries**
Customer inquiry management
- Create and track inquiries
- Update inquiry status
- Set follow-up dates
- Convert inquiries to quotations
- Timeline tracking

### 6. **Quotations**
Quotation/Proposal management
- Create quotations
- Send to customers
- Accept/Reject quotations
- Duplicate quotations
- Convert to proforma invoices
- Generate PDF

### 7. **Proforma Invoices**
Proforma invoice management
- List and retrieve proforma invoices
- Confirm and send
- Generate PDF
- Automatic sales order creation

### 8. **Sales Orders**
Sales order management
- Create sales orders directly or from quotations
- Update order status
- View order timeline
- Shipping and document management
- Generate PDF

### 9. **Purchase Orders**
Supplier purchase management
- Create purchase orders
- Create from sales orders
- Update status (draft, sent, confirmed, received)
- Confirm and send
- Generate PDF

### 10. **Packing Lists**
Shipment packing management
- Create packing lists
- Track package details
- Weight and volume calculations
- Confirm and generate PDF

### 11. **Shipping Documents**
Shipping document management
- Upload shipping documents
- Associate with sales orders
- Bill of lading, certifications, etc.
- Document tracking

### 12. **Shipments**
Shipment tracking and management
- Create shipments
- Track shipment events
- Monitor vessel/carrier details
- Port information
- Estimated and actual delivery dates

### 13. **Inspections**
Quality inspection management
- Schedule inspections
- Track inspection status
- Generate inspection reports
- Quality metrics
- Pre-production, during, and final inspections

### 14. **Claims**
Customer claim management
- Submit quality/damage claims
- Track claim status
- Resolve with compensation
- Customer-specific claim history

### 15. **Invoices**
Invoice management and tracking
- Create invoices
- Auto-generate from sales orders
- Track payment status
- Aging report
- Collection metrics
- Overdue tracking

### 16. **Payments**
Payment tracking
- Record payments
- Confirm payments
- Reject payments
- Link to invoices

### 17. **Notifications**
User notification system
- Get user notifications
- Mark as read
- Mark all as read
- Delete notifications
- Unread count

### 18. **Dashboard**
Role-based dashboards
- Admin dashboard with key metrics
- Sales dashboard with conversion tracking
- Operations dashboard
- Finance dashboard with cash flow
- Customer-specific dashboards
- Customizable dashboard preferences
- Custom chart generation

### 19. **Reports**
Business reporting
- Sales reports by period
- Purchase reports
- Inventory reports
- Financial reports (P&L)
- Customer performance reports
- Factory performance reports

### 20. **Documents**
Document management system
- Upload documents
- Manage document templates
- Generate customized documents
- Version control
- Category-based organization
- Entity-specific documents

## Response Formats

All API responses follow consistent formats:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalCount": 100,
    "pageSize": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400
  }
}
```

## Authentication

All endpoints (except registration and login) require Bearer token authentication.

**Header Format:**
```
Authorization: Bearer <JWT_TOKEN>
```

The token is obtained from the login endpoint and must be included in all subsequent requests.

## Role-Based Access Control

The API implements role-based access control:
- **admin** - Full system access
- **sales** - Sales and inquiry management
- **operations** - Order fulfillment and shipment
- **finance** - Invoicing and payments
- **inspector** - Quality inspections

## Key Features

### 1. Document Generation
- Automatic PDF generation for orders, invoices, and shipments
- Document templates with customization
- Version control for documents

### 2. Financial Management
- Invoice aging reports
- Payment tracking
- Collection metrics
- Overdue invoice alerts

### 3. Quality Control
- Inspection scheduling and tracking
- Pass/fail metrics
- Inspection reports with findings
- Factory quality ratings

### 4. Supply Chain Tracking
- Shipment tracking with events
- Port information (loading/discharge)
- Carrier management
- Container tracking

### 5. Analytics & Reporting
- Custom dashboard widgets
- Period-based reporting (week, month, quarter, year)
- Customer and factory analytics
- Financial performance metrics

### 6. Notifications
- Real-time notifications
- WebSocket integration
- Mark as read tracking
- Notification preferences

## Query Parameters

Common query parameters across endpoints:
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 10-20)
- `status` - Filter by status
- `search` - Text search
- `period` - Time period for reports (week, month, quarter, year)

## Testing

### Using Swagger UI
1. Navigate to `http://localhost:5000/api-docs`
2. Click "Authorize" button
3. Enter your JWT token from login
4. Try out any endpoint

### Using cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use returned token
curl http://localhost:5000/api/customers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Postman
1. Import the Swagger spec from `http://localhost:5000/api-docs.json`
2. Set up Bearer token authentication
3. Execute requests

## Integration Points

### Frontend Integration
The frontend can use the Swagger spec for:
- Auto-generating API clients
- Type-safe API calls
- Real-time API documentation
- Request/response validation

### Third-Party Integration
External systems can:
- Access the OpenAPI spec at `/api-docs.json`
- Generate client libraries
- Validate requests against schema
- Implement automated testing

## Security

### JWT Bearer Token
- Required for all endpoints except login/register
- Token must be included in Authorization header
- Implement token refresh mechanism

### Rate Limiting
- Auth endpoints: 5 requests per 15 minutes
- General endpoints: 100 requests per 15 minutes

### CORS
- Configured for development origins (localhost:3000, localhost:3001, localhost:5173)
- Update for production

## Environment Variables

### Swagger Configuration
No specific environment variables needed. The Swagger setup uses:
- `NODE_ENV` - Development or production
- `PORT` - Server port (default: 5000)

## File Organization

```
backend/
├── config/
│   └── swagger.js              # Swagger configuration
├── docs/
│   ├── SWAGGER_README.md       # This file
│   └── swagger-definitions.js  # All endpoint definitions
└── routes/
    ├── authRoutes.js
    ├── customerRoutes.js
    ├── ... (other routes)
    └── documentRoutes.js
```

## Maintenance

### Adding New Endpoints
1. Create route in appropriate file
2. Add JSDoc comments OR
3. Add endpoint definition to `swagger-definitions.js`
4. Reference in Swagger configuration

### Updating Schemas
1. Modify component schemas in `swagger.js`
2. Update endpoint definitions with new schemas
3. Swagger UI auto-refreshes

## Performance Considerations

- Pagination improves performance for large datasets
- Limit size defaults to 10-20 records
- Consider database indexing on frequently filtered fields
- Cache frequently accessed master data (customers, products)

## Troubleshooting

### Swagger Not Loading
- Check server is running: `http://localhost:5000/api/health`
- Verify Swagger packages installed: `npm list swagger-jsdoc swagger-ui-express`
- Check no syntax errors in swagger.js

### Endpoints Not Showing
- Verify definitions added to `swagger-definitions.js`
- Check JSDoc comment syntax
- Ensure path references match actual routes

### Authorization Not Working
- Verify JWT token format
- Check Authorization header format
- Ensure token hasn't expired
- Verify user role permissions

## Support

For issues or questions:
1. Check endpoint documentation in Swagger UI
2. Review request/response examples
3. Check error messages and status codes
4. Verify authentication token

## API Versioning

Current Version: **1.0.0**

Future versions will maintain backward compatibility or provide migration guides.

---

**Last Updated:** March 16, 2026
**API Server:** Trading ERP Backend
**Documentation Format:** OpenAPI 3.0
