/**
 * k6 Load Test: Browse Orders
 * Tests listing, filtering, and viewing order details
 * VUs: 50
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
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

  group('List Orders', () => {
    const listRes = http.get(
      `${BASE_URL}/sales-orders?limit=20&page=1`,
      { headers: authHeaders }
    );

    check(listRes, {
      'list status is 200': (r) => r.status === 200,
      'response has orders': (r) => r.json('data.rows').length > 0,
      'response time < 500ms': (r) => r.timings.duration < 500
    });

    const orders = listRes.json('data.rows');
    sleep(1);

    if (orders && orders.length > 0) {
      group('Get Order Details', () => {
        const orderId = orders[0].id;
        const detailRes = http.get(
          `${BASE_URL}/sales-orders/${orderId}`,
          { headers: authHeaders }
        );

        check(detailRes, {
          'detail status is 200': (r) => r.status === 200,
          'order has id': (r) => r.json('data.id') !== undefined,
          'response time < 300ms': (r) => r.timings.duration < 300
        });
      });

      sleep(1);

      group('Filter Orders', () => {
        const filterRes = http.get(
          `${BASE_URL}/sales-orders?status=completed&limit=10`,
          { headers: authHeaders }
        );

        check(filterRes, {
          'filter status is 200': (r) => r.status === 200
        });
      });
    }
  });

  sleep(2);
}
