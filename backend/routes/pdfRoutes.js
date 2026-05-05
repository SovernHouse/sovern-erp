const express = require('express');
const router = express.Router();
const pdfGeneratorService = require('../services/pdfGeneratorService');
const pdfTemplates = require('../services/pdfTemplates');
const { requireAuth } = require('../middleware/auth');
const { getErrorResponse } = require('../utils/helpers');
const logger = require('../utils/logger.js');

/**
 * PDF Generation Routes
 * Endpoints for generating and downloading PDF documents
 */

/**
 * GET /api/pdf/invoice/:id
 * Generate and download an invoice as PDF
 */
router.get('/invoice/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfGeneratorService.generateInvoicePDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating invoice PDF:', error);
    next(error);
  }
});

/**
 * GET /api/pdf/purchase-order/:id
 * Generate and download a purchase order as PDF
 */
router.get('/purchase-order/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfGeneratorService.generatePurchaseOrderPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating purchase order PDF:', error);
    next(error);
  }
});

/**
 * GET /api/pdf/quotation/:id
 * Generate and download a quotation as PDF
 */
router.get('/quotation/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfGeneratorService.generateQuotationPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quotation-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating quotation PDF:', error);
    next(error);
  }
});

/**
 * GET /api/pdf/proforma-invoice/:id
 * Generate and download a proforma invoice as PDF
 */
router.get('/proforma-invoice/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfGeneratorService.generateProformaInvoicePDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proforma-invoice-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating proforma invoice PDF:', error);
    next(error);
  }
});

/**
 * GET /api/pdf/packing-list/:id
 * Generate and download a packing list as PDF
 */
router.get('/packing-list/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfGeneratorService.generatePackingListPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="packing-list-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating packing list PDF:', error);
    next(error);
  }
});

/**
 * GET /api/pdf/certificate-of-origin/:id
 * Generate and download a Certificate of Origin as PDF
 */
router.get('/certificate-of-origin/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfTemplates.generateCertificateOfOriginPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-of-origin-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating certificate of origin PDF:', error);
    next(error);
  }
});

/**
 * GET /api/pdf/quotation/:id
 * Generate and download an enhanced quotation as PDF
 */
router.get('/quotation-enhanced/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfTemplates.generateQuotationPDFEnhanced(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quotation-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating quotation PDF:', error);
    next(error);
  }
});

/**
 * GET /api/pdf/packing-list-advanced/:id
 * Generate a professional packing list using pdfTemplates
 */
router.get('/packing-list-advanced/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfTemplates.generatePackingListPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="packing-list-${id}.pdf"`);
    res.sen