# Phase 5 Implementation Guide

## Overview
Phase 5 introduces three major features to the Trading ERP system:
1. External Exchange Rate API Integration
2. Docker Containerization (Production-Ready)
3. Webhook System for Event-Driven Architecture

---

## Feature 1: External Exchange Rate API

### Overview
Fetches live exchange rates from a free external API with automatic scheduling and database persistence. Falls back gracefully to hardcoded rates if API is unreachable.

### Key Components

#### Service: `backend/services/currencyService.js`
- **fetchLiveRates()** - Fetches rates from exchangerate-api.com
- **startScheduledRateUpdate()** - Starts background scheduler (runs every 6 hours by default)
- **stopScheduledRateUpdate()** - Stops the scheduler
- **getHistoricalRate(from, to, date)** - Retrieves historical rates from database
- **getApiStatus()** - Returns current API status and configuration

#### New Routes

```
GET  /api/currencies/live
     Returns latest live exchange rates with API status

POST /api/currencies/refresh
     Manually trigger rate refresh (admin/finance only)
     Returns newly fetched rates

GET  /api/currencies/historical?from=USD&to=EUR&date=2026-03-01
     Get historical exchange rate for a specific date
```

#### Environment Variables

```env
ENABLE_EXCHANGE_RATE_SCHEDULER=true
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest/USD
EXCHANGE_RATE_UPDATE_INTERVAL_MS=21600000  # 6 hours
```

### Database Schema

Rates are persisted in the existing `ExchangeRate` table:
- `baseCurrency` - Always "USD"
- `targetCurrency` - Currency code (EUR, GBP, etc.)
- `rate` - Exchange rate value
- `source` - "api" or "manual"
- `effectiveDate` - When the rate was recorded
- `isActive` - Boolean flag

### Implementation Flow

1. **On Server Startup**
   - `currencyService.startScheduledRateUpdate()` is called
   - Initial fetch from API happens immediately
   - Rates stored in memory and database

2. **Scheduled Updates**
   - Every 6 hours (configurable), the scheduler fetches new rates
   - Updates in-memory cache
   - Persists to database
   - Logs any errors but doesn't block operations

3. **API Failure Handling**
   - If API is unreachable, falls back to in-memory rates
   - Records error message in `lastApiError`
   - Continues operating without interruption
   - Admin can see last error via `/api/currencies/live` response

4. **Manual Refresh**
   - Admins can force immediate refresh via `POST /api/currencies/refresh`
   - Creates audit log entry
   - Returns freshly fetched rates

### Usage Examples

```bash
# Get live rates with API status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/currencies/live

# Response:
{
  "success": true,
  "data": {
    "rates": { "USD": 1.0, "EUR": 0.92, ... },
    "baseCurrency": "USD",
    "lastUpdated": "2026-03-16T10:30:45.123Z",
    "source": "api",
    "apiStatus": {
      "isAvailable": true,
      "lastError": null,
      "updateInterval": 21600000
    }
  }
}

# Manually trigger refresh (admin only)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/currencies/refresh

# Get historical rate
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/currencies/historical?from=USD&to=EUR&date=2026-03-01"
```

### Database Queries

Monitor exchange rate updates:

```sql
-- View latest rates for each currency
SELECT baseCurrency, targetCurrency, rate, effectiveDate, source
FROM exchange_rates
WHERE isActive = true
ORDER BY targetCurrency, effectiveDate DESC;

-- Check update history
SELECT targetCurrency, rate, source, effectiveDate
FROM exchange_rates
WHERE targetCurrency = 'EUR'
  AND source = 'api'
ORDER BY effectiveDate DESC
LIMIT 20;
```

---

## Feature 2: Docker Containerization

### Overview
Production-ready Docker setup with:
- Multi-stage build for optimized image
- Separate nginx reverse proxy
- PostgreSQL database container
- Health checks on all services
- Volume-based data persistence

### Files Created/Modified

#### New Files
- `Dockerfile` - Multi-stage build for full stack
- `docker-compose.prod.yml` - Production Docker Compose configuration
- `docker/nginx.prod.conf` - Production-optimized nginx configuration
- `.dockerignore` - Exclude unnecessary files from build

### Build and Deployment

#### Build the Docker Image

```bash
cd /path/to/Trading\ ERP

# Build the image
docker build -t trading-erp:latest .

# For development with PostgreSQL and other services:
docker-compose -f docker-compose.yml up -d

# For production:
docker-compose -f docker-compose.prod.yml up -d
```

#### Image Details

**Dockerfile Strategy:**
1. **Stage 1: Frontend Builder**
   - Builds admin, customer, and factory portals
   - Creates optimized dist directories

2. **Stage 2: Production Runtime**
   - Uses node:18-alpine (small, secure base)
   - Installs only production dependencies
   - Copies built frontends to /app/public
   - Runs as non-root nodejs user
   - Includes health check

**Image Size:** ~350MB (optimized with alpine)

### Docker Compose Setup

#### Services

```yaml
backend:
  - Node.js application running on port 5000
  - Health check: /api/health
  - Volumes: uploads, logs, backups

postgres:
  - PostgreSQL 15-alpine database
  - Health check: pg_isready
  - Volume: trading_erp_db

nginx:
  - Reverse proxy on ports 80/443
  - Serves 3 frontend portals
  - Routes /api/* to backend
  - SSL/TLS support (requires certificates)
```

#### Environment Configuration

Create `.env` file for docker-compose:

```env
NODE_ENV=production
PORT=5000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=trading_erp
DB_USER=trading_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_long_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# All other variables from .env.example
```

### Nginx Configuration

The nginx configuration (`docker/nginx.prod.conf`):

**Features:**
- SSL/TLS with strong ciphers (TLS 1.2+)
- Gzip compression for all text content
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Rate limiting:
  - Auth endpoints: 5 req/sec
  - API endpoints: 10 req/sec
- Cache control for static assets (30 days)
- 404/403 handling for hidden files
- Connection buffering and timeouts

**Routing:**
- `/admin` → admin-portal build
- `/customer` → customer-portal build
- `/factory` → factory-portal build
- `/api/*` → backend:5000
- `/api-docs` → backend:5000
- `/health` → returns 200 OK

### SSL/TLS Configuration

For HTTPS support:

1. **Generate self-signed certificates (development):**

```bash
mkdir -p docker/ssl

openssl req -x509 -newkey rsa:4096 -keyout docker/ssl/key.pem \
  -out docker/ssl/cert.pem -days 365 -nodes \
  -subj "/CN=localhost"
```

2. **Use production certificates (production):**

```bash
# Copy your certificate files to docker/ssl/
cp /path/to/cert.pem docker/ssl/cert.pem
cp /path/to/key.pem docker/ssl/key.pem

# Ensure proper permissions
chmod 600 docker/ssl/key.pem
chmod 644 docker/ssl/cert.pem
```

### Deployment Checklist

- [ ] Set strong passwords in `.env`
- [ ] Update JWT secrets
- [ ] Configure email credentials
- [ ] Add production SSL certificates
- [ ] Configure database backup strategy
- [ ] Set resource limits (memory, CPU)
- [ ] Configure log rotation
- [ ] Set up monitoring/alerting
- [ ] Test health checks
- [ ] Verify all routes working
- [ ] Check nginx security headers

### Monitoring

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Check service health
docker-compose -f docker-compose.prod.yml ps

# Access database
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U trading_user -d trading_erp

# View nginx access logs
docker-compose -f docker-compose.prod.yml logs nginx
```

---

## Feature 3: Webhook System

### Overview
Event-driven webhook system for integrating with external services. Supports multiple events with automatic retry logic, signature verification, and delivery tracking.

### Key Components

#### Models

**Webhook**
```javascript
{
  id: UUID,
  url: string,           // HTTPS/HTTP endpoint
  secret: string,        // For HMAC signing
  events: string[],      // Subscribed event types
  description: string,   // Optional note
  isActive: boolean,     // Enable/disable
  customerId: UUID,      // Optional filtering
  factoryId: UUID,       // Optional filtering
  createdBy: UUID,       // Creator user ID
  lastTriggered: Date,   // Last successful delivery
  failureCount: int,     // Consecutive failures
  lastFailureReason: string
}
```

**WebhookDelivery** (audit trail)
```javascript
{
  id: UUID,
  webhookId: UUID,
  event: string,
  payload: object,       // Actual event data sent
  statusCode: int,       // HTTP response code
  responseBody: string,  // Webhook response
  isSuccess: boolean,
  errorMessage: string,
  attemptNumber: int,
  nextRetryAt: Date,
  deliveredAt: Date,
  processingTimeMs: int
}
```

#### Supported Events

```
order.created           - New sales order created
order.statusChanged     - Sales order status updated
shipment.created        - New shipment booked
shipment.updated        - Shipment tracking updated
invoice.created         - Invoice generated
payment.received        - Payment recorded on invoice
inspection.scheduled    - Quality inspection scheduled
```

### REST API

#### List Webhooks
```
GET /api/webhooks?page=1&limit=10

Response:
{
  "data": [
    {
      "id": "uuid",
      "url": "https://api.example.com/webhooks",
      "events": ["order.created", "payment.received"],
      "isActive": true,
      "createdAt": "2026-03-16T10:00:00Z"
      // Note: 'secret' is excluded from responses for security
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10
}
```

#### Create Webhook
```
POST /api/webhooks

Body:
{
  "url": "https://api.example.com/webhook",
  "events": ["order.created", "payment.received"],
  "secret": "optional-secret-key",  // Generated if omitted
  "description": "Order notifications",
  "customerId": "uuid",               // Optional - filter to customer
  "factoryId": "uuid"                 // Optional - filter to factory
}

Response:
{
  "id": "uuid",
  "url": "https://api.example.com/webhook",
  "events": ["order.created", "payment.received"],
  "secret": "generated-secret-key",
  "isActive": true,
  "createdAt": "2026-03-16T10:00:00Z"
}
```

#### Update Webhook
```
PUT /api/webhooks/:id

Body:
{
  "url": "https://api.example.com/webhook-v2",
  "events": ["order.created"],
  "description": "Updated description",
  "isActive": false
}
```

#### Delete Webhook
```
DELETE /api/webhooks/:id

Response: { success: true }
```

#### Test Webhook
```
POST /api/webhooks/:id/test

Sends a test webhook ping to verify URL is reachable

Response:
{
  "webhookId": "uuid",
  "isReachable": true,
  "statusCode": 200,
  "processingTime": 125,
  "deliveryId": "uuid"
}
```

#### Get Delivery History
```
GET /api/webhooks/:id/deliveries?page=1&limit=20&event=order.created&isSuccess=true

Response:
{
  "data": [
    {
      "id": "uuid",
      "webhookId": "uuid",
      "event": "order.created",
      "statusCode": 200,
      "isSuccess": true,
      "attemptNumber": 1,
      "processingTimeMs": 125,
      "deliveredAt": "2026-03-16T10:00:00Z"
      // Note: 'payload' and 'responseBody' included for debugging
    }
  ],
  "total": 47
}
```

#### Get Supported Events
```
GET /api/webhooks/events/supported

Response:
{
  "data": {
    "events": [
      "order.created",
      "order.statusChanged",
      "shipment.created",
      "shipment.updated",
      "invoice.created",
      "payment.received",
      "inspection.scheduled"
    ]
  }
}
```

### Webhook Payload Format

All webhook payloads include standard headers:

```
POST /your-webhook-url HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Length: 256
X-Webhook-ID: 550e8400-e29b-41d4-a716-446655440000
X-Webhook-Signature: sha256=abcd1234...
X-Webhook-Timestamp: 2026-03-16T10:30:45.123Z
User-Agent: Trading-ERP-Webhook/1.0

{
  "event": "order.created",
  "timestamp": "2026-03-16T10:30:45.123Z",
  "data": {
    // Event-specific payload (see below)
  }
}
```

#### Signature Verification

Verify webhook authenticity using HMAC-SHA256:

```javascript
// Node.js example
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
}

// Usage
const isValid = verifyWebhookSignature(
  req.body,
  req.headers['x-webhook-signature'],
  process.env.WEBHOOK_SECRET
);
```

### Event Payloads

#### order.created
```json
{
  "orderId": "uuid",
  "orderNumber": "SO-20260316-001",
  "customerId": "uuid",
  "status": "confirmed",
  "total": 5000.00,
  "currency": "USD",
  "createdAt": "2026-03-16T10:30:45.123Z",
  "itemsCount": 5
}
```

#### order.statusChanged
```json
{
  "orderId": "uuid",
  "orderNumber": "SO-20260316-001",
  "previousStatus": "confirmed",
  "newStatus": "shipped",
  "changedAt": "2026-03-16T11:45:30.456Z"
}
```

#### shipment.created
```json
{
  "shipmentId": "uuid",
  "shipmentNumber": "SHP-1710606645123",
  "salesOrderId": "uuid",
  "carrier": "Maersk",
  "containerNumber": "CONT-123456",
  "status": "booked",
  "createdAt": "2026-03-16T10:30:45.123Z"
}
```

#### shipment.updated
```json
{
  "shipmentId": "uuid",
  "shipmentNumber": "SHP-1710606645123",
  "status": "in_transit",
  "currentLocation": "Port of Rotterdam",
  "description": "Container loaded and departed",
  "updatedAt": "2026-03-16T12:15:30.789Z"
}
```

#### invoice.created
```json
{
  "invoiceId": "uuid",
  "invoiceNumber": "INV-20260316-001",
  "salesOrderId": "uuid",
  "customerId": "uuid",
  "total": 5000.00,
  "currency": "USD",
  "dueDate": "2026-04-15T00:00:00.000Z",
  "status": "draft",
  "createdAt": "2026-03-16T10:30:45.123Z"
}
```

#### payment.received
```json
{
  "paymentId": "uuid",
  "invoiceId": "uuid",
  "invoiceNumber": "INV-20260316-001",
  "amount": 2500.00,
  "method": "bank_transfer",
  "reference": "TRF-REF-123456",
  "invoiceStatus": "partially_paid",
  "balance": 2500.00,
  "receivedAt": "2026-03-16T10:30:45.123Z"
}
```

#### inspection.scheduled
```json
{
  "inspectionId": "uuid",
  "inspectionNumber": "INSP-1710606645123",
  "type": "pre_shipment",
  "factoryId": "uuid",
  "scheduledDate": "2026-03-18T09:00:00.000Z",
  "inspectorId": "uuid",
  "status": "scheduled",
  "createdAt": "2026-03-16T10:30:45.123Z"
}
```

### Retry Logic

Failed deliveries are automatically retried with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: 1 second delay
Attempt 3: 5 seconds delay
Attempt 4: 30 seconds delay (final attempt)
```

**Retry Triggers:**
- Network timeout (10 seconds)
- Connection refused
- Server error (5xx)
- Timeout after 10 seconds

**Conditions for Success:**
- HTTP status 200-299
- Response received within 10 seconds

### Authorization & Permissions

```
GET    /api/webhooks              Admin sees all, others see their own
POST   /api/webhooks              Any authenticated user
PUT    /api/webhooks/:id          Admin or creator
DELETE /api/webhooks/:id          Admin or creator
POST   /api/webhooks/:id/test     Admin or creator
GET    /api/webhooks/:id/deliveries Admin or creator
```

### Implementation in Routes

Webhook triggers are added as fire-and-forget operations after main response:

```javascript
// In route handler, after res.json():

webhookService.triggerWebhook('order.created', {
  orderId: order.id,
  orderNumber: order.orderNumber,
  // ... event-specific data
}).catch(() => {});  // Ignore webhook failures

// The .catch(() => {}) ensures webhook failures never crash the request
```

### Database Queries

Monitor webhook activity:

```sql
-- Active webhooks
SELECT id, url, events, isActive, lastTriggered, failureCount
FROM webhooks
WHERE isActive = true
ORDER BY lastTriggered DESC;

-- Recent deliveries
SELECT w.url, d.event, d.statusCode, d.isSuccess, d.processingTimeMs
FROM webhook_deliveries d
JOIN webhooks w ON d.webhook_id = w.id
WHERE d.created_at > NOW() - INTERVAL '24 hours'
ORDER BY d.created_at DESC
LIMIT 100;

-- Failed deliveries needing attention
SELECT w.id, w.url, COUNT(*) as failed_count, w.lastFailureReason
FROM webhook_deliveries d
JOIN webhooks w ON d.webhook_id = w.id
WHERE d.isSuccess = false
  AND d.nextRetryAt IS NOT NULL
GROUP BY w.id
HAVING COUNT(*) > 0;

-- Event frequency
SELECT event, COUNT(*) as delivery_count, AVG(processingTimeMs) as avg_time_ms
FROM webhook_deliveries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event
ORDER BY delivery_count DESC;
```

### Troubleshooting

#### Webhook not receiving events

1. Check webhook is active: `isActive = true`
2. Verify URL is publicly accessible
3. Send test: `POST /api/webhooks/:id/test`
4. Check delivery logs: `GET /api/webhooks/:id/deliveries`
5. Verify event types match: `GET /api/webhooks/events/supported`

#### Signature verification failing

1. Ensure same secret is used for signing and verification
2. Sign the JSON payload, not the raw request body
3. Use HMAC-SHA256 algorithm
4. Compare signatures as hex strings

#### High failure count

1. Check webhook URL availability
2. Verify firewall/network connectivity
3. Review error messages in delivery logs
4. Increase timeout if processing takes long
5. Reduce payload size if necessary

---

## Configuration Summary

### Environment Variables

```env
# Feature 1: Exchange Rates
ENABLE_EXCHANGE_RATE_SCHEDULER=true
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest/USD
EXCHANGE_RATE_UPDATE_INTERVAL_MS=21600000

# Feature 2: Docker/Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=trading_erp
DB_USER=trading_user
DB_PASSWORD=secure_password

# Feature 3: Webhooks
# No additional env vars - system is self-contained

# All other standard Trading ERP env vars...
```

---

## Testing

### Exchange Rates
```bash
# Get live rates
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/currencies/live

# Manually refresh (admin)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/currencies/refresh
```

### Webhooks
```bash
# Create test webhook
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/your-unique-id",
    "events": ["order.created", "payment.received"]
  }' \
  http://localhost:5000/api/webhooks

# Test webhook
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/webhooks/:webhook_id/test

# View deliveries
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/webhooks/:webhook_id/deliveries
```

### Docker
```bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Test health check
curl http://localhost/api/health
```

---

## Files Modified/Created

### Created Files
- `/Dockerfile` - Production-ready multi-stage build
- `/docker-compose.prod.yml` - Production Docker Compose
- `/docker/nginx.prod.conf` - Production nginx config
- `/.dockerignore` - Docker build exclusions
- `/backend/models/Webhook.js` - Webhook model
- `/backend/models/WebhookDelivery.js` - Delivery tracking model
- `/backend/services/webhookService.js` - Webhook business logic
- `/backend/routes/webhookRoutes.js` - Webhook API endpoints
- `/.env.phase5` - Phase 5 configuration reference

### Modified Files
- `/backend/services/currencyService.js` - Added API integration & scheduler
- `/backend/routes/currencyRoutes.js` - Added new endpoints
- `/backend/models/index.js` - Registered new models
- `/backend/server.js` - Initialize scheduler & register routes
- `/backend/routes/salesOrderRoutes.js` - Added webhook triggers
- `/backend/routes/shipmentRoutes.js` - Added webhook triggers
- `/backend/routes/invoiceRoutes.js` - Added webhook triggers
- `/backend/routes/inspectionRoutes.js` - Added webhook triggers
- `/backend/routes/purchaseOrderRoutes.js` - Webhook trigger template

---

## Deployment Recommendations

### Development
- Use `docker-compose.yml` with development settings
- Enable all logging
- Use self-signed certificates

### Staging
- Use `docker-compose.prod.yml`
- Test all webhook integrations
- Verify SSL certificates
- Load test with realistic data

### Production
- Use `docker-compose.prod.yml` with secured `.env`
- Enable automated backups
- Set up monitoring/alerting
- Use valid SSL certificates
- Implement rate limiting
- Enable health checks
- Set resource limits
- Configure log rotation
- Set up disaster recovery plan

---

## Additional Resources

- [ExchangeRate-API Documentation](https://www.exchangerate-api.com/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Webhook Standard](https://webhooks.dev/)
- [HMAC-SHA256 Examples](https://en.wikipedia.org/wiki/HMAC)

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f backend`
2. Review delivery logs for webhooks: `GET /api/webhooks/:id/deliveries`
3. Test connectivity: `POST /api/webhooks/:id/test`
4. Verify database: `SELECT * FROM webhooks WHERE id = ?`

