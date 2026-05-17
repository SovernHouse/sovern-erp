export const ROLE_PERMISSIONS = {
  super_admin: ['*'], // everything — founder/CEO level
  admin: ['*'], // everything
  manager: [
    'dashboard',
    'customers',
    'factories',
    'products',
    'inquiries',
    'quotations',
    'proforma',
    'orders',
    'purchase-orders',
    'shipments',
    'inspections',
    'claims',
    'invoices',
    'payments',
    'reports',
    'analytics',
    'bi-dashboard',
    'inventory',
    'documents',
  ],
  sales: [
    'dashboard',
    'customers',
    'inquiries',
    'quotations',
    'proforma',
    'orders',
    'products',
    'reports',
    'outreach',
  ],
  operations: [
    'dashboard',
    'factories',
    'purchase-orders',
    'shipments',
    'inspections',
    'inventory',
    'products',
  ],
  finance: ['dashboard', 'invoices', 'payments', 'reports', 'analytics', 'bi-dashboard', 'customers'],
  warehouse: ['dashboard', 'inventory', 'shipments', 'products'],
  quality: ['dashboard', 'inspections', 'claims', 'factories'],
  viewer: ['dashboard', 'reports'],

  // ── Business-title roles (map to access patterns above) ──────────────────
  // These are the roles you assign to actual staff members.

  ceo: [
    'dashboard', 'customers', 'factories', 'products', 'inquiries', 'quotations',
    'proforma', 'orders', 'purchase-orders', 'packing-lists', 'shipments', 'inspections',
    'claims', 'invoices', 'payments', 'reports', 'analytics', 'bi-dashboard',
    'inventory', 'documents', 'outreach',
    // Note: no 'settings' — admins manage user accounts and config, not executives
  ],
  coo: [
    'dashboard', 'customers', 'factories', 'products', 'inquiries', 'quotations',
    'proforma', 'orders', 'purchase-orders', 'packing-lists', 'shipments', 'inspections',
    'claims', 'invoices', 'payments', 'reports', 'analytics', 'bi-dashboard',
    'inventory', 'documents', 'outreach',
  ],
  sales_rep: [
    'dashboard', 'customers', 'inquiries', 'quotations', 'proforma', 'orders',
    'products', 'reports', 'outreach',
    // No: purchase-orders, factories, invoices, payments, analytics — protect cost/supplier data
  ],
  project_manager: [
    'dashboard', 'customers', 'orders', 'factories', 'products', 'purchase-orders',
    'packing-lists', 'shipments', 'inspections', 'inventory', 'documents', 'reports',
  ],
  accountant: [
    'dashboard', 'customers', 'invoices', 'payments', 'claims', 'orders',
    'reports', 'analytics', 'bi-dashboard', 'documents',
  ],
  cashier: [
    'dashboard', 'payments', 'invoices',
    // Payments only — no access to cost data, orders detail, or reports
  ],
  office_manager: [
    'dashboard', 'customers', 'inquiries', 'quotations', 'proforma', 'orders',
    'products', 'documents', 'reports',
  ],
  procurement_officer: [
    'dashboard', 'factories', 'products', 'purchase-orders', 'packing-lists',
    'shipments', 'inspections', 'inventory', 'documents',
  ],
  logistics_coordinator: [
    'dashboard', 'shipments', 'packing-lists', 'inspections', 'inventory',
    'documents', 'orders',
  ],
  qc_inspector: [
    'dashboard', 'inspections', 'claims', 'factories', 'products', 'documents',
  ],
  customer_service: [
    'dashboard', 'customers', 'inquiries', 'orders', 'claims', 'documents', 'reports',
  ],
  compliance_officer: [
    'dashboard', 'inspections', 'claims', 'factories', 'products', 'shipments',
    'documents', 'reports',
  ],
}

export const NAV_ITEMS_BY_ROLE = {
  admin: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    // ── Sales & Customer Management ──────────────────────────────────────
    {
      label: 'Sales',
      icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Quotations', path: '/quotations', permission: 'quotations' },
        { label: 'Proforma Invoices', path: '/proforma-invoices', permission: 'proforma' },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    {
      label: 'Business Development',
      icon: 'Users2',
      submenu: [
        { label: 'CRM Dashboard', path: '/crm', permission: 'outreach' },
        { label: 'Leads', path: '/crm/leads', permission: 'outreach' },
        { label: 'Pipeline', path: '/crm/pipeline', permission: 'outreach' },
        { label: 'Activities', path: '/crm/activities', permission: 'outreach' },
        { label: 'Supplier Contacts', path: '/crm/contacts', permission: 'outreach' },
        { label: 'Email Inbox', path: '/crm/inbox', permission: 'outreach' },
        { label: 'Client Contacts', path: '/client-contacts', permission: 'outreach' },
      ],
    },
    // ── Supply Chain & Operations ────────────────────────────────────────
    {
      label: 'Procurement',
      icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        { label: 'Products', path: '/products', permission: 'products' },
        { label: 'Spec Templates', path: '/products/spec-templates', permission: 'products' },
        { label: 'Product Categories', path: '/settings/product-taxonomy', permission: 'settings' },
        { label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase-orders' },
      ],
    },
    {
      label: 'Logistics',
      icon: 'Truck',
      submenu: [
        { label: 'Packing Lists', path: '/packing-lists', permission: 'packing-lists' },
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    // ── Finance & Expenses ───────────────────────────────────────────────
    {
      label: 'Finance',
      icon: 'DollarSign',
      submenu: [
        { label: 'Invoices', path: '/invoices', permission: 'invoices' },
        { label: 'Payments', path: '/payments', permission: 'payments' },
        { label: 'Claims', path: '/claims', permission: 'claims' },
        { label: 'Expenses', path: '/expenses', permission: 'expenses' },
        { label: 'Approvals', path: '/internal-approvals', permission: 'approvals' },
      ],
    },
    // ── Intelligence & Analytics ─────────────────────────────────────────
    {
      label: 'Intelligence',
      icon: 'TrendingUp',
      submenu: [
        { label: 'Reports', path: '/reports', permission: 'reports' },
        { label: 'Analytics', path: '/analytics', permission: 'analytics' },
        { label: 'BI Dashboard', path: '/bi-dashboard', permission: 'bi-dashboard' },
        { label: 'AI Research', path: '/ai/research', permission: 'outreach' },
      ],
    },
    // ── Tools & Communication ────────────────────────────────────────────
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    // ── Administration ──────────────────────────────────────────────────────
    {
      label: 'Documents',
      icon: 'FileText',
      submenu: [
        { label: 'Document Templates', path: '/documents/templates', permission: 'documents' },
        { label: 'Google Drive', path: '/drive', roles: ['admin', 'manager'] },
      ],
    },
    {
      label: 'Settings',
      icon: 'Cog',
      submenu: [
        { label: 'General', path: '/settings', permission: 'settings' },
        { label: 'Users', path: '/settings/users', permission: 'settings' },
        { label: 'Role Permissions', path: '/settings/role-permissions', permission: 'settings' },
        { label: 'Email Templates', path: '/settings/email-templates', permission: 'settings' },
        { label: 'Email Signatures', path: '/settings/email-signatures', permission: 'settings' },
        { label: 'Product Attributes', path: '/settings/product-attributes', permission: 'settings' },
        { label: 'Product Taxonomy', path: '/settings/product-taxonomy', permission: 'settings' },
        { label: 'Price Lists', path: '/settings/price-lists', permission: 'settings' },
        { label: 'Bulk Import', path: '/settings/bulk-import', permission: 'settings' },
        { label: 'Mobile App', path: '/settings/mobile-app', permission: 'settings' },
        { label: 'Connected Accounts', path: '/settings/connected-accounts', roles: ['admin', 'super_admin'] },
      ],
    },
    // ── Dev Mode (super_admin only) ─────────────────────────────────────
    { label: 'Dev Mode runs', icon: 'Code', path: '/ai/dev-runs', roles: ['super_admin'] },
  ],
  manager: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales',
      icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Quotations', path: '/quotations', permission: 'quotations' },
        {
          label: 'Proforma Invoices',
          path: '/proforma-invoices',
          permission: 'proforma',
        },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    {
      label: 'Procurement',
      icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        { label: 'Products', path: '/products', permission: 'products' },
        {
          label: 'Purchase Orders',
          path: '/purchase-orders',
          permission: 'purchase-orders',
        },
      ],
    },
    {
      label: 'Logistics',
      icon: 'Truck',
      submenu: [
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    {
      label: 'Finance',
      icon: 'DollarSign',
      submenu: [
        { label: 'Invoices', path: '/invoices', permission: 'invoices' },
        { label: 'Payments', path: '/payments', permission: 'payments' },
        { label: 'Claims', path: '/claims', permission: 'claims' },
      ],
    },
    {
      label: 'Operations',
      icon: 'CheckCircle',
      submenu: [], // Inventory removed Phase 4.24 (no-stock business)
    },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    { label: 'Approvals', icon: 'CheckCircle', path: '/internal-approvals' },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
    { label: 'Analytics', icon: 'TrendingUp', path: '/analytics', permission: 'analytics' },
    { label: 'BI Dashboard', icon: 'BarChart3', path: '/bi-dashboard', permission: 'bi-dashboard' },
    {
      label: 'Documents',
      icon: 'FileText',
      submenu: [
        { label: 'Document Templates', path: '/documents/templates', permission: 'documents' },
        { label: 'Google Drive', path: '/drive', roles: ['admin', 'manager'] },
      ],
    },
  ],
  sales: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales',
      icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Quotations', path: '/quotations', permission: 'quotations' },
        {
          label: 'Proforma Invoices',
          path: '/proforma-invoices',
          permission: 'proforma',
        },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    {
      label: 'Products',
      icon: 'Package',
      path: '/products',
      permission: 'products',
    },
    {
      label: 'Outreach',
      icon: 'Users2',
      submenu: [
        { label: 'CRM Dashboard',   path: '/crm',              permission: 'outreach' },
        { label: 'Leads',           path: '/crm/leads',        permission: 'outreach' },
        { label: 'Pipeline',        path: '/crm/pipeline',     permission: 'outreach' },
        { label: 'Activities',      path: '/crm/activities',   permission: 'outreach' },
        { label: 'Supplier Contacts', path: '/crm/contacts',   permission: 'outreach' },
        { label: 'Email Inbox',     path: '/crm/inbox',        permission: 'outreach' },
        { label: 'Client Contacts', path: '/client-contacts',  permission: 'outreach' },
      ],
    },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
  ],
  operations: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Procurement',
      icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        {
          label: 'Purchase Orders',
          path: '/purchase-orders',
          permission: 'purchase-orders',
        },
      ],
    },
    {
      label: 'Logistics',
      icon: 'Truck',
      submenu: [
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    {
      label: 'Operations',
      icon: 'CheckCircle',
      submenu: [], // Inventory removed Phase 4.24 (no-stock business)
    },
    {
      label: 'Products',
      icon: 'Package',
      path: '/products',
      permission: 'products',
    },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
  ],
  finance: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Finance',
      icon: 'DollarSign',
      submenu: [
        { label: 'Invoices', path: '/invoices', permission: 'invoices' },
        { label: 'Payments', path: '/payments', permission: 'payments' },
      ],
    },
    {
      label: 'Customers',
      icon: 'Users',
      path: '/customers',
      permission: 'customers',
    },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
    { label: 'Analytics', icon: 'TrendingUp', path: '/analytics', permission: 'analytics' },
    { label: 'BI Dashboard', icon: 'BarChart3', path: '/bi-dashboard', permission: 'bi-dashboard' },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
  ],
  warehouse: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Logistics',
      icon: 'Truck',
      submenu: [
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
      ],
    },
    {
      label: 'Operations',
      icon: 'CheckCircle',
      submenu: [], // Inventory removed Phase 4.24 (no-stock business)
    },
    {
      label: 'Products',
      icon: 'Package',
      path: '/products',
      permission: 'products',
    },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
  ],
  quality: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Quality',
      icon: 'CheckCircle',
      submenu: [
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
        { label: 'Claims', path: '/claims', permission: 'claims' },
      ],
    },
    {
      label: 'Procurement',
      icon: 'Inbox',
      submenu: [{ label: 'Factories', path: '/factories', permission: 'factories' }],
    },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
  ],
  viewer: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
  ],

  // ── Business-title nav configs ────────────────────────────────────────────

  ceo: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales', icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Quotations', path: '/quotations', permission: 'quotations' },
        { label: 'Proforma Invoices', path: '/proforma-invoices', permission: 'proforma' },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    {
      label: 'Procurement', icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        { label: 'Products', path: '/products', permission: 'products' },
        { label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase-orders' },
      ],
    },
    {
      label: 'Logistics', icon: 'Truck',
      submenu: [
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    {
      label: 'Finance', icon: 'DollarSign',
      submenu: [
        { label: 'Invoices', path: '/invoices', permission: 'invoices' },
        { label: 'Payments', path: '/payments', permission: 'payments' },
        { label: 'Claims', path: '/claims', permission: 'claims' },
      ],
    },
    {
      label: 'Outreach', icon: 'Users2',
      submenu: [
        { label: 'CRM Dashboard',   path: '/crm',              permission: 'outreach' },
        { label: 'Leads',           path: '/crm/leads',        permission: 'outreach' },
        { label: 'Pipeline',        path: '/crm/pipeline',     permission: 'outreach' },
        { label: 'Activities',      path: '/crm/activities',   permission: 'outreach' },
        { label: 'Supplier Contacts', path: '/crm/contacts',   permission: 'outreach' },
        { label: 'Email Inbox',     path: '/crm/inbox',        permission: 'outreach' },
        { label: 'Client Contacts', path: '/client-contacts',  permission: 'outreach' },
      ],
    },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    { label: 'Approvals', icon: 'CheckCircle', path: '/internal-approvals' },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
    { label: 'Analytics', icon: 'TrendingUp', path: '/analytics', permission: 'analytics' },
    { label: 'BI Dashboard', icon: 'BarChart3', path: '/bi-dashboard', permission: 'bi-dashboard' },
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
  ],

  coo: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales', icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Quotations', path: '/quotations', permission: 'quotations' },
        { label: 'Proforma Invoices', path: '/proforma-invoices', permission: 'proforma' },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    {
      label: 'Procurement', icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        { label: 'Products', path: '/products', permission: 'products' },
        { label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase-orders' },
      ],
    },
    {
      label: 'Logistics', icon: 'Truck',
      submenu: [
        { label: 'Packing Lists', path: '/packing-lists', permission: 'packing-lists' },
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    {
      label: 'Finance', icon: 'DollarSign',
      submenu: [
        { label: 'Invoices', path: '/invoices', permission: 'invoices' },
        { label: 'Payments', path: '/payments', permission: 'payments' },
        { label: 'Claims', path: '/claims', permission: 'claims' },
      ],
    },
    {
      label: 'Outreach', icon: 'Users2',
      submenu: [
        { label: 'CRM Dashboard',   path: '/crm',              permission: 'outreach' },
        { label: 'Leads',           path: '/crm/leads',        permission: 'outreach' },
        { label: 'Pipeline',        path: '/crm/pipeline',     permission: 'outreach' },
        { label: 'Activities',      path: '/crm/activities',   permission: 'outreach' },
        { label: 'Supplier Contacts', path: '/crm/contacts',   permission: 'outreach' },
        { label: 'Email Inbox',     path: '/crm/inbox',        permission: 'outreach' },
        { label: 'Client Contacts', path: '/client-contacts',  permission: 'outreach' },
      ],
    },
    { label: 'Chat', icon: 'MessageCircle', path: '/chat' },
    { label: 'Approvals', icon: 'CheckCircle', path: '/internal-approvals' },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
    { label: 'Analytics', icon: 'TrendingUp', path: '/analytics', permission: 'analytics' },
    { label: 'BI Dashboard', icon: 'BarChart3', path: '/bi-dashboard', permission: 'bi-dashboard' },
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
  ],

  sales_rep: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales', icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Quotations', path: '/quotations', permission: 'quotations' },
        { label: 'Proforma Invoices', path: '/proforma-invoices', permission: 'proforma' },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    { label: 'Products', icon: 'Package', path: '/products', permission: 'products' },
    {
      label: 'Outreach', icon: 'Users2',
      submenu: [
        { label: 'CRM Dashboard',   path: '/crm',              permission: 'outreach' },
        { label: 'Leads',           path: '/crm/leads',        permission: 'outreach' },
        { label: 'Pipeline',        path: '/crm/pipeline',     permission: 'outreach' },
        { label: 'Activities',      path: '/crm/activities',   permission: 'outreach' },
        { label: 'Supplier Contacts', path: '/crm/contacts',   permission: 'outreach' },
        { label: 'Email Inbox',     path: '/crm/inbox',        permission: 'outreach' },
        { label: 'Client Contacts', path: '/client-contacts',  permission: 'outreach' },
      ],
    },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
    { label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' },
  ],

  project_manager: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales', icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    {
      label: 'Procurement', icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        { label: 'Products', path: '/products', permission: 'products' },
        { label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase-orders' },
      ],
    },
    {
      label: 'Logistics', icon: 'Truck',
      submenu: [
        { label: 'Packing Lists', path: '/packing-lists', permission: 'packing-lists' },
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    // Operations menu removed Phase 4.24 — its only item (Inventory) is gone.
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
  ],

  accountant: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Finance', icon: 'DollarSign',
      submenu: [
        { label: 'Invoices', path: '/invoices', permission: 'invoices' },
        { label: 'Payments', path: '/payments', permission: 'payments' },
        { label: 'Claims', path: '/claims', permission: 'claims' },
      ],
    },
    { label: 'Customers', icon: 'Users', path: '/customers', permission: 'customers' },
    { label: 'Sales Orders', icon: 'ShoppingCart', path: '/orders', permission: 'orders' },
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
    { label: 'Analytics', icon: 'TrendingUp', path: '/analytics', permission: 'analytics' },
    { label: 'BI Dashboard', icon: 'BarChart3', path: '/bi-dashboard', permission: 'bi-dashboard' },
  ],

  cashier: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Finance', icon: 'DollarSign',
      submenu: [
        { label: 'Invoices', path: '/invoices', permission: 'invoices' },
        { label: 'Payments', path: '/payments', permission: 'payments' },
      ],
    },
  ],

  office_manager: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales', icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Quotations', path: '/quotations', permission: 'quotations' },
        { label: 'Proforma Invoices', path: '/proforma-invoices', permission: 'proforma' },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    { label: 'Products', icon: 'Package', path: '/products', permission: 'products' },
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
  ],

  procurement_officer: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Procurement', icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        { label: 'Products', path: '/products', permission: 'products' },
        { label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase-orders' },
      ],
    },
    {
      label: 'Logistics', icon: 'Truck',
      submenu: [
        { label: 'Packing Lists', path: '/packing-lists', permission: 'packing-lists' },
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    // Operations menu removed Phase 4.24 — its only item (Inventory) is gone.
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
  ],

  logistics_coordinator: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    { label: 'Sales Orders', icon: 'ShoppingCart', path: '/orders', permission: 'orders' },
    {
      label: 'Logistics', icon: 'Truck',
      submenu: [
        { label: 'Packing Lists', path: '/packing-lists', permission: 'packing-lists' },
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    // Operations menu removed Phase 4.24 — its only item (Inventory) is gone.
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
  ],

  qc_inspector: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Quality', icon: 'CheckCircle',
      submenu: [
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
        { label: 'Claims', path: '/claims', permission: 'claims' },
      ],
    },
    { label: 'Factories', icon: 'Building2', path: '/factories', permission: 'factories' },
    { label: 'Products', icon: 'Package', path: '/products', permission: 'products' },
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
  ],

  customer_service: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Sales', icon: 'ShoppingCart',
      submenu: [
        { label: 'Customers', path: '/customers', permission: 'customers' },
        { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
        { label: 'Sales Orders', path: '/orders', permission: 'orders' },
      ],
    },
    { label: 'Claims', icon: 'AlertCircle', path: '/claims', permission: 'claims' },
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
  ],

  compliance_officer: [
    { label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' },
    {
      label: 'Procurement', icon: 'Inbox',
      submenu: [
        { label: 'Factories', path: '/factories', permission: 'factories' },
        { label: 'Products', path: '/products', permission: 'products' },
      ],
    },
    {
      label: 'Logistics', icon: 'Truck',
      submenu: [
        { label: 'Shipments', path: '/shipments', permission: 'shipments' },
        { label: 'Inspections', path: '/inspections', permission: 'inspections' },
      ],
    },
    { label: 'Claims', icon: 'AlertCircle', path: '/claims', permission: 'claims' },
    { label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' },
  ],
}

// Nav for roles not explicitly listed above — auto-build from permission strings
// Used as the fallback for custom roles and any new roles added via the permissions UI.
const buildNavFromPermissions = (permissions) => {
  const has = (key) => permissions.includes('*') || permissions.includes(key)
  const nav = []
  if (has('dashboard')) nav.push({ label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' })

  const salesItems = [
    has('customers')  && { label: 'Customers', path: '/customers', permission: 'customers' },
    has('inquiries')  && { label: 'Inquiries', path: '/inquiries', permission: 'inquiries' },
    has('quotations') && { label: 'Quotations', path: '/quotations', permission: 'quotations' },
    has('proforma')   && { label: 'Proforma Invoices', path: '/proforma-invoices', permission: 'proforma' },
    has('orders')     && { label: 'Sales Orders', path: '/orders', permission: 'orders' },
  ].filter(Boolean)
  if (salesItems.length) nav.push({ label: 'Sales', icon: 'ShoppingCart', submenu: salesItems })

  const procItems = [
    has('factories')       && { label: 'Factories', path: '/factories', permission: 'factories' },
    has('products')        && { label: 'Products', path: '/products', permission: 'products' },
    has('purchase-orders') && { label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase-orders' },
  ].filter(Boolean)
  if (procItems.length) nav.push({ label: 'Procurement', icon: 'Inbox', submenu: procItems })

  const logItems = [
    has('packing-lists') && { label: 'Packing Lists', path: '/packing-lists', permission: 'packing-lists' },
    has('shipments')     && { label: 'Shipments', path: '/shipments', permission: 'shipments' },
    has('inspections')   && { label: 'Inspections', path: '/inspections', permission: 'inspections' },
  ].filter(Boolean)
  if (logItems.length) nav.push({ label: 'Logistics', icon: 'Truck', submenu: logItems })

  const finItems = [
    has('invoices')  && { label: 'Invoices', path: '/invoices', permission: 'invoices' },
    has('payments')  && { label: 'Payments', path: '/payments', permission: 'payments' },
    has('claims')    && { label: 'Claims', path: '/claims', permission: 'claims' },
  ].filter(Boolean)
  if (finItems.length) nav.push({ label: 'Finance', icon: 'DollarSign', submenu: finItems })

  // Operations / Inventory removed Phase 4.24 (no-stock business). The
  // 'inventory' permission may still exist on legacy role rows; intentionally
  // not pushing anything for it here.
  if (has('outreach'))  nav.push({ label: 'Outreach', icon: 'Users2', submenu: [{ label: 'Client Contacts', path: '/client-contacts', permission: 'outreach' }] })
  if (has('reports'))   nav.push({ label: 'Reports', icon: 'BarChart3', path: '/reports', permission: 'reports' })
  if (has('analytics')) nav.push({ label: 'Analytics', icon: 'TrendingUp', path: '/analytics', permission: 'analytics' })
  if (has('bi-dashboard')) nav.push({ label: 'BI Dashboard', icon: 'BarChart3', path: '/bi-dashboard', permission: 'bi-dashboard' })
  if (has('documents')) nav.push({ label: 'Documents', icon: 'FileText', submenu: [{ label: 'Document Templates', path: '/documents/templates', permission: 'documents' }] })
  if (has('settings'))  nav.push({ label: 'Settings', icon: 'Cog', submenu: [
    { label: 'General', path: '/settings', permission: 'settings' },
    { label: 'Users', path: '/settings/users', permission: 'settings' },
    { label: 'Email Signatures', path: '/settings/email-signatures', permission: 'settings' },
    { label: 'Role Permissions', path: '/settings/role-permissions', permission: 'settings' },
    { label: 'Product Taxonomy', path: '/settings/product-taxonomy', permission: 'settings' },
    { label: 'Bulk Import', path: '/settings/bulk-import', permission: 'settings' },
    { label: 'Mobile App', path: '/settings/mobile-app', permission: 'settings' },
    { label: 'Connected Accounts', path: '/settings/connected-accounts', roles: ['admin', 'super_admin'] },
  ]})
  nav.push({ label: 'AI Assistant', icon: 'Sparkles', path: '/ai/assistant' })
  // AI Research (admin + super_admin — Tier 2 background sourcing audit).
  nav.push({ label: 'AI Research', icon: 'Search', path: '/ai/research', roles: ['super_admin', 'admin'] })
  // Expenses module (admin + super_admin — multi-currency expense tracking
  // with per-client P&L attribution).
  nav.push({ label: 'Expenses', icon: 'Receipt', path: '/expenses', roles: ['super_admin', 'admin'] })
  // Dev Mode runs (super_admin only — gated client-side here AND server-side
  // by requireRole('super_admin') in backend/routes/devModeRoutes.js).
  nav.push({ label: 'Dev Mode runs', icon: 'Code', path: '/ai/dev-runs', roles: ['super_admin'] })
  return nav
}

// Helper function to get allowed items for a specific role.
// If the role has a hardcoded nav, use it. Otherwise auto-build from permission strings.
export const getAllowedNavItems = (role, dynamicPermissions = null) => {
  const resolvedRole = role === 'super_admin' ? 'admin' : role
  if (NAV_ITEMS_BY_ROLE[resolvedRole]) return NAV_ITEMS_BY_ROLE[resolvedRole]
  // Dynamic fallback — used for custom roles loaded from the DB
  if (dynamicPermissions) return buildNavFromPermissions(dynamicPermissions)
  return [{ label: 'Dashboard', icon: 'Home', path: '/', permission: 'dashboard' }]
}

// Helper function to check if user can access a route
export const canAccessRoute = (userRole, requiredPermission, dynamicPermissions = null) => {
  const permissions = dynamicPermissions || ROLE_PERMISSIONS[userRole] || []
  return permissions.includes('*') || permissions.includes(requiredPermission)
}
