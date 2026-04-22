# Personalization Features - Quick Start Guide

## Overview
Complete implementation of personalization features for the Trading ERP system, enabling users to customize dashboards, manage notifications, track commissions, and save filter presets.

---

## Features at a Glance

### 1. Configurable Dashboard
- **Location:** `/api/dashboard` (backend), `/pages/Dashboard/ConfigurableDashboard.jsx` (frontend)
- **For:** All users
- **Features:**
  - Role-based default layouts (Admin/Sales/Operations/Finance)
  - Drag-and-drop widget reordering
  - Add/remove widgets from dashboard
  - Save custom layouts
  - Minimize widgets

**Quick Test:**
```bash
# Get role-specific widgets
GET /api/dashboard/role/sales

# Save user layout
POST /api/dashboard/layout
{
  "layout": [
    { "id": "widget-1", "title": "My Performance", "type": "kpi" },
    { "id": "widget-2", "title": "Recent Orders", "type": "table" }
  ]
}
```

---

### 2. Notification Preferences
- **Location:** `/api/personalization/notification-preferences` (backend), `/pages/Settings/NotificationPreferences.jsx` (frontend)
- **For:** All users
- **Features:**
  - Per-channel settings (Email, In-App, SMS)
  - Per-category toggles (6 categories)
  - Digest frequency (Real-time, Hourly, Daily, Weekly)
  - Scheduled delivery time

**Quick Test:**
```bash
# Get user's preferences
GET /api/personalization/notification-preferences/USER_ID

# Update preferences
PUT /api/personalization/notification-preferences/USER_ID
{
  "preferences": {
    "email": { "orders": true, "payments": false },
    "inApp": { "orders": true, "payments": true },
    "sms": { "orders": false }
  },
  "digestFrequency": "daily",
  "digestTime": "09:00"
}
```

---

### 3. Commission Tracking
- **Location:** `/api/personalization/commissions` (backend), `/pages/Commissions/CommissionDashboard.jsx` (frontend)
- **For:** Sales team, Admin, Finance
- **Features:**
  - Commission rules management
  - Track earned commissions
  - Commission history with status
  - Performance metrics
  - Tiered commission support

**Quick Test:**
```bash
# Get commission rules
GET /api/personalization/commissions/rules

# Create commission rule
POST /api/personalization/commissions/rules
{
  "name": "Standard Sales Commission",
  "ruleType": "percentage",
  "baseValue": 5.0,
  "minAmount": 1000,
  "applicableRoles": ["sales"]
}

# Get my commissions
GET /api/personalization/commissions/my
```

---

### 4. Filter Presets
- **Location:** `/api/personalization/filter-presets` (backend), `/components/FilterPresets.jsx` (frontend)
- **For:** All users
- **Features:**
  - Save filter combinations
  - Load saved presets
  - Share presets with secure tokens
  - Entity-type scoped presets

**Quick Test:**
```bash
# Get presets for entity type
GET /api/personalization/filter-presets?entityType=salesOrder

# Save preset
POST /api/personalization/filter-presets
{
  "entityType": "salesOrder",
  "name": "My Open Orders",
  "filters": { "status": "pending", "customer": "ABC Corp" },
  "isPublic": true
}

# Load shared preset (no auth needed)
GET /api/personalization/filter-presets/shared/TOKEN_HERE
```

---

## Integration Guide

### Add Configurable Dashboard to App
```jsx
import ConfigurableDashboard from './pages/Dashboard/ConfigurableDashboard'

// In your routing
<Route path="/dashboard" element={<ConfigurableDashboard />} />
```

### Add Filter Presets to List Pages
```jsx
import FilterPresets from './components/FilterPresets'
import { useState } from 'react'

export default function SalesOrdersList() {
  const [filters, setFilters] = useState({})

  const handleLoadPreset = (presetFilters) => {
    setFilters(presetFilters)
    // Apply filters to your data fetch
  }

  return (
    <>
      <FilterPresets
        entityType="salesOrder"
        currentFilters={filters}
        onLoadPreset={handleLoadPreset}
      />
      {/* Your list component */}
    </>
  )
}
```

### Add Notification Preferences to Settings
```jsx
import NotificationPreferences from './pages/Settings/NotificationPreferences'

// In your settings routing
<Route path="/settings/notifications" element={<NotificationPreferences />} />
```

### Add Commission Dashboard
```jsx
import CommissionDashboard from './pages/Commissions/CommissionDashboard'

// In your routing
<Route path="/commissions" element={<CommissionDashboard />} />
```

---

## Database Setup

### Create Tables
Run these migrations or use your migration tool:

```sql
-- Dashboard Layouts
CREATE TABLE dashboard_layouts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  role ENUM(...),
  layout JSON,
  is_default BOOLEAN DEFAULT false,
  name VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Notification Preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  preferences JSON,
  digest_frequency ENUM('real-time','hourly','daily','weekly'),
  digest_time TIME,
  unsubscribe_token VARCHAR(255) UNIQUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Commission Rules
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE,
  description TEXT,
  rule_type ENUM('percentage','fixed','tiered'),
  base_value DECIMAL(10,4),
  min_amount DECIMAL(15,2),
  max_amount DECIMAL(15,2),
  tiers JSON,
  applicable_roles JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Commission Tracking
CREATE TABLE commission_trackings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  commission_rule_id UUID NOT NULL REFERENCES commission_rules(id),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
  amount DECIMAL(15,2),
  percentage DECIMAL(10,4),
  order_amount DECIMAL(15,2),
  status ENUM('pending','approved','paid','disputed','cancelled'),
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Filter Presets
CREATE TABLE filter_presets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type VARCHAR(255),
  name VARCHAR(255),
  filters JSON,
  is_default BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  share_token VARCHAR(255) UNIQUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX idx_dashboard_layouts_role_default ON dashboard_layouts(role, is_default);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_filter_presets_user_id ON filter_presets(user_id);
CREATE INDEX idx_filter_presets_entity ON filter_presets(user_id, entity_type);
CREATE INDEX idx_filter_presets_share_token ON filter_presets(share_token);
CREATE INDEX idx_commission_trackings_user_id ON commission_trackings(user_id);
CREATE INDEX idx_commission_trackings_status ON commission_trackings(status);
CREATE INDEX idx_commission_rules_active ON commission_rules(is_active);
```

---

## API Reference

### Dashboard Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard/role/:role` | Yes | Get default widgets for role |
| GET | `/api/dashboard/layout` | Yes | Get user's saved layout |
| POST | `/api/dashboard/layout` | Yes | Save/update user's layout |
| GET | `/api/dashboard/widgets` | Yes | List all available widgets |

### Notification Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/personalization/notification-preferences/:userId` | Yes | Get preferences |
| PUT | `/api/personalization/notification-preferences/:userId` | Yes | Update preferences |

### Commission Endpoints
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/personalization/commissions/rules` | Yes | admin,finance | List rules |
| POST | `/api/personalization/commissions/rules` | Yes | admin | Create rule |
| GET | `/api/personalization/commissions/my` | Yes | all | Get my commissions |
| GET | `/api/personalization/commissions` | Yes | admin,finance | List all commissions |

### Filter Preset Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/personalization/filter-presets` | Yes | Get user's presets |
| POST | `/api/personalization/filter-presets` | Yes | Create preset |
| PUT | `/api/personalization/filter-presets/:id` | Yes | Update preset |
| DELETE | `/api/personalization/filter-presets/:id` | Yes | Delete preset |
| GET | `/api/personalization/filter-presets/shared/:token` | No | Get shared preset |

---

## Components Reference

### ConfigurableDashboard
```jsx
<ConfigurableDashboard />
```
Standalone page component. No props needed.

### FilterPresets
```jsx
<FilterPresets
  entityType="salesOrder"
  currentFilters={{ status: 'pending' }}
  onLoadPreset={(filters) => applyFilters(filters)}
/>
```
Props:
- `entityType` (string, required) - Entity type for presets
- `currentFilters` (object) - Current filter state
- `onLoadPreset` (function) - Callback when preset is loaded

### WidgetGrid
```jsx
<WidgetGrid
  widgets={[...]}
  onRemoveWidget={(id) => {...}}
  onUpdateWidget={(id, updates) => {...}}
/>
```

---

## Testing Checklist

### Backend
- [ ] All routes respond with correct HTTP status codes
- [ ] Authentication is enforced on protected routes
- [ ] Role-based access control works
- [ ] Error handling returns proper format
- [ ] Data validation prevents invalid inputs
- [ ] Cache is invalidated on updates

### Frontend
- [ ] Dashboard widgets render without errors
- [ ] Drag-and-drop reordering works smoothly
- [ ] Filter presets save and load correctly
- [ ] Notification preferences update successfully
- [ ] Commission data displays correctly
- [ ] Responsive design works on mobile
- [ ] Toast notifications appear for actions
- [ ] Loading states display during API calls

---

## Troubleshooting

### Dashboard not loading
- Check database has `DashboardLayout` table
- Verify user has role set
- Check API responses in browser DevTools

### Drag-and-drop not working
- Ensure WidgetGrid is rendered
- Check browser supports HTML5 Drag API (all modern browsers)
- Verify CSS grid is applied

### Commissions not showing
- Check `CommissionRule` and `CommissionTracking` tables exist
- Verify commission rules are created with `isActive: true`
- Check sales orders are linked to commission rules

### Filters not saving
- Verify `FilterPreset` table exists
- Check current user is authenticated
- Ensure filter JSON is valid

---

## Performance Tips

1. Dashboard widgets are cached for 60 seconds
2. Use pagination for large commission lists
3. Index frequently queried fields (already done)
4. Lazy load widget data in production
5. Cache widget configuration in frontend

---

## Security Notes

- All endpoints require authentication (except shared presets)
- Users can only access their own data
- Admin can access all user data
- Share tokens are cryptographically secure
- Unsubscribe tokens prevent unauthorized unsubscription
- Input validation on all routes

---

## Future Enhancements

1. Widget refresh intervals
2. Real-time dashboard updates (WebSocket)
3. Team widget sharing
4. Advanced commission rules engine
5. Notification history/archive
6. Preset versioning
7. Dashboard templates for teams

---

## Support

For issues or questions:
1. Check the error messages in browser console
2. Review API responses in Network tab
3. Verify database tables exist
4. Check user authentication status
5. Review implementation summary for detailed info

---

## Files Reference

**Backend:**
- Models: `backend/models/{DashboardLayout,NotificationPreference,CommissionRule,CommissionTracking,FilterPreset}.js`
- Routes: `backend/routes/personalizationRoutes.js`
- Dashboard routes: `backend/routes/dashboardRoutes.js`

**Frontend:**
- Pages: `frontend/admin-portal/src/pages/{Dashboard/ConfigurableDashboard,Settings/NotificationPreferences,Commissions/CommissionDashboard}.jsx`
- Components: `frontend/admin-portal/src/components/{DashboardWidgets/*,FilterPresets}.jsx`
- API: `frontend/admin-portal/src/services/api.js` (personalizationAPI)

---

**Last Updated:** March 16, 2026
**Status:** Production Ready
