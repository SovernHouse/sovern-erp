# Load Testing Suite for Trading ERP

This directory contains load testing scripts for the Trading ERP backend using k6, an industry-standard load testing tool.

## Installation

### Prerequisites
- Node.js 14+ (for running the test runner script)
- k6 1.0+ (install from https://k6.io/docs/getting-started/installation/)

### Setup

1. Install k6:
```bash
# macOS (Homebrew)
brew install k6

# Linux (apt)
sudo apt-get update
sudo apt-get install k6

# Windows (Chocolatey)
choco install k6

# Or download from: https://github.com/grafana/k6/releases
```

2. Verify installation:
```bash
k6 version
```

## Test Scenarios

### 1. **Authentication Flow** (`k6/scenarios/auth-flow.js`)
- **Purpose**: Tests login, token refresh, and logout
- **VUs**: 100 (Virtual Users)
- **Duration**: 2 minutes (30s ramp-up, 1m sustained, 30s ramp-down)
- **Thresholds**:
  - p95 response time < 500ms
  - p99 response time < 1000ms
  - Error rate < 1%

```bash
k6 run load-tests/k6/scenarios/auth-flow.js
```

### 2. **Browse Orders** (`k6/scenarios/browse-orders.js`)
- **Purpose**: Tests listing, filtering, and viewing order details
- **VUs**: 50
- **Duration**: 1m40s
- **Focus**: Realistic browsing patterns

```bash
k6 run load-tests/k6/scenarios/browse-orders.js
```

### 3. **Dashboard Load** (`k6/scenarios/dashboard-load.js`)
- **Purpose**: Tests dashboard and analytics endpoints under load
- **VUs**: 100
- **Duration**: 2 minutes
- **Endpoints Tested**:
  - Dashboard metrics
  - Revenue trend analytics
  - Order funnel
  - Top products
  - Customer segments

```bash
k6 run load-tests/k6/scenarios/dashboard-load.js
```

### 4. **Concurrent Mixed Operations** (`k6/scenarios/concurrent-users.js`)
- **Purpose**: Simulates 50 users performing different operations
- **VUs**: 50
- **Duration**: 1m40s
- **Operations**: Browse, Analytics, Search

```bash
k6 run load-tests/k6/scenarios/concurrent-users.js
```

### 5. **Spike Test** (`k6/scenarios/spike-test.js`)
- **Purpose**: Tests system response to sudden traffic spike
- **Spike**: 10 → 200 VUs in 10 seconds
- **Duration**: 60 seconds
- **Use Case**: Identifying breaking points

```bash
k6 run load-tests/k6/scenarios/spike-test.js
```

### 6. **Soak Test** (`k6/scenarios/soak-test.js`)
- **Purpose**: Tests system stability under sustained load
- **VUs**: 30
- **Duration**: 30 minutes (5m ramp-up, 20m sustained, 5m ramp-down)
- **Goal**: Identify memory leaks and degradation

```bash
k6 run load-tests/k6/scenarios/soak-test.js
```

## Running Tests

### Run a specific test:
```bash
k6 run load-tests/k6/scenarios/auth-flow.js
```

### Run with custom settings:
```bash
BASE_URL=http://api.example.com k6 run load-tests/k6/scenarios/auth-flow.js
```

### Run with custom auth token:
```bash
AUTH_TOKEN=your-token-here k6 run load-tests/k6/scenarios/dashboard-load.js
```

## Performance Thresholds

All tests validate the following thresholds:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| p95 Response Time | < 500ms | 95th percentile |
| p99 Response Time | < 1000ms | 99th percentile |
| Error Rate | < 1% | Failed requests |
| Throughput | > 100 req/s | Requests per second |

## Test Profiles

### Quick Smoke Test (2 minutes)
```bash
k6 run load-tests/k6/scenarios/auth-flow.js
```

### Standard Load Test (5 minutes)
Run multiple scenarios:
```bash
k6 run load-tests/k6/scenarios/browse-orders.js
k6 run load-tests/k6/scenarios/dashboard-load.js
```

### Full Test Suite (45 minutes)
```bash
# Run all scenarios sequentially
for scenario in load-tests/k6/scenarios/*.js; do
  echo "Running: $scenario"
  k6 run "$scenario"
done
```

### Stress Testing
```bash
# Gradually increase load until system breaks
k6 run load-tests/k6/scenarios/spike-test.js
```

### Endurance Test (Run daily)
```bash
k6 run load-tests/k6/scenarios/soak-test.js
```

## Output and Results

### Console Output
k6 displays real-time statistics:
- VUs (Virtual Users) count
- Requests per second (throughput)
- Response times (min, max, avg)
- Data sent/received
- Thresholds status

### Example Output:
```
     data_received..................: 2.3 MB   2.3 kB/s
     data_sent......................: 1.2 MB   1.2 kB/s
     http_req_blocked...............: avg=2.34ms    min=0s      max=54.23ms p(90)=5.32ms   p(95)=6.23ms
     http_req_connecting............: avg=1.23ms    min=0s      max=34.12ms p(90)=2.34ms   p(95)=3.12ms
     http_req_duration..............: avg=245.34ms  min=12.34ms max=876.23ms p(90)=432ms    p(95)=567ms
     http_req_failed................: 0.45%
     http_req_receiving.............: avg=12.34ms   min=1.23ms  max=123.45ms p(90)=45ms     p(95)=67ms
     http_req_sending...............: avg=5.67ms    min=0.12ms  max=56.78ms p(90)=12ms     p(95)=23ms
     http_req_tls_handshaking.......: avg=0s        min=0s      max=0s       p(90)=0s       p(95)=0s
     http_req_waiting...............: avg=227.33ms  min=10.12ms max=765.43ms p(90)=392ms    p(95)=512ms
     http_reqs......................: 2540      25.4/s
     iteration_duration.............: avg=1.23s     min=1s      max=2.34s    p(90)=1.89s    p(95)=2.12s
     iterations.....................: 254       2.54/iter
     vus............................: 1         max=100
```

## Interpreting Results

### Success Criteria
- All thresholds passed (green ✓)
- No significant p95/p99 response time increases over time
- Error rate remains below 1%
- System recovers after spikes/peaks

### Red Flags
- Thresholds failed (red ✗)
- Response times trending upward (memory leak)
- High error rate under load
- System doesn't recover after spike

## Configuration

### Environment Variables

```bash
# Base API URL (default: http://localhost:5000/api)
BASE_URL=http://api.example.com

# Authentication token
AUTH_TOKEN=your-token-here

# Project ID for cloud integration
PROJECT_ID=3456789
```

### Modifying Tests

Edit `load-tests/k6/scenarios/` to customize:
- Number of VUs
- Ramp-up/ramp-down duration
- Test duration
- Endpoints tested
- Validation thresholds

## Continuous Integration

### GitHub Actions Example
```yaml
name: Load Tests
on: [schedule]
jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: load-tests/k6/scenarios/dashboard-load.js
          cloud: false
          env: BASE_URL=https://api.example.com
```

## Best Practices

1. **Isolate Tests**: Run on dedicated test environment
2. **Monitor System**: Watch CPU, memory, database during tests
3. **Scale Gradually**: Start with small VU counts, increase slowly
4. **Vary Scenarios**: Mix different user behaviors
5. **Regular Testing**: Run daily/weekly for regression detection
6. **Baseline**: Establish baseline metrics for comparison
7. **Document Results**: Keep records of test runs

## Troubleshooting

### "Connection refused" error
- Verify backend is running on correct port
- Check BASE_URL environment variable
- Ensure no firewall blocking connections

### "Threshold failed" error
- Reduce number of VUs
- Check backend performance/logs
- Look for database bottlenecks
- Review application code for inefficiencies

### High error rates
- Check authentication configuration
- Verify API endpoints exist
- Review backend error logs
- Check for rate limiting

### Memory issues
- Run soak tests to identify leaks
- Monitor process memory during test
- Check for unbounded data structures

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 API Reference](https://k6.io/docs/javascript-api/)
- [k6 Examples](https://github.com/grafana/k6/tree/master/samples)
- [Performance Testing Best Practices](https://k6.io/blog/load-testing-best-practices/)

## Support

For issues or questions:
1. Check k6 documentation
2. Review test logs and error messages
3. Consult trading ERP backend documentation
4. Open issue in project repository
