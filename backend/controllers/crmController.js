// Barrel: re-exports all CRM sub-controllers for backward compatibility.
// Split introduced by #48 — backend/routes/crm.js is unchanged.
module.exports = {
  ...require('./contactController'),
  ...require('./leadController'),
  ...require('./activityController'),
  ...require('./dealController'),
  ...require('./campaignController'),
  ...require('./crmDashboardController'),
};
