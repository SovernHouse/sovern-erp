/**
 * Initial Schema Migration
 * Creates all tables from current models
 *
 * Tables created:
 * - User (with roles and preferences)
 * - Customer, Factory, Product management
 * - Orders: Sales, Purchase
 * - Financial: Invoice, Payment, ProformaInvoice
 * - Logistics: Shipment, Packing, Inspection
 * - Compliance: Certificate, Claim, Audit
 * - Inventory: Stock, Batch, Warehouse
 * - Trade Finance: LetterOfCredit
 * - And more...
 */

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // User table
      await queryInterface.createTable('User', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false
        },
        firstName: {
          type: DataTypes.STRING,
          allowNull: false
        },
        lastName: {
          type: DataTypes.STRING,
          allowNull: false
        },
        phone: DataTypes.STRING,
        avatar: DataTypes.STRING,
        role: {
          type: DataTypes.ENUM('admin', 'sales', 'operations', 'finance', 'inspector', 'customer', 'factory'),
          defaultValue: 'customer'
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        lastLogin: DataTypes.DATE,
        preferences: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('User', ['email'], { transaction });
      await queryInterface.addIndex('User', ['role'], { transaction });
      await queryInterface.addIndex('User', ['isActive'], { transaction });

      // SSOAccount table
      await queryInterface.createTable('SSOAccount', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        provider: {
          type: DataTypes.STRING,
          allowNull: false
        },
        externalId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addConstraint('SSOAccount', {
        fields: ['userId'],
        type: 'foreign key',
        name: 'fk_ssoaccount_userid',
        references: {
          table: 'User',
          field: 'id'
        },
        onDelete: 'CASCADE',
        transaction
      });

      // Customer table
      await queryInterface.createTable('Customer', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        phone: DataTypes.STRING,
        country: DataTypes.STRING,
        city: DataTypes.STRING,
        address: DataTypes.TEXT,
        taxId: DataTypes.STRING,
        companyType: DataTypes.STRING,
        website: DataTypes.STRING,
        creditLimit: DataTypes.DECIMAL(15, 2),
        outstandingAmount: DataTypes.DECIMAL(15, 2),
        status: {
          type: DataTypes.ENUM('active', 'inactive', 'suspended'),
          defaultValue: 'active'
        },
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Customer', ['email'], { transaction });
      await queryInterface.addIndex('Customer', ['status'], { transaction });

      // Factory table
      await queryInterface.createTable('Factory', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        phone: DataTypes.STRING,
        country: DataTypes.STRING,
        city: DataTypes.STRING,
        address: DataTypes.TEXT,
        certifications: DataTypes.JSON,
        capacityPerMonth: DataTypes.INTEGER,
        status: {
          type: DataTypes.ENUM('active', 'inactive', 'suspended'),
          defaultValue: 'active'
        },
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Factory', ['email'], { transaction });
      await queryInterface.addIndex('Factory', ['status'], { transaction });

      // ProductCategory table
      await queryInterface.createTable('ProductCategory', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        description: DataTypes.TEXT,
        parentId: DataTypes.UUID,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ProductCategory', ['name'], { transaction });

      // Product table
      await queryInterface.createTable('Product', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        sku: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        description: DataTypes.TEXT,
        categoryId: DataTypes.UUID,
        factoryId: DataTypes.UUID,
        unitOfMeasure: DataTypes.STRING,
        weight: DataTypes.DECIMAL(10, 3),
        dimensions: DataTypes.JSON,
        hsCode: DataTypes.STRING,
        imageUrl: DataTypes.STRING,
        status: {
          type: DataTypes.ENUM('active', 'inactive', 'discontinued'),
          defaultValue: 'active'
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Product', ['sku'], { transaction });
      await queryInterface.addIndex('Product', ['categoryId'], { transaction });
      await queryInterface.addIndex('Product', ['factoryId'], { transaction });
      await queryInterface.addIndex('Product', ['hsCode'], { transaction });

      // ProductPrice table
      await queryInterface.createTable('ProductPrice', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        productId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        factoryId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        price: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false
        },
        currency: {
          type: DataTypes.STRING,
          defaultValue: 'USD'
        },
        minQuantity: DataTypes.INTEGER,
        maxQuantity: DataTypes.INTEGER,
        leadTimeDays: DataTypes.INTEGER,
        validFrom: DataTypes.DATE,
        validUntil: DataTypes.DATE,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ProductPrice', ['productId'], { transaction });
      await queryInterface.addIndex('ProductPrice', ['factoryId'], { transaction });

      // Inquiry table
      await queryInterface.createTable('Inquiry', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        inquiryNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        customerId: DataTypes.UUID,
        salesPersonId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('draft', 'sent', 'received', 'won', 'lost'),
          defaultValue: 'draft'
        },
        sentDate: DataTypes.DATE,
        expiryDate: DataTypes.DATE,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Inquiry', ['inquiryNumber'], { transaction });
      await queryInterface.addIndex('Inquiry', ['customerId'], { transaction });
      await queryInterface.addIndex('Inquiry', ['status'], { transaction });

      // InquiryItem table
      await queryInterface.createTable('InquiryItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        inquiryId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        unitOfMeasure: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('InquiryItem', ['inquiryId'], { transaction });
      await queryInterface.addIndex('InquiryItem', ['productId'], { transaction });

      // Quotation table
      await queryInterface.createTable('Quotation', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        quotationNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        inquiryId: DataTypes.UUID,
        customerId: DataTypes.UUID,
        salesPersonId: DataTypes.UUID,
        parentQuotationId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('draft', 'sent', 'accepted', 'rejected', 'expired'),
          defaultValue: 'draft'
        },
        totalAmount: DataTypes.DECIMAL(15, 2),
        totalTax: DataTypes.DECIMAL(15, 2),
        totalDiscount: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        validUntil: DataTypes.DATE,
        sentDate: DataTypes.DATE,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Quotation', ['quotationNumber'], { transaction });
      await queryInterface.addIndex('Quotation', ['customerId'], { transaction });
      await queryInterface.addIndex('Quotation', ['status'], { transaction });

      // QuotationItem table
      await queryInterface.createTable('QuotationItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        quotationId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        unitPrice: DataTypes.DECIMAL(15, 2),
        discount: DataTypes.DECIMAL(15, 2),
        tax: DataTypes.DECIMAL(15, 2),
        lineTotal: DataTypes.DECIMAL(15, 2),
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('QuotationItem', ['quotationId'], { transaction });

      // ProformaInvoice table
      await queryInterface.createTable('ProformaInvoice', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        piNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        quotationId: DataTypes.UUID,
        customerId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('draft', 'sent', 'accepted', 'rejected'),
          defaultValue: 'draft'
        },
        totalAmount: DataTypes.DECIMAL(15, 2),
        totalTax: DataTypes.DECIMAL(15, 2),
        totalDiscount: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        sentDate: DataTypes.DATE,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ProformaInvoice', ['piNumber'], { transaction });
      await queryInterface.addIndex('ProformaInvoice', ['customerId'], { transaction });

      // ProformaInvoiceItem table
      await queryInterface.createTable('ProformaInvoiceItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        proformaInvoiceId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        unitPrice: DataTypes.DECIMAL(15, 2),
        discount: DataTypes.DECIMAL(15, 2),
        tax: DataTypes.DECIMAL(15, 2),
        lineTotal: DataTypes.DECIMAL(15, 2),
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ProformaInvoiceItem', ['proformaInvoiceId'], { transaction });

      // SalesOrder table
      await queryInterface.createTable('SalesOrder', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        soNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        proformaInvoiceId: DataTypes.UUID,
        customerId: DataTypes.UUID,
        factoryId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('draft', 'confirmed', 'in-production', 'ready-for-shipment', 'shipped', 'delivered', 'cancelled'),
          defaultValue: 'draft'
        },
        orderDate: DataTypes.DATE,
        deliveryDate: DataTypes.DATE,
        totalAmount: DataTypes.DECIMAL(15, 2),
        totalTax: DataTypes.DECIMAL(15, 2),
        totalDiscount: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        paymentTerms: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('SalesOrder', ['soNumber'], { transaction });
      await queryInterface.addIndex('SalesOrder', ['customerId'], { transaction });
      await queryInterface.addIndex('SalesOrder', ['status'], { transaction });

      // SalesOrderItem table
      await queryInterface.createTable('SalesOrderItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        salesOrderId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        unitPrice: DataTypes.DECIMAL(15, 2),
        discount: DataTypes.DECIMAL(15, 2),
        tax: DataTypes.DECIMAL(15, 2),
        lineTotal: DataTypes.DECIMAL(15, 2),
        deliveredQuantity: DataTypes.INTEGER,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('SalesOrderItem', ['salesOrderId'], { transaction });

      // PurchaseOrder table
      await queryInterface.createTable('PurchaseOrder', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        poNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        salesOrderId: DataTypes.UUID,
        factoryId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('draft', 'sent', 'confirmed', 'received', 'completed', 'cancelled'),
          defaultValue: 'draft'
        },
        orderDate: DataTypes.DATE,
        deliveryDate: DataTypes.DATE,
        totalAmount: DataTypes.DECIMAL(15, 2),
        totalTax: DataTypes.DECIMAL(15, 2),
        totalDiscount: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        paymentTerms: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('PurchaseOrder', ['poNumber'], { transaction });
      await queryInterface.addIndex('PurchaseOrder', ['factoryId'], { transaction });
      await queryInterface.addIndex('PurchaseOrder', ['status'], { transaction });

      // PurchaseOrderItem table
      await queryInterface.createTable('PurchaseOrderItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        purchaseOrderId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        unitPrice: DataTypes.DECIMAL(15, 2),
        discount: DataTypes.DECIMAL(15, 2),
        tax: DataTypes.DECIMAL(15, 2),
        lineTotal: DataTypes.DECIMAL(15, 2),
        receivedQuantity: DataTypes.INTEGER,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('PurchaseOrderItem', ['purchaseOrderId'], { transaction });

      // GoodsReceivedNote table
      await queryInterface.createTable('GoodsReceivedNote', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        grnNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        poId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        receivedBy: DataTypes.UUID,
        receivedDate: DataTypes.DATE,
        status: {
          type: DataTypes.ENUM('draft', 'received', 'verified'),
          defaultValue: 'draft'
        },
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('GoodsReceivedNote', ['grnNumber'], { transaction });
      await queryInterface.addIndex('GoodsReceivedNote', ['poId'], { transaction });

      // PackingList table
      await queryInterface.createTable('PackingList', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        plNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        salesOrderId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        status: {
          type: DataTypes.ENUM('draft', 'finalized', 'shipped'),
          defaultValue: 'draft'
        },
        totalQuantity: DataTypes.INTEGER,
        totalPackages: DataTypes.INTEGER,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('PackingList', ['plNumber'], { transaction });
      await queryInterface.addIndex('PackingList', ['salesOrderId'], { transaction });

      // PackingListItem table
      await queryInterface.createTable('PackingListItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        packingListId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        packageNumber: DataTypes.STRING,
        weight: DataTypes.DECIMAL(10, 3),
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('PackingListItem', ['packingListId'], { transaction });

      // ShippingDocument table
      await queryInterface.createTable('ShippingDocument', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        documentNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        salesOrderId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        documentType: {
          type: DataTypes.ENUM('bill-of-lading', 'commercial-invoice', 'packing-list', 'certificate-of-origin'),
          allowNull: false
        },
        uploadedBy: DataTypes.UUID,
        fileUrl: DataTypes.STRING,
        uploadedDate: DataTypes.DATE,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ShippingDocument', ['documentNumber'], { transaction });
      await queryInterface.addIndex('ShippingDocument', ['salesOrderId'], { transaction });

      // Shipment table
      await queryInterface.createTable('Shipment', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        shipmentNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        salesOrderId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        status: {
          type: DataTypes.ENUM('pending', 'in-transit', 'delivered', 'cancelled'),
          defaultValue: 'pending'
        },
        shipmentDate: DataTypes.DATE,
        estimatedDeliveryDate: DataTypes.DATE,
        actualDeliveryDate: DataTypes.DATE,
        shippingMethod: DataTypes.STRING,
        carrier: DataTypes.STRING,
        trackingNumber: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Shipment', ['shipmentNumber'], { transaction });
      await queryInterface.addIndex('Shipment', ['salesOrderId'], { transaction });
      await queryInterface.addIndex('Shipment', ['status'], { transaction });

      // ShipmentTracking table
      await queryInterface.createTable('ShipmentTracking', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        shipmentId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        status: {
          type: DataTypes.ENUM('pending', 'in-transit', 'out-for-delivery', 'delivered', 'failed'),
          allowNull: false
        },
        location: DataTypes.STRING,
        timestamp: DataTypes.DATE,
        notes: DataTypes.TEXT,
        updatedBy: DataTypes.UUID,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ShipmentTracking', ['shipmentId'], { transaction });

      // Inspection table
      await queryInterface.createTable('Inspection', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        inspectionNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        salesOrderId: DataTypes.UUID,
        purchaseOrderId: DataTypes.UUID,
        factoryId: DataTypes.UUID,
        inspectorId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('scheduled', 'in-progress', 'completed', 'rejected'),
          defaultValue: 'scheduled'
        },
        inspectionDate: DataTypes.DATE,
        result: {
          type: DataTypes.ENUM('pass', 'fail', 'conditional'),
          defaultValue: 'pass'
        },
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Inspection', ['inspectionNumber'], { transaction });
      await queryInterface.addIndex('Inspection', ['status'], { transaction });

      // InspectionItem table
      await queryInterface.createTable('InspectionItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        inspectionId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantityChecked: DataTypes.INTEGER,
        quantityAccepted: DataTypes.INTEGER,
        quantityRejected: DataTypes.INTEGER,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('InspectionItem', ['inspectionId'], { transaction });

      // InspectionReport table
      await queryInterface.createTable('InspectionReport', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        inspectionId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true
        },
        reportDate: DataTypes.DATE,
        findings: DataTypes.TEXT,
        recommendations: DataTypes.TEXT,
        attachments: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // Claim table
      await queryInterface.createTable('Claim', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        claimNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        salesOrderId: DataTypes.UUID,
        customerId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('open', 'in-review', 'approved', 'rejected', 'resolved'),
          defaultValue: 'open'
        },
        claimDate: DataTypes.DATE,
        description: DataTypes.TEXT,
        claimAmount: DataTypes.DECIMAL(15, 2),
        approvedAmount: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Claim', ['claimNumber'], { transaction });
      await queryInterface.addIndex('Claim', ['status'], { transaction });

      // Invoice table
      await queryInterface.createTable('Invoice', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        invoiceNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        salesOrderId: DataTypes.UUID,
        customerId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('draft', 'sent', 'received', 'partially-paid', 'paid', 'overdue', 'cancelled'),
          defaultValue: 'draft'
        },
        invoiceDate: DataTypes.DATE,
        dueDate: DataTypes.DATE,
        totalAmount: DataTypes.DECIMAL(15, 2),
        totalTax: DataTypes.DECIMAL(15, 2),
        totalDiscount: DataTypes.DECIMAL(15, 2),
        paidAmount: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Invoice', ['invoiceNumber'], { transaction });
      await queryInterface.addIndex('Invoice', ['customerId'], { transaction });
      await queryInterface.addIndex('Invoice', ['status'], { transaction });

      // InvoiceItem table
      await queryInterface.createTable('InvoiceItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        invoiceId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        productId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        unitPrice: DataTypes.DECIMAL(15, 2),
        discount: DataTypes.DECIMAL(15, 2),
        tax: DataTypes.DECIMAL(15, 2),
        lineTotal: DataTypes.DECIMAL(15, 2),
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('InvoiceItem', ['invoiceId'], { transaction });

      // Payment table
      await queryInterface.createTable('Payment', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        paymentNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        invoiceId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        amount: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false
        },
        paymentDate: DataTypes.DATE,
        paymentMethod: {
          type: DataTypes.ENUM('bank-transfer', 'credit-card', 'check', 'cash', 'lc'),
          allowNull: false
        },
        currency: DataTypes.STRING,
        status: {
          type: DataTypes.ENUM('pending', 'processed', 'failed', 'cancelled'),
          defaultValue: 'pending'
        },
        reference: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Payment', ['paymentNumber'], { transaction });
      await queryInterface.addIndex('Payment', ['invoiceId'], { transaction });

      // Notification table
      await queryInterface.createTable('Notification', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        type: DataTypes.STRING,
        title: DataTypes.STRING,
        message: DataTypes.TEXT,
        read: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        relatedEntity: DataTypes.STRING,
        relatedEntityId: DataTypes.UUID,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Notification', ['userId'], { transaction });
      await queryInterface.addIndex('Notification', ['read'], { transaction });

      // AuditLog table
      await queryInterface.createTable('AuditLog', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false
        },
        resourceType: DataTypes.STRING,
        resourceId: DataTypes.UUID,
        details: DataTypes.JSON,
        ipAddress: DataTypes.STRING,
        userAgent: DataTypes.STRING,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('AuditLog', ['userId'], { transaction });
      await queryInterface.addIndex('AuditLog', ['resourceType'], { transaction });
      await queryInterface.addIndex('AuditLog', ['created_at'], { transaction });

      // InventoryItem table
      await queryInterface.createTable('InventoryItem', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        productId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        warehouseLocation: DataTypes.STRING,
        quantity: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        reserved: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        available: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        reorderLevel: DataTypes.INTEGER,
        lastCountDate: DataTypes.DATE,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('InventoryItem', ['productId'], { transaction });

      // InventoryTransaction table
      await queryInterface.createTable('InventoryTransaction', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        inventoryItemId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        type: {
          type: DataTypes.ENUM('in', 'out', 'adjustment', 'return'),
          allowNull: false
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        reference: DataTypes.STRING,
        performedBy: DataTypes.UUID,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('InventoryTransaction', ['inventoryItemId'], { transaction });

      // Document table
      await queryInterface.createTable('Document', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        documentName: DataTypes.STRING,
        documentType: DataTypes.STRING,
        createdBy: DataTypes.UUID,
        fileUrl: DataTypes.STRING,
        mimeType: DataTypes.STRING,
        fileSize: DataTypes.INTEGER,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Document', ['createdBy'], { transaction });

      // DocumentVersion table
      await queryInterface.createTable('DocumentVersion', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        documentId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        versionNumber: DataTypes.INTEGER,
        uploadedBy: DataTypes.UUID,
        fileUrl: DataTypes.STRING,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('DocumentVersion', ['documentId'], { transaction });

      // ProductSpecification table
      await queryInterface.createTable('ProductSpecification', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        productId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true
        },
        specifications: DataTypes.JSON,
        updatedBy: DataTypes.UUID,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // ProductBatch table
      await queryInterface.createTable('ProductBatch', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        productId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        batchNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        manufactureDate: DataTypes.DATE,
        expiryDate: DataTypes.DATE,
        quantity: DataTypes.INTEGER,
        createdBy: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('active', 'archived', 'expired'),
          defaultValue: 'active'
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ProductBatch', ['productId'], { transaction });
      await queryInterface.addIndex('ProductBatch', ['batchNumber'], { transaction });

      // BatchAllocation table
      await queryInterface.createTable('BatchAllocation', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        productBatchId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        salesOrderId: DataTypes.UUID,
        purchaseOrderId: DataTypes.UUID,
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        allocatedBy: DataTypes.UUID,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('BatchAllocation', ['productBatchId'], { transaction });

      // Container table
      await queryInterface.createTable('Container', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        containerNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        shipmentId: DataTypes.UUID,
        purchaseOrderId: DataTypes.UUID,
        type: DataTypes.STRING,
        size: DataTypes.STRING,
        status: {
          type: DataTypes.ENUM('empty', 'loading', 'loaded', 'in-transit', 'delivered'),
          defaultValue: 'empty'
        },
        createdBy: DataTypes.UUID,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('Container', ['containerNumber'], { transaction });

      // ContainerConfiguration table
      await queryInterface.createTable('ContainerConfiguration', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        containerId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        configuration: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // LetterOfCredit table
      await queryInterface.createTable('LetterOfCredit', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        lcNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        customerId: DataTypes.UUID,
        supplierId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('draft', 'issued', 'confirmed', 'negotiated', 'completed', 'cancelled'),
          defaultValue: 'draft'
        },
        amount: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        issuanceDate: DataTypes.DATE,
        expiryDate: DataTypes.DATE,
        applicant: DataTypes.STRING,
        beneficiary: DataTypes.STRING,
        terms: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('LetterOfCredit', ['lcNumber'], { transaction });
      await queryInterface.addIndex('LetterOfCredit', ['status'], { transaction });

      // LetterOfCreditDocument table
      await queryInterface.createTable('LetterOfCreditDocument', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        letterOfCreditId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        documentType: DataTypes.STRING,
        fileUrl: DataTypes.STRING,
        uploadedDate: DataTypes.DATE,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // LandedCostTemplate table
      await queryInterface.createTable('LandedCostTemplate', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        components: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // LandedCostCalculation table
      await queryInterface.createTable('LandedCostCalculation', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        customerId: DataTypes.UUID,
        productCost: DataTypes.DECIMAL(15, 2),
        freight: DataTypes.DECIMAL(15, 2),
        insurance: DataTypes.DECIMAL(15, 2),
        duties: DataTypes.DECIMAL(15, 2),
        taxes: DataTypes.DECIMAL(15, 2),
        otherCharges: DataTypes.DECIMAL(15, 2),
        totalLandedCost: DataTypes.DECIMAL(15, 2),
        currency: DataTypes.STRING,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // SampleRequest table
      await queryInterface.createTable('SampleRequest', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        requestNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        customerId: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('pending', 'approved', 'shipped', 'received', 'rejected'),
          defaultValue: 'pending'
        },
        requestDate: DataTypes.DATE,
        items: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // SampleShipment table
      await queryInterface.createTable('SampleShipment', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        sampleRequestId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        shipmentDate: DataTypes.DATE,
        trackingNumber: DataTypes.STRING,
        estimatedDelivery: DataTypes.DATE,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // SampleFeedback table
      await queryInterface.createTable('SampleFeedback', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        sampleRequestId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        rating: DataTypes.INTEGER,
        comments: DataTypes.TEXT,
        status: {
          type: DataTypes.ENUM('approved', 'rejected', 'pending-revision'),
          defaultValue: 'pending-revision'
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // ComplianceRecord table
      await queryInterface.createTable('ComplianceRecord', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        shipmentId: DataTypes.UUID,
        productId: DataTypes.UUID,
        recordType: DataTypes.STRING,
        status: {
          type: DataTypes.ENUM('compliant', 'non-compliant', 'pending-review'),
          defaultValue: 'pending-review'
        },
        details: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // HarmonizedCode table
      await queryInterface.createTable('HarmonizedCode', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        code: {
          type: DataTypes.STRING,
          unique: true
        },
        description: DataTypes.TEXT,
        category: DataTypes.STRING,
        dutyRate: DataTypes.DECIMAL(5, 2),
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // CertificateOfOrigin table
      await queryInterface.createTable('CertificateOfOrigin', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        coNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        shipmentId: DataTypes.UUID,
        issueDate: DataTypes.DATE,
        expiryDate: DataTypes.DATE,
        countryOfOrigin: DataTypes.STRING,
        status: {
          type: DataTypes.ENUM('draft', 'issued', 'verified'),
          defaultValue: 'draft'
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // WarehouseLocation table
      await queryInterface.createTable('WarehouseLocation', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        code: {
          type: DataTypes.STRING,
          unique: true
        },
        name: DataTypes.STRING,
        zone: DataTypes.STRING,
        rack: DataTypes.STRING,
        shelf: DataTypes.STRING,
        capacity: DataTypes.INTEGER,
        currentOccupancy: DataTypes.INTEGER,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // WarehouseTransaction table
      await queryInterface.createTable('WarehouseTransaction', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        productId: DataTypes.UUID,
        batchId: DataTypes.UUID,
        fromLocationId: DataTypes.UUID,
        toLocationId: DataTypes.UUID,
        quantity: DataTypes.INTEGER,
        transactionType: {
          type: DataTypes.ENUM('in', 'out', 'transfer', 'count-adjustment'),
          allowNull: false
        },
        performedBy: DataTypes.UUID,
        reference: DataTypes.STRING,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // StockCount table
      await queryInterface.createTable('StockCount', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        countNumber: {
          type: DataTypes.STRING,
          unique: true
        },
        countDate: DataTypes.DATE,
        countedBy: DataTypes.UUID,
        approvedBy: DataTypes.UUID,
        status: {
          type: DataTypes.ENUM('in-progress', 'completed', 'approved'),
          defaultValue: 'in-progress'
        },
        discrepancies: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // CustomerAddress table
      await queryInterface.createTable('CustomerAddress', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        customerId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        addressType: {
          type: DataTypes.ENUM('shipping', 'billing', 'both'),
          defaultValue: 'shipping'
        },
        address: DataTypes.STRING,
        city: DataTypes.STRING,
        state: DataTypes.STRING,
        country: DataTypes.STRING,
        zipCode: DataTypes.STRING,
        isDefault: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // SustainabilityRecord table
      await queryInterface.createTable('SustainabilityRecord', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        productId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true
        },
        carbonFootprint: DataTypes.DECIMAL(10, 2),
        recyclable: DataTypes.BOOLEAN,
        certifications: DataTypes.JSON,
        ethicalSource: DataTypes.BOOLEAN,
        notes: DataTypes.TEXT,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // ExchangeRate table
      await queryInterface.createTable('ExchangeRate', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        baseCurrency: {
          type: DataTypes.STRING,
          allowNull: false
        },
        targetCurrency: {
          type: DataTypes.STRING,
          allowNull: false
        },
        rate: {
          type: DataTypes.DECIMAL(15, 6),
          allowNull: false
        },
        effectiveDate: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        source: DataTypes.STRING,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.addIndex('ExchangeRate', ['baseCurrency', 'targetCurrency'], { transaction });

      // Webhook table
      await queryInterface.createTable('Webhook', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        url: {
          type: DataTypes.STRING,
          allowNull: false
        },
        event: {
          type: DataTypes.STRING,
          allowNull: false
        },
        active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        secret: DataTypes.STRING,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // WebhookDelivery table
      await queryInterface.createTable('WebhookDelivery', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        webhookId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        payload: DataTypes.JSON,
        status: {
          type: DataTypes.ENUM('pending', 'success', 'failed'),
          defaultValue: 'pending'
        },
        responseStatus: DataTypes.INTEGER,
        responseBody: DataTypes.TEXT,
        retries: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // DashboardLayout table
      await queryInterface.createTable('DashboardLayout', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        layout: DataTypes.JSON,
        widgets: DataTypes.JSON,
        name: DataTypes.STRING,
        isDefault: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // NotificationPreference table
      await queryInterface.createTable('NotificationPreference', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true
        },
        emailNotifications: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        pushNotifications: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        smsNotifications: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        preferences: DataTypes.JSON,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // CommissionRule table
      await queryInterface.createTable('CommissionRule', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        salesTarget: DataTypes.DECIMAL(15, 2),
        commissionRate: DataTypes.DECIMAL(5, 2),
        active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // CommissionTracking table
      await queryInterface.createTable('CommissionTracking', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        commissionRuleId: DataTypes.UUID,
        salesOrderId: DataTypes.UUID,
        amount: DataTypes.DECIMAL(15, 2),
        status: {
          type: DataTypes.ENUM('earned', 'approved', 'paid'),
          defaultValue: 'earned'
        },
        paidDate: DataTypes.DATE,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // FilterPreset table
      await queryInterface.createTable('FilterPreset', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        name: DataTypes.STRING,
        filters: DataTypes.JSON,
        module: DataTypes.STRING,
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await transaction.commit();
      console.log('[MIGRATION] ✓ Initial schema created successfully');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop all tables in reverse dependency order
      const tables = [
        'FilterPreset',
        'CommissionTracking',
        'CommissionRule',
        'NotificationPreference',
        'DashboardLayout',
        'WebhookDelivery',
        'Webhook',
        'ExchangeRate',
        'SustainabilityRecord',
        'CustomerAddress',
        'StockCount',
        'WarehouseTransaction',
        'WarehouseLocation',
        'CertificateOfOrigin',
        'HarmonizedCode',
        'ComplianceRecord',
        'SampleFeedback',
        'SampleShipment',
        'SampleRequest',
        'LandedCostCalculation',
        'LandedCostTemplate',
        'LetterOfCreditDocument',
        'LetterOfCredit',
        'ContainerConfiguration',
        'Container',
        'BatchAllocation',
        'ProductBatch',
        'ProductSpecification',
        'DocumentVersion',
        'Document',
        'InventoryTransaction',
        'InventoryItem',
        'AuditLog',
        'Notification',
        'Payment',
        'InvoiceItem',
        'Invoice',
        'Claim',
        'InspectionReport',
        'InspectionItem',
        'Inspection',
        'ShipmentTracking',
        'Shipment',
        'ShippingDocument',
        'PackingListItem',
        'PackingList',
        'GoodsReceivedNote',
        'PurchaseOrderItem',
        'PurchaseOrder',
        'SalesOrderItem',
        'SalesOrder',
        'ProformaInvoiceItem',
        'ProformaInvoice',
        'QuotationItem',
        'Quotation',
        'InquiryItem',
        'Inquiry',
        'ProductPrice',
        'Product',
        'ProductCategory',
        'Factory',
        'Customer',
        'SSOAccount',
        'User'
      ];

      for (const table of tables) {
        try {
          await queryInterface.dropTable(table, { transaction });
        } catch (error) {
          if (!error.message.includes('does not exist')) {
            throw error;
          }
        }
      }

      await transaction.commit();
      console.log('[MIGRATION] ✓ All tables dropped successfully');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
