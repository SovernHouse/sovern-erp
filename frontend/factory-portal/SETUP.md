# Factory Portal - Setup Guide

## ✅ Installation & Setup

### Step 1: Install Dependencies
```bash
npm install
```

This will install all required packages including:
- React 18, React Router v6
- Vite for bundling
- Tailwind CSS for styling
- Axios for API calls
- Recharts for data visualization
- Socket.IO client for real-time updates

### Step 2: Configure Environment

Create a `.env` file in the project root:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_API_PREFIX=/api

# App Configuration
VITE_APP_NAME=Factory Portal
VITE_APP_VERSION=1.0.0

# Socket.IO Configuration
VITE_SOCKET_URL=http://localhost:3000
```

### Step 3: Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000

### Step 4: Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

## 🔌 API Integration

All API endpoints are configured in `src/services/api.js`. The backend needs to provide these endpoints:

### Authentication
```
POST /api/auth/factory-login
POST /api/auth/logout
GET /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Factory Resources
```
GET/POST /api/factory/products
GET/PUT/DELETE /api/factory/products/:id
POST /api/factory/products/:id/images

GET/PUT /api/factory/prices
POST /api/factory/prices/bulk-update
GET /api/factory/prices/history/:productId

GET /api/factory/purchase-orders
GET /api/factory/purchase-orders/:id
POST /api/factory/purchase-orders/:id/confirm
POST /api/factory/purchase-orders/:id/reject
PUT /api/factory/purchase-orders/:id/items/:itemId
POST /api/factory/purchase-orders/:id/notes

GET /api/factory/production/po/:poId
PUT /api/factory/production/:id
POST /api/factory/production/:id/notes
POST /api/factory/production/:id/photos

GET/POST /api/factory/shipments
GET/PUT /api/factory/shipments/:id
POST /api/factory/shipments/:id/documents/:type
DELETE /api/factory/shipments/:id/documents/:docId
POST /api/factory/shipments/:id/packing-list

GET /api/factory/inspections/schedule
POST /api/factory/inspections/:id/confirm
GET /api/factory/inspections/results
GET /api/factory/inspections/:id/checklist
PUT /api/factory/inspections/:id/checklist/:itemId

GET/POST /api/factory/documents
DELETE /api/factory/documents/:id

GET /api/factory/profile
PUT /api/factory/profile
GET/POST /api/factory/certifications
DELETE /api/factory/certifications/:id

GET /api/factory/settings/notifications
PUT /api/factory/settings/notifications
GET /api/factory/settings/team
POST /api/factory/settings/team/invite
DELETE /api/factory/settings/team/:userId

GET /api/factory/dashboard/kpis
GET /api/factory/dashboard/revenue
GET /api/factory/dashboard/po-status-distribution
GET /api/factory/dashboard/upcoming-deadlines
GET /api/factory/dashboard/recent-pos
GET /api/factory/dashboard/inspection-schedule
GET /api/factory/dashboard/action-items
```

## 🎨 Customization

### Colors
Edit `tailwind.config.js` to customize the factory theme colors:

```js
colors: {
  factory: {
    50: '#fffbf0',   // Lightest
    100: '#fef3e2',
    200: '#fde4c4',
    300: '#fccf97',
    400: '#fab567',
    500: '#f59e3f',
    600: '#e67e22',   // Primary
    700: '#d35400',
    800: '#b84600',
    900: '#7a2d0c',   // Darkest
  }
}
```

### Typography
Fonts are loaded from Google Fonts (Inter). Edit `index.html` to change:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Layout
Main layout sidebar can be customized in `src/components/Layout.jsx`:
- Colors in sidebar
- Menu items and structure
- Top bar content
- Sidebar width

## 📦 Production Deployment

### 1. Build Optimization
```bash
npm run build
```

### 2. Environment Configuration
Create `.env.production`:
```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

### 3. Server Deployment Options

#### Option A: Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /var/www/factory-portal/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend-api:3000;
    }
}
```

#### Option B: Docker
```dockerfile
FROM node:18 as builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:18
RUN npm install -g serve
COPY --from=builder /app/dist /app/dist
EXPOSE 3000
CMD ["serve", "-s", "/app/dist"]
```

#### Option C: Vercel
```bash
npm install -g vercel
vercel deploy
```

#### Option D: Docker Compose
```yaml
version: '3'
services:
  factory-portal:
    build: .
    ports:
      - "3001:3000"
    environment:
      - VITE_API_BASE_URL=http://backend:3000
    depends_on:
      - backend
```

## 🔒 Security Checklist

- [ ] Set secure API endpoints (HTTPS)
- [ ] Configure CORS properly in backend
- [ ] Use environment variables for sensitive config
- [ ] Enable authentication (JWT tokens)
- [ ] Implement rate limiting on backend
- [ ] Use HTTPS only in production
- [ ] Set secure cookie flags
- [ ] Validate all user inputs
- [ ] Sanitize form data
- [ ] Keep dependencies updated

## 🐛 Troubleshooting

### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS Errors
Ensure backend has proper CORS configuration:
```js
// Backend (Express)
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));
```

### Port Already in Use
```bash
# Change port in vite.config.js
server: {
  port: 3002  // Change to different port
}
```

### API Timeouts
Check backend is running and accessible:
```bash
curl http://localhost:3000/api/health
```

### Authentication Issues
- Check token is saved in localStorage
- Verify token is valid and not expired
- Check Authorization header in API requests
- Clear localStorage and re-login

## 📊 Performance Tips

1. **Code Splitting**: Already configured in Vite
2. **Lazy Loading**: Add route-based code splitting:
```jsx
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```

3. **Image Optimization**: Use WebP with fallbacks
4. **Caching**: Configure cache headers on CDN
5. **Compression**: Enable gzip compression on server

## 🔄 Development Workflow

### Daily Development
```bash
npm run dev
```

### Before Commit
```bash
# Check for unused imports (add eslint if needed)
npm run build
```

### Deployment
```bash
npm run build
# Deploy dist/ folder to your server
```

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [React Router v6](https://reactrouter.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Axios Documentation](https://axios-http.com)
- [Vite Documentation](https://vitejs.dev)
- [Socket.IO Client](https://socket.io/docs/v4/client-api/)

## 🆘 Support

If you encounter issues:

1. Check this setup guide
2. Review the README.md
3. Check backend API logs
4. Check browser console for errors
5. Check Network tab in DevTools
6. Review Git logs for recent changes

## ✨ Next Steps

1. **Configure API endpoints** in `src/services/api.js`
2. **Set up authentication** in backend
3. **Test all major workflows**
4. **Configure email notifications** (optional)
5. **Set up Socket.IO** for real-time features
6. **Deploy to production**
7. **Monitor performance**
8. **Gather user feedback**

---

**Setup Version**: 1.0.0
**Last Updated**: 2024
