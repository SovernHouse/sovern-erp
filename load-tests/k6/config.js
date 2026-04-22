/**
 * Shared k6 configuration
 * Provides base URL, headers, and auth token generation
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

export const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

/**
 * Generate a test token for load tests
 * In production, ensure proper authentication flow
 */
export function getAuthToken() {
  // For testing, you should implement proper login flow
  // This is a placeholder that assumes you have test credentials
  return __ENV.AUTH_TOKEN || 'test-token';
}

/**
 * Get headers with authorization
 */
export function getAuthHeaders() {
  return {
    ...headers,
    'Authorization': `Bearer ${getAuthToken()}`
  };
}

/**
 * Thresholds for performance testing
 */
export const thresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  http_requests: ['count>100']
};

/**
 * Standard test options
 */
export const defaultOptions = {
  thresholds: thresholds,
  ext: {
    loadimpact: {
      projectID: __ENV.PROJECT_ID || 0,
      name: 'Load Test'
    }
  }
};
