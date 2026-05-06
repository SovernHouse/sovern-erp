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
