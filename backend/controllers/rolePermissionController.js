const db = require('../models');

/**
 * Default role configurations.
 * These are seeded into the DB on first request if the table is empty.
 * Admins can override them via the UI; the DB values always win.
 */
const ROLE_DEFAULTS = [
  {
    role: 'admin',
    label: 'Admin',
    description: 'Full system access — all modules and settings',
    permissions: ['*'],
    isSystem: true,
    sortOrder: 1,
  },
  {
    role: 'ceo',
    label: 'CEO',
    description: 'Full read + analytics. Cannot manage users or system settings.',
    permissions: [
      'dashboard','customers','factories','products','inquiries','quotations',
      'proforma','orders','purchase-orders','packing-lists','shipments','inspections',
      'claims','invoices','payments','reports','analytics','bi-dashboard',
      'inventory','documents','outreach',
    ],
    isSystem: true,
    sortOrder: 2,
  },
  {
    role: 'coo',
    label: 'COO',
    description: 'Full operational access across all modules except system settings.',
    permissions: [
      'dashboard','customers','factories','products','inquiries','quotations',
      'proforma','orders','purchase-orders','packing-lists','shipments','inspections',
      'claims','invoices','payments','reports','analytics','bi-dashboard',
      'inventory','documents','outreach',
    ],
    isSystem: true,
    sortOrder: 3,
  },
  {
    role: 'sales_rep',
    label: 'Sales Rep',
    description: 'CRM, quotes, orders, and outreach. No cost/supplier visibility.',
    permissions: [
      'dashboard','customers','inquiries','quotations','proforma','orders',
      'products','reports','outreach',
    ],
    isSystem: true,
    sortOrder: 4,
  },
  {
    role: 'project_manager',
    label: 'Project Manager',
    description: 'Manages order execution — procurement, logistics, inspections.',
    permissions: [
      'dashboard','customers','orders','factories','products','purchase-orders',
      'packing-lists','shipments','inspections','inventory','documents','reports',
    ],
    isSystem: true,
    sortOrder: 5,
  },
  {
    role: 'accountant',
    label: 'Accountant',
    description: 'Full financial visibility — invoices, payments, claims, reports.',
    permissions: [
      'dashboard','customers','invoices','payments','claims','orders',
      'reports','analytics','bi-dashboard','documents',
    ],
    isSystem: true,
    sortOrder: 6,
  },
  {
    role: 'cashier',
    label: 'Cashier',
    description: 'Payments and invoice management only.',
    permissions: ['dashboard','payments','invoices'],
    isSystem: true,
    sortOrder: 7,
  },
  {
    role: 'office_manager',
    label: 'Office Manager',
    description: 'Customers, sales flow, documents. No financial detail or supplier data.',
    permissions: [
      'dashboard','customers','inquiries','quotations','proforma','orders',
      'products','documents','reports',
    ],
    isSystem: true,
    sortOrder: 8,
  },
  {
    role: 'procurement_officer',
    label: 'Procurement Officer',
    description: 'Factories, products, purchase orders, and incoming logistics.',
    permissions: [
      'dashboard','factories','products','purchase-orders','packing-lists',
      'shipments','inspections','inventory','documents',
    ],
    isSystem: true,
    sortOrder: 9,
  },
  {
    role: 'logistics_coordinator',
    label: 'Logistics Coordinator',
    description: 'Shipments, packing lists, GRN, and shipment documents.',
    permissions: [
      'dashboard','shipments','packing-lists','inspections','inventory',
      'documents','orders',
    ],
    isSystem: true,
    sortOrder: 10,
  },
  {
    role: 'qc_inspector',
    label: 'QC Inspector',
    description: 'Inspections, claims, and factory quality records.',
    permissions: [
      'dashboard','inspections','claims','factories','products','documents',
    ],
    isSystem: true,
    sortOrder: 11,
  },
  {
    role: 'customer_service',
    label: 'Customer Service',
    description: 'Customer-facing queries — orders, customers, inquiries, claims.',
    permissions: [
      'dashboard','customers','inquiries','orders','claims','documents','reports',
    ],
    isSystem: true,
    sortOrder: 12,
  },
  {
    role: 'compliance_officer',
    label: 'Compliance Officer',
    description: 'Trade compliance, sanctions, inspections, and document review.',
    permissions: [
      'dashboard','inspections','claims','factories','products','shipments',
      'documents','reports',
    ],
    isSystem: true,
    sortOrder: 13,
  },
  {
    role: 'viewer',
    label: 'Viewer',
    description: 'Read-only — dashboard and reports only.',
    permissions: ['dashboard','reports'],
    isSystem: true,
    sortOrder: 14,
  },
  // Legacy roles kept for backward compat
  {
    role: 'manager',
    label: 'Manager (legacy)',
    description: 'Legacy role — use COO for new assignments.',
    permissions: [
      'dashboard','customers','factories','products','inquiries','quotations',
      'proforma','orders','purchase-orders','shipments','inspections','claims',
      'invoices','payments','reports','analytics','bi-dashboard','inventory','documents',
    ],
    isSystem: false,
    sortOrder: 90,
  },
  {
    role: 'sales',
    label: 'Sales (legacy)',
    description: 'Legacy role — use Sales Rep for new assignments.',
    permissions: ['dashboard','customers','inquiries','quotations','proforma','orders','products','reports','outreach'],
    isSystem: false,
    sortOrder: 91,
  },
  {
    role: 'operations',
    label: 'Operations (legacy)',
    description: 'Legacy role — use Project Manager for new assignments.',
    permissions: ['dashboard','factories','purchase-orders','shipments','inspections','inventory','products'],
    isSystem: false,
    sortOrder: 92,
  },
  {
    role: 'finance',
    label: 'Finance (legacy)',
    description: 'Legacy role — use Accountant for new assignments.',
    permissions: ['dashboard','invoices','payments','reports','analytics','bi-dashboard','customers'],
    isSystem: false,
    sortOrder: 93,
  },
  {
    role: 'warehouse',
    label: 'Warehouse (legacy)',
    description: 'Legacy role for warehouse/inventory staff.',
    permissions: ['dashboard','inventory','shipments','products'],
    isSystem: false,
    sortOrder: 94,
  },
  {
    role: 'quality',
    label: 'Quality (legacy)',
    description: 'Legacy role — use QC Inspector for new assignments.',
    permissions: ['dashboard','inspections','claims','factories'],
    isSystem: false,
    sortOrder: 95,
  },
];

/**
 * Ensure defaults are seeded if the table is empty.
 */
const seedDefaults = async () => {
  const count = await db.RolePermission.count();
  if (count === 0) {
    await db.RolePermission.bulkCreate(ROLE_DEFAULTS);
  }
};

/**
 * GET /api/settings/role-permissions
 * Returns all role configs ordered by sortOrder.
 */
const getRolePermissions = async (req, res) => {
  try {
    await seedDefaults();
    const roles = await db.RolePermission.findAll({
      order: [['sortOrder', 'ASC'], ['role', 'ASC']],
    });
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/settings/role-permissions/:role
 * Update permissions for an existing role.
 * Body: { permissions: string[], label?: string, description?: string }
 */
const updateRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions, label, description } = req.body;

    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'The admin role cannot be modified.',
      });
    }

    const record = await db.RolePermission.findOne({ where: { role } });
    if (!record) {
      return res.status(404).json({ success: false, message: `Role "${role}" not found` });
    }

    const updates = {};
    if (permissions !== undefined) updates.permissions = permissions;
    if (label !== undefined) updates.label = label;
    if (description !== undefined) updates.description = description;

    await record.update(updates);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/settings/role-permissions
 * Create a new custom role.
 * Body: { role: string, label: string, description?: string, permissions: string[] }
 */
const createRolePermission = async (req, res) => {
  try {
    const { role, label, description, permissions } = req.body;

    if (!role || !label) {
      return res.status(400).json({ success: false, message: 'role and label are required' });
    }

    // Validate role slug
    if (!/^[a-z0-9_]+$/.test(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role slug must be lowercase letters, numbers, and underscores only',
      });
    }

    const existing = await db.RolePermission.findOne({ where: { role } });
    if (existing) {
      return res.status(409).json({ success: false, message: `Role "${role}" already exists` });
    }

    const record = await db.RolePermission.create({
      role,
      label,
      description: description || null,
      permissions: permissions || [],
      isSystem: false,
      isCustom: true,
      sortOrder: 50,
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/settings/role-permissions/:role
 * Delete a custom role (cannot delete system roles).
 */
const deleteRolePermission = async (req, res) => {
  try {
    const { role } = req.params;

    if (role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete the admin role.' });
    }

    const record = await db.RolePermission.findOne({ where: { role } });
    if (!record) {
      return res.status(404).json({ success: false, message: `Role "${role}" not found` });
    }

    if (record.isSystem) {
      return res.status(400).json({
        success: false,
        message: `"${record.label}" is a system role and cannot be deleted. You can modify its permissions instead.`,
      });
    }

    await record.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/settings/role-permissions/:role/reset
 * Reset a role's permissions to system defaults.
 */
const resetRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const defaults = ROLE_DEFAULTS.find(r => r.role === role);
    if (!defaults) {
      return res.status(404).json({ success: false, message: `No default configuration found for role "${role}"` });
    }

    const record = await db.RolePermission.findOne({ where: { role } });
    if (!record) {
      return res.status(404).json({ success: false, message: `Role "${role}" not found` });
    }

    await record.update({ permissions: defaults.permissions });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRolePermissions,
  updateRolePermissions,
  createRolePermission,
  deleteRolePermission,
  resetRolePermissions,
  ROLE_DEFAULTS,
};
