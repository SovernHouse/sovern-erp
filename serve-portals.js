/**
 * Static file server for built frontend portals with API proxy
 * Serves factory-portal on :3001 and admin-portal on :5173
 * Proxies /api/* requests to backend on :5000
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

function createPortalServer(name, distPath, port) {
  const app = express();

  // Proxy /api to backend (keep the /api prefix in the forwarded path)
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5000',
    changeOrigin: true,
    pathRewrite: (path) => '/api' + path,
  }));

  // Proxy /uploads to backend
  app.use('/uploads', createProxyMiddleware({
    target: 'http://localhost:5000',
    changeOrigin: true,
    pathRewrite: (path) => '/uploads' + path,
  }));

  // Serve static files
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for all non-file routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`${name} serving from ${distPath} on port ${port}`);
  });
}

// Start both portals on ports that don't conflict with local Vite dev servers
createPortalServer(
  'Factory Portal',
  path.join(__dirname, 'frontend/factory-portal/dist'),
  4001
);

createPortalServer(
  'Admin Portal',
  path.join(__dirname, 'frontend/admin-portal/dist'),
  4173
);

createPortalServer(
  'Customer Portal',
  path.join(__dirname, 'frontend/customer-portal/dist'),
  4000
);

console.log('Portal servers starting...');
