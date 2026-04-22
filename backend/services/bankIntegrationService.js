const { v4: uuidv4 } = require('uuid');

/**
 * Bank Integration Service for Letter of Credit operations
 * Simulates real bank APIs - in production would integrate with actual bank systems
 */

class BankIntegrationService {
  constructor() {
    // In-memory storage for demo purposes (would use database in production)
    this.lcApplications = new Map();
    this.lcStatusHistory = new Map();
    this.documentSubmissions = new Map();
    this.amendments = new Map();
  }

  /**
   * Submit LC application to bank
   * @param {Object} lcData - LC application data
   * @returns {Object} Submission response with tracking info
   */
  async submitLCApplication(lcData) {
    try {
      this.validateLCApplicationData(lcData);

      const submissionId = uuidv4();
      const bankReference = `LC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const application = {
        submissionId,
        bankReference,
        status: 'pending',
        lcAmount: lcData.lcAmount,
        currency: lcData.currency,
        buyerBankCode: lcData.buyerBankCode,
        applicantDetails: lcData.applicantDetails,
        beneficiary: lcData.beneficiary,
        validity: lcData.validity,
        port: lcData.port,
        documents: lcData.documents || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedProcessingDays: this.calculateProcessingDays(lcData.lcAmount),
      };

      this.lcApplications.set(bankReference, application);
      this.initializeStatusHistory(bankReference);

      return {
        success: true,
        submissionId,
        bankReference,
        status: 'pending',
        estimatedProcessingDays: application.estimatedProcessingDays,
        message: 'LC application submitted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'LC_SUBMISSION_ERROR',
      };
    }
  }

  /**
   * Check LC status with bank
   * @param {string} bankReference - Bank reference number
   * @returns {Object} Current LC status
   */
  async checkLCStatus(bankReference) {
    try {
      const application = this.lcApplications.get(bankReference);
      if (!application) {
        throw new Error('LC application not found');
      }

      // Simulate status progression based on elapsed time
      const status = this.determineCurrentStatus(application);

      return {
        success: true,
        bankReference,
        status,
        lastUpdated: application.updatedAt,
        comments: this.getStatusComments(status),
        nextSteps: this.getNextSteps(status),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'LC_STATUS_ERROR',
      };
    }
  }

  /**
   * Submit documents for LC negotiation
   * @param {string} bankReference - Bank reference number
   * @param {Array} documents - Required documents
   * @returns {Object} Submission result with discrepancies
   */
  async submitDocuments(bankReference, documents) {
    try {
      const application = this.lcApplications.get(bankReference);
      if (!application) {
        throw new Error('LC application not found');
      }

      const requiredDocs = ['commercial_invoice', 'bill_of_lading', 'packing_list', 'certificate_of_origin', 'insurance_certificate'];
      const submittedDocTypes = documents.map((d) => d.type);

      const discrepancies = [];
      for (const required of requiredDocs) {
        if (!submittedDocTypes.includes(required)) {
          discrepancies.push({
            type: required,
            message: `Missing required document: ${required.replace(/_/g, ' ')}`,
            severity: 'error',
          });
        }
      }

      const submissionId = uuidv4();
      const submission = {
        submissionId,
        bankReference,
        documents,
        discrepancies,
        submittedAt: new Date(),
        status: discrepancies.length === 0 ? 'accepted' : 'pending_correction',
      };

      this.documentSubmissions.set(submissionId, submission);

      // Update application with submitted documents
      application.documents = documents;
      application.documentSubmissionId = submissionId;
      application.updatedAt = new Date();

      return {
        success: true,
        submissionId,
        bankReference,
        discrepancies,
        status: submission.status,
        message: discrepancies.length === 0 ? 'All documents accepted' : 'Some documents need correction',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'DOCUMENT_SUBMISSION_ERROR',
      };
    }
  }

  /**
   * Request LC amendment
   * @param {string} bankReference - Bank reference number
   * @param {Object} amendments - Requested amendments
   * @returns {Object} Amendment request response
   */
  async requestLCAmendment(bankReference, amendments) {
    try {
      const application = this.lcApplications.get(bankReference);
      if (!application) {
        throw new Error('LC application not found');
      }

      const amendmentRef = `AMD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const amendment = {
        amendmentRef,
        bankReference,
        amendments,
        status: 'pending',
        requestedAt: new Date(),
        estimatedDays: 3,
      };

      this.amendments.set(amendmentRef, amendment);

      return {
        success: true,
        amendmentRef,
        bankReference,
        status: 'pending',
        estimatedDays: amendment.estimatedDays,
        message: 'Amendment request submitted',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'AMENDMENT_REQUEST_ERROR',
      };
    }
  }

  /**
   * Get LC advice/notification
   * @param {string} bankReference - Bank reference number
   * @returns {Object} LC advice details
   */
  async getLCAdvice(bankReference) {
    try {
      const application = this.lcApplications.get(bankReference);
      if (!application) {
        throw new Error('LC application not found');
      }

      const advice = {
        bankReference,
        lcAmount: application.lcAmount,
        currency: application.currency,
        status: application.status,
        conditions: [
          'Shipment must be effected on or before the expiry date',
          'Bills of exchange must be drawn on the issuing bank',
          'Insurance certificate in original must be provided',
          'Packing list and commercial invoice required',
          'All documents must be presented within 21 days of shipment',
        ],
        deadlines: {
          shipmentDeadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          documentSubmissionDeadline: new Date(Date.now() + 111 * 24 * 60 * 60 * 1000),
        },
        issuingBank: application.buyerBankCode,
        advisingBank: 'ADVISING-BANK-CODE',
      };

      return {
        success: true,
        adviceDetails: advice,
        conditions: advice.conditions,
        deadlines: advice.deadlines,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'LC_ADVICE_ERROR',
      };
    }
  }

  /**
   * Calculate estimated bank charges
   * @param {number} lcAmount - LC amount
   * @param {string} currency - Currency code
   * @param {string} bankCode - Bank code
   * @returns {Object} Charges breakdown
   */
  async getBankCharges(lcAmount, currency, bankCode) {
    try {
      // Fee rates (in percentage or fixed amounts)
      const rates = {
        issuanceFeeRate: 0.003, // 0.3%
        amendmentFeeFlat: 150,
        negotiationFeeRate: 0.002, // 0.2%
        swiftCharges: 25,
      };

      const issuanceFee = lcAmount * rates.issuanceFeeRate;
      const amendmentFee = rates.amendmentFeeFlat;
      const negotiationFee = lcAmount * rates.negotiationFeeRate;
      const swiftCharges = rates.swiftCharges;

      const totalCharges = issuanceFee + amendmentFee + negotiationFee + swiftCharges;

      return {
        success: true,
        breakdown: {
          lcIssuanceFee: {
            description: 'LC issuance fee',
            rate: `${(rates.issuanceFeeRate * 100).toFixed(2)}%`,
            amount: issuanceFee.toFixed(2),
          },
          amendmentFee: {
            description: 'Amendment fee (flat rate)',
            amount: amendmentFee.toFixed(2),
          },
          negotiationFee: {
            description: 'Document negotiation fee',
            rate: `${(rates.negotiationFeeRate * 100).toFixed(2)}%`,
            amount: negotiationFee.toFixed(2),
          },
          swiftCharges: {
            description: 'SWIFT communication charges',
            amount: swiftCharges.toFixed(2),
          },
        },
        totalCharges: totalCharges.toFixed(2),
        currency: currency || 'USD',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'CHARGES_CALCULATION_ERROR',
      };
    }
  }

  // ==================== Private Helper Methods ====================

  validateLCApplicationData(lcData) {
    const requiredFields = ['lcAmount', 'currency', 'buyerBankCode', 'applicantDetails', 'beneficiary'];
    for (const field of requiredFields) {
      if (!lcData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof lcData.lcAmount !== 'number' || lcData.lcAmount <= 0) {
      throw new Error('LC amount must be a positive number');
    }
  }

  calculateProcessingDays(lcAmount) {
    // Larger amounts take longer
    if (lcAmount > 1000000) return 7;
    if (lcAmount > 500000) return 5;
    return 3;
  }

  initializeStatusHistory(bankReference) {
    this.lcStatusHistory.set(bankReference, [
      {
        status: 'pending',
        timestamp: new Date(),
        comment: 'Application received',
      },
    ]);
  }

  determineCurrentStatus(application) {
    const elapsed = Date.now() - application.createdAt.getTime();
    const days = elapsed / (1000 * 60 * 60 * 24);

    // Simulate status progression
    if (days > application.estimatedProcessingDays) {
      // Random choice between approved and rejected for demo
      return Math.random() > 0.1 ? 'approved' : 'rejected';
    } else if (days > application.estimatedProcessingDays * 0.5) {
      return 'under_review';
    }
    return 'pending';
  }

  getStatusComments(status) {
    const comments = {
      pending: 'Application submitted and awaiting review by the issuing bank',
      under_review: 'Application is under review by the bank compliance team',
      approved: 'LC has been approved and issued',
      rejected: 'LC application has been rejected',
      amended: 'LC amendment has been processed',
    };
    return comments[status] || 'Status unknown';
  }

  getNextSteps(status) {
    const steps = {
      pending: [
        'Await bank confirmation of application receipt',
        'Prepare required documents for submission',
      ],
      under_review: ['Monitor status updates', 'Ensure beneficiary information is accurate'],
      approved: [
        'Retrieve LC from bank',
        'Send LC to beneficiary',
        'Prepare shipment according to LC terms',
      ],
      rejected: [
        'Contact your bank to understand reasons for rejection',
        'Resubmit with corrected information if applicable',
      ],
      amended: ['Review amendment details', 'Acknowledge receipt of amendment to bank'],
    };
    return steps[status] || [];
  }
}

module.exports = new BankIntegrationService();
