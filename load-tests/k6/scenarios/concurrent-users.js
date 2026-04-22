/**
 * k6 Load Test: Concurrent Users
 * Tests mixed operations with 50 concurrent users
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';
import { BASE_URL, headers, thresholds } from '../config.js';

export const options = {
  stages: [
    { duration: '20s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '20s', target: 0 }
  ],
  thresholds: thresholds
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

  // Randomly choose an operation
  const operations = ['browse', 'analytics', 'search'];
  const operation = operations[Math.floor(Math.random() * operations.length)];

  if (operation === 'browse') {
    group('Browse Operations', () => {
      const res = http.get(
        `${BASE_URL}/sales-orders?limit=20&page=${randomIntBetween(1, 5)}`,
        { headers: authHeaders }
      );
      check(res, { 'browse status 200': (r) => r.status === 200 });
    });
  } else if (operation === 'analytics') {
    group('Analytics Operations', () => {
      const endpoints = [
        '/analytics/revenue-trend',
        '/analytics/order-funnel',
        '/analytics/top-products',
        '/analytics/customer-segments'
      ];
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const res = http.get(`${BASE_URL}${endpoint}`, { headers: authHeaders });
      check(res, { 'analytics status 200': (r) => r.status === 200 });
    });
  } else if (operation === 'search') {
    group('Search Operations', () => {
      const res = http.get(
        `${BASE_URL}/sales-orders?search=order&limit=20`,
        { headers: authHeaders }
      );
      check(res, { 'search status 200': (r) => r.status === 200 });
    });
  }

  sleep(randomIntBetween(1, 3));
}
