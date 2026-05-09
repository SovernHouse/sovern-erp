const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // Optional grouping for multi-day trips ("Vietnam Apr 2023" = 12 expense rows).
  // Used by exporters to render trip-level subtotals matching how the existing
  // inspector-travel sheet does monthly subtotal rows. Trip rows are not
  // required — a single one-off expense doesn't need one.
  const Trip = sequelize.define('Trip', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    purpose: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // When the whole trip was for one client, every expense row inherits this
    // attribution unless overridden at the row level.
    primaryCustomerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // When an inspector did the trip on Alex's behalf (matching the existing
    // "WJW" / "ZDC" / etc. tabs in the inspector travel expenses sheet).
    inspectorId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'Trips',
    timestamps: true,
    indexes: [
      { fields: ['start_date'] },
      { fields: ['primary_customer_id'] },
      { fields: ['inspector_id'] },
    ],
  });

  Trip.associate = (models) => {
    if (models.Customer) {
      Trip.belongsTo(models.Customer, { foreignKey: 'primaryCustomerId', as: 'primaryCustomer' });
    }
    if (models.User) {
      Trip.belongsTo(models.User, { foreignKey: 'inspectorId', as: 'inspector' });
    }
  };

  return Trip;
};
