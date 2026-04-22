# @trading-erp/shared

Shared component library for Trading ERP System portals (Admin, Customer, Factory).

## Overview

This package provides reusable React components, custom hooks, and utilities used across all three Trading ERP portals:
- Admin Portal
- Customer Portal
- Factory Portal

## Installation

The shared library is automatically available in each portal through npm workspaces. Import directly:

```javascript
import { DataTable, Modal, ConfirmDialog, LoadingSpinner } from '@trading-erp/shared'
```

Or using the alias in vite.config.js:

```javascript
import { DataTable, Modal } from '@shared/components'
```

## Components

### Core UI Components

- **Modal** - Reusable modal dialog component
- **ConfirmDialog** - Confirmation dialog with customizable messages
- **LoadingSpinner** - Loading indicator with configurable size
- **EmptyState** - Empty state placeholder with optional action button
- **ErrorBoundary** - Error boundary wrapper for error handling

### Data Display Components

- **DataTable** - Fully featured data table with sorting, pagination, selection
- **Pagination** - Pagination controls
- **StatusBadge** - Status indicator with color mapping
- **StatsCard** - Statistics card for dashboards with trend indicators
- **SearchBar** - Search input with debounce

### Form Components

Form field components exported from `FormFields.jsx`:
- `TextInput` - Standard text input
- `NumberInput` - Number input field
- `EmailInput` - Email input with validation
- `PasswordInput` - Password input field
- `SelectInput` - Dropdown select
- `DateInput` - Date picker
- `DateTimeInput` - DateTime picker
- `TextArea` - Multi-line text input
- `CheckboxInput` - Checkbox field
- `RadioInput` - Radio button group
- `FileInput` - File upload field
- `CurrencyInput` - Currency input with currency symbol

### File Upload Component

- **FileUpload** - Drag-and-drop file upload with validation

## Hooks

### useApi
Hook for making HTTP requests with automatic auth token handling.

```javascript
import { useApi } from '@trading-erp/shared'

function MyComponent() {
  const { get, post, loading, error } = useApi()

  const fetchData = async () => {
    const data = await get('/users')
  }
}
```

### useDebounce
Hook for debouncing values (useful for search inputs).

```javascript
import { useDebounce } from '@trading-erp/shared'

function SearchComponent() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    // API call with debouncedQuery
  }, [debouncedQuery])
}
```

### usePagination
Hook for managing pagination state.

```javascript
import { usePagination } from '@trading-erp/shared'

function ListComponent({ items }) {
  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage
  } = usePagination(items, 10)
}
```

## Utils

### Constants

Status enums and color mappings:
- `ORDER_STATUS` - Order status constants
- `SHIPMENT_STATUS` - Shipment status constants
- `INVOICE_STATUS` - Invoice status constants
- `STATUS_COLOR_MAP` - Maps status values to Tailwind color classes
- `CURRENCIES` - Available currencies
- `COUNTRIES` - List of countries
- `PAYMENT_TERMS` - Payment terms

```javascript
import { ORDER_STATUS, STATUS_COLOR_MAP } from '@trading-erp/shared'
```

### Formatters

Utility functions for formatting values:
- `formatDate(date, format)` - Format date with dayjs
- `formatCurrency(amount, currency)` - Format numbers as currency
- `formatNumber(number, decimals)` - Format with decimals
- `formatFileSize(bytes)` - Format file size (B, KB, MB, GB)
- `truncateText(text, maxLength)` - Truncate text with ellipsis
- `capitalizeWords(text)` - Capitalize words in text
- `formatPhone(phone, countryCode)` - Format phone numbers
- `isValidEmail(email)` - Validate email format
- `formatUrl(url)` - Ensure URL has protocol

```javascript
import { formatCurrency, formatDate, formatFileSize } from '@trading-erp/shared'

formatCurrency(1234.56, 'USD') // "$1,234.56"
formatDate('2024-01-15', 'MMM DD, YYYY') // "Jan 15, 2024"
formatFileSize(1048576) // "1 MB"
```

### API Client

Pre-configured axios instance with auth interceptors:

```javascript
import { apiClient } from '@trading-erp/shared'

// Automatically includes Bearer token from localStorage
const response = await apiClient.get('/users')
```

## Styling

All components use Tailwind CSS. Ensure Tailwind is configured in each portal:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure `tailwind.config.js` to include shared component paths:

```javascript
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../shared/src/**/*.{js,jsx}',
  ],
  // ...
}
```

## Color Scheme

Components use blue as the primary color:
- Primary: `blue-600` (hover: `blue-700`)
- Status colors map to Tailwind color palette
- Error/danger: `red-600`
- Success: `green-600`
- Warning: `yellow-600`

Customize colors by overriding Tailwind classes in individual portals.

## Usage Examples

### DataTable

```javascript
import { DataTable } from '@trading-erp/shared'

<DataTable
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' }
  ]}
  data={users}
  isLoading={loading}
  paginated
  sortable
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

### Modal with Form

```javascript
import { Modal, TextInput, NumberInput } from '@trading-erp/shared'
import { useState } from 'react'

function CreateItemModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({ name: '', price: '' })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Item">
      <TextInput
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <NumberInput
        label="Price"
        value={formData.price}
        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
        required
      />
      <button onClick={() => onSubmit(formData)}>Create</button>
    </Modal>
  )
}
```

### File Upload

```javascript
import { FileUpload } from '@trading-erp/shared'

<FileUpload
  onFilesSelected={handleFilesSelected}
  maxSize={10}
  maxFiles={5}
  acceptedTypes=".pdf,.doc,.docx"
/>
```

## Migration Guide

To migrate existing portal components to use shared library:

1. Identify duplicate components in portals
2. Remove portal-specific versions
3. Import from `@trading-erp/shared`
4. Adjust props/styling if needed for portal-specific requirements

Portal-specific components (Layout, OrderTracker, ShipmentMap, etc.) remain in individual portals.

## Contributing

When adding new shared components:

1. Create component in `src/components/`
2. Export from `src/components/index.js`
3. Add TypeScript types if needed
4. Document props and usage
5. Update this README

## Structure

```
frontend/shared/
├── package.json
├── README.md
├── src/
│   ├── components/
│   │   ├── index.js
│   │   ├── Modal.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── DataTable.jsx
│   │   ├── FormFields.jsx
│   │   └── ...
│   ├── hooks/
│   │   ├── index.js
│   │   ├── useApi.js
│   │   ├── useDebounce.js
│   │   └── usePagination.js
│   ├── utils/
│   │   ├── index.js
│   │   ├── constants.js
│   │   ├── formatters.js
│   │   └── api.js
│   └── index.js
```

## License

PROPRIETARY - Trading Company ERP System
