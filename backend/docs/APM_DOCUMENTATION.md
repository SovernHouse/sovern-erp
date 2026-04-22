# Application Performance Monitoring (APM) System

## Overview

A lightweight, in-memory APM system for the Trading ERP backend that tracks request metrics, errors, and system health. Designed for small systems (<50 users) with zero external dependencies.

## Architecture

### Components

1. **apmService** (`services/apmService.js`)
   - Core metrics collection and storage
   - In-memory data structure with rolling window approach
   - Stores last 1 hour of detailed data
   - Cleans up old data every 10 minutes

2. **apmMiddleware** (`middleware/apmMiddleware.js`)
   - Express middleware that intercepts requests
   - Records metrics using high-resolution timer (`process.hrtime()`)
   - Normalizes route patterns (removes specific :id values)
   - Logs slow requests (>2000ms) to console

3. **alertService** (`services/alertService.js`)
   - Monitors APM metrics for anomalies
   - Runs checks every 5 minutes
   - Generates alerts for:
     - High error rate (>10% in 5 minutes)
     - Slow response times (>3000ms average)
     - High memory usage (>80%)
     - Multiple 5xx errors (>5 in 5 minutes)
   - Stores alert state in memory

4. **monitoringRoutes** (`routes/monitoringRoutes.js`)
   - Admin-only endpoints for viewing metrics
   - Public health check endpoint
   - RESTful API for metrics access

## API Endpoints

### Public Endpoints

#### `GET /api/monitoring/health`
No authentication required. Returns current system health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-16T12:00:00.000Z",
  "uptime": 3600,
  "nodejs": "v18.0.0",
  "memory": {
    "heapUsed": 45,
    "heapTotal": 128,
    "external": 2,
    "percentUsed": 35,
    "isHealthy": true
  },
  "requests": {
    "total": 1250,
    "last5min": 15,
    "errorRate5min": 2
  },
  "errors": {
    "total": 25,
    "stored": 25
  }
}
```

### Admin Endpoints (Authentication Required)

#### `GET /api/monitoring/metrics`
Get comprehensive request and performance metrics.

**Response:**
```json
{
  "success": true,
  "message": "Metrics retrieved successfully",
  "data": {
    "uptime": 3600,
    "startTime": "2026-03-16T11:00:00.000Z",
    "requests": {
      "total": 1250,
      "lastHour": 500,
      "successful": 490,
      "failed": 10,
      "avgResponseTime": 145,
      "successRate": 98
    },
    "errors": {
      "total": 25,
      "recent": 25
    },
    "byEndpoint": {
      "/api/customers": {
        "count": 50,
        "avgResponseTime": 120,
        "minResponseTime": 45,
        "maxResponseTime": 2100,
        "errorCount": 2
      }
    },
    "byStatusCode": {
      "200": 490,
      "400": 5,
      "500": 5
    },
    "lastUpdated": "2026-03-16T12:00:00.000Z"
  }
}
```

#### `GET /api/monitoring/errors?limit=50`
Get recent errors with stack traces.

**Query Parameters:**
- `limit` (optional): Number of errors to return, default 50, max 100

**Response:**
```json
{
  "success": true,
  "message": "Errors retrieved successfully",
  "data": {
    "total": 25,
    "errors": [
      {
        "message": "Database connection timeout",
        "stack": "Error: Connection timeout...",
        "errorType": "TimeoutError",
        "timestamp": 1710666000000,
        "recordedAt": "2026-03-16T12:00:00.000Z",
        "path": "/api/customers",
        "method": "GET",
        "statusCode": 500
      }
    ]
  }
}
```

#### `GET /api/monitoring/slow-requests?limit=20`
Get slowest requests that exceeded the threshold (>1000ms).

**Query Parameters:**
- `limit` (optional): Number of requests to return, default 20, max 50

**Response:**
```json
{
  "success": true,
  "message": "Slow requests retrieved successfully",
  "data": {
    "total": 8,
    "slowRequests": [
      {
        "method": "POST",
        "path": "/api/inquiries",
        "statusCode": 201,
        "responseTimeMs": 2150,
        "timestamp": 1710666000000,
        "recordedAt": "2026-03-16T12:00:00.000Z",
        "success": true
      }
    ]
  }
}
```

#### `GET /api/monitoring/system`
Get detailed system information including memory, CPU, and Node.js details.

**Response:**
```json
{
  "success": true,
  "message": "System info retrieved successfully",
  "data": {
    "nodejs": "v18.0.0",
    "platform": "linux",
    "arch": "x64",
    "uptime": 3600,
    "cpuUsage": {
      "user": 1234567,
      "system": 345678
    },
    "memory": {
      "rss": 156,
      "heapUsed": 45,
      "heapTotal": 128,
      "external": 2,
      "percentUsed": 35
    },
    "apm": {
      "status": "healthy",
      "timestamp": "2026-03-16T12:00:00.000Z",
      ...
    }
  }
}
```

#### `GET /api/monitoring/alerts`
Get all active alerts.

**Response:**
```json
{
  "success": true,
  "message": "Alerts retrieved successfully",
  "data": {
    "total": 2,
    "alerts": [
      {
        "id": "SLOW_RESPONSE_TIME",
        "message": "Average response time 3200ms exceeds threshold",
        "severity": "warning",
        "data": {
          "avgResponseTime": 3200
        },
        "createdAt": "2026-03-16T11:55:00.000Z",
        "lastUpdated": "2026-03-16T12:00:00.000Z",
        "acknowledged": false,
        "count": 5,
        "isAcknowledged": false
      }
    ]
  }
}
```

#### `POST /api/monitoring/alerts/:alertId/acknowledge`
Acknowledge an alert to suppress notifications.

**Parameters:**
- `alertId` (path): ID of the alert (e.g., "SLOW_RESPONSE_TIME")

**Response:**
```json
{
  "success": true,
  "message": "Alert acknowledged successfully",
  "data": {
    "alertId": "SLOW_RESPONSE_TIME"
  }
}
```

#### `POST /api/monitoring/reset`
Reset all metrics (clears collected data). Use with caution!

**Response:**
```json
{
  "success": true,
  "message": "All metrics reset successfully",
  "data": null
}
```

## Metrics Collected

### Request Metrics
- Total request count
- Request count by endpoint (with pattern normalization)
- Response time (min, max, average) per endpoint
- Status code distribution
- Success/failure counts
- Error rate percentage

### Performance Metrics
- Response time histogram
- Slow request tracking (requests >1000ms)
- Endpoint-level performance analysis
- Average response time trends

### Error Tracking
- Error count by type
- Error messages and stack traces
- Error context (path, method, status code)
- Last 100 errors stored in memory

### System Health
- Memory usage (heap, external, RSS)
- Uptime
- Node.js version
- CPU usage
- Request rate in last 5 minutes

### Alert Conditions
- Error rate >10% in 5 minutes
- Average response time >3000ms
- Memory usage >80%
- Multiple 5xx errors (>5 in 5 minutes)

## Configuration

### apmService
Edit the `config` object in `services/apmService.js`:
```javascript
config = {
  slowQueryThreshold: 1000,      // ms - requests slower than this are tracked
  maxErrorsStored: 100,          // Max errors to keep in memory
  maxRequestsStored: 500,        // Max request records
  maxSlowRequestsStored: 100,    // Max slow request records
  dataRetentionHours: 1          // Hours to keep detailed data
}
```

### alertService
Edit the `config` object in `services/alertService.js`:
```javascript
config = {
  errorRateThreshold: 10,        // % errors in 5 minutes
  avgResponseTimeThreshold: 3000, // ms
  memoryUsageThreshold: 80,      // %
  fivexxErrorThreshold: 5        // count in 5 minutes
}
```

### apmMiddleware
Slow request warning threshold is hardcoded at 2000ms. Change in `middleware/apmMiddleware.js`:
```javascript
if (responseTimeMs > 2000) {  // Change this value
  console.warn(`[SLOW REQUEST] ...`);
}
```

## Usage Examples

### Monitor API Performance
```bash
# Get overall metrics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/monitoring/metrics

# Get slowest requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/monitoring/slow-requests?limit=10

# Get recent errors
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/monitoring/errors?limit=20
```

### Check System Health (public)
```bash
curl http://localhost:5000/api/monitoring/health
```

### View Active Alerts
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/monitoring/alerts
```

### Acknowledge Alert
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/monitoring/alerts/SLOW_RESPONSE_TIME/acknowledge
```

## Implementation Details

### High-Resolution Timing
Uses `process.hrtime()` for accurate request timing with nanosecond precision.

### Route Pattern Normalization
Automatically converts specific IDs to route patterns to prevent metric fragmentation:
- `/api/customers/123` → `/api/customers/:id`
- `/api/inquiries/456/items/789` → `/api/inquiries/:id/items/:id`

### Data Retention
- Detailed metrics: Last 1 hour (rolling window)
- Aggregated metrics: Computed from recent data
- Old data automatically cleaned every 10 minutes
- Counters (total request count, error count) persist indefinitely

### Alert Lifecycle
1. Alert is created when condition is detected
2. Alert is logged to console
3. Alert remains active until condition clears
4. Admins can acknowledge alerts to suppress notifications
5. Acknowledged alerts are tracked but don't generate new logs

## Performance Impact

- **Memory overhead**: ~2-5MB depending on traffic volume
- **CPU overhead**: <1% (cleanup runs every 10 minutes)
- **Request latency**: Negligible (~1-2ms per request)

## Security

- All admin endpoints require JWT authentication
- Public health endpoint has no auth but provides minimal info
- All inputs validated and sanitized
- No sensitive data stored in metrics
- Request paths normalized to prevent ID leakage

## Future Enhancements

- Email alerting for critical conditions
- Database persistence for historical data
- Grafana/Prometheus integration
- Custom dashboard UI
- Request tracing and correlation IDs
- Webhook notifications for alerts
- Export metrics to file (CSV, JSON)

## Troubleshooting

### High Memory Usage
- Check memory percentage in `/api/monitoring/health`
- Review slow requests and error logs
- Consider reducing `dataRetentionHours` or `maxErrorsStored`

### Missing Metrics
- Verify APM middleware is registered in `server.js`
- Check route paths are using pattern format (`:id`, not specific values)
- Ensure responses use `res.send()` or `res.json()`

### Alerts Not Triggering
- Check alert thresholds in `alertService` config
- Verify alert check task is running (runs every 5 minutes)
- Review alert conditions in `checkAlerts()` method

## File Structure

```
backend/
├── middleware/
│   ├── apmMiddleware.js           # Request tracking middleware
├── services/
│   ├── apmService.js              # Core metrics collection
│   ├── alertService.js            # Alert monitoring
├── routes/
│   ├── monitoringRoutes.js        # Monitoring endpoints
└── server.js                       # Updated with APM integration
```

## Testing

To test the APM system:

```javascript
// In a test or manually:
const apmService = require('./services/apmService');

// Simulate requests
apmService.recordRequest('GET', '/api/customers', 200, 150);
apmService.recordRequest('POST', '/api/inquiries', 201, 2500); // Slow request

// Simulate error
apmService.recordError(
  new Error('Database timeout'),
  { path: '/api/customers', method: 'GET', statusCode: 500 }
);

// Get metrics
console.log(apmService.getMetrics());
console.log(apmService.getErrors(10));
console.log(apmService.getSlowRequests(5));
console.log(apmService.getHealthCheck());
```

## Notes

- No external dependencies required
- All code uses only Node.js standard modules and existing dependencies
- Designed to scale for up to 50 concurrent users
- Data is lost on server restart (acceptable for small systems)
