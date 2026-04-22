/**
 * k6 Load Test: Soak Test
 * Tests system stability under sustained load
 * 30 VUs for 30 minutes
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, headers, thresholds } from '../config.js';

export const options = {
  stages: [
    { duration: '5m', target: 30 },    // Ramp-up
    { duration: '20m', target: 30 },   // Soak
    { duration: '5m', target: 0 }      // Ramp-down
  ],
  thresholds: {
    ...thresholds,
    http_req_failed: ['rate<0.005'], // Even stricter for soak tests
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

  // Rotate through different endpoints
  const endpoints = [
    { url: `${BASE_URL}/sales-orders`, name: 'Orders' },
    { url: `${BASE_URL}/customers`, name: 'Customers' },
    { url: `${BASE_URL}/invoices`, name: 'Invoices' },
    { url: `${BASE_URL}/analytics/revenue-trend`, name: 'Analytics' },
    { url: `${BASE_URL}/dashboard/admin`, name: 'Dashboard' }
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${endpoint.url}?limit=50`, { headers: authHeaders });

  check(res, {
    [`${endpoint.name} status is 200`]: (r) => r.status === 200,
    [`${endpoint.name} response time < 1000ms`]: (r) => r.timings.duration < 1000,
    [`${endpoint.name} has content`]: (r) => r.body.length > 0
  });

  sleep(Math.random() * 3);
}
