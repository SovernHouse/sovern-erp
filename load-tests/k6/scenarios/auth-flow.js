/**
 * k6 Load Test: Authentication Flow
 * Tests login, token refresh, and logout operations
 * VUs: 100, Ramp-up: 30s
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, headers, thresholds } from '../config.js';

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp-up
    { duration: '1m', target: 100 }, // Stay at 100 VUs
    { duration: '30s', target: 0 }   // Ramp-down
  ],
  thresholds: thresholds
};

const testUser = {
  email: `testuser${Math.random()}@example.com`,
  password: 'TestPassword123!'
};

export default function () {
  group('Login', () => {
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        email: 'admin@example.com',
        password: 'admin'
      }),
      { headers }
    );

    check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => r.json('data.token') !== undefined,
      'response time < 500ms': (r) => r.timings.duration < 500
    });

    const token = loginRes.json('data.token');
    sleep(1);

    group('Refresh Token', () => {
      const refreshRes = http.post(
        `${BASE_URL}/auth/refresh`,
        '',
        {
          headers: {
            ...headers,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      check(refreshRes, {
        'refresh status is 200': (r) => r.status === 200,
        'refresh returns new token': (r) => r.json('data.token') !== undefined
      });
    });

    sleep(1);

    group('Get Current User', () => {
      const meRes = http.get(
        `${BASE_URL}/auth/me`,
        {
          headers: {
            ...headers,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      check(meRes, {
        'get user status is 200': (r) => r.status === 200,
        'user data exists': (r) => r.json('data.id') !== undefined
      });
    });

    sleep(1);

    group('Logout', () => {
      const logoutRes = http.post(
        `${BASE_URL}/auth/logout`,
        '',
        {
          headers: {
            ...headers,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      check(logoutRes, {
        'logout status is 200': (r) => r.status === 200 || r.status === 204
      });
    });
  });

  sleep(2);
}
