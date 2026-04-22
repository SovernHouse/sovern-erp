# Trading ERP Customer Mobile App

A complete React Native mobile application for customers of a Trading Company ERP system (flooring business). This app enables customers to browse products, request quotations, track orders/shipments, and file claims from their mobile devices.

## Features

### 1. **Authentication**
- Email/password login
- Biometric authentication placeholder
- Password recovery
- Secure token-based session management

### 2. **Home Dashboard**
- Welcome header with user info
- Quick stats (Active Orders, In Transit, Pending Quotes)
- Active shipment tracking card with mini progress indicator
- Recent orders list (last 5)
- Quick action buttons
- Notifications feed

### 3. **Product Catalog**
- Scrollable grid product display
- Category filtering with chips
- Full-text search by name/SKU
- Product detail view with:
  - Image carousel
  - Complete specifications table
  - Pricing information
  - MOQ and lead time
  - Related products
  - Add to quote functionality

### 4. **Orders Management**
- Comprehensive order list with status filtering
- **Visual Order Tracker** - Beautiful vertical stepper showing:
  - Order stages: Confirmed → Production → Quality Check → Ready to Ship → Shipped → In Transit → Customs → Delivered
  - Current stage with pulse animation
  - Completed/pending status indicators
  - Estimated dates for future stages
- Order details view with:
  - Order header and amount
  - Items list
  - Documents download
  - Payment status
  - Shipment link
  - Quick actions (Request Quote, File Claim)

### 5. **Quotations**
- **Multi-step quotation request form**:
  - Step 1: Select products from catalog
  - Step 2: Adjust quantities and add special requirements
  - Step 3: Review quotation details
  - Step 4: Submit request
- Quotation list with status badges
- Full quotation detail view with:
  - Line items breakdown
  - Summary with pricing
  - Discount/tax information
  - Accept/Reject actions
  - Terms and conditions

### 6. **Shipment Tracking** (Flagship Feature)
- **Animated Route Visualization**:
  - Origin → Destination route with moving ship icon
  - Real-time progress indicator
  - Visual dotted path showing journey
  - Current location display with pulsing animation
- Shipment details:
  - Container information
  - Vessel and voyage numbers
  - ETA countdown
  - Total shipment value
- Comprehensive timeline showing:
  - All tracking events
  - Dates and locations
  - Event descriptions
- Document downloads section
- Support contact information

### 7. **Claims Management**
- **Multi-step claim filing form**:
  - Step 1: Select from delivered orders
  - Step 2: Select affected items and claim details
  - Step 3: Upload photos (optional)
  - Step 4: Review and submit
- Claims list with priority filtering
- Claim detail view showing:
  - Claim timeline
  - Associated order and items
  - Attached photos
  - Resolution information (if resolved)
  - Support contacts

### 8. **Profile Management**
- User profile information display
- Account statistics (total orders, total spent)
- Notification preferences management with per-channel settings:
  - Push notifications
  - Email notifications
  - SMS notifications
- Password change
- Secure logout

### 9. **Navigation**
- Bottom tab navigation with 5 main tabs:
  - Home
  - Products
  - Orders
  - Shipments
  - More
- Stack navigation within each tab
- Smooth transitions and animations

## Project Structure

```
customer-app/
├── src/
│   ├── navigation/
│   │   ├── AppNavigator.js           # Main auth/non-auth router
│   │   ├── AuthStack.js              # Login/forgot password flow
│   │   ├── MainTabs.js               # Bottom tab navigator
│   │   ├── HomeStack.js
│   │   ├── ProductStack.js
│   │   ├── OrderStack.js
│   │   ├── ShipmentStack.js
│   │   └── MoreStack.js
│   ├── screens/
│   │   ├── Auth/
│   │   │   ├── LoginScreen.js
│   │   │   └── ForgotPasswordScreen.js
│   │   ├── Home/
│   │   │   └── HomeScreen.js
│   │   ├── Products/
│   │   │   ├── ProductCatalogScreen.js
│   │   │   └── ProductDetailScreen.js
│   │   ├── Orders/
│   │   │   ├── OrderListScreen.js
│   │   │   └── OrderDetailScreen.js
│   │   ├── Quotations/
│   │   │   ├── QuotationListScreen.js
│   │   │   ├── QuotationDetailScreen.js
│   │   │   └── QuotationRequestScreen.js
│   │   ├── Shipments/
│   │   │   ├── ShipmentListScreen.js
│   │   │   └── ShipmentTrackerScreen.js
│   │   ├── Claims/
│   │   │   ├── ClaimListScreen.js
│   │   │   ├── ClaimFormScreen.js
│   │   │   └── ClaimDetailScreen.js
│   │   ├── Profile/
│   │   │   ├── ProfileScreen.js
│   │   │   └── NotificationSettingsScreen.js
│   │   └── More/
│   │       └── MoreScreen.js
│   ├── components/
│   │   ├── StatusBadge.js
│   │   ├── ProductCard.js
│   │   ├── OrderTrackerVertical.js
│   │   ├── ShipmentRouteAnimation.js
│   │   ├── LoadingScreen.js
│   │   ├── EmptyState.js
│   │   └── Header.js
│   ├── services/
│   │   └── api.js                    # Axios instance with auth interceptors
│   └── utils/
│       ├── colors.js                 # Theme color palette
│       ├── constants.js              # App constants
│       └── formatters.js             # Text/date formatting utilities
├── App.js                            # Entry point with auth state
├── package.json
└── README.md
```

## Design System

### Color Palette
- **Primary**: #4F46E5 (Indigo)
- **Accent**: #10B981 (Emerald)
- **Status Colors**:
  - Success: #10B981
  - Error: #EF4444
  - Warning: #F59E0B
  - Info: #3B82F6

### Typography
- Bold titles: 28px, font-weight 700
- Large text: 20px, font-weight 700
- Section titles: 16px, font-weight 600
- Body text: 13-14px, font-weight 400-500
- Small text: 11-12px, font-weight 400

### Components
- Rounded corners: 8-12px
- Card shadows with elevation
- Safe area handling for notches
- Pull-to-refresh on lists
- Smooth animations with React Native Animated API

## Key Technologies

- **React Native**: Cross-platform mobile framework
- **React Navigation**: Navigation and routing
- **Axios**: HTTP client with interceptors
- **AsyncStorage**: Local data persistence
- **React Native Animated**: Smooth animations
- **Vector Icons**: Icon library (Ionicons)
- **DayJS**: Date/time handling

## API Integration

### Endpoints
All API calls are made through the centralized `api.js` service:

**Authentication**
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

**Products**
- `GET /products`
- `GET /products/:id`
- `GET /products/categories`

**Orders**
- `GET /orders`
- `GET /orders/:id`
- `POST /orders`
- `GET /orders/:id/documents`

**Quotations**
- `GET /quotations`
- `GET /quotations/:id`
- `POST /quotations`
- `POST /quotations/:id/accept`
- `POST /quotations/:id/reject`

**Shipments**
- `GET /shipments`
- `GET /shipments/:id`
- `GET /shipments/:id/tracking`
- `GET /shipments/:id/documents`

**Claims**
- `GET /claims`
- `GET /claims/:id`
- `POST /claims`
- `POST /claims/:id/photos`

**User**
- `GET /user/profile`
- `PUT /user/profile`
- `POST /user/change-password`
- `GET /user/notification-preferences`
- `PUT /user/notification-preferences`

### Authentication
- Bearer token sent in `Authorization: Bearer {token}` header
- Token stored in AsyncStorage
- 401 responses trigger logout
- Auto-refresh token on app launch

## Installation & Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **iOS Setup**
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Android Setup**
   - Ensure Android SDK is installed
   - Update gradle if needed

4. **Run the app**
   ```bash
   # iOS
   npm run ios

   # Android
   npm run android

   # or use Xcode/Android Studio
   ```

## Configuration

Edit `src/services/api.js` to update:
- `API_BASE_URL`: Your backend API endpoint
- `SOCKET_URL`: For real-time updates (future enhancement)

## State Management

Currently uses local component state with `useState` and `useCallback`. For larger apps, consider:
- Redux Toolkit
- Zustand
- Context API with custom hooks
- Jotai

## Future Enhancements

1. **Real-time Updates**
   - WebSocket integration via Socket.IO
   - Push notifications
   - Live shipment tracking

2. **Offline Support**
   - Redux Persist
   - Local database (SQLite)
   - Sync queue for offline actions

3. **Performance**
   - Code splitting
   - Image optimization
   - Lazy loading

4. **Features**
   - Order history analytics
   - Invoice generation
   - Price comparison tools
   - Advanced search filters

## Testing

```bash
npm test
```

## Building for Production

### iOS
```bash
cd ios
xcodebuild -workspace CustomerApp.xcworkspace -scheme CustomerApp -configuration Release
```

### Android
```bash
cd android
./gradlew assembleRelease
```

## Security Considerations

1. ✅ Token stored securely (AsyncStorage with encryption)
2. ✅ API calls over HTTPS
3. ✅ Request interceptors add auth header
4. ✅ Response interceptors handle 401 errors
5. ⚠️ Consider: Keychain/Keystore for tokens
6. ⚠️ Consider: Certificate pinning for production

## Performance Tips

- Use `React.memo()` for heavy components
- Implement `FlatList` virtualization
- Use `useMemo()` for expensive calculations
- Lazy load images
- Split bundles for faster load

## Troubleshooting

### Common Issues

**Metro bundler errors**
```bash
npm start -- --reset-cache
```

**Pod installation issues (iOS)**
```bash
cd ios && rm Podfile.lock && pod install && cd ..
```

**Gradle issues (Android)**
```bash
cd android && ./gradlew clean && cd ..
npm run android
```

## Support

For issues or questions:
1. Check the error logs in console
2. Review API response data
3. Verify AsyncStorage permissions
4. Check network connectivity

## License

Proprietary - Trading ERP System
