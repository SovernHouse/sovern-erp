/**
 * Internal Approvals Module
 * Manager sign-off on staff-initiated actions.
 * Depends on Chatter for audit event logging.
 */

async function initInternalApprovals(app, sequelize, models, registry) {
  try {
    const internalApprovalRoutes = require('../../routes/internalApprovalRoutes');
const logger = require('../../utils/logger.js');
    app.use('/api/internal-approvals', internalApprovalRoutes);

    registry.registerModel('internalApprovals', 'InternalApproval', models.InternalApproval);
    logger.info('Internal Approvals module: routes and model registered');
  } catch (error) {
    logger.warn('Internal Approvals module initialization warning:', error.message);
  }
}

module.exports = initI