/**
 * k6 Load Test: Dashboard Load
 * Tests dashboard metrics and analytics endpoints
 * VUs: 100
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, headers, thresholds } from '../config.js';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    ...thresholds,
    http_req_duration: ['p(95)<800', 'p(99)<2000']
  }
};

const getToken = () => {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: 'admin@example.com',
      password: 'admin'
    }),
    { headers }
  );
  return loginRes.json('data.token');
};

export default function () {
  const token = getToken();
  const authHeaders = {
    ...headers,
    'Authorization': `Bearer ${token}`
  };

  group('Dashboard Metrics', () => {
    const metricsRes = http.get(
      `${BASE_URL}/dashboard/admin`,
      { headers: authHeaders }
    );

    check(metricsRes, {
      'metrics status is 200': (r) => r.status === 200,
      'has stats': (r) => r.json('data.stats') !== undefined
    });
  });

  sleep(1);

  group('Analytics - Revenue Trend', () => {
    const revenueRes = http.get(
      `${BASE_URL}/analytics/revenue-trend`,
      { headers: authHeaders }
    );

    check(revenueRes, {
      'revenue status is 200': (r) => r.status === 200,
      'has data': (r) => r.json('data.data') !== undefined,
      'response time < 800ms': (r) => r.timings.duration < 800
    });
  });

  sleep(1);

  group('Analytics - Order Funnel', () => {
    const funnelRes = http.get(
      `${BASE_URL}/analytics/order-funnel`,
      { headers: authHeaders }
    );

    check(funnelRes, {
      'funnel status is 200': (r) => r.status === 200,
      'has stages': (r) => r.json('data.stages') !== undefined
    });
  });

  sleep(1);

  group('Analytics - Top Products', () => {
    const productsRes = http.get(
      `${BASE_URL}/analytics/top-products`,
      { headers: authHeaders }
    );

    check(productsRes, {
      'products status is 200': (r) => r.status === 200,
      'has product data': (r) => r.json('data.data') !== undefined
    });
  });

  sleep(1);

  group('Analytics - Customer Segments', () => {
    const segmentsRes = http.get(
      `${BASE_URL}/analytics/customer-segments`,
      { headers: authHeaders }
    );

    check(segmentsRes, {
      'segments status is 200': (r) => r.status === 200,
      'has segment data': (r) => r.json('data.data') !== undefined
    });
  });

  sleep(2);
}
