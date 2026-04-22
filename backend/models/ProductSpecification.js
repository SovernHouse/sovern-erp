const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductSpecification = sequelize.define('ProductSpecification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: false,
      references: {
        model: 'Product',
        key: 'id'
      },
      comment: 'NULL indicates this is a template, non-NULL links to a product'
    },

    // ── Flooring Type & Construction ──
    flooringType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'SPC, WPC, LVT, Laminate, Engineered Wood, Solid Wood, Bamboo, Vinyl Dry Back'
    },
    coreType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Stone Plastic Composite, Wood Plastic Composite, HDF, Plywood, Solid Wood, None'
    },
    construction: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'For engineered: 2-ply, 3-ply, Multiply. For bamboo: Strand Woven, Horizontal, Vertical'
    },

    // ── Dimensions ──
    length: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Plank/board length in mm'
    },
    width: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Plank/board width in mm'
    },
    thickness: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Total thickness in mm'
    },
    wearLayerThickness: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Wear layer thickness in mm (e.g., 0.3, 0.5, 0.7 for vinyl; 2-6mm for engineered wood top layer)'
    },
    wearLayerMil: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Wear layer in mil (US measurement, e.g., 12, 20, 28 mil for vinyl)'
    },

    // ── Performance Ratings ──
    acRating: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'AC rating for laminate: AC1 (light residential) to AC5 (heavy commercial)'
    },
    waterproof: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Whether product is waterproof (true) or water-resistant (false)'
    },
    fireRating: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Fire rating class: Bfl-s1, Cfl-s1, etc.'
    },
    slipRating: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Slip resistance: R9, R10, R11 or COF value'
    },

    // ── Surface & Appearance ──
    surfaceFinish: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'EIR, Synchronized, Embossed, Matt, Piano, Crystal, Hand-scraped, Brushed, Oiled, Lacquered'
    },
    surfaceTexture: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Wood grain, Stone, Tile look, Hand scraped, Wire brushed, Smooth'
    },
    colorPattern: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Color name or pattern (e.g., Natural Oak, Grey Wash, Hickory Peppercorn)'
    },
    edgeType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Micro-bevel, Square edge, Painted bevel, V-groove, Beveled 4 sides'
    },

    // ── Wood-Specific ──
    woodSpecies: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'European Oak, American Oak, Black Walnut, Birch, Hickory, Maple, etc.'
    },
    woodGrade: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'AB, BC, CD, EF, Character, Select, Prime, Rustic'
    },

    // ── Installation ──
    installationMethod: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Click-lock, Glue-down, Nail-down, Floating, Loose Lay'
    },
    clickSystem: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Uniclick, Valinge, Drop-lock, Angle-angle, I4F, Uniclic'
    },
    underlaymentRequired: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Attached, Required, Optional, Not Required'
    },
    underlaymentType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'IXPE, Cork, EVA, EPE, Rubber, Foam'
    },

    // ── Packaging & Coverage ──
    sqftPerBox: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Square feet per box/package'
    },
    sqmPerBox: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Square meters per box/package'
    },
    planksPerBox: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Number of planks per box'
    },
    boxWeight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Box weight in kg'
    },

    // ── Warranty & Compliance ──
    warrantyResidential: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Residential warranty (e.g., Lifetime, 30 Years, 25 Years)'
    },
    warrantyCommercial: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Commercial warranty (e.g., 15 Years, 10 Years, 5 Years)'
    },
    certifications: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of certifications: FSC, EUDR, FloorScore, CARB2, CE, ISO 9001, etc.'
    },
    origin: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Country of origin/manufacturing'
    },

    // ── Format ──
    format: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Plank, Herringbone, Chevron, Wide Plank, Long Plank, Parquet'
    },

    // ── General ──
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    }
  }, {
    indexes: [
      { fields: ['product_id'], unique: true },
      { fields: ['flooring_type'] },
      { fields: ['ac_rating'] },
      { fields: ['waterproof'] }
    ]
  });

  return ProductSpecification;
};
