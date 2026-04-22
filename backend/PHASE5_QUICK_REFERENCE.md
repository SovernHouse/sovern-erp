# Phase 5 Features - Quick Reference

## Quick Start

### 1. Run Migration
```bash
cd backend
npm run migrate
```

### 2. Configure Environment Variables
Add to `.env`:
```env
# Feature 1: SSO (Optional, needed for OAuth)
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/sso/google/callback
MICROSOFT_CLIENT_ID=your_id
MICROSOFT_CLIENT_SECRET=your_secret
MICROSOFT_REDIRECT_URI=http://localhost:5000/api/auth/sso/microsoft/callback

# Feature 3: Storage (Optional, defaults to local)
STORAGE_PROVIDER=local  # or s3, minio

# Feature 4: Rate Limiting (Optional, uses defaults)
RATE_LIMIT_ADMIN=200
RATE_LIMIT_CUSTOMER=60
```

### 3. Install S3 SDK (Optional)
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## API Endpoints

### Feature 1: SSO/OAuth2

```bash
# Get Google consent URL
GET /api/auth/sso/google

# Google callback (automatic after user consent)
GET /api/auth/sso/google/callback?code=AUTH_CODE

# Get Microsoft consent URL
GET /api/auth/sso/microsoft

# Microsoft callback (automatic after user consent)
GET /api/auth/sso/microsoft/callback?code=AUTH_CODE

# Link SSO to existing account (requires auth)
POST /api/auth/sso/link
Authorization: Bearer TOKEN
Body: { provider: "google", providerId: "123", providerEmail: "..." }

# Unlink SSO provider
DELETE /api/auth/sso/unlink/google
Authorization: Bearer TOKEN

# Get linked accounts
GET /api/auth/sso/accounts
Authorization: Bearer TOKEN
```

### Feature 2: Data Export (Admin Only)

```bash
# List exportable entities
GET /api/exports/entities
Authorization: Bearer ADMIN_TOKEN

# Export as CSV
GET /api/exports/customers/csv
GET /api/exports/invoices/csv?status=paid&startDate=2026-01-01

# Export as JSON Lines
GET /api/exports/orders/json
GET /api/exports/payments/json?limit=1000&offset=0

# Analytics snapshot
GET /api/exports/analytics/snapshot
Authorization: Bearer ADMIN_TOKEN

# KPIs for BI tools
GET /api/exports/analytics/kpis
Authorization: Bearer ADMIN_TOKEN
```

### Feature 3: File Storage

Used automatically in upload endpoints via middleware.

**In Code**:
```javascript
const storageService = require('./services/storageService');

// Upload
const result = await storageService.uploadFile(file, 'documents');
// { url, path, size, provider }

// Download
const { stream } = await storageService.getFile('documents/file-id.pdf');

// Delete
await storageService.deleteFile('documents/file-id.pdf');

// Get signed URL (S3 only)
const url = await storageService.getSignedUrlPath('documents/file-id.pdf', 3600);
```

### Feature 4: Rate Limiting

Automatic on all endpoints. Returns:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 2026-03-16T12:00:00Z
```

When limit exceeded (429):
```json
{
  "error": "Too many requests, please try again later",
  "retryAfter": "2026-03-16T12:00:00.000Z",
  "resetTime": "2026-03-16T12:00:00.000Z"
}
```

---

## Key Classes & Functions

### ssoService
```javascript
const ssoService = require('./services/ssoService');

// Get auth URLs
ssoService.getGoogleAuthUrl()       // Returns: string
ssoService.getMicrosoftAuthUrl()    // Returns: string

// Handle callbacks
await ssoService.handleGoogleCallback(code)      // Returns: { user, tokens, ssoProvider }
await ssoService.handleMicrosoftCallback(code)   // Returns: { user, tokens, ssoProvider }

// Link/unlink
await ssoService.linkSSOAccount(userId, provider, providerId, ...)
await ssoService.unlinkSSOAccount(userId, provider)
await ssoService.getUserSSOAccounts(userId)
```

### dataExportService
```javascript
const dataExportService = require('./services/dataExportService');

// Exports
await dataExportService.exportToCSV(entity, filters)      // Returns: { csv, count, total }
await dataExportService.exportToJSON(entity, filters)     // Returns: { jsonl, count, total }

// Analytics
await dataExportService.generateAnalyticsSnapshot()       // Returns: { snapshot }
await dataExportService.generateKPIs()                    // Returns: { kpis, timestamp }

// List entities
dataExportService.getExportableEntities()                 // Returns: object with all entities
```

### storageService
```javascript
const storageService = require('./services/storageService');

// File operations
await storageService.uploadFile(file, path, options)
await storageService.getFile(path)
await storageService.deleteFile(path)
await storageService.getSignedUrlPath(path, expiresIn)
await storageService.listFiles(prefix)
await storageService.moveFile(from, to)

// Provider
storageService.STORAGE_PROVIDER  // 'local' | 's3' | 'minio'
```

### userRateLimiter
```javascript
const { userRateLimiter, userRateLimitMiddleware } = require('./middleware/rateLimiter');

// In routes
app.use('/api/critical', userRateLimitMiddleware);

// Check limit in code
const result = userRateLimiter.checkLimit(req);
// { allowed: boolean, remaining: number, resetTime: Date, limit: number }

// Get stats
userRateLimiter.getStats('user:uuid')    // Single user
userRateLimiter.getAllStats()            // All users
```

---

## Common Use Cases

### Use Case 1: Enable Google Login
1. Create Google OAuth credentials at https://console.cloud.google.com
2. Set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
3. Frontend: Direct users to `/api/auth/sso/google`
4. User grants permission, redirected to callback
5. Backend returns JWT tokens

### Use Case 2: Export Customer Data to BI Tool
```bash
# Get all customers as CSV
curl -X GET "http://localhost:5000/api/exports/customers/csv" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  > customers.csv

# Get recent invoices as JSON
curl -X GET "http://localhost:5000/api/exports/invoices/json?startDate=2026-01-01" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  > invoices.jsonl
```

### Use Case 3: Store Uploaded Files to S3
1. Install AWS SDK: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
2. Set env vars: STORAGE_PROVIDER=s3, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
3. Use existing upload endpoints - storage is automatic
4. Files stored in S3 instead of local disk

### Use Case 4: Rate Limit API Access
1. Adjust limits in .env (RATE_LIMIT_CUSTOMER, RATE_LIMIT_ADMIN, etc.)
2. Requests automatically tracked per user/IP
3. Headers show remaining quota
4. 429 response when exceeded

---

## Environment Variables Reference

### SSO
```env
GOOGLE_CLIENT_ID                      # Google OAuth app ID
GOOGLE_CLIENT_SECRET                  # Google OAuth secret
GOOGLE_REDIRECT_URI                   # Google callback URL
MICROSOFT_CLIENT_ID                   # Microsoft OAuth app ID
MICROSOFT_CLIENT_SECRET               # Microsoft OAuth secret
MICROSOFT_REDIRECT_URI                # Microsoft callback URL
```

### Storage
```env
STORAGE_PROVIDER=local|s3|minio       # Default: local
UPLOAD_DIR=./uploads                  # Local storage directory
S3_ENDPOINT=https://...               # S3 or MinIO endpoint
S3_BUCKET=bucket-name                 # S3 bucket name
S3_ACCESS_KEY=key                     # S3 access key
S3_SECRET_KEY=secret                  # S3 secret key
S3_REGION=us-east-1                   # S3 region
```

### Rate Limiting
```env
RATE_LIMIT_ADMIN=200                  # Requests per minute (admin)
RATE_LIMIT_SALES=100
RATE_LIMIT_OPERATIONS=100
RATE_LIMIT_FINANCE=100
RATE_LIMIT_INSPECTOR=80
RATE_LIMIT_CUSTOMER=60
RATE_LIMIT_FACTORY=60
RATE_LIMIT_UNAUTHENTICATED=30         # For non-logged-in users
```

---

## Testing Examples

### Test SSO Callback
```bash
# Simulate Google callback with real auth code
curl -X GET "http://localhost:5000/api/auth/sso/google/callback?code=REAL_AUTH_CODE"
```

### Test CSV Export
```bash
# Export with filters
curl -X GET "http://localhost:5000/api/exports/invoices/csv?status=paid&limit=100" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  --output invoices.csv
```

### Test Rate Limiting
```bash
# Make 65 requests as customer (limit is 60/min)
for i in {1..65}; do
  curl -X GET "http://localhost:5000/api/health" \
    -H "Authorization: Bearer CUSTOMER_TOKEN"
done
# Last 5 requests will return 429
```

### Test Storage Service
```bash
# Direct call in Node
const storageService = require('./services/storageService');
const result = await storageService.uploadFile(file, 'docs');
console.log(result.url);  // Local: /uploads/docs/uuid.pdf or S3: https://...
```

---

## Troubleshooting

### "OAuth callback failed"
- Verify GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET are set
- Check GOOGLE_REDIRECT_URI matches OAuth config
- Ensure credentials are valid on Google Cloud Console

### "Admin access required"
- Use admin role JWT token
- Check user role in database

### "S3 connection failed"
- Verify S3 credentials and endpoint
- Check bucket name is correct
- Ensure AWS SDK is installed

### "Too many requests" (429)
- Check your role's rate limit in .env
- Wait for X-RateLimit-Reset time
- Adjust limits if needed

---

## File Locations

```
/backend/
├── services/
│   ├── ssoService.js           (346 lines)
│   ├── dataExportService.js    (516 lines)
│   └── storageService.js       (667 lines)
├── routes/
│   ├── ssoRoutes.js            (133 lines)
│   └── exportRoutes.js         (143 lines)
├── models/
│   └── SSOAccount.js           (46 lines)
├── middleware/
│   ├── rateLimiter.js          (enhanced)
│   └── upload.js               (enhanced)
├── migrations/
│   └── 20260316000002-add-sso-accounts.js
└── server.js                   (updated)
```

---

## Quick Deployment Checklist

- [ ] Run `npm run migrate`
- [ ] Set OAuth env vars (if using SSO)
- [ ] (Optional) Set S3 env vars
- [ ] (Optional) Adjust rate limit thresholds
- [ ] Test each feature endpoint
- [ ] Deploy code changes

---

**Last Updated**: March 16, 2026
