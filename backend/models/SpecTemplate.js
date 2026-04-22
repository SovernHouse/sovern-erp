const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SpecTemplate = sequelize.define('SpecTemplate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Template name (e.g., "SPC Standard Plank Template")'
    },
    flooringType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Flooring type: SPC, WPC, LVT, Laminate, Engineered Wood, Solid Wood, Bamboo, Vinyl Dry Back'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed description of the template'
    },

    // ── Construction ──
    coreType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default core type'
    },
    construction: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Default construction type'
    },

    // ── Dimensions ──
    dimensionLength: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Default plank length in mm'
    },
    dimensionWidth: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Default plank width in mm'
    },
    dimensionThickness: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Default total thickness in mm'
    },
    wearLayerThickness: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Default wear layer thickness in mm'
    },
    wearLayerMil: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Default wear layer in mil'
    },

    // ── Performance ──
    acRating: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Default AC rating'
    },
    waterproof: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Default waterproof status'
    },
    fireRating: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Default fire rating'
    },
    slipRating: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Default slip rating'
    },

    // ── Surface ──
    surfaceFinish: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default surface finish'
    },
    surfaceTexture: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default surface texture'
    },
    edgeType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default edge type'
    },

    // ── Wood-Specific ──
    woodSpecies: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Default wood species'
    },
    woodGrade: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Default wood grade'
    },

    // ── Installation ──
    installationMethod: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Default installation method'
    },
    clickSystem: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default click system'
    },
    underlaymentRequired: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default underlayment requirement'
    },
    underlaymentType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Default underlayment type'
    },

    // ── Packaging ──
    sqftPerBox: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Default SF per box'
    },
    sqmPerBox: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Default SQM per box'
    },
    planksPerBox: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Default planks per box'
    },

    // ── Warranty ──
    warrantyResidential: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default residential warranty'
    },
    warrantyCommercial: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default commercial warranty'
    },
    certifications: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Default certifications (JSON stringified array)',
      get() {
        const value = this.getDataValue('certifications');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('certifications', value ? JSON.stringify(value) : null);
      }
    },

    // ── Format ──
    format: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Default format (Plank, Herringbone, etc.)'
    },

    // ── Meta ──
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether the template is active'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      },
      comment: 'User ID who created the template'
    }
  }, {
    tableName: 'spec_templates',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['flooring_type'] },
      { fields: ['is_active'] },
      { fields: ['created_by'] }
    ]
  });

  return SpecTemplate;
};
