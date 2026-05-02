/**
 * Internal Approvals Module
 * Manager sign-off on staff-initiated actions.
 * Depends on Chatter for audit event logging.
 */

async function initInternalApprovals(app, sequelize, models, registry) {
  try {
    const internalApprovalRoutes = require('../../routes/internalApprovalRoutes');
    app.use('/api/internal-approvals', internalApprovalRoutes);

    registry.registerModel('internalApprovals', 'InternalApproval', models.InternalApproval);
    console.log('Internal Approvals module: routes and model registered');
  } catch (error) {
    console.warn('Internal Approvals module initialization warning:', error.message);
  }
}

module.exports = initInternalApprovals;
