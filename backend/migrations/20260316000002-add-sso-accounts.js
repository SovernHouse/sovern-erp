'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('SSOAccounts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      provider: {
        type: Sequelize.ENUM('google', 'microsoft'),
        allowNull: false
      },
      providerId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      providerEmail: {
        type: Sequelize.STRING,
        allowNull: true
      },
      accessToken: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      refreshToken: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('SSOAccounts', ['userId']);
    await queryInterface.addIndex('SSOAccounts', ['provider']);
    await queryInterface.addIndex('SSOAccounts', ['userId', 'provider'], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('SSOAccounts');
  }
};
