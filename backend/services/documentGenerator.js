// Barrel: re-exports all PDF generators for backward compatibility.
// Split introduced by #48 — all existing importers are unchanged.
module.exports = {
  ...require('./pdf/salesDocumentsPDF'),
  ...require('./pdf/orderDocumentsPDF'),
  ...require('./pdf/financeDocumentsPDF'),
  ...require('./pdf/logisticsDocumentsPDF'),
};
