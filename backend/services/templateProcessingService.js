/**
 * Template Processing Service
 * Handles document template analysis, field mapping, and document generation
 */

const Handlebars = require('handlebars');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
});

Handlebars.registerHelper('formatCurrency', (amount, currency) => {
  if (!amount) return '$0.00';
  const curr = typeof currency === 'string' ? currency : 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amount);
});

Handlebars.registerHelper('formatNumber', (num, decimals) => {
  if (!num) return '0';
  const dec = typeof decimals === 'number' ? decimals : 2;
  return Number(num).toFixed(dec);
});

Handlebars.registerHelper('uppercase', (str) => str ? str.toUpperCase() : '');
Handlebars.registerHelper('lowercase', (str) => str ? str.toLowerCase() : '');
Handlebars.registerHelper('ifEquals', function(a, b, options) {
  return a === b ? options.fn(this) : options.inverse(this);
});

/**
 * Field definitions for each document type — defines available placeholders
 */
const DOCUMENT_FIELD_DEFINITIONS = {
  sales_order: {
    label: 'Sales Order',
    fields: [
      { name: 'orderNumber', label: 'Order Number', path: 'orderNumber', type: 'text' },
      { name: 'orderDate', label: 'Order Date', path: 'createdAt', type: 'date' },
      { name: 'status', label: 'Status', path: 'status', type: 'text' },
      { name: 'customerName', label: 'Customer Name', path: 'Customer.companyName', type: 'text' },
      { name: 'customerEmail', label: 'Customer Email', path: 'Customer.email', type: 'text' },
      { name: 'customerPhone', label: 'Customer Phone', path: 'Customer.phone', type: 'text' },
      { name: 'customerAddress', label: 'Customer Address', path: 'Customer.address', type: 'text' },
      { name: 'subtotal', label: 'Subtotal', path: 'subtotal', type: 'currency' },
      { name: 'tax', label: 'Tax', path: 'tax', type: 'currency' },
      { name: 'total', label: 'Total', path: 'total', type: 'currency' },
      { name: 'currency', label: 'Currency', path: 'currency', type: 'text' },
      { name: 'notes', label: 'Notes', path: 'notes', type: 'text' },
      { name: 'items', label: 'Line Items', path: 'items', type: 'array' },
    ]
  },
  purchase_order: {
    label: 'Purchase Order',
    fields: [
      { name: 'poNumber', label: 'PO Number', path: 'poNumber', type: 'text' },
      { name: 'poDate', label: 'PO Date', path: 'createdAt', type: 'date' },
      { name: 'status', label: 'Status', path: 'status', type: 'text' },
      { name: 'factoryName', label: 'Factory Name', path: 'Factory.name', type: 'text' },
      { name: 'factoryEmail', label: 'Factory Email', path: 'Factory.email', type: 'text' },
      { name: 'factoryCountry', label: 'Factory Country', path: 'Factory.country', type: 'text' },
      { name: 'subtotal', label: 'Subtotal', path: 'subtotal', type: 'currency' },
      { name: 'total', label: 'Total', path: 'total', type: 'currency' },
      { name: 'currency', label: 'Currency', path: 'currency', type: 'text' },
      { name: 'expectedDelivery', label: 'Expected Delivery', path: 'expectedDelivery', type: 'date' },
      { name: 'notes', label: 'Notes', path: 'notes', type: 'text' },
      { name: 'items', label: 'Line Items', path: 'items', type: 'array' },
    ]
  },
  invoice: {
    label: 'Invoice',
    fields: [
      { name: 'invoiceNumber', label: 'Invoice Number', path: 'invoiceNumber', type: 'text' },
      { name: 'invoiceDate', label: 'Invoice Date', path: 'createdAt', type: 'date' },
      { name: 'dueDate', label: 'Due Date', path: 'dueDate', type: 'date' },
      { name: 'status', label: 'Status', path: 'status', type: 'text' },
      { name: 'customerName', label: 'Customer Name', path: 'Customer.companyName', type: 'text' },
      { name: 'customerEmail', label: 'Customer Email', path: 'Customer.email', type: 'text' },
      { name: 'subtotal', label: 'Subtotal', path: 'subtotal', type: 'currency' },
      { name: 'tax', label: 'Tax', path: 'tax', type: 'currency' },
      { name: 'total', label: 'Total', path: 'total', type: 'currency' },
      { name: 'currency', label: 'Currency', path: 'currency', type: 'text' },
      { name: 'paymentTerms', label: 'Payment Terms', path: 'paymentTerms', type: 'text' },
      { name: 'items', label: 'Line Items', path: 'items', type: 'array' },
    ]
  },
  packing_list: {
    label: 'Packing List',
    fields: [
      { name: 'shipmentNumber', label: 'Shipment Number', path: 'shipmentNumber', type: 'text' },
      { name: 'containerNumber', label: 'Container Number', path: 'containerNumber', type: 'text' },
      { name: 'containerType', label: 'Container Type', path: 'containerType', type: 'text' },
      { name: 'carrier', label: 'Carrier', path: 'carrier', type: 'text' },
      { name: 'vesselName', label: 'Vessel Name', path: 'vesselName', type: 'text' },
      { name: 'portOfLoading', label: 'Port of Loading', path: 'portOfLoading', type: 'text' },
      { name: 'portOfDischarge', label: 'Port of Discharge', path: 'portOfDischarge', type: 'text' },
      { name: 'etd', label: 'ETD', path: 'etd', type: 'date' },
      { name: 'eta', label: 'ETA', path: 'eta', type: 'date' },
      { name: 'items', label: 'Packing Items', path: 'items', type: 'array' },
    ]
  },
  quotation: {
    label: 'Quotation',
    fields: [
      { name: 'quotationNumber', label: 'Quotation Number', path: 'quotationNumber', type: 'text' },
      { name: 'date', label: 'Date', path: 'createdAt', type: 'date' },
      { name: 'validUntil', label: 'Valid Until', path: 'validUntil', type: 'date' },
      { name: 'customerName', label: 'Customer', path: 'Customer.companyName', type: 'text' },
      { name: 'total', label: 'Total', path: 'total', type: 'currency' },
      { name: 'items', label: 'Line Items', path: 'items', type: 'array' },
    ]
  }
};

/**
 * Default HTML templates for each document type
 */
const DEFAULT_TEMPLATES = {
  sales_order: `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
  .company-name { font-size: 24px; font-weight: bold; color: #2563eb; }
  .doc-title { font-size: 28px; font-weight: bold; color: #1e3a5f; text-align: right; }
  .doc-number { color: #666; text-align: right; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; }
  .info-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
  .info-value { font-size: 14px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #2563eb; color: white; padding: 10px; text-align: left; font-size: 13px; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  tr:nth-child(even) { background: #f8fafc; }
  .totals { text-align: right; margin-top: 20px; }
  .total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 5px 0; }
  .total-label { font-weight: 500; }
  .grand-total { font-size: 18px; font-weight: bold; color: #2563eb; border-top: 2px solid #2563eb; padding-top: 10px; }
  .notes { margin-top: 30px; padding: 15px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  {{{customCss}}}
</style></head>
<body>
  <div class="header">
    <div>
      <div class="company-name">{{companyInfo.name}}</div>
      <div style="color:#666;font-size:13px;">{{companyInfo.address}}</div>
      <div style="color:#666;font-size:13px;">{{companyInfo.phone}} | {{companyInfo.email}}</div>
    </div>
    <div>
      <div class="doc-title">SALES ORDER</div>
      <div class="doc-number">#{{orderNumber}}</div>
      <div class="doc-number">Date: {{formatDate orderDate}}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Bill To</div>
      <div class="info-value">{{customerName}}</div>
      <div style="font-size:13px;color:#666;">{{customerEmail}}</div>
      <div style="font-size:13px;color:#666;">{{customerPhone}}</div>
      <div style="font-size:13px;color:#666;">{{customerAddress}}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Order Details</div>
      <div class="info-value">Status: {{status}}</div>
      <div style="font-size:13px;color:#666;">Currency: {{currency}}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr><td>{{@index}}</td><td>{{this.name}}</td><td>{{this.sku}}</td><td>{{this.quantity}}</td><td>{{formatCurrency this.unitPrice ../currency}}</td><td>{{formatCurrency this.total ../currency}}</td></tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span class="total-label">Subtotal:</span><span>{{formatCurrency subtotal currency}}</span></div>
    <div class="total-row"><span class="total-label">Tax:</span><span>{{formatCurrency tax currency}}</span></div>
    <div class="total-row grand-total"><span class="total-label">Total:</span><span>{{formatCurrency total currency}}</span></div>
  </div>
  {{#if notes}}<div class="notes"><strong>Notes:</strong> {{notes}}</div>{{/if}}
  <div class="footer">{{companyInfo.name}} | {{companyInfo.website}} | Generated on {{formatDate generatedAt}}</div>
</body>
</html>`,

  purchase_order: `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #d97706; padding-bottom: 20px; margin-bottom: 30px; }
  .company-name { font-size: 24px; font-weight: bold; color: #d97706; }
  .doc-title { font-size: 28px; font-weight: bold; color: #92400e; text-align: right; }
  .doc-number { color: #666; text-align: right; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .info-box { background: #fffbeb; padding: 15px; border-radius: 8px; }
  .info-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
  .info-value { font-size: 14px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #d97706; color: white; padding: 10px; text-align: left; font-size: 13px; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  tr:nth-child(even) { background: #fffbeb; }
  .totals { text-align: right; margin-top: 20px; }
  .total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 5px 0; }
  .grand-total { font-size: 18px; font-weight: bold; color: #d97706; border-top: 2px solid #d97706; padding-top: 10px; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
  {{{customCss}}}
</style></head>
<body>
  <div class="header">
    <div>
      <div class="company-name">{{companyInfo.name}}</div>
      <div style="color:#666;font-size:13px;">{{companyInfo.address}}</div>
    </div>
    <div>
      <div class="doc-title">PURCHASE ORDER</div>
      <div class="doc-number">#{{poNumber}}</div>
      <div class="doc-number">Date: {{formatDate poDate}}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Supplier / Factory</div>
      <div class="info-value">{{factoryName}}</div>
      <div style="font-size:13px;color:#666;">{{factoryEmail}}</div>
      <div style="font-size:13px;color:#666;">{{factoryCountry}}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Order Info</div>
      <div class="info-value">Status: {{status}}</div>
      <div style="font-size:13px;">Expected Delivery: {{formatDate expectedDelivery}}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr><td>{{@index}}</td><td>{{this.name}}</td><td>{{this.sku}}</td><td>{{this.quantity}}</td><td>{{formatCurrency this.unitPrice ../currency}}</td><td>{{formatCurrency this.total ../currency}}</td></tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal:</span><span>{{formatCurrency subtotal currency}}</span></div>
    <div class="total-row grand-total"><span>Total:</span><span>{{formatCurrency total currency}}</span></div>
  </div>
  {{#if notes}}<div style="margin-top:20px;padding:15px;background:#f0fdf4;border-left:4px solid #22c55e;"><strong>Notes:</strong> {{notes}}</div>{{/if}}
  <div class="footer">Generated on {{formatDate generatedAt}}</div>
</body>
</html>`,

  invoice: `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 30px; }
  .company-name { font-size: 24px; font-weight: bold; color: #059669; }
  .doc-title { font-size: 28px; font-weight: bold; text-align: right; }
  .doc-number { color: #666; text-align: right; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .info-box { background: #f0fdf4; padding: 15px; border-radius: 8px; }
  .info-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #059669; color: white; padding: 10px; text-align: left; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
  .totals { text-align: right; }
  .total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 5px 0; }
  .grand-total { font-size: 18px; font-weight: bold; color: #059669; border-top: 2px solid #059669; padding-top: 10px; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
  {{{customCss}}}
</style></head>
<body>
  <div class="header">
    <div><div class="company-name">{{companyInfo.name}}</div><div style="color:#666;font-size:13px;">{{companyInfo.address}}</div><div style="color:#666;font-size:13px;">{{companyInfo.phone}} | {{companyInfo.email}}</div></div>
    <div><div class="doc-title">INVOICE</div><div class="doc-number">#{{invoiceNumber}}</div><div class="doc-number">Date: {{formatDate invoiceDate}}</div><div class="doc-number">Due: {{formatDate dueDate}}</div></div>
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="info-label">Bill To</div><div style="font-weight:500;">{{customerName}}</div><div style="font-size:13px;color:#666;">{{customerEmail}}</div></div>
    <div class="info-box"><div class="info-label">Payment</div><div>Terms: {{paymentTerms}}</div><div>Status: {{status}}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
    <tbody>{{#each items}}<tr><td>{{@index}}</td><td>{{this.name}}</td><td>{{this.quantity}}</td><td>{{formatCurrency this.unitPrice ../currency}}</td><td>{{formatCurrency this.total ../currency}}</td></tr>{{/each}}</tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal:</span><span>{{formatCurrency subtotal currency}}</span></div>
    <div class="total-row"><span>Tax:</span><span>{{formatCurrency tax currency}}</span></div>
    <div class="total-row grand-total"><span>Total Due:</span><span>{{formatCurrency total currency}}</span></div>
  </div>
  <div class="footer">Thank you for your business! | {{companyInfo.name}}</div>
</body>
</html>`
};

class TemplateProcessingService {
  /**
   * Get available field definitions for a document type
   */
  getFieldDefinitions(documentType) {
    return DOCUMENT_FIELD_DEFINITIONS[documentType] || null;
  }

  /**
   * Get all available document types
   */
  getDocumentTypes() {
    return Object.entries(DOCUMENT_FIELD_DEFINITIONS).map(([key, val]) => ({
      value: key,
      label: val.label,
      fieldCount: val.fields.length
    }));
  }

  /**
   * Get or create default template HTML for a document type
   */
  getDefaultTemplate(documentType) {
    return DEFAULT_TEMPLATES[documentType] || DEFAULT_TEMPLATES.sales_order;
  }

  /**
   * Extract data from a source entity based on field mappings
   */
  extractFieldValues(sourceData, fieldDefinitions) {
    const values = {};
    for (const field of fieldDefinitions) {
      values[field.name] = this._getNestedValue(sourceData, field.path);
    }
    return values;
  }

  /**
   * Generate HTML document from template and data
   */
  generateHtml(templateHtml, data, companyInfo = {}) {
    const enrichedData = {
      ...data,
      companyInfo: {
        name: companyInfo.name || 'Trading Company',
        address: companyInfo.address || '',
        phone: companyInfo.phone || '',
        email: companyInfo.email || '',
        website: companyInfo.website || '',
        logo: companyInfo.logo || '',
        ...companyInfo
      },
      generatedAt: new Date(),
      customCss: data.customCss || ''
    };

    const template = Handlebars.compile(templateHtml);
    return template(enrichedData);
  }

  /**
   * Parse an uploaded Excel file and extract structure
   */
  async analyzeExcelTemplate(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets = [];
    workbook.eachSheet((worksheet) => {
      const columns = [];
      const firstRow = worksheet.getRow(1);
      firstRow.eachCell((cell, colNumber) => {
        columns.push({
          column: colNumber,
          header: cell.value?.toString() || `Column ${colNumber}`,
          type: typeof cell.value
        });
      });

      sheets.push({
        name: worksheet.name,
        rowCount: worksheet.rowCount,
        columns
      });
    });

    return { sheets, fileType: 'xlsx' };
  }

  /**
   * Parse uploaded Excel/CSV for product import
   */
  async parseImportFile(filePath, fileType = 'xlsx') {
    if (fileType === 'xlsx' || fileType === 'xls') {
      return this._parseExcelImport(filePath);
    } else if (fileType === 'csv') {
      return this._parseCsvImport(filePath);
    }
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  /**
   * Generate Excel file from price list data
   */
  async generateExcel(data, columns, sheetName = 'Sheet1') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Add headers
    worksheet.columns = columns.map(col => ({
      header: col.label || col.key,
      key: col.key,
      width: col.width || 15
    }));

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

    // Add data rows
    data.forEach(row => worksheet.addRow(row));

    // Auto-fit columns
    worksheet.columns.forEach(col => {
      col.width = Math.max(col.width || 15, 12);
    });

    return workbook;
  }

  // Private helpers

  _getNestedValue(obj, path) {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async _parseExcelImport(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const headers = [];
    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => headers.push(cell.value?.toString() || ''));
      } else {
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          rowData[headers[colNumber - 1] || `col${colNumber}`] = cell.value;
        });
        rows.push(rowData);
      }
    });

    return { headers, rows, rowCount: rows.length };
  }

  async _parseCsvImport(filePath) {
    const { parse } = require('csv-parse/sync');
    const content = await fs.readFile(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    return { headers, rows: records, rowCount: records.length };
  }
}

module.exports = new TemplateProcessingService();
