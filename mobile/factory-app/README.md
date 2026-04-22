# Factory Partner Mobile App - Trading Company ERP

A comprehensive React Native mobile application for factory partners managing purchase orders, production, shipments, documents, and inspections within a Trading Company ERP system.

## Overview

The Factory Partner App is designed for flooring business factories and suppliers to efficiently manage their operations with the trading company. The app features an amber/orange color theme (#F59E0B) to differentiate from the customer-facing application, with a focus on quick actions and efficiency for factory workers.

## Key Features

### 1. Dashboard
- Real-time statistics: Active POs, In Production, Ready to Ship, Pending Inspections
- Urgent items list with overdue alerts
- Recent PO history with quick access
- Fast action buttons for common tasks

### 2. Purchase Order Management
- Browse all POs with advanced filtering
- View complete PO details with items, specifications
- Confirm/reject POs with delivery date commitment
- Track PO status throughout lifecycle

### 3. Production Management
- Visual progress tracking with percentage indicators
- Update production status with photos and notes
- Production calendar view with deadline tracking
- Item-level completion tracking
- Multi-step status workflow (Not Started → In Progress → Quality Check → Completed)

### 4. Shipping & Logistics
- Shipment creation and management
- Vessel and container tracking
- Port information management
- Document upload for:
  - Bill of Lading
  - Certificate of Origin
  - Commercial Invoice
  - Insurance Certificate
  - Packing List
  - Fumigation Certificate
  - Customs Declaration
- Packing list creation with detailed item specifications

### 5. Product Management
- Product catalog browsing
- Product creation and editing
- Bulk price updates with effective dates
- Product specifications and categories

### 6. Quality Inspections
- Scheduled inspection calendar
- Inspection preparation checklist
- View detailed inspection reports
- Track inspection results and findings
- Photo documentation of inspections

### 7. Factory Profile
- Company information management
- Certifications tracking
- Team member management
- Settings and preferences

## Project Structure

```
factory-app/
├── src/
│   ├── navigation/
│   │   ├── AppNavigator.js          # Main app navigation
│   │   ├── AuthStack.js              # Authentication flow
│   │   └── MainTabs.js               # Bottom tab navigation with 4 tabs
│   │
│   ├── screens/
│   │   ├── Auth/
│   │   │   └── LoginScreen.js
│   │   ├── Dashboard/
│   │   │   └── DashboardScreen.js
│   │   ├── PurchaseOrders/
│   │   │   ├── POListScreen.js
│   │   │   ├── PODetailScreen.js
│   │   │   └── POConfirmScreen.js
│   │   ├── Production/
│   │   │   ├── ProductionListScreen.js
│   │   │   ├── ProductionUpdateScreen.js
│   │   │   └── ProductionCalendarScreen.js
│   │   ├── Shipping/
│   │   │   ├── ShipmentListScreen.js
│   │   │   ├── ShipmentFormScreen.js
│   │   │   ├── DocumentUploadScreen.js
│   │   │   └── PackingListScreen.js
│   │   ├── Products/
│   │   │   ├── ProductListScreen.js
│   │   │   ├── ProductFormScreen.js
│   │   │   └── PriceUpdateScreen.js
│   │   ├── Inspections/
│   │   │   ├── InspectionListScreen.js
│   │   │   ├── InspectionDetailScreen.js
│   │   │   └── InspectionPrepScreen.js
│   │   ├── Profile/
│   │   │   └── ProfileScreen.js
│   │   └── More/
│   │       └── MoreScreen.js
│   │
│   ├── components/
│   │   ├── ProductionProgressBar.js  # Visual progress indicator
│   │   ├── POCard.js                 # Purchase order card component
│   │   ├── DocumentSlot.js           # Document upload slot
│   │   ├── StatusBadge.js            # Status badge component
│   │   ├── LoadingScreen.js          # Loading indicator
│   │   ├── EmptyState.js             # Empty state display
│   │   └── Header.js                 # Custom header component
│   │
│   ├── services/
│   │   └── api.js                    # API service with axios
│   │
│   └── utils/
│       ├── colors.js                 # Amber/orange color theme
│       ├── constants.js              # Constants (statuses, document types)
│       └── formatters.js             # Date/time/number formatting utilities
│
├── App.js                            # Main app entry point
└── package.json                      # Dependencies and scripts
```

## Installation & Setup

### Prerequisites
- Node.js 14+ and npm
- React Native CLI
- Android Studio or Xcode (for testing)

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd factory-app

# Install dependencies
npm install

# Link native modules
react-native link

# For Android
react-native run-android

# For iOS
react-native run-ios
```

## Dependencies

### Core
- `react-native`: 0.72.0
- `react`: 18.2.0

### Navigation
- `@react-navigation/native`: ^6.1.8
- `@react-navigation/bottom-tabs`: ^6.5.8
- `@react-navigation/stack`: ^6.3.17
- `react-native-gesture-handler`: ^2.14.0
- `react-native-reanimated`: ^3.5.0
- `react-native-safe-area-context`: ^4.7.2
- `react-native-screens`: ^3.26.0

### UI & Icons
- `react-native-vector-icons`: ^10.0.0
- `react-native-calendar-picker`: ^9.3.1

### HTTP & State
- `axios`: ^1.6.1
- `@react-native-async-storage/async-storage`: ^1.19.2

### Media & Files
- `react-native-image-picker`: ^5.7.0
- `socket.io-client`: ^4.7.1

### Utilities
- `dayjs`: ^1.11.10

## Design System

### Color Palette
- **Primary**: #F59E0B (Amber)
- **Dark**: #D97706 (Darker Amber)
- **Light**: #FCD34D (Light Amber)
- **Lighter**: #FEF3C7 (Very Light Amber)
- **Success**: #10B981
- **Danger**: #EF4444
- **Warning**: #F59E0B
- **Info**: #3B82F6

### Typography
- Headings: Bold, 16-20px
- Body: Regular, 13-14px
- Labels: Medium/Bold, 11-12px
- Small text: Regular, 10-11px

### Component Guidelines
- Border Radius: 8-12px for cards, 6-8px for buttons
- Spacing: 8px base unit (8, 16, 24, 32px)
- Shadows: Subtle elevation effect for cards
- Touch targets: Minimum 44x44dp for interactive elements

## API Integration

The app connects to a Trading Company ERP backend with the following endpoints:

### Authentication
- `POST /auth/factory-login`: Login with factory credentials
- `POST /auth/logout`: Logout
- `POST /auth/refresh-token`: Refresh auth token

### Purchase Orders
- `GET /purchase-orders`: List all POs
- `GET /purchase-orders/:id`: Get PO details
- `PUT /purchase-orders/:id/confirm`: Confirm PO
- `PUT /purchase-orders/:id/reject`: Reject PO

### Production
- `GET /production`: List production orders
- `PUT /production/:id`: Update production status
- `POST /production/:id/photos`: Upload production photos

### Shipments
- `GET /shipments`: List shipments
- `POST /shipments`: Create shipment
- `POST /shipments/:id/documents`: Upload shipping documents

### Products
- `GET /products`: List products
- `POST /products`: Create product
- `PUT /products/:id`: Update product
- `POST /prices/batch`: Update multiple prices

### Inspections
- `GET /inspections`: List inspections
- `GET /inspections/:id`: Get inspection details
- `POST /inspections/:id/complete`: Complete inspection

## Features in Detail

### Login System
- Factory ID and password authentication
- Token-based session management
- Persistent login with AsyncStorage
- Auto-logout on token expiration

### Pull-to-Refresh
All list screens support pull-to-refresh functionality to reload data.

### Offline Support
The app is designed with offline patterns:
- Last loaded data is displayed
- Network status indicators
- Queued actions for offline scenarios

### Photo Capture
- Camera integration for production updates
- Document scanning for shipping papers
- Inspection photo documentation
- Image compression for efficient upload

### Date/Time Handling
- Calendar picker for date selection
- Relative time display (e.g., "3 days left")
- Timezone-aware formatting
- ISO 8601 standardization for API

### Form Validation
- Client-side validation for all forms
- Clear error messages
- Required field indicators
- Character limit tracking

## Navigation Structure

### Tab Navigation (4 Tabs)
1. **Dashboard** - Home & overview
2. **Orders** - PO management
3. **Production** - Production & shipping
4. **More** - Additional features

Each tab has its own stack navigator supporting nested navigation.

## Performance Optimization

- FlatList optimization with proper keys
- Image lazy loading
- API call debouncing
- Memoization of heavy components
- Efficient re-render management

## Security Considerations

- Bearer token authentication
- Secure token storage in AsyncStorage
- HTTPS-only API calls
- Input validation and sanitization
- No sensitive data in logs

## Customization

### Changing Theme
Edit `src/utils/colors.js` to modify the color scheme. The primary color is used throughout the app.

### API Base URL
Update `src/utils/constants.js`:
```javascript
export const API_BASE_URL = 'https://your-api-url.com';
```

### Document Types
Modify `DOCUMENT_TYPES` in `src/utils/constants.js` to add/remove document categories.

## Troubleshooting

### Port Already in Use
```bash
lsof -i :8081
kill -9 <PID>
```

### Build Issues
```bash
# Clean build
npm install
watchman watch-del-all
react-native start --reset-cache
```

### Android Build
```bash
cd android
./gradlew clean
cd ..
react-native run-android
```

## Testing

The app includes error handling for:
- Network failures
- API errors (400, 401, 404, 500)
- Form validation errors
- Image upload failures
- Permission denials

## Deployment

### Production Build

**Android:**
```bash
cd android
./gradlew assembleRelease
```

**iOS:**
```bash
cd ios
xcodebuild -workspace FactoryApp.xcworkspace -scheme FactoryApp -configuration Release
```

## Support & Documentation

For API documentation and backend setup, refer to the Trading Company ERP documentation.

## Version History

- v1.0.0: Initial release with all core features

## Future Enhancements

- WebSocket real-time notifications
- Offline data sync
- Advanced analytics and reporting
- Multi-language support
- Dark mode theme
- Biometric authentication
- Voice commands

## License

Proprietary - Trading Company ERP System
