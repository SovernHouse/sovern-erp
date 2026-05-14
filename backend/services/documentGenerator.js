// Barrel: re-exports all PDF generators for backward compatibility.
// Split introduced by #48. All existing importers are unchanged.
//
// Phase 3, C9: generateQuotationPDF is overridden to route through the
// brand-aware dispatcher (FW + SH variants). All other generators keep
// pointing at the legacy salesDocumentsPDF / orderDocumentsPDF code paths
// until later phases.
const brandedQuotationRenderer = require('./pdf/brandedQuotationRenderer');

module.exports = {
  ...require('./pdf/salesDocumentsPDF'),
  ...require('./pdf/orderDocumentsPDF'),
  ...require('./pdf/financeDocumentsPDF'),
  ...require('./pdf/logisticsDocumentsPDF'),
  // Override after the spread so the brand-aware version wins.
  generateQuotationPDF: brandedQuotationRenderer.dispatch,
};
