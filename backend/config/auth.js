require('dotenv').config();

// Validate required secrets at startup
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set!');
  console.error('Please set JWT_SECRET in your .env file.');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_REFRESH_SECRET environment variable is not set!');
  console.error('Please set JWT_REFRESH_SECRET in your .env file.');
  process.exit(1);
}

module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY || '24h'
  },
  jwtRefresh: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiry: process.env.JWT_REFRESH_EXPIRY || '30d'
  },
  roles: {
    ADMIN: 'admin',
    SALES: 'sales',
    OPERATIONS: 'operations',
    FINANCE: 'finance',
    INSPECTOR: 'inspector',
    CUSTOMER: 'customer',
    FACTORY: 'factory'
  },
  rolePermissions: {
    admin: ['*'],
    sales: ['inquiries', 'quotations', 'quotations:generate', 'proforma_invoices', 'customers', 'notifications'],
    operations: ['sales_orders', 'purchase_orders', 'packing_lists', 'shipments', 'inventory', 'notifications'],
    finance: ['invoices', 'payments', 'reports', 'customers:view', 'notifications'],
    inspector: ['inspections', 'sales_orders:view', 'purchase_orders:view', 'notifications'],
    customer: ['notifications', 'sales_orders:own', 'shipments:own', 'invoices:own'],
    factory: ['notifications', 'purchase_orders:own', 'products:own', 'inspections:own']
  },
  bcrypt: {
    saltRounds: 10
  }
};
