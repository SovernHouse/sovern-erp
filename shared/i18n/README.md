# Trading Company ERP - Internationalization (i18n) System

A complete multilingual internationalization system supporting 6 languages across all 3 web portals and 2 mobile apps.

## Supported Languages

- **English** (en) - Default language
- **Mandarin Chinese** (zh) - Simplified Chinese
- **Spanish** (es) - European Spanish
- **French** (fr) - European French
- **German** (de) - German
- **Portuguese** (pt) - Brazilian Portuguese

## Features

- ✅ **Automatic browser language detection** - Detects user's preferred language on first visit
- ✅ **Persistent language preference** - Saves selection in localStorage (web) or AsyncStorage (mobile)
- ✅ **Dot notation support** - Access translations with nested keys: `t('dashboard.welcome')`
- ✅ **Fallback to English** - Missing translations automatically fall back to English
- ✅ **String replacements** - Support for parameterized translations: `t('validation.minLength', { min: 5 })`
- ✅ **All 6 languages complete** - Every key has full translations, not placeholders
- ✅ **Professional business terminology** - Proper ERP terminology in each language
- ✅ **Accessibility support** - Mobile app includes accessibility announcements

## File Structure

```
/mnt/Trading ERP/shared/i18n/
├── en.json                      # English translations (master file)
├── zh.json                      # Mandarin Chinese translations
├── es.json                      # Spanish translations
├── fr.json                      # French translations
├── de.json                      # German translations
├── pt.json                      # Portuguese translations
├── i18nProvider.jsx             # React Context Provider for web portals
├── useTranslation.js            # Custom hook for React components
├── LanguageSelector.jsx         # Web language selector component
├── i18nMobile.js                # React Native provider and hook
├── LanguageSelectorMobile.js    # React Native language selector component
└── README.md                    # This file
```

## Translation Files Structure

All translation files follow the same nested structure with these main sections:

- **common** - Universal UI labels (Save, Cancel, Delete, etc.)
- **auth** - Authentication pages (Login, Register, Reset Password)
- **nav** - Navigation menu items
- **dashboard** - Dashboard KPIs and quick actions
- **customers** - Customer management labels and statuses
- **factories** - Factory management labels
- **products** - Product specifications and attributes
- **inquiries** - Inquiry management
- **quotations** - Quotation management
- **proformaInvoices** - PI management
- **salesOrders** - Sales order management
- **purchaseOrders** - Purchase order management
- **packingLists** - Packing list labels
- **shipments** - Shipment tracking and statuses
- **inspections** - Quality inspection labels
- **claims** - Claim management
- **invoices** - Invoice management
- **payments** - Payment methods and statuses
- **inventory** - Stock management
- **crm** - CRM module (Contacts, Leads, Deals, Activities, Campaigns)
- **documents** - Document types (BOL, Invoice, COO, etc.)
- **reports** - Reporting module
- **settings** - System settings
- **notifications** - Notification messages
- **orderTracker** - Order status tracking
- **shipmentTracker** - Shipment tracking
- **validation** - Form validation messages
- **messages** - CRUD operation messages
- **language** - Language switcher labels

## Integration Guide

### WEB PORTALS (React)

#### 1. Install Dependencies

```bash
npm install react
# No additional dependencies needed - uses React Context API
```

#### 2. Wrap App with I18nProvider

In your main App.jsx or index.jsx:

```jsx
import React from 'react';
import { I18nProvider } from './shared/i18n/i18nProvider';
import YourMainComponent from './components/YourMainComponent';

function App() {
  return (
    <I18nProvider>
      <YourMainComponent />
    </I18nProvider>
  );
}

export default App;
```

#### 3. Use useTranslation Hook in Components

```jsx
import React from 'react';
import { useTranslation } from './shared/i18n/useTranslation';

function Dashboard() {
  const { t, setLanguage, currentLanguage, languages } = useTranslation();

  return (
    <div>
      <h1>{t('dashboard.welcome')}</h1>
      <p>{t('dashboard.totalRevenue')}: $100,000</p>

      {/* Example of string replacement */}
      <p>{t('validation.minLength', { min: 5 })}</p>
    </div>
  );
}

export default Dashboard;
```

#### 4. Add LanguageSelector to Navigation

In your Navigation/Header component:

```jsx
import React from 'react';
import { LanguageSelector } from './shared/i18n/LanguageSelector';
import { useTranslation } from './shared/i18n/useTranslation';

function Header() {
  const { t } = useTranslation();

  return (
    <header className="flex justify-between items-center p-4 bg-white border-b">
      <h1>{t('nav.dashboard')}</h1>
      <LanguageSelector />
    </header>
  );
}

export default Header;
```

#### 5. Integrating into the 3 Web Portals

**Admin Portal (src/App.jsx):**
```jsx
import { I18nProvider } from '../shared/i18n/i18nProvider';

function AdminPortal() {
  return (
    <I18nProvider>
      <AdminLayout />
    </I18nProvider>
  );
}
```

**Customer Portal (src/App.jsx):**
```jsx
import { I18nProvider } from '../shared/i18n/i18nProvider';

function CustomerPortal() {
  return (
    <I18nProvider>
      <CustomerLayout />
    </I18nProvider>
  );
}
```

**Supplier Portal (src/App.jsx):**
```jsx
import { I18nProvider } from '../shared/i18n/i18nProvider';

function SupplierPortal() {
  return (
    <I18nProvider>
      <SupplierLayout />
    </I18nProvider>
  );
}
```

### CONVERTING HARDCODED STRINGS

#### Before (Hardcoded):
```jsx
<h1>Dashboard</h1>
<button>Save</button>
<p>Enter your email address</p>
<span>Status: Completed</span>
```

#### After (Using Translations):
```jsx
<h1>{t('nav.dashboard')}</h1>
<button>{t('common.save')}</button>
<p>{t('validation.invalidEmail')}</p>
<span>{t('common.status')}: {t('common.completed')}</span>
```

#### More Examples:

```jsx
// Form labels
<label>{t('customers.customerName')}</label>
<input placeholder={t('customers.email')} />

// Status badges
<span className={getStatusColor(status)}>
  {t(`salesOrders.${status}`)}
</span>

// Table headers
<table>
  <thead>
    <tr>
      <th>{t('common.date')}</th>
      <th>{t('common.amount')}</th>
      <th>{t('common.status')}</th>
      <th>{t('common.actions')}</th>
    </tr>
  </thead>
</table>

// Error messages
<div className="error">
  {t('messages.sessionExpired')}
</div>

// Parameterized messages
<p>{t('validation.minLength', { min: 5 })}</p>
<p>{t('messages.confirmDelete', { itemName: 'Order #123' })}</p>
```

### MOBILE APPS (React Native)

#### 1. Install Dependencies

```bash
npm install @react-native-async-storage/async-storage
```

#### 2. Wrap App with I18nMobileProvider

```javascript
import React from 'react';
import { SafeAreaView } from 'react-native';
import { I18nMobileProvider } from './shared/i18n/i18nMobile';
import MainApp from './screens/MainApp';

export default function App() {
  return (
    <I18nMobileProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <MainApp />
      </SafeAreaView>
    </I18nMobileProvider>
  );
}
```

#### 3. Use useTranslationMobile Hook

```javascript
import React from 'react';
import { View, Text } from 'react-native';
import { useTranslationMobile } from './shared/i18n/i18nMobile';

function DashboardScreen() {
  const { t } = useTranslationMobile();

  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
        {t('dashboard.welcome')}
      </Text>
      <Text>{t('dashboard.totalRevenue')}: $100,000</Text>
    </View>
  );
}

export default DashboardScreen;
```

#### 4. Add Language Selector to Navigation Header

```javascript
import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { LanguageSelectorMobile, LanguageSelectorButton } from './shared/i18n/LanguageSelectorMobile';
import { useTranslationMobile } from './shared/i18n/i18nMobile';

function NavigationHeader() {
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const { t } = useTranslationMobile();

  return (
    <View>
      <LanguageSelectorButton
        onPress={() => setShowLanguageSelector(true)}
      />
      <LanguageSelectorMobile
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
      />
    </View>
  );
}

export default NavigationHeader;
```

## API Reference

### Web - useTranslation Hook

```javascript
const {
  t,                    // Translation function: (key, replacements?) => string
  setLanguage,          // Function to change language: (code) => void
  currentLanguage,      // Currently selected language code: string
  isLoading,            // Loading state during initialization: boolean
  languages,            // Array of all supported languages with metadata
  supportedLanguages    // Array of language codes: string[]
} = useTranslation();
```

### Mobile - useTranslationMobile Hook

```javascript
const {
  t,                    // Translation function: (key, replacements?) => string
  setLanguage,          // Function to change language: (code) => Promise<void>
  currentLanguage,      // Currently selected language code: string
  isLoading,            // Loading state during initialization: boolean
  languages,            // Array of all supported languages with metadata
  supportedLanguages    // Array of language codes: string[]
} = useTranslationMobile();
```

### Translation Function

```javascript
// Basic usage
t('common.save')                               // "Save"

// Nested keys
t('dashboard.welcome')                         // "Welcome to Trading ERP"

// With replacements
t('validation.minLength', { min: 5 })         // "Minimum length is 5 characters"
t('validation.minLength', { min: 10 })        // "Minimum length is 10 characters"

// Missing keys fall back to English
t('unknown.key')                               // "unknown.key" (key itself if not found)
```

## Language Detection

### Web (Browser)

On first visit, the system automatically detects the user's preferred language:

1. Checks localStorage for saved preference
2. Detects browser language from `navigator.language`
3. Matches against supported languages
4. Falls back to English if no match

```javascript
// Example: User with browser language 'de-DE' gets German
// Example: User with browser language 'ja-JP' gets English (fallback)
```

### Mobile (React Native)

Mobile apps use the same approach but with AsyncStorage for persistence.

## Adding New Translations

### Step 1: Add to en.json (Master File)

```json
{
  "common": {
    "save": "Save",
    "newKey": "New translation"
  }
}
```

### Step 2: Add to All Other Language Files

- zh.json: `"newKey": "新翻译"`
- es.json: `"newKey": "Nueva traducción"`
- fr.json: `"newKey": "Nouvelle traduction"`
- de.json: `"newKey": "Neue Übersetzung"`
- pt.json: `"newKey": "Nova tradução"`

### Step 3: Use in Component

```jsx
<span>{t('common.newKey')}</span>
```

## Adding New Languages

To add a new language (e.g., Japanese):

1. Create `ja.json` with all translations from en.json
2. Update `supportedLanguages` array in i18nProvider.jsx and i18nMobile.js
3. Add language metadata to `languages` array in useTranslation.js
4. Rebuild and deploy

## Best Practices

### ✅ DO

- Always use `t()` for user-facing text
- Use descriptive key names: `t('customers.creditLimit')`
- Use dot notation for nested keys
- Keep translations concise but clear
- Use parameterized translations for dynamic values
- Test in all 6 languages before deployment

### ❌ DON'T

- Hardcode text strings (e.g., "Save", "Delete")
- Mix hardcoded and translated text
- Use complex HTML in translation keys
- Store language preference in cookies or session
- Modify translation files at runtime (for i18n updates, rebuild needed)

## Translation Quality Standards

All translations follow these standards:

- **Professional terminology** - Uses proper ERP/business terms
- **Consistency** - Same terms translated consistently across all keys
- **Completeness** - Every language file has 500+ keys, all translated
- **Natural phrasing** - Translations read naturally in each language
- **Cultural appropriateness** - Respects regional language variations

## Testing Translations

### Test Checklist

- [ ] All 6 languages render without errors
- [ ] Language switching works immediately
- [ ] Language preference persists after reload (web) or app restart (mobile)
- [ ] Missing keys fall back to English correctly
- [ ] Parameterized translations work with various values
- [ ] UI layout accommodates longest translations (German, Portuguese)
- [ ] Special characters render correctly in all languages
- [ ] Mobile app accessibility announcements work

## Troubleshooting

### Issue: Text displays as key name (e.g., "common.save")

**Solution:** Check that the key exists in the translation file. Verify dot notation is correct.

```javascript
// Wrong
t('common_save')        // Uses underscore instead of dot
t('commonSave')         // Uses camelCase

// Correct
t('common.save')        // Uses dot notation
```

### Issue: Language doesn't persist

**Web:**
- Check that localStorage is enabled in browser
- Verify no browser extensions are blocking storage
- Check browser's privacy settings

**Mobile:**
- Ensure AsyncStorage is properly installed
- Check app permissions on device
- Clear app cache and reinstall if needed

### Issue: Missing translation message appearing

**Solution:** Add the missing key to all language files:

```javascript
// In i18nProvider.jsx, missing keys fallback to the key name
// Add to all 6 .json files and rebuild
```

## Performance Considerations

- All 500+ translation keys are loaded on app startup
- Memory usage is minimal (all JSON files combined ~200KB)
- Translation lookup is O(n) where n is depth of nested key
- Language switching is instant (no network requests)
- Recommended to lazy-load language selector component on large apps

## Support & Updates

For adding or updating translations across all languages:

1. Update en.json first (master file)
2. Update remaining 5 language files
3. Test in all 6 languages
4. Rebuild and redeploy to all portals and apps

---

**Last Updated:** 2026-03-16
**Maintained by:** Trading ERP Development Team
**Version:** 1.0.0
