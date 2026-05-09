# Front-End Developer Reference: International Trade Website

**Audience**: AI front-end developers and code reviewers for Alex's international trade company website.

**Purpose**: This reference ensures all front-end work adheres to standards for global B2B, accessibility, performance, internationalization, and the specific credibility requirements of international trade platforms.

---

## I. Brand Design System

### Color Tokens

A professional trade website must communicate stability, legitimacy, and international reach. Avoid excessive color; trade partners judge restraint as competence.

**Primary Palette** (anchors trust)
- Primary: `#1a365d` (deep navy) — authority, trust, stability
- Secondary: `#2d5a2d` (professional green) — growth, sustainability, legitimacy
- Accent: `#d97706` (amber) — highlights, CTAs, urgency without alarm
- Neutral (text/bg): `#111827` (near-black), `#6b7280` (mid-gray), `#f9fafb` (off-white)

**Semantic Colors**
- Success: `#059669` (emerald, ISO/cert badges)
- Error: `#dc2626` (red, form validation)
- Warning: `#ea580c` (orange, alerts)
- Info: `#0369a1` (slate-blue, help text)

**Contrast Requirements** (WCAG AA minimum)
- All text on color backgrounds: 4.5:1 ratio (normal text) or 3:1 (large text, 18pt+)
- Use tools: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) before finalizing

### Typography

Type accounts for 85-90% of design; get this right.

**Font Stack** (global, professional)
- Headings: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (system fonts load fastest globally)
- Body: Same stack (consistency matters for B2B)
- Monospace (specs, code): `'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace`

**Hierarchy** (sizes + weights)
```
h1: 32px (500 weight) — page title
h2: 24px (600 weight) — section header
h3: 20px (600 weight) — subsection
h4: 18px (600 weight) — component header
body: 16px (400 weight) — paragraph text
small: 14px (400 weight) — captions, metadata
tiny: 12px (400 weight) — helper text, badges

Minimum line-height: 1.5 (body), 1.3 (headings)
Letter-spacing: 0 (body), -0.01em (headings, optional tightening)
```

**Font Loading** (critical for global performance)
- Load only 2 weights per font family (regular 400, bold 600/700)
- Use `font-display: swap` to prevent invisible text
- Avoid system fonts downloads; they load locally
- If using custom fonts, serve via CDN with `preload` link tags

```html
<!-- In <head>, preload critical fonts -->
<link rel="preload" href="/fonts/system-500.woff2" as="font" type="font/woff2" crossorigin />
```

### Spacing Scale

Establish a modular scale for all margins, padding, gaps. This reduces CSS bloat and ensures alignment.

```
Token    CSS Value    Usage
--sp-0   0px         Reset
--sp-1   4px         Tight inner padding, icon gaps
--sp-2   8px         Component padding, small gaps
--sp-3   12px        Default padding (buttons, inputs)
--sp-4   16px        Section padding, card margins
--sp-6   24px        Large gaps, component separation
--sp-8   32px        Section separation
--sp-10  40px        Major section breaks
--sp-12  48px        Full-page padding
--sp-16  64px        Hero padding, top-level sections
```

**Rule**: Never hardcode pixel values outside this scale. If you need 18px, that's a scale problem—document it and add the token.

---

## II. Internationalization (i18n) Architecture

### Strategy Overview

The website must support 12–15 languages, primarily for APAC, EMEA, and Americas regions. Use a structured, scalable approach.

**Technologies**
- **Framework**: [vue-i18n](https://vue-i18n.intlify.dev/) (if Vue) or [react-i18next](https://www.i18next.com/) (if React)
- **Translation Storage**: JSON files, organized by locale (not inline strings)
- **Locale Detection**: Browser language + explicit user picker (stored in localStorage)
- **Fallback Chain**: User selection → Browser language → Default locale (English)

### File Structure

```
/src
  /locales
    /en.json        # English (base language)
    /es.json        # Spanish
    /fr.json        # French
    /de.json        # German
    /ar.json        # Arabic (RTL)
    /zh-cn.json     # Simplified Chinese
    /ja.json        # Japanese
    /pt-br.json     # Brazilian Portuguese
    /... (others)
```

### Translation File Format

```json
{
  "common": {
    "currency": "USD",
    "language": "English"
  },
  "header": {
    "home": "Home",
    "products": "Products",
    "contact": "Contact Us"
  },
  "product": {
    "priceLabel": "Price per unit",
    "quantity": "Quantity",
    "addToCart": "Add to Cart",
    "requestQuote": "Request Quote"
  },
  "forms": {
    "name": "Full Name",
    "email": "Email Address",
    "phone": "Phone Number",
    "country": "Country"
  }
}
```

**Critical Rule**: Do NOT translate technical terms, brand names, product SKUs, or trade-specific jargon (e.g., "incoterm", "FOB") unless the target market has a localized equivalent. Verify with Alex.

### Locale Detection & Switching

```javascript
// Pseudo-code: Locale initialization
export function initLocale() {
  const saved = localStorage.getItem('locale');
  if (saved && SUPPORTED_LOCALES.includes(saved)) {
    return saved;
  }
  
  const browserLang = navigator.language.split('-')[0]; // "en", "ar", etc.
  if (SUPPORTED_LOCALES.includes(browserLang)) {
    return browserLang;
  }
  
  return 'en'; // Default fallback
}

// Switching locales
function setLocale(newLocale) {
  if (!SUPPORTED_LOCALES.includes(newLocale)) return;
  localStorage.setItem('locale', newLocale);
  document.documentElement.lang = newLocale;
  document.documentElement.dir = RTL_LOCALES.includes(newLocale) ? 'rtl' : 'ltr';
  i18n.locale.value = newLocale;
  // Trigger re-render; adjust syntax per framework
}
```

### Named Locales

Store alongside locale code for UI display:
```javascript
const LOCALES = {
  'en': { name: 'English', native: 'English', rtl: false },
  'es': { name: 'Spanish', native: 'Español', rtl: false },
  'ar': { name: 'Arabic', native: 'العربية', rtl: true },
  'zh-cn': { name: 'Chinese (Simplified)', native: '简体中文', rtl: false },
};
```

---

## III. RTL (Right-to-Left) Language Support

RTL languages (Arabic, Hebrew, Urdu, Persian, etc.) require layout mirroring AND careful text handling. This is non-optional for international reach.

### Core Setup

**HTML Document**
```html
<html lang="ar" dir="rtl">
  <!-- or dynamically: dir="{{ locale.rtl ? 'rtl' : 'ltr' }}" -->
</html>
```

**CSS Logical Properties** (the modern approach—highly recommended)

Logical properties adapt automatically based on `dir` attribute. Use them instead of `left`/`right` for nearly all layout.

```css
/* Logical Properties Cheatsheet */
/* LTR: start=left, end=right | RTL: start=right, end=left */

.card {
  padding: var(--sp-4);
  margin-block-start: var(--sp-3);    /* margin-top in LTR, same in RTL */
  padding-inline-start: var(--sp-4);  /* padding-left in LTR, padding-right in RTL */
  padding-inline-end: var(--sp-2);    /* padding-right in LTR, padding-left in RTL */
  border-inline-start: 3px solid blue; /* left border in LTR, right in RTL */
  text-align: start;                   /* left in LTR, right in RTL */
}

.button {
  margin-inline-end: auto;  /* Aligns button to the start in both directions */
}

.icon-with-text {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  /* In LTR: icon left, text right. In RTL: icon right, text left (automatic!) */
}
```

**Flexbox & Grid (automatically RTL-aware)**

Flexbox and CSS Grid respect `dir` attribute automatically. No changes needed:
```css
.row {
  display: flex;
  gap: var(--sp-4);
  /* LTR: items flow left-to-right. RTL: items flow right-to-left automatically. */
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  /* Grid cells auto-reverse in RTL context. */
}
```

**Avoid absolute positional properties**
```css
/* ❌ DON'T DO THIS */
.sidebar {
  position: absolute;
  left: 0;  /* Breaks in RTL */
}

/* ✅ DO THIS */
.sidebar {
  position: absolute;
  inset-inline-start: 0;  /* Logical property: left in LTR, right in RTL */
}
```

### Bidrectional Text (Bidi)

When mixing LTR and RTL text (e.g., English brand name in Arabic), use `<bdi>` or `<span dir="auto">`:

```html
<!-- Product card with mixed text -->
<h3>
  <bdi>TradeMaster Pro</bdi> — أداة إدارة التجارة
</h3>

<!-- Phone number with international prefix -->
<p>+966 <bdi>55 1234 5678</bdi></p>
```

### Rotation & Transforms (directional awareness)

Animations and transforms that rely on direction require conditional logic:

```css
/* Icon rotation example */
.expand-icon {
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

/* In LTR, rotate clockwise; in RTL, rotate counter-clockwise for visual consistency */
[dir="rtl"] .expand-icon {
  transform: scaleX(-1);  /* Flip horizontally */
}

.expand-icon.open {
  [dir="ltr"] & {
    transform: rotate(90deg);
  }
  
  [dir="rtl"] & {
    transform: scaleX(-1) rotate(-90deg);
  }
}
```

### RTL Testing Checklist
- [ ] Navigation flows right-to-left visually
- [ ] Images with text are not simply mirrored (content intent preserved)
- [ ] Floats and absolute positioning use logical properties
- [ ] Icons that suggest direction (arrows, etc.) are rotated or conditionally rendered
- [ ] Tables and lists scan naturally in RTL
- [ ] Form fields and inputs align correctly
- [ ] Borders and shadows maintain visual hierarchy

---

## IV. Multi-Currency Display

B2B trade spans dozens of currencies. Display must be accurate, locale-aware, and not misleading.

### Implementation Using Intl.NumberFormat

**Setup** (create once, reuse)

```javascript
// currencyFormatter.js
export const formatters = new Map();

export function getCurrencyFormatter(locale, currency) {
  const key = `${locale}-${currency}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return formatters.get(key);
}

export function formatPrice(amount, locale, currency) {
  const formatter = getCurrencyFormatter(locale, currency);
  return formatter.format(amount);
}
```

**Usage in Components**

```javascript
// Example: Product card displaying price in multiple currencies
const product = {
  name: 'Premium Steel Ingot',
  priceUSD: 450.00,
  priceEUR: 415.00,
  priceAED: 1650.00,
};

const currentLocale = 'en-US';
const displayPrice = formatPrice(product.priceUSD, currentLocale, 'USD');
// Output: "$450.00"

// In Saudi Arabia
const saudiLocale = 'ar-SA';
const saudiPrice = formatPrice(product.priceAED, saudiLocale, 'AED');
// Output: "1,650.00 د.إ" (Arabic numerals, RTL-aware currency symbol)
```

### Common Currency Symbol Placement by Region

| Locale | Currency | Example Output | Notes |
|--------|----------|-----------------|-------|
| en-US | USD | $450.00 | Symbol before |
| de-DE | EUR | 415,00 € | Symbol after, comma decimal |
| fr-FR | EUR | 415,00 € | Symbol after, space before |
| ja-JP | JPY | ¥415 | Symbol before, no decimals |
| ar-SA | AED | 1,650.00 د.إ | Symbol after, RTL numerals |
| ru-RU | RUB | 415,00 ₽ | Symbol after, comma decimal |
| zh-CN | CNY | ¥415.00 | Symbol before |

**Rule**: Always verify with locale-specific tests. Never assume placement.

### Hiding Prices for B2B

In B2B trade, prices are often negotiated or tiered. Provide a way to hide prices and show "Request Quote" instead:

```html
<!-- Template: Conditional price display -->
<div class="product-price">
  <template v-if="product.showPrice">
    <span class="price">{{ formatPrice(product.price, locale, currency) }}</span>
    <span class="unit">/{{ product.unit }}</span>
  </template>
  <template v-else>
    <button class="cta-quote">Request Quote</button>
  </template>
</div>
```

### Decimal & Grouping Conventions

Intl.NumberFormat handles these, but be aware:
- US/UK: 1,234.56 (comma for thousands, period for decimal)
- Germany/France: 1.234,56 or 1 234,56 (period/space for thousands, comma for decimal)
- India: 12,34,567.89 (Indian numbering system)

Let the Intl API handle it. Never hardcode.

---

## V. Responsive Design Rules

### Design Approach

**Desktop-First Mentality**: Most B2B decision-makers research on desktop, but do NOT ignore mobile. 50% of B2B web traffic is now mobile (during commutes, between meetings).

**Content-Driven Breakpoints**: Don't design for specific devices. Design where your *content* naturally breaks.

### Breakpoint Scale

Use CSS custom properties for consistency:

```css
:root {
  --breakpoint-sm: 640px;   /* Large phones, 1-column layouts */
  --breakpoint-md: 768px;   /* Tablets, 2-column layouts */
  --breakpoint-lg: 1024px;  /* Desktops, 3-4 column layouts */
  --breakpoint-xl: 1280px;  /* Large desktops, 4+ columns */
  --breakpoint-2xl: 1536px; /* Ultra-wide, max-width constraint */
}

/* Mobile-first media queries */
@media (min-width: 640px) { /* 'sm' and up */ }
@media (min-width: 768px) { /* 'md' and up */ }
@media (min-width: 1024px) { /* 'lg' and up */ }
@media (min-width: 1280px) { /* 'xl' and up */ }
```

### Layout Patterns for Trade Sites

**Product Grid** (3-4 columns on desktop, 2 on tablet, 1 on mobile)
```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--sp-6);
}

@media (min-width: 1024px) {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 768px) {
  grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-4);
}

@media (max-width: 640px) {
  grid-template-columns: 1fr;
}
```

**Specification Table** (horizontal scroll on mobile, normal on desktop)
```css
.spec-table {
  overflow-x: auto;  /* Allow horizontal scroll on small screens */
  -webkit-overflow-scrolling: touch;  /* Smooth momentum scrolling on iOS */
}

@media (min-width: 768px) {
  overflow-x: visible;
}
```

**Navigation** (hamburger on mobile, horizontal on desktop)
```css
.nav-menu {
  display: none;  /* Hidden on mobile */
}

.nav-toggle {
  display: block;  /* Visible on mobile */
}

@media (min-width: 768px) {
  .nav-menu {
    display: flex;
  }
  
  .nav-toggle {
    display: none;
  }
}
```

### Container Queries (modern alternative to media queries)

For modular components that adapt regardless of viewport, use CSS container queries:

```css
@container (min-width: 400px) {
  .product-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@container (min-width: 600px) {
  .product-card {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Touch-Friendly Sizing

Mobile users need larger tap targets. WCAG recommends minimum 44x44px (logical pixels).

```css
.button {
  min-height: 44px;
  min-width: 44px;
  padding: var(--sp-3) var(--sp-4);
}

.form-input {
  min-height: 44px;
  padding: var(--sp-2) var(--sp-3);
}

/* Spacing around interactive elements */
.icon-button + .icon-button {
  margin-inline-start: var(--sp-2);  /* 16px gap minimum */
}
```

---

## VI. Component Reference

### Product Card

**Purpose**: Display a single product with image, title, price, specs summary, and CTA.

**States**: Normal, Hover, Focus, Active, Disabled, Loading

**HTML Structure** (semantic)
```html
<article class="product-card" aria-label="Premium Steel Ingot">
  <a href="/products/steel-ingot-premium" class="product-link">
    <div class="product-image">
      <img 
        src="/images/ingot-large.webp"
        alt="Premium Steel Ingot 10kg"
        loading="lazy"
        width="280"
        height="280"
      />
      <span class="badge-new">New</span>
    </div>
    
    <div class="product-content">
      <h3 class="product-title">Premium Steel Ingot</h3>
      <p class="product-sku">SKU: PSI-10-2024</p>
      
      <div class="product-specs">
        <span class="spec-item">
          <span class="spec-label">Weight:</span>
          <span class="spec-value">10 kg</span>
        </span>
        <span class="spec-item">
          <span class="spec-label">Purity:</span>
          <span class="spec-value">99.8%</span>
        </span>
      </div>
      
      <div class="product-footer">
        <div class="product-price">
          <span class="price" aria-label="Price: $450 per unit">
            $450.00
          </span>
          <span class="unit">/unit</span>
        </div>
        <button class="btn btn-primary">Request Quote</button>
      </div>
    </div>
  </a>
</article>
```

**CSS** (with RTL & responsive)
```css
.product-card {
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  background: white;
}

.product-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.product-card:focus-within {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.product-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.product-image {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: #f9fafb;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.badge-new {
  position: absolute;
  inset-inline-start: var(--sp-2);
  inset-block-start: var(--sp-2);
  background: var(--color-accent);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  z-index: 10;
}

.product-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: var(--sp-4);
}

.product-title {
  margin: 0 0 var(--sp-1) 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
}

.product-sku {
  margin: 0 0 var(--sp-3) 0;
  font-size: 12px;
  color: var(--color-gray-600);
  font-family: monospace;
}

.product-specs {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-bottom: auto;
  padding-bottom: var(--sp-3);
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

.spec-item {
  display: flex;
  justify-content: space-between;
}

.spec-label {
  color: var(--color-gray-600);
  font-weight: 500;
}

.spec-value {
  color: var(--color-text);
  font-weight: 600;
}

.product-footer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.product-price {
  display: flex;
  align-items: baseline;
  gap: var(--sp-1);
}

.price {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.unit {
  font-size: 12px;
  color: var(--color-gray-600);
}

.btn {
  min-height: 44px;
  padding: var(--sp-2) var(--sp-3);
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: #0d2847;
  transform: scale(1.02);
}

.btn-primary:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.btn-primary:active {
  transform: scale(0.98);
}

/* Responsive: Stack differently on smaller screens */
@media (max-width: 640px) {
  .product-card {
    flex-direction: row;
    gap: var(--sp-3);
  }
  
  .product-image {
    aspect-ratio: auto;
    width: 120px;
    min-width: 120px;
    height: 120px;
  }
}
```

### Specification Table (for detailed product specs)

**HTML**
```html
<figure class="spec-table-wrapper">
  <figcaption class="sr-only">Product Specifications</figcaption>
  <table class="spec-table">
    <thead>
      <tr>
        <th scope="col">Property</th>
        <th scope="col">Value</th>
        <th scope="col">Unit</th>
        <th scope="col">Standard</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td data-label="Property">Density</td>
        <td data-label="Value">7.85</td>
        <td data-label="Unit">g/cm³</td>
        <td data-label="Standard">ISO 1035</td>
      </tr>
      <tr>
        <td data-label="Property">Tensile Strength</td>
        <td data-label="Value">400–500</td>
        <td data-label="Unit">MPa</td>
        <td data-label="Standard">ASTM A29</td>
      </tr>
    </tbody>
  </table>
</figure>
```

**CSS** (with responsive horizontal scroll)
```css
.spec-table-wrapper {
  margin: var(--sp-6) 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.spec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.spec-table thead {
  background: var(--color-primary);
  color: white;
}

.spec-table th {
  padding: var(--sp-3);
  text-align: start;
  font-weight: 600;
  border-bottom: 2px solid var(--color-primary);
}

.spec-table td {
  padding: var(--sp-3);
  border-bottom: 1px solid #e5e7eb;
}

.spec-table tbody tr:hover {
  background: #f9fafb;
}

@media (max-width: 768px) {
  .spec-table thead {
    display: none;
  }
  
  .spec-table tbody,
  .spec-table tr {
    display: block;
  }
  
  .spec-table tr {
    margin-bottom: var(--sp-4);
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: var(--sp-3);
  }
  
  .spec-table td {
    display: flex;
    justify-content: space-between;
    padding: var(--sp-2) 0;
    border: none;
  }
  
  .spec-table td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--color-gray-600);
  }
  
  .spec-table tbody tr:hover {
    background: white;
  }
}
```

### RFQ (Request for Quote) Form

**Purpose**: Capture lead information and product interest; keep minimal (8 fields max).

**HTML Structure**
```html
<form class="rfq-form" action="/api/rfq" method="POST" aria-label="Request for Quote">
  <fieldset>
    <legend class="sr-only">Your Details</legend>
    
    <!-- Name -->
    <div class="form-group">
      <label for="fullname" class="form-label">
        Full Name <span aria-label="required">*</span>
      </label>
      <input
        id="fullname"
        type="text"
        name="fullName"
        class="form-input"
        required
        minlength="2"
        aria-required="true"
        aria-describedby="fullname-help"
      />
      <small id="fullname-help" class="form-hint">Your full legal name</small>
    </div>
    
    <!-- Email -->
    <div class="form-group">
      <label for="email" class="form-label">
        Email Address <span aria-label="required">*</span>
      </label>
      <input
        id="email"
        type="email"
        name="email"
        class="form-input"
        required
        aria-required="true"
      />
    </div>
    
    <!-- Country -->
    <div class="form-group">
      <label for="country" class="form-label">
        Country <span aria-label="required">*</span>
      </label>
      <select
        id="country"
        name="country"
        class="form-input"
        required
        aria-required="true"
      >
        <option value="">— Select a country —</option>
        <option value="US">United States</option>
        <option value="GB">United Kingdom</option>
        <option value="SA">Saudi Arabia</option>
        <option value="AE">United Arab Emirates</option>
        <option value="CN">China</option>
        <!-- ... more countries ... -->
      </select>
    </div>
    
    <!-- Phone (international) -->
    <div class="form-group">
      <label for="phone" class="form-label">
        Phone Number <span aria-label="required">*</span>
      </label>
      <div class="phone-input-wrapper">
        <select id="countrycode" name="countryCode" class="phone-country-select" aria-label="Country code">
          <option value="+1">+1 (US)</option>
          <option value="+44">+44 (UK)</option>
          <option value="+966">+966 (SA)</option>
          <option value="+971">+971 (AE)</option>
          <option value="+86">+86 (China)</option>
        </select>
        <input
          id="phone"
          type="tel"
          name="phone"
          class="form-input"
          placeholder="555 123 4567"
          required
          aria-required="true"
        />
      </div>
      <small class="form-hint">Include area code; we'll format automatically</small>
    </div>
    
    <!-- Company -->
    <div class="form-group">
      <label for="company" class="form-label">Company Name</label>
      <input
        id="company"
        type="text"
        name="company"
        class="form-input"
      />
    </div>
    
    <!-- Product Interest -->
    <div class="form-group">
      <label for="product" class="form-label">
        Product Interest <span aria-label="required">*</span>
      </label>
      <select
        id="product"
        name="product"
        class="form-input"
        required
        aria-required="true"
      >
        <option value="">— Select a product category —</option>
        <option value="steel">Steel & Metals</option>
        <option value="chemicals">Chemicals & Petrochemicals</option>
        <option value="textiles">Textiles & Fabrics</option>
        <option value="electronics">Electronics & Components</option>
      </select>
    </div>
    
    <!-- Message -->
    <div class="form-group">
      <label for="message" class="form-label">Additional Details</label>
      <textarea
        id="message"
        name="message"
        class="form-input form-textarea"
        rows="4"
        placeholder="Quantity needed, delivery timeline, specific requirements..."
      ></textarea>
    </div>
  </fieldset>
  
  <!-- Privacy & Consent -->
  <div class="form-group form-checkbox">
    <input
      id="consent"
      type="checkbox"
      name="consent"
      required
      aria-required="true"
    />
    <label for="consent" class="form-label">
      I agree to be contacted regarding this quote request.
      <a href="/privacy">Privacy Policy</a>
    </label>
  </div>
  
  <!-- Submit -->
  <div class="form-actions">
    <button type="submit" class="btn btn-primary btn-lg" aria-busy="false">
      Request Quote
    </button>
    <p class="form-note">
      <strong>Response time:</strong> We typically respond within 24 hours.
    </p>
  </div>
</form>
```

**CSS**
```css
.rfq-form {
  max-width: 600px;
  margin: var(--sp-8) 0;
}

.form-group {
  margin-bottom: var(--sp-6);
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--sp-2);
  color: var(--color-text);
}

.form-label span {
  color: var(--color-error);
  margin-inline-start: 2px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  font-size: 16px; /* Prevents zoom on iOS */
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: var(--color-text);
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 54, 93, 0.1);
}

.form-input:invalid,
.form-textarea:invalid {
  border-color: var(--color-error);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.form-hint {
  display: block;
  margin-top: var(--sp-1);
  font-size: 12px;
  color: var(--color-gray-600);
}

.phone-input-wrapper {
  display: flex;
  gap: var(--sp-2);
}

.phone-country-select {
  flex: 0 0 120px;
  padding: var(--sp-2) var(--sp-2);
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.form-checkbox {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-start;
}

.form-checkbox input[type="checkbox"] {
  margin-top: 4px;
  min-width: 20px;
  min-height: 20px;
}

.form-checkbox label {
  margin-bottom: 0;
  line-height: 1.5;
}

.form-checkbox a {
  color: var(--color-primary);
  text-decoration: underline;
}

.form-actions {
  margin-top: var(--sp-8);
}

.btn-lg {
  min-height: 48px;
  font-size: 16px;
  padding: var(--sp-3) var(--sp-6);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-note {
  margin-top: var(--sp-3);
  font-size: 12px;
  color: var(--color-gray-600);
}

/* Validation states */
.form-input:invalid:not(:placeholder-shown)::after {
  content: ' ✗';
  color: var(--color-error);
}

/* Responsive: Full-width on mobile */
@media (max-width: 768px) {
  .rfq-form {
    margin: var(--sp-6) 0;
  }
  
  .form-group {
    margin-bottom: var(--sp-4);
  }
  
  .form-label {
    font-size: 16px; /* Prevents zoom on iOS */
  }
  
  .form-input,
  .form-textarea {
    font-size: 16px; /* Prevents zoom on iOS */
  }
}
```

**JavaScript** (Phone formatting, country detection)
```javascript
// Phone number auto-formatting
const phoneInput = document.getElementById('phone');
const countrySelect = document.getElementById('countrycode');

phoneInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
  
  // Format as: (555) 123-4567
  if (value.length > 0) {
    if (value.length <= 3) {
      value = `(${value}`;
    } else if (value.length <= 6) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    } else {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
    }
  }
  
  e.target.value = value;
});

// Detect user's country and pre-select
fetch('/api/geoip')
  .then((r) => r.json())
  .then((data) => {
    const countryCode = data.countryCode.toUpperCase();
    const option = Array.from(countrySelect.options).find(
      (opt) => opt.value === countryCode
    );
    if (option) option.selected = true;
  })
  .catch(() => {
    /* Fallback: keep default */
  });
```

### Trust Badges & Certification Section

**Purpose**: Display third-party validations (ISO, BBB, industry memberships, client logos).

**HTML**
```html
<section class="trust-badges" aria-label="Certifications and Memberships">
  <h2 class="trust-title">Trusted by Industry Leaders</h2>
  
  <div class="badges-grid">
    <!-- ISO Certification -->
    <div class="badge-item">
      <img
        src="/images/iso-9001.svg"
        alt="ISO 9001:2015 Certified"
        width="80"
        height="80"
        loading="lazy"
      />
      <p class="badge-label">ISO 9001:2015</p>
    </div>
    
    <!-- BBB Accreditation -->
    <div class="badge-item">
      <img
        src="/images/bbb-accredited.svg"
        alt="Better Business Bureau Accredited A+ Rating"
        width="80"
        height="80"
        loading="lazy"
      />
      <p class="badge-label">BBB Accredited</p>
    </div>
    
    <!-- Industry Association -->
    <div class="badge-item">
      <img
        src="/images/imex-member.svg"
        alt="International Materials Exchange Member"
        width="80"
        height="80"
        loading="lazy"
      />
      <p class="badge-label">IMEX Member</p>
    </div>
    
    <!-- Secure Payment -->
    <div class="badge-item">
      <img
        src="/images/ssl-secure.svg"
        alt="SSL Secure - Encrypted Transactions"
        width="80"
        height="80"
        loading="lazy"
      />
      <p class="badge-label">SSL Secured</p>
    </div>
  </div>
  
  <!-- Client Logos -->
  <div class="clients-section">
    <h3 class="clients-title">Trusted by Global Partners</h3>
    <div class="clients-grid">
      <img src="/images/client-logo-1.svg" alt="Global Trading Corp" width="120" height="60" loading="lazy" />
      <img src="/images/client-logo-2.svg" alt="Premium Materials Ltd" width="120" height="60" loading="lazy" />
      <img src="/images/client-logo-3.svg" alt="Industrial Group Inc" width="120" height="60" loading="lazy" />
      <img src="/images/client-logo-4.svg" alt="Trade Partners Global" width="120" height="60" loading="lazy" />
    </div>
  </div>
</section>
```

**CSS**
```css
.trust-badges {
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  padding: var(--sp-12);
  border-radius: 12px;
  margin: var(--sp-12) 0;
}

.trust-title {
  margin: 0 0 var(--sp-8) 0;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  color: var(--color-text);
}

.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--sp-6);
  margin-bottom: var(--sp-12);
}

.badge-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4);
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
  text-align: center;
}

.badge-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.badge-item img {
  width: auto;
  height: 60px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.05));
}

.badge-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-700);
  line-height: 1.3;
}

.clients-section {
  border-top: 1px solid #e5e7eb;
  padding-top: var(--sp-8);
}

.clients-title {
  margin: 0 0 var(--sp-6) 0;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  color: var(--color-text);
}

.clients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--sp-6);
}

.clients-grid img {
  height: 60px;
  object-fit: contain;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.clients-grid img:hover {
  opacity: 1;
}

@media (max-width: 768px) {
  .trust-badges {
    padding: var(--sp-6);
    margin: var(--sp-8) 0;
  }
  
  .trust-title {
    font-size: 20px;
    margin-bottom: var(--sp-6);
  }
  
  .badges-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-4);
    margin-bottom: var(--sp-8);
  }
  
  .clients-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

## VII. Form Design for International Users

### Phone Number Input

**Best Practice**: Use a country selector + auto-formatting

```html
<div class="phone-field">
  <label for="phone">Phone Number *</label>
  <div class="phone-input-group">
    <select id="country-code" class="country-code-select">
      <option value="1">+1 (US/Canada)</option>
      <option value="44">+44 (UK)</option>
      <option value="966">+966 (Saudi Arabia)</option>
      <option value="971">+971 (UAE)</option>
      <option value="86">+86 (China)</option>
    </select>
    <input
      id="phone"
      type="tel"
      placeholder="555 123 4567"
      inputmode="tel"
      autocomplete="tel"
    />
  </div>
  <small>Phone numbers are automatically formatted.</small>
</div>
```

**JavaScript Validation** (server-side is mandatory)

```javascript
// Client-side: format only; server validates with libphonenumber
function formatPhoneNumber(value, countryCode) {
  const digitsOnly = value.replace(/\D/g, '');
  
  if (countryCode === '1') {
    // US/Canada format: (555) 123-4567
    return digitsOnly
      .replace(/^(\d{3})/, '($1) ')
      .replace(/(\d{3}) (\d{3})/, '$1-$2');
  }
  
  // Fallback: minimal formatting
  return digitsOnly.slice(0, 15);
}
```

**Server-side Validation** (example: Node.js with libphonenumber)

```javascript
const phoneUtil = require('libphonenumber-js');

function validatePhone(phoneNumber, countryCode) {
  const phone = phoneUtil.parsePhoneNumber(phoneNumber, countryCode);
  
  if (!phone || !phoneUtil.isValidPhoneNumber(phone)) {
    throw new Error('Invalid phone number for the selected country.');
  }
  
  return phone.number; // E.164 format: +1234567890
}
```

### Address Input

**Strategy**: Conditional fields based on selected country

```html
<form class="address-form">
  <div class="form-group">
    <label for="country">Country *</label>
    <select id="country" name="country" required>
      <option value="">— Select —</option>
      <option value="US">United States</option>
      <option value="GB">United Kingdom</option>
      <option value="SA">Saudi Arabia</option>
      <option value="JP">Japan</option>
      <option value="AU">Australia</option>
    </select>
  </div>
  
  <div class="form-group">
    <label for="street">Street Address *</label>
    <input id="street" type="text" name="street" required />
  </div>
  
  <div class="form-group">
    <label for="city">City *</label>
    <input id="city" type="text" name="city" required />
  </div>
  
  <!-- State/Province (show only if applicable) -->
  <div id="state-group" class="form-group" style="display: none;">
    <label for="state">State / Province</label>
    <input id="state" type="text" name="state" />
  </div>
  
  <!-- Postal Code (label varies by country) -->
  <div class="form-group">
    <label id="postal-label" for="postal">Postal Code</label>
    <input id="postal" type="text" name="postal" />
    <small id="postal-help" class="form-hint"></small>
  </div>
</form>
```

**JavaScript** (Conditional field display)

```javascript
const COUNTRY_ADDRESS_FORMATS = {
  US: {
    hasState: true,
    stateLabel: 'State',
    postalLabel: 'ZIP Code',
    postalPlaceholder: '12345',
  },
  GB: {
    hasState: false,
    postalLabel: 'Postcode',
    postalPlaceholder: 'SW1A 1AA',
  },
  SA: {
    hasState: false,
    postalLabel: 'Postal Code',
    postalPlaceholder: '12345',
  },
  JP: {
    hasState: false,
    postalLabel: 'Postal Code',
    postalPlaceholder: '100-0001',
  },
};

const countrySelect = document.getElementById('country');
const stateGroup = document.getElementById('state-group');
const postalLabel = document.getElementById('postal-label');
const postalHelp = document.getElementById('postal-help');

countrySelect.addEventListener('change', (e) => {
  const format = COUNTRY_ADDRESS_FORMATS[e.target.value];
  
  if (!format) return;
  
  // Show/hide state field
  stateGroup.style.display = format.hasState ? 'block' : 'none';
  
  // Update postal label & help text
  postalLabel.textContent = format.postalLabel;
  postalHelp.textContent = `Example: ${format.postalPlaceholder}`;
});
```

### Name Field Conventions

**Avoid**: Separate "First Name" and "Last Name" fields. Not all cultures follow this pattern.

```html
<!-- ❌ DON'T -->
<input type="text" name="firstName" placeholder="First Name" />
<input type="text" name="lastName" placeholder="Last Name" />

<!-- ✅ DO -->
<input type="text" name="fullName" placeholder="Full Name" />
```

---

## VIII. Performance Requirements

### Core Web Vitals Targets (2025)

Google ranks sites based on these metrics. Meet these thresholds for top performance:

| Metric | Target | Impact |
|--------|--------|--------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | Page feels responsive |
| **INP** (Interaction to Next Paint) | ≤ 200ms | User input feels snappy |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | No content jumping around |

**Testing**: Use [Google PageSpeed Insights](https://pagespeed.web.dev/) (tests real user data) and [Web Vitals extension](https://chrome.google.com/webstore/detail/web-vitals/) for local testing.

### Image Optimization Strategy

**Modern formats** (AVIF > WebP > JPEG/PNG)
```html
<picture>
  <source srcset="image.avif" type="image/avif" />
  <source srcset="image.webp" type="image/webp" />
  <img src="image.jpg" alt="Description" loading="lazy" />
</picture>
```

**File Size Targets**
- Hero images: < 200 KB (all formats combined)
- Product thumbnails: < 50 KB
- Card images: < 80 KB
- Use tools: [TinyPNG](https://tinypng.com/) or [ImageOptim](https://imageoptim.com/)

**Lazy Loading** (only for below-fold content)
```html
<!-- Don't lazy-load above-the-fold images (hurts LCP) -->
<img src="hero.webp" alt="Hero" width="1200" height="600" />

<!-- Lazy-load below-fold images -->
<img
  src="product-2.webp"
  alt="Product"
  loading="lazy"
  width="280"
  height="280"
/>
```

### Font Loading Strategy

**Critical Rule**: Fonts are render-blocking. Minimize impact.

```css
/* Load only 2 weights: regular (400) and bold (700) */
@font-face {
  font-family: 'System';
  font-display: swap; /* Show fallback immediately, swap when loaded */
}

/* If using custom fonts, limit to one typeface */
@font-face {
  font-family: 'CustomSerif';
  src: url('/fonts/serif-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'CustomSerif';
  src: url('/fonts/serif-700.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
```

**Preload critical fonts in <head>**
```html
<link rel="preload" href="/fonts/serif-400.woff2" as="font" type="font/woff2" crossorigin />
```

### CSS & JavaScript Bundle Optimization

**Target**: ≤ 50 KB gzipped (CSS + JS combined for initial page load)

- **Remove unused CSS**: Use PurgeCSS or Tailwind's built-in purging
- **Code-split** heavy features (modals, image galleries) loaded on-demand
- **Tree-shake** unused library code
- **Minify** all production assets

### Global CDN Strategy

For an international audience, use a CDN to serve assets from edge servers close to users.

**Recommended**: Cloudflare, AWS CloudFront, or Fastly

```html
<!-- Example: Serve images from CDN -->
<img src="https://cdn.tradingco.com/images/product-1.webp" alt="Product" />
```

**Cache Headers** (set on server)
```
Static assets (images, fonts, JS): max-age=31536000 (1 year)
HTML: max-age=3600 (1 hour)
API responses: max-age=300 (5 minutes) or no-cache
```

### Real-User Monitoring (RUM)

Install analytics to track real performance (not just lab tests):

```javascript
// Example: Web Vitals library
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log); // Cumulative Layout Shift
getFID(console.log); // First Input Delay (deprecated; use INP)
getFCP(console.log); // First Contentful Paint
getLCP(console.log); // Largest Contentful Paint
getTTFB(console.log); // Time to First Byte
```

---

## IX. Accessibility Checklist (WCAG 2.2 Level AA)

This is legally required in most markets; non-negotiable.

### Foundational Requirements
- [ ] Semantic HTML: `<nav>`, `<main>`, `<article>`, `<button>` (not `<div onclick>`)
- [ ] Color contrast: 4.5:1 for normal text, 3:1 for large text
- [ ] No color-only information conveyance (use icons + text, or patterns)
- [ ] Keyboard navigation: All interactive elements reachable via Tab
- [ ] Focus indicators: Visible outlines on focusable elements
- [ ] Focus trap: Modal dialogs trap keyboard focus; escape key dismisses

### Images & Media
- [ ] All images have descriptive `alt` text
- [ ] Decorative images use `alt=""` or hidden from screen readers (`aria-hidden="true"`)
- [ ] Video has captions and transcripts
- [ ] Audio has transcripts

### Forms
- [ ] Every form input has an associated `<label>`
- [ ] Error messages linked to inputs via `aria-describedby`
- [ ] Required fields marked with `aria-required="true"`
- [ ] Error identification on submit, not just color
- [ ] Form instructions visible before input

### Navigation & Landmarks
- [ ] Skip-to-main link (visible when focused)
- [ ] Unique page title in `<title>` tag
- [ ] Heading hierarchy: h1, h2, h3 (no skipping levels)
- [ ] Landmark regions: `<header>`, `<nav>`, `<main>`, `<footer>`
- [ ] Lists use semantic `<ul>`, `<ol>` tags

### Interactive Components
- [ ] Buttons have visible `:focus` state (not just `:hover`)
- [ ] Links are underlined or have other clear visual indicator (not color alone)
- [ ] Dropdown menus open on Enter/Space, close on Escape
- [ ] Modals announce purpose on open, restore focus on close
- [ ] Tooltips: Keyboard accessible, not hover-only

### Text & Readability
- [ ] Language declared on page: `<html lang="en">`
- [ ] Line length ≤ 80 characters (readability)
- [ ] Line height ≥ 1.5 (spacing)
- [ ] No justified text (creates uneven word spacing)
- [ ] Avoid all-caps text (harder to read)

### Testing Tools
- [WAVE](https://wave.webaim.org/) — Visual error detection
- [Axe DevTools](https://www.deque.com/axe/devtools/) — Chrome extension
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) — Built into Chrome DevTools
- Screen reader testing: [NVDA](https://www.nvaccess.org/) (Windows) or [VoiceOver](https://www.apple.com/accessibility/voiceover/) (Mac)

---

## X. Mobile Checklist

50% of B2B traffic is now mobile. Don't deprioritize it.

### Layout & Touch
- [ ] Viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] Touch targets ≥ 44x44px (CSS pixels)
- [ ] Touch target spacing ≥ 8px between elements
- [ ] No horizontal scrolling on mobile
- [ ] Safe area insets respected on notched devices

### Input
- [ ] Phone field: `inputmode="tel"` + country picker
- [ ] Email field: `inputmode="email"`, `type="email"`
- [ ] Number field: `inputmode="numeric"` for better mobile keyboard
- [ ] Avoid pinch-to-zoom prevention (`user-scalable=no` is deprecated; don't use)

### Forms on Mobile
- [ ] Labels above inputs (not floating labels on small screens)
- [ ] Buttons full width or at least 48px tall
- [ ] Form fields don't hide when keyboard appears (scroll into view)
- [ ] Mobile-optimized country/state pickers (dropdowns are clunky; consider autocomplete)

### Images & Media
- [ ] Optimize for slow networks (2G/3G targets still common in developing markets)
- [ ] Lazy-load off-screen images
- [ ] Responsive image sizes: `<picture>` with multiple sources
- [ ] Test on real devices (emulation isn't enough)

### Navigation
- [ ] Hamburger menu labeled "Menu" (not just icon)
- [ ] Menu doesn't auto-close on navigation; let user close it
- [ ] Navigation accessible without scrolling to top
- [ ] Breadcrumbs on sub-pages for wayfinding

### Performance on Mobile
- [ ] Test on slow networks: Chrome DevTools → Network → Slow 3G
- [ ] First page load ≤ 3 seconds on 4G
- [ ] Interactive page ≤ 5 seconds on 4G
- [ ] Don't block rendering on third-party scripts (ads, chat, analytics)

---

## XI. Animation & Interaction Standards

Animations must enhance, never distract. Professional B2B sites use restraint.

### Hover States (Desktop Only)

```css
.interactive:hover {
  cursor: pointer;
  /* Subtle elevation or color shift */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

/* No hover on mobile */
@media (hover: none) {
  .interactive:hover {
    box-shadow: none;
  }
}
```

### Focus States (All Devices)

```css
.interactive:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove browser default outline on mouse/touch activation */
.interactive:focus:not(:focus-visible) {
  outline: none;
}
```

### Transitions & Animations

```css
/* General rule: Keep animations under 300ms */
.button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Entrance animations (fade-in, slide-up) */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.card {
  animation: fadeIn 0.3s ease-out;
}
```

### Scroll Behavior

```css
/* Smooth scrolling for in-page links */
html {
  scroll-behavior: smooth;
}

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

---

## XII. Items That Block Development

**STOP and escalate to Alex immediately** if you encounter any of these:

1. **Regulatory/Compliance Issues**
   - Unclear export control restrictions for target markets
   - Sanctions compliance (OFAC, EU, etc.)
   - Data privacy requirements not documented (GDPR, CCPA, etc.)
   - Payment processing in restricted currencies/regions

2. **Payment Integration**
   - Credit card or financial data requested in forms (use only PCI-DSS compliant payment gateways)
   - Unclear payment processor choice (Stripe? Wise? Local gateway?)
   - Multi-currency billing logic not defined

3. **Brand/Legal Risks**
   - Third-party content (client logos, case studies) without verified permission
   - Accuracy of product certifications or claims not verified
   - Pricing discrepancies across regions (legal exposure)
   - Terms of service / privacy policy not finalized

4. **Scope Creep**
   - Feature requests conflicting with current roadmap
   - "Just add..." requests that require back-end changes
   - Requests to support features not in approved design system

5. **Missing Infrastructure**
   - i18n translation files not ready
   - CDN not configured
   - API endpoints not available for testing
   - Database schema not finalized

6. **Performance Concerns**
   - Can't meet Core Web Vitals thresholds due to third-party scripts
   - Image optimization tooling not in place
   - Back-end queries too slow (investigate, don't mask)

**Response Pattern**: "I've found [issue]. This blocks [what]. We need [decision/information] from [owner] before I can proceed. Should I flag this to Alex?"

---

## XIII. Code Standards

### Commit Messages

Reference files and line numbers. Example:

```
Add RTL support to product card component

- Use CSS logical properties (padding-inline-start, etc.)
- Update .product-card in /src/components/product-card.css:18-45
- Add dir="rtl" support test in /src/tests/product-card.test.js
- Verify in Arabic locale ✓
```

### Component Naming

Use consistent, semantic names:
- Button: `.btn`, `.btn-primary`, `.btn-secondary`
- Cards: `.card`, `.product-card`, `.trust-badge`
- Forms: `.form-group`, `.form-input`, `.form-label`
- Layout: `.container`, `.section`, `.hero`

### CSS Organization

```css
/* Structure: Reset → Variables → Utility → Components → Responsive */

/* 1. Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 2. CSS Custom Properties (design tokens) */
:root {
  --color-primary: #1a365d;
  --sp-4: 16px;
  /* ... */
}

/* 3. Base styles */
body {
  font-family: system-ui;
  line-height: 1.5;
}

/* 4. Components */
.button {
  /* ... */
}

/* 5. Responsive overrides */
@media (max-width: 768px) {
  /* ... */
}
```

### HTML Semantics

```html
<!-- ✅ Good: Semantic structure -->
<main>
  <article>
    <h1>Product Title</h1>
    <figure>
      <img src="..." alt="..." />
      <figcaption>Image description</figcaption>
    </figure>
    <section>
      <h2>Specifications</h2>
      <table>
        <!-- ... -->
      </table>
    </section>
  </article>
</main>

<!-- ❌ Bad: Divitis -->
<div id="main">
  <div id="article">
    <div id="title">Product Title</div>
    <!-- ... -->
  </div>
</div>
```

---

## Quick Reference: Common Tasks

### "Add a New Language"
1. Create `/src/locales/[locale].json` with translations
2. Add locale to `SUPPORTED_LOCALES` array
3. Test locale picker switches language without page reload
4. Test RTL if language is Arabic, Hebrew, Urdu, etc.
5. Verify currency display for target market

### "Fix Contrast Issue"
1. Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
2. Adjust background color, text color, or font size
3. Test with WAVE or Axe DevTools
4. Retest on mobile devices (different lighting conditions)

### "Optimize Image Performance"
1. Export in multiple formats: AVIF, WebP, JPEG/PNG
2. Compress with TinyPNG or ImageOptim
3. Wrap in `<picture>` tag with fallback
4. Add `loading="lazy"` for below-fold images (NOT above-fold)
5. Test on slow network: Chrome DevTools → Network → Slow 3G

### "Add a New Product Card Variant"
1. Extend `.product-card` base styles
2. Create new class: `.product-card-compact` or `.product-card-featured`
3. Override only necessary properties (avoid duplication)
4. Test in all locales and breakpoints
5. Ensure all interactive elements have `:focus` states

### "Test Accessibility"
1. Run Lighthouse (Chrome DevTools → Lighthouse)
2. Run Axe DevTools on all pages
3. Test keyboard navigation: Tab through page, all elements reachable
4. Test with screen reader: NVDA (Windows) or VoiceOver (Mac)
5. Verify color contrast: 4.5:1 minimum

---

## Resources & References

- [MDN Web Docs](https://developer.mozilla.org/) — Authoritative web standards
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) — Accessibility standards
- [Web.dev](https://web.dev/) — Google's web performance guides
- [Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) — Currency formatting
- [CSS Logical Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties) — RTL support
- [vue-i18n](https://vue-i18n.intlify.dev/) or [react-i18next](https://www.i18next.com/) — Internationalization
- [ImageOptim](https://imageoptim.com/) or [TinyPNG](https://tinypng.com/) — Image compression
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) — Performance testing
- [WAVE](https://wave.webaim.org/) — Accessibility auditing

---

## Revision Log

- **2026-04-09**: Initial version. Covers B2B design, i18n, RTL, multi-currency, performance, accessibility, responsive design, and component patterns for international trade website.

---

**Last Updated**: 2026-04-09  
**Version**: 1.0  
**Audience**: Front-end developers, code reviewers, AI agents
