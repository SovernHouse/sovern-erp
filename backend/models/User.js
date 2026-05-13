const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      lowercase: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM(
        // Core operational roles
        'admin', 'manager', 'sales', 'operations', 'finance', 'warehouse', 'quality', 'viewer',
        // Business title roles
        'ceo', 'coo', 'sales_rep', 'project_manager', 'accountant', 'cashier',
        'office_manager', 'procurement_officer', 'logistics_coordinator',
        'qc_inspector', 'customer_service', 'compliance_officer',
        // Legacy roles (kept for backward compatibility)
        'inspector', 'customer', 'factory'
      ),
      defaultValue: 'viewer'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        theme: 'light',
        language: 'en',
        notifications: true,
        emailNotifications: true
      }
    },
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // Multi-brand (Phase 1, D-4). Which brands this user can see + act on.
    // brandScope middleware (Commit 3) filters every list/get/mutate by this
    // array. super_admin role bypasses the filter for cross-brand reads.
    // Stored as JSON array of brand codes, raw per L-023.
    accessibleBrands: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: ['SH'],
    },
    // Pre-fills the BrandPicker on new-entity forms. User can still override
    // per-entity. Phase 1 wires the schema; Phase 2 reads it in UI.
    defaultBrand: {
      type: DataTypes.STRING(8),
      allowNull: true,
      defaultValue: 'SH',
    }
  }, {
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    },
    indexes: [
      { fields: ['email'] },
      { fields: ['role'] },
      { fields: ['is_active'] }
    ]
  });

  User.prototype.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password;
    delete values.resetToken;
    delete values.resetExpiry;
    return values;
  };

  return User;
};
