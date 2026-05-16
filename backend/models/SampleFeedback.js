const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SampleFeedback = sequelize.define('SampleFeedback', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sampleRequestId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    feedbackDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    quality: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    packaging: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    delivery: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    issues: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    recommendations: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending_action', 'under_review', 'resolved', 'escalated'),
      defaultValue: 'pending_action'
    },
    followUpDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    sentByContactId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    handledBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['sample_request_id'] },
      { fields: ['rating'] },
      { fields: ['status'] },
      { fields: ['feedback_date'] }
    ]
  });

  return SampleFeedback;
};
