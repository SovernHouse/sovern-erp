const { PDFDocument, fs, path, formatCurrency, uploadDir,
  createDir, getCompanyHeader, getDocumentTitle, getDocumentDetails,
  createTable, addFooter } = require('./pdfHelpers');

const generateInspectionCertificatePDF = (inspection, report, factory) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'inspection_certificates'));
      const filename = `cert-${inspection.inspectionNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'inspection_certificates', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      getCompanyHeader(doc);
      getDocumentTitle(doc, 'INSPECTION CERTIFICATE');

      const details = {
        'Certificate #': inspection.inspectionNumber,
        'Date': new Date(inspection.completedDate || inspection.createdAt).toLocaleDateString(),
        'Factory': factory.companyName,
        'Type': inspection.type,
        'Result': inspection.overallResult || 'Pending'
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Inspection Findings', 50, y);
      y += 20;

      if (report) {
        doc.fontSize(10).font('Helvetica');
        doc.text(`Overall Result: ${report.overallResult}`, 50, y);
        y += 15;
        doc.text(`Findings: ${report.findings || 'No findings'}`, 50, y, { width: 500 });
        y += 60;
        doc.text(`Recommendations: ${report.recommendations || 'None'}`, 50, y, { width: 500 });
      } else {
        doc.fontSize(10).font('Helvetica');
        doc.text('Inspection report pending completion', 50, y);
      }

      y += 60;
      doc.fontSize(9).font('Helvetica-Bold').text('This certifies that the inspection was conducted according to trading standards.', 50, y);

      addFooter(doc);

      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateShipmentDocumentPDF = (shipment, salesOrder, customer) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'shipment_documents'));
      const filename = `shp-${shipment.shipmentNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'shipment_documents', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      getCompanyHeader(doc);
      getDocumentTitle(doc, 'SHIPMENT DOCUMENT');

      const details = {
        'Shipment #': shipment.shipmentNumber,
        'Date': new Date(shipment.createdAt).toLocaleDateString(),
        'Customer': customer.companyName,
        'Order': salesOrder.orderNumber,
        'Status': shipment.status
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Shipping Details', 50, y);
      y += 20;

      const columns = ['Detail', 'Value'];
      const rows = [
        ['Carrier', shipment.carrier || 'N/A'],
        ['Vessel Name', shipment.vesselName || 'N/A'],
        ['Container Number', shipment.containerNumber || 'N/A'],
        ['Container Type', shipment.containerType || 'N/A'],
        ['Port of Loading', shipment.portOfLoading || 'N/A'],
        ['Port of Discharge', shipment.portOfDischarge || 'N/A'],
        ['ETA', shipment.eta ? new Date(shipment.eta).toLocaleDateString() : 'N/A']
      ];

      y = createTable(doc, columns, rows, y);

      y += 20;
      doc.fontSize(10).font('Helvetica-Bold').text('Tracking Number:', 50, y);
      y += 15;
      doc.font('Helvetica').fontSize(12).text(shipment.containerNumber || 'N/A', 50, y);

      addFooter(doc);

      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateProductSpecSheetPDF = (product, category, factory, price = null) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'spec_sheets'));
      const filename = `spec-sheet-${product.sku}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'spec_sheets', filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // ── Header bar ───────────────────────────────────────────────────────────
      doc.rect(0, 0, 595, 80).fill('#1a1a2e');
      doc.fillColor('white');
      doc.fontSize(20).font('Helvetica-Bold')
         .text(process.env.PDF_COMPANY_NAME || 'Sovern House', 50, 18);
      doc.fontSize(9).font('Helvetica')
         .text('PRODUCT SPECIFICATION SHEET', 50, 44)
         .text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 50, 56);

      // Category label (right side of header)
      doc.fontSize(11).font('Helvetica-Bold')
         .text(category?.name || 'Product', 300, 28, { align: 'right', width: 245 });

      doc.fillColor('black');

      // ── Product name + SKU ───────────────────────────────────────────────────
      let y = 100;
      doc.fontSize(16).font('Helvetica-Bold')
         .text(product.name || 'Product Name', 50, y);
      y += 22;
      doc.fontSize(10).font('Helvetica')
         .text(`SKU: ${product.sku}`, 50, y);

      if (price) {
        doc.text(`Price: ${formatCurrency(price.sellingPrice, price.currency)} / ${product.unit || 'unit'}`,
          300, y, { align: 'right', width: 245 });
      }

      y += 18;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 12;

      // ── Description ──────────────────────────────────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold').text('PRODUCT DESCRIPTION', 50, y);
      y += 12;
      doc.font('Helvetica').fontSize(9)
         .text(product.description || '—', 50, y, { width: 495 });
      y += doc.heightOfString(product.description || '—', { width: 495 }) + 14;

      // ── Technical Specifications ─────────────────────────────────────────────
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 10;
      doc.fontSize(9).font('Helvetica-Bold').text('TECHNICAL SPECIFICATIONS', 50, y);
      y += 12;

      let specs = {};
      if (product.specifications) {
        if (typeof product.specifications === 'string') {
          try { specs = JSON.parse(product.specifications); } catch (e) { specs = {}; }
        } else {
          specs = product.specifications;
        }
      }

      if (Object.keys(specs).length > 0) {
        doc.font('Helvetica').fontSize(9);
        const specEntries = Object.entries(specs);
        // Two-column layout
        const half = Math.ceil(specEntries.length / 2);
        const leftCol = specEntries.slice(0, half);
        const rightCol = specEntries.slice(half);
        const maxRows = Math.max(leftCol.length, rightCol.length);

        for (let i = 0; i < maxRows; i++) {
          if (leftCol[i]) {
            const [k, v] = leftCol[i];
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true, width: 220 })
               .font('Helvetica').text(String(v));
          }
          if (rightCol[i]) {
            const [k, v] = rightCol[i];
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            doc.font('Helvetica-Bold').text(`${label}: `, 300, y, { continued: true, width: 220 })
               .font('Helvetica').text(String(v));
          }
          y += 14;
        }
      } else {
        doc.font('Helvetica').fontSize(9).text('No specifications available.', 50, y);
        y += 14;
      }

      y += 6;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 10;

      // ── Commercial Details ───────────────────────────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold').text('COMMERCIAL DETAILS', 50, y);
      y += 12;
      doc.font('Helvetica').fontSize(9);
      const commercialRows = [
        ['Unit of Measure', product.unit || '—'],
        ['Minimum Order Qty', product.minOrderQty ? `${product.minOrderQty} ${product.unit || 'units'}` : '—'],
        ['Gross Weight (per unit)', product.weight ? `${product.weight} kg` : '—'],
        ['HS Code', product.hsCode || 'TBC — consult licensed customs broker'],
        ['Country of Origin', factory?.country || 'China'],
        ['Factory / Supplier', factory?.companyName || '—'],
        ['Lead Time', factory?.leadTimeDays ? `${factory.leadTimeDays} days` : '—'],
      ];
      commercialRows.forEach(([label, val]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true, width: 220 })
           .font('Helvetica').text(val);
        y += 14;
      });

      // ── Certifications ───────────────────────────────────────────────────────
      if (factory?.certifications && factory.certifications.length > 0) {
        y += 6;
        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 10;
        doc.fontSize(9).font('Helvetica-Bold').text('FACTORY CERTIFICATIONS', 50, y);
        y += 12;
        const certs = Array.isArray(factory.certifications)
          ? factory.certifications
          : (typeof factory.certifications === 'string' ? JSON.parse(factory.certifications) : []);
        doc.font('Helvetica').fontSize(9)
           .text(certs.join(' · '), 50, y, { width: 495 });
        y += 14;
      }

      // ── Compliance note ──────────────────────────────────────────────────────
      y += 8;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 10;
      doc.fontSize(8).font('Helvetica-Oblique')
         .text(
           'IMPORTANT: HS codes must be verified with a licensed customs broker before import. ' +
           'Pricing and specifications are indicative and subject to final order confirmation. ' +
           'This document is for reference only and does not constitute a binding offer.',
           50, y, { width: 495 }
         );

      addFooter(doc);
      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateInspectionCertificatePDF, generateShipmentDocumentPDF, generateProductSpecSheetPDF };
