# Phase 5 Features Implementation

## Overview
Four advanced features have been implemented for the Trading ERP system:
1. SSO/OAuth2 Integration (Google & Microsoft)
2. Data Warehouse / ETL Export (CSV, JSON, Analytics)
3. File Storage Abstraction (Local / S3 / MinIO)
4. Per-User Rate Limiting (Role-based)

---

## Feature 1: SSO/OAuth2 Integration

### Files Created
- `services/ssoService.js` - Core OAuth2 logic
- `routes/ssoRoutes.js` - OAuth endpoints
- `models/SSOAccount.js` - Database model
- `migrations/20260316000002-add-sso-accounts.js` - Migration

### Environment Variables Required
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/sso/google/callback

MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=http://localhost:5000/api/auth/sso/microsoft/callback
```

### API Endpoints
```
GET  /api/auth/sso/google                    - Get Google OAuth consent URL
GET  /api/auth/sso/google/callback           - Handle Google callback (auto-login)
GET  /api/auth/sso/microsoft                 - Get Microsoft OAuth consent URL
GET  /api/auth/sso/microsoft/callback        - Handle Microsoft callback (auto-login)
POST /api/auth/sso/link                      - Link SSO to existing user (requires auth)
GET  /api/auth/sso/accounts                  - Get user's linked SSO accounts (requires auth)
DELETE /api/auth/sso/unlink/:provider        - Unlink SSO provider (requires auth)
```

### Features
- Native HTTPS requests for OAuth2 token exchange (no passport.js)
- Auto-login: Users can log in with Google/Microsoft credentials
- Account linking: Link SSO to existing user accounts
- Account unlinking: Remove SSO providers
- Token refresh handling: Automatic token refresh tokens storage
- User discovery: Find/create users from OAuth provider info

### Database Model
SSOAccount table stores:
- userId (FK to Users)
- provider (enum: google, microsoft)
- providerId (provider's user ID)
- providerEmail (provider's email)
- accessToken (OAuth access token)
- refreshToken (OAuth refresh token)
- expiresAt (token expiration)

---

## Feature 2: Data Warehouse / ETL Export

### Files Created
- `services/dataExportService.js` - Export logic
- `routes/exportRoutes.js` - Export endpoints

### Environment Variables (Optional)
```env
# No required variables - works with defaults
```

### API Endpoints (Admin Only)
```
GET /api/exports/entities                    - List exportable entities
GET /api/exports/:entity/csv                 - Export as CSV download
GET /api/exports/:entity/json                - Export as JSON Lines download
GET /api/exports/analytics/snapshot          - Full analytics snapshot
GET /api/exports/analytics/kpis              - KPIs for BI tools
```

### Supported Entities
- salesOrders
- purchaseOrders
- invoices
- payments
- customers
- factories
- products
- shipments
- inspections

### Features
- CSV export: Comma-separated values with proper escaping
- JSON Lines export: One JSON object per line (NDJSON format)
- Analytics snapshot: Complete summary with key metrics
- KPI generation: Revenue, orders, customers, payment metrics
- Filtering: Status, date range, customer/factory filtering
- Pagination: Support for large dataset exports (limit/offset)
- Streaming: Memory-efficient for large datasets
- Response headers: Content-Disposition for download

### Query Parameters
```
status=draft           - Filter by status
startDate=2026-01-01   - Start date for range filter
endDate=2026-03-31     - End date for range filter
customerId=uuid        - Filter by customer
factoryId=uuid         - Filter by factory
limit=1000             - Results per page (default: 10000)
offset=0               - Skip N results
```

### Analytics Metrics Included
- Total sales and purchase amounts
- Invoice and payment counts/amounts
- Revenue last 30/90 days
- New orders last 30/90 days
- New customers last 30 days
- Outstanding invoices count
- Average payment days
- Inventory metrics (total products, low stock items)

---

## Feature 3: File Storage Abstraction

### Files Created
- `services/storageService.js` - Storage abstraction layer
- Updated `middleware/upload.js` - Integrated storage service

### Installation Required
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Environment Variables

#### Local Storage (Default)
```env
STORAGE_PROVIDER=local        # or omit for default
UPLOAD_DIR=./uploads          # Default upload directory
```

#### S3 Storage
```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://s3.amazonaws.com  # For MinIO, use endpoint
S3_BUCKET=my-bucket
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_REGION=us-east-1
```

#### MinIO Storage
```env
STORAGE_PROVIDER=minio
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=my-bucket
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
```

### Storage Service API
```javascript
// Upload file
const result = await storageService.uploadFile(file, 'documents', { metadata: {...} });
// Returns: { url, path, size, provider, uploadedAt }

// Get file stream
const { stream, size } = await storageService.getFile('documents/file-id.pdf');

// Delete file
await storageService.deleteFile('documents/file-id.pdf');

// Get signed/presigned URL
const url = await storageService.getSignedUrlPath('documents/file-id.pdf', 3600);

// List files
const files = await storageService.listFiles('documents/');

// Move/rename file
await storageService.moveFile('old/path.pdf', 'new/path.pdf');
```

### Upload Middleware Integration
The `uploadSingle()` and `uploadMultiple()` middleware now:
- Automatically handle local vs S3/MinIO uploads
- Clean up temp files for cloud storage
- Attach upload results to `req.uploadedFile` or `req.uploadedFiles`
- Support all existing file filtering and validation

### Features
- **Provider agnostic**: Switch between local/S3/MinIO with env var
- **Streaming**: Returns streams for large files
- **Signed URLs**: Presigned URLs for S3 downloads
- **Metadata**: Store custom metadata with S3 files
- **Temp file cleanup**: Automatic cleanup for cloud uploads
- **Path safety**: Prevents directory traversal attacks

---

## Feature 4: Per-User Rate Limiting

### Files Modified
- `middleware/rateLimiter.js` - Enhanced with user-based limiting

### Environment Variables
```env
# Role-based limits (requests per minute)
RATE_LIMIT_ADMIN=200
RATE_LIMIT_SALES=100
RATE_LIMIT_OPERATIONS=100
RATE_LIMIT_FINANCE=100
RATE_LIMIT_INSPECTOR=80
RATE_LIMIT_CUSTOMER=60
RATE_LIMIT_FACTORY=60
RATE_LIMIT_UNAUTHENTICATED=30
```

### Features

#### Original IP-based Limiters (Still Available)
- `generalLimiter` - General API rate limit
- `authLimiter` - Login/auth attempts
- `createLimiter` - Resource creation
- `fileLimiter` - File uploads

#### New User-based Limiter
- `userRateLimiter` - Per-user rate limiter
- `userRateLimitMiddleware` - Express middleware

### UserRateLimiter Class

```javascript
// Check rate limit for a request
const result = userRateLimiter.checkLimit(req);
// Returns: { allowed, remaining, resetTime, limit, current }

// Use as middleware
app.use('/api/critical', userRateLimitMiddleware);

// Get stats for monitoring
const stats = userRateLimiter.getStats('user:uuid');
const allStats = userRateLimiter.getAllStats();
```

### Implementation Details

#### Rate Limiting Strategy
- **User-authenticated**: Tracks by user ID
- **Unauthenticated**: Falls back to IP address
- **Sliding window**: 1-minute rolling window
- **In-memory store**: Map-based storage
- **Auto-cleanup**: Removes expired entries every 5 minutes

#### Response Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 2026-03-16T12:00:00.000Z
```

#### Rate Limit Response (429)
```json
{
  "error": "Too many requests, please try again later",
  "retryAfter": "2026-03-16T12:00:00.000Z",
  "resetTime": "2026-03-16T12:00:00.000Z"
}
```

### Role-Based Limits (Default)
- **admin**: 200 req/min (operations staff)
- **sales**: 100 req/min
- **operations**: 100 req/min
- **finance**: 100 req/min
- **inspector**: 80 req/min
- **customer**: 60 req/min
- **factory**: 60 req/min
- **unauthenticated**: 30 req/min (IP-based)

### Usage in Routes
```javascript
// Apply user-based rate limiting to sensitive endpoints
router.post('/critical-operation', userRateLimitMiddleware, requireAuth, controller.criticalOp);

// Or wrap specific handler
app.use('/api/orders', userRateLimitMiddleware);
```

---

## Integration with Server

### Routes Registered
All features are registered in `server.js`:
```javascript
app.use('/api/auth/sso', ssoRoutes);      // Feature 1
app.use('/api/exports', exportRoutes);    // Feature 2
// Feature 3 integrated via upload middleware
// Feature 4 available as middleware
```

### Model Registration
New `SSOAccount` model needs to be added to `models/index.js`:
```javascript
const SSOAccount = require('./SSOAccount')(sequelize);
```

---

## Testing & Validation

### Feature 1: SSO Testing
```bash
# Get Google OAuth URL
curl http://localhost:5000/api/auth/sso/google

# Simulate callback (with real auth code)
curl http://localhost:5000/api/auth/sso/google/callback?code=xxx

# Link SSO to existing user
curl -X POST http://localhost:5000/api/auth/sso/link \
  -H "Authorization: Bearer TOKEN" \
  -d '{"provider":"google","providerId":"123"}'
```

### Feature 2: Export Testing
```bash
# Export customers as CSV
curl http://localhost:5000/api/exports/customers/csv \
  -H "Authorization: Bearer TOKEN" > customers.csv

# Export with filters
curl 'http://localhost:5000/api/exports/invoices/json?status=paid&startDate=2026-01-01' \
  -H "Authorization: Bearer TOKEN" > invoices.jsonl

# Get analytics
curl http://localhost:5000/api/exports/analytics/kpis \
  -H "Authorization: Bearer TOKEN"
```

### Feature 3: Storage Testing
```javascript
// Test in code
const storageService = require('./services/storageService');

// Local upload
const result = await storageService.uploadFile(file, 'docs');

// S3 upload (with AWS SDK installed)
const url = await storageService.getSignedUrlPath(path, 3600);
```

### Feature 4: Rate Limiting Testing
```bash
# Make multiple requests
for i in {1..65}; do
  curl http://localhost:5000/api/health \
    -H "Authorization: Bearer CUSTOMER_TOKEN"
done
# After 60 requests (customer limit), returns 429
```

---

## Database Migration

Run migration to create SSOAccount table:
```bash
npm run migrate
```

Or manually in backend:
```bash
npx sequelize-cli db:migrate
```

---

## Security Considerations

### Feature 1: SSO
- OAuth tokens stored securely (in database)
- Refresh tokens used to obtain new access tokens
- Secrets managed via environment variables
- Token expiration tracked

### Feature 2: Export
- Admin-only access required
- Large exports streamed to prevent memory issues
- Can be logged for audit trail

### Feature 3: Storage
- File type validation still applied
- File size limits enforced
- S3 supports encryption and access control
- Local storage respects directory permissions

### Feature 4: Rate Limiting
- Prevents abuse and DDoS attacks
- Per-user tracking prevents shared IP issues
- Configurable limits per role
- Automatic cleanup prevents memory leaks

---

## Performance Notes

### Feature 1: SSO
- Native HTTPS requests minimize dependencies
- Tokens cached in database for refresh

### Feature 2: Export
- Streaming API prevents memory overflow
- Pagination support for large exports
- Efficient SQL queries with selected fields

### Feature 3: Storage
- S3 streaming for large files
- Local disk storage is fast
- MinIO supports compression

### Feature 4: Rate Limiting
- In-memory Map O(1) lookups
- Sliding window implementation efficient
- Cleanup runs every 5 minutes
- Scales to thousands of users

---

## Troubleshooting

### Feature 1: SSO
**Problem**: "S3_BUCKET environment variable not set"
**Solution**: Set GOOGLE_CLIENT_ID and other OAuth env vars

**Problem**: "OAuth callback failed"
**Solution**: Verify redirect URIs match configured values

### Feature 2: Export
**Problem**: "No data found"
**Solution**: Check date filters and entity status

**Problem**: "Admin access required"
**Solution**: Use admin account and valid JWT token

### Feature 3: Storage
**Problem**: "AWS SDK not installed"
**Solution**: Run `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

**Problem**: "S3 connection failed"
**Solution**: Check S3 credentials and endpoint configuration

### Feature 4: Rate Limiting
**Problem**: Getting 429 quickly
**Solution**: Adjust RATE_LIMIT_* env vars for your role

---

## Future Enhancements

1. **SSO**: Add GitHub, Google Workspace, custom OIDC providers
2. **Export**: Add Excel, PDF export formats; scheduled exports
3. **Storage**: Add CDN integration, image optimization
4. **Rate Limiting**: Add distributed rate limiting (Redis); custom rules per endpoint

---

## Summary of Files Modified/Created

### New Files
- `/backend/services/ssoService.js`
- `/backend/routes/ssoRoutes.js`
- `/backend/models/SSOAccount.js`
- `/backend/services/dataExportService.js`
- `/backend/routes/exportRoutes.js`
- `/backend/services/storageService.js`
- `/backend/migrations/20260316000002-add-sso-accounts.js`

### Modified Files
- `/backend/middleware/rateLimiter.js` - Enhanced with UserRateLimiter class
- `/backend/middleware/upload.js` - Integrated storageService
- `/backend/server.js` - Added route registrations

### Total Lines Added
- Services: ~1,200 lines
- Routes: ~300 lines
- Middleware: ~250 lines
- Models: ~60 lines
- Migrations: ~60 lines

Total: ~1,870 lines of production code

---

**Implementation Date**: March 16, 2026
**Status**: Ready for Testing & Migration
**Next Step**: Run `npm run migrate` and test endpoints
