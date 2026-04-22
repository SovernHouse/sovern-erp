const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProformaInvoiceItem = sequelize.define('ProformaInvoiceItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    proformaInvoiceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ProformaInvoice',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
      defaultValue: 'sqm'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    }
  });

  return ProformaInvoiceItem;
};
