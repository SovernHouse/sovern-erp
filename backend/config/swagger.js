const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trading ERP API',
      version: '1.0.0',
      description: 'Complete Trading Company ERP System API for Flooring Business',
      contact: {
        name: 'Trading ERP Team',
        email: 'support@trading-erp.com'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://api.trading-erp.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'integer', example: 1 },
                totalPages: { type: 'integer', example: 10 },
                totalCount: { type: 'integer', example: 100 },
                pageSize: { type: 'integer', example: 10 },
                hasNextPage: { type: 'boolean', example: true },
                hasPreviousPage: { type: 'boolean', example: false }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                statusCode: { type: 'integer' }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'sales', 'operations', 'finance', 'inspector'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            companyName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
            paymentTerms: { type: 'string', default: 'Net 30' },
            creditLimit: { type: 'number' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Factory: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            companyName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            country: { type: 'string' },
            capacity: { type: 'number' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            sku: { type: 'string' },
            categoryId: { type: 'string', format: 'uuid' },
            factoryId: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
            unit: { type: 'string' },
            basePrice: { type: 'number' },
            leadTime: { type: 'integer' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Inquiry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            inquiryNumber: { type: 'string' },
            customerId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['open', 'under_review', 'quoted', 'converted', 'rejected'] },
            items: { type: 'array' },
            submittedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Quotation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            quotationNumber: { type: 'string' },
            customerId: { type: 'string', format: 'uuid' },
            inquiryId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'] },
            items: { type: 'array' },
            subtotal: { type: 'number' },
            discount: { type: 'number' },
            tax: { type: 'number' },
            total: { type: 'number' },
            validUntil: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ProformaInvoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            proformaNumber: { type: 'string' },
            quotationId: { type: 'string', format: 'uuid' },
            customerId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['draft', 'sent', 'confirmed', 'converted'] },
            items: { type: 'array' },
            subtotal: { type: 'number' },
            discount: { type: 'number' },
            tax: { type: 'number' },
            total: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        SalesOrder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderNumber: { type: 'string' },
            customerId: { type: 'string', format: 'uuid' },
            factoryId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'] },
            items: { type: 'array' },
            subtotal: { type: 'number' },
            discount: { type: 'number' },
            tax: { type: 'number' },
            total: { type: 'number' },
            currency: { type: 'string', default: 'USD' },
            estimatedDelivery: { type: 'string', format: 'date' },
            actualDelivery: { type: 'string', format: 'date' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        PurchaseOrder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            poNumber: { type: 'string' },
            factoryId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['draft', 'sent', 'confirmed', 'received', 'cancelled'] },
            items: { type: 'array' },
            subtotal: { type: 'number' },
            total: { type: 'number' },
            expectedDelivery: { type: 'string', format: 'date' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceNumber: { type: 'string' },
            salesOrderId: { type: 'string', format: 'uuid' },
            customerId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'] },
            subtotal: { type: 'number' },
            discount: { type: 'number' },
            tax: { type: 'number' },
            total: { type: 'number' },
            paidAmount: { type: 'number' },
            balance: { type: 'number' },
            dueDate: { type: 'string', format: 'date' },
            paymentTerms: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            method: { type: 'string', enum: ['bank_transfer', 'credit_card', 'check', 'cash'] },
            reference: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'rejected'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Shipment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shipmentNumber: { type: 'string' },
            salesOrderId: { type: 'string', format: 'uuid' },
            carrier: { type: 'string' },
            vesselName: { type: 'string' },
            containerNumber: { type: 'string' },
            portOfLoading: { type: 'string' },
            portOfDischarge: { type: 'string' },
            status: { type: 'string', enum: ['booked', 'in_transit', 'arrived', 'delivered', 'cancelled'] },
            etd: { type: 'string', format: 'date-time' },
            eta: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        PackingList: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            packingListNumber: { type: 'string' },
            salesOrderId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['draft', 'confirmed'] },
            items: { type: 'array' },
            totalPackages: { type: 'integer' },
            totalGrossWeight: { type: 'number' },
            totalNetWeight: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Inspection: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            inspectionNumber: { type: 'string' },
            salesOrderId: { type: 'string', format: 'uuid' },
            purchaseOrderId: { type: 'string', format: 'uuid' },
            factoryId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] },
            type: { type: 'string', enum: ['pre_production', 'during_production', 'final'] },
            scheduledDate: { type: 'string', format: 'date-time' },
            overallResult: { type: 'string', enum: ['pass', 'fail'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Claim: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            claimNumber: { type: 'string' },
            salesOrderId: { type: 'string', format: 'uuid' },
            customerId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['quality', 'damage', 'shortage', 'other'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            status: { type: 'string', enum: ['submitted', 'under_review', 'resolved', 'rejected'] },
            description: { type: 'string' },
            submittedAt: { type: 'string', format: 'date-time' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            type: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            isRead: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['template', 'uploaded', 'generated'] },
            category: { type: 'string' },
            fileUrl: { type: 'string' },
            entityType: { type: 'string' },
            entityId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: [path.join(__dirname, '../docs/swagger-definitions.js')]
};

module.exports = swaggerJsdoc(options);
