/**
 * k6 Load Test: Spike Test
 * Tests system behavior under sudden load spike
 * Ramps from 10 to 200 VUs in 10 seconds
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, headers, thresholds } from '../config.js';

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Initial load
    { duration: '10s', target: 200 },  // Spike
    { duration: '30s', target: 200 },  // Maintain spike
    { duration: '10s', target: 0 }     // Recovery
  ],
  thresholds: {
    ...thresholds,
    http_req_failed: ['rate<0.05'], // Higher tolerance for spike
    http_req_duration: ['p(95)<1000', 'p(99)<3000']
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

  // Test various endpoints
  const endpoints = [
    `${BASE_URL}/dashboard/admin`,
    `${BASE_URL}/analytics/revenue-trend`,
    `${BASE_URL}/analytics/order-funnel`,
    `${BASE_URL}/sales-orders?limit=20`,
    `${BASE_URL}/customers?limit=20`,
    `${BASE_URL}/invoices?limit=20`
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(endpoint, { headers: authHeaders });

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response time reasonable': (r) => r.timings.duration < 5000
  });

  sleep(Math.random());
}
