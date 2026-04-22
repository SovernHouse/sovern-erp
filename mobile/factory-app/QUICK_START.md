# Quick Start Guide - Factory Partner Mobile App

## Installation

```bash
# Install dependencies
npm install

# Install pods (iOS only)
cd ios && pod install && cd ..

# Link native modules
react-native link
```

## Running the App

### Android
```bash
react-native run-android
```

### iOS
```bash
react-native run-ios
```

## Configuration

### 1. Update API Base URL
Edit `src/utils/constants.js`:
```javascript
export const API_BASE_URL = 'https://your-api-domain.com';
```

### 2. Configure Credentials
The app uses factory ID and password authentication:
- Factory ID: Unique identifier for each factory/supplier
- Password: Secure password stored on backend

## Key Features Overview

### Dashboard Tab
- View key metrics at a glance
- See urgent items and overdue POs
- Quick action buttons for common tasks

### Orders Tab
- Browse all purchase orders
- Filter by status (Draft, Confirmed, In Production, etc.)
- View detailed PO information and items
- Confirm or reject orders

### Production Tab
- Track active production with progress bars
- Update production status with photos
- View production calendar
- Manage shipments and documents

### More Tab
- Product catalog management
- Bulk price updates
- Inspection scheduling
- Factory profile and team management

## Common Tasks

### Confirming a Purchase Order
1. Go to Orders tab → POListScreen
2. Tap a PO to view details
3. Tap "Confirm Order" button
4. Enter delivery date and notes
5. Review and confirm

### Updating Production Status
1. Go to Production tab → Production Orders
2. Tap an order to update
3. Adjust progress slider (0-100%)
4. Add photos via camera
5. Select production status
6. Save changes

### Uploading Shipping Documents
1. Go to Production tab → Shipments
2. Select a shipment
3. Upload required documents:
   - Bill of Lading
   - Commercial Invoice
   - Certificate of Origin
   - Others as needed
4. Documents will be tracked with status

### Creating Packing List
1. From Shipment screen, select "Packing List"
2. Add items with:
   - Product name
   - Quantity
   - Weight and dimensions
   - Special notes
3. Save packing list

## Troubleshooting

### App Won't Start
1. Clear cache: `watchman watch-del-all`
2. Reset bundler: `react-native start --reset-cache`
3. Rebuild: `react-native run-android` or `react-native run-ios`

### API Connection Issues
1. Check API_BASE_URL in constants.js
2. Verify network connectivity
3. Check backend server status
4. Review API error messages in alerts

### Photo/Document Upload Issues
1. Ensure camera permissions are granted
2. Check internet connection
3. Verify file size isn't too large
4. Try uploading again

## Important Notes

- Login credentials are factory-specific
- Token is automatically managed by the app
- Pull to refresh on any list screen to reload data
- All forms validate before submission
- Network errors are displayed with retry options

## Performance Tips

- Close other apps to free memory
- Clear app cache if app slows down: Settings → Apps → Factory Partner → Clear Cache
- Update to latest version for bug fixes and improvements

## Support

For API issues or backend configuration:
- Contact your ERP system administrator
- Review API documentation in README.md
- Check IMPLEMENTATION_SUMMARY.md for technical details

## Next Steps

1. Test login with factory credentials
2. Explore each tab and feature
3. Try common workflows
4. Configure additional settings as needed
5. Deploy to production when ready

Happy shipping!
