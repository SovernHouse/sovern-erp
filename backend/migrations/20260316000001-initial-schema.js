'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // User table
      await queryInterface.createTable('User', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        password: {
          type: Sequelize.STRING,
          allowNull: false
        },
        firstName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        lastName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: true
        },
        avatar: {
          type: Sequelize.STRING,
          allowNull: true
        },
        role: {
          type: Sequelize.ENUM('admin', 'sales', 'operations', 'finance', 'inspector', 'customer', 'factory'),
          defaultValue: 'customer'
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        lastLogin: {
          type: Sequelize.DATE,
          allowNull: true
        },
        preferences: {
          type: Sequelize.JSON,
          defaultValue: {
            theme: 'light',
            language: 'en',
            notifications: true,
            emailNotifications: true
          }
        },
        resetToken: {
          type: Sequelize.STRING,
          allowNull: true
        },
        resetExpiry: {
          type: Sequelize.DATE,
          allowNull: true
        },
        companyId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for User
      await queryInterface.addIndex('User', ['email'], { transaction });
      await queryInterface.addIndex('User', ['role'], { transaction });
      await queryInterface.addIndex('User', ['is_active'], { transaction });

      // ProductCategory table
      await queryInterface.createTable('ProductCategory', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        image: {
          type: Sequelize.STRING,
          allowNull: true
        },
        parentId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'ProductCategory',
            key: 'id'
          }
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Customer table
      await queryInterface.createTable('Customer', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        companyName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        contactPerson: {
          type: Sequelize.STRING,
          allowNull: true
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: false
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        city: {
          type: Sequelize.STRING,
          allowNull: true
        },
        country: {
          type: Sequelize.STRING,
          allowNull: true
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        paymentTerms: {
          type: Sequelize.STRING,
          defaultValue: 'Net 30'
        },
        creditLimit: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        balance: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        rating: {
          type: Sequelize.FLOAT,
          defaultValue: 5.0
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        logo: {
          type: Sequelize.STRING,
          allowNull: true
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Customer
      await queryInterface.addIndex('Customer', ['email'], { transaction });
      await queryInterface.addIndex('Customer', ['company_name'], { transaction });
      await queryInterface.addIndex('Customer', ['is_active'], { transaction });
      await queryInterface.addIndex('Customer', ['country'], { transaction });

      // Factory table
      await queryInterface.createTable('Factory', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        companyName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        contactPerson: {
          type: Sequelize.STRING,
          allowNull: true
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: false
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        city: {
          type: Sequelize.STRING,
          allowNull: true
        },
        country: {
          type: Sequelize.STRING,
          allowNull: true
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        paymentTerms: {
          type: Sequelize.STRING,
          defaultValue: 'Net 60'
        },
        leadTimeDays: {
          type: Sequelize.INTEGER,
          defaultValue: 30
        },
        rating: {
          type: Sequelize.FLOAT,
          defaultValue: 5.0
        },
        certifications: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        specializations: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        logo: {
          type: Sequelize.STRING,
          allowNull: true
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Factory
      await queryInterface.addIndex('Factory', ['email'], { transaction });
      await queryInterface.addIndex('Factory', ['company_name'], { transaction });
      await queryInterface.addIndex('Factory', ['is_active'], { transaction });

      // Product table
      await queryInterface.createTable('Product', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        sku: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        categoryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'ProductCategory',
            key: 'id'
          }
        },
        factoryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Factory',
            key: 'id'
          }
        },
        unit: {
          type: Sequelize.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
          defaultValue: 'sqm'
        },
        specifications: {
          type: Sequelize.JSON,
          defaultValue: {
            thickness: null,
            width: null,
            length: null,
            material: null,
            finish: null,
            color: null,
            pattern: null,
            grade: null,
            wearLayer: null
          }
        },
        images: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        minOrderQty: {
          type: Sequelize.DECIMAL(10, 2),
          defaultValue: 1
        },
        weight: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        hsCode: {
          type: Sequelize.STRING,
          allowNull: true
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Product
      await queryInterface.addIndex('Product', ['name'], { transaction });
      await queryInterface.addIndex('Product', ['sku'], { transaction });
      await queryInterface.addIndex('Product', ['category_id'], { transaction });
      await queryInterface.addIndex('Product', ['factory_id'], { transaction });
      await queryInterface.addIndex('Product', ['is_active'], { transaction });

      // ProductPrice table
      await queryInterface.createTable('ProductPrice', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        factoryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Factory',
            key: 'id'
          }
        },
        costPrice: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        markup: {
          type: Sequelize.DECIMAL(5, 2),
          defaultValue: 20
        },
        sellingPrice: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        validFrom: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        validTo: {
          type: Sequelize.DATE,
          allowNull: true
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Inquiry table
      await queryInterface.createTable('Inquiry', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        inquiryNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        salesPersonId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.ENUM('new', 'in_review', 'quoted', 'follow_up', 'converted', 'lost', 'cancelled'),
          defaultValue: 'new'
        },
        source: {
          type: Sequelize.ENUM('web', 'email', 'phone', 'portal'),
          defaultValue: 'email'
        },
        priority: {
          type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
          defaultValue: 'medium'
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        followUpDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        convertedToQuotationId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        estimatedValue: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Inquiry
      await queryInterface.addIndex('Inquiry', ['inquiry_number'], { transaction });
      await queryInterface.addIndex('Inquiry', ['status'], { transaction });
      await queryInterface.addIndex('Inquiry', ['customer_id'], { transaction });
      await queryInterface.addIndex('Inquiry', ['sales_person_id'], { transaction });

      // InquiryItem table
      await queryInterface.createTable('InquiryItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        inquiryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Inquiry',
            key: 'id'
          }
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        unit: {
          type: Sequelize.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
          defaultValue: 'sqm'
        },
        targetPrice: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        specifications: {
          type: Sequelize.JSON,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Quotation table
      await queryInterface.createTable('Quotation', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        quotationNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        inquiryId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Inquiry',
            key: 'id'
          }
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        salesPersonId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.ENUM('draft', 'sent', 'revised', 'accepted', 'rejected', 'expired'),
          defaultValue: 'draft'
        },
        subtotal: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        discount: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        discountType: {
          type: Sequelize.ENUM('percentage', 'fixed'),
          defaultValue: 'fixed'
        },
        tax: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        taxRate: {
          type: Sequelize.DECIMAL(5, 2),
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        validUntil: {
          type: Sequelize.DATE,
          allowNull: true
        },
        terms: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        version: {
          type: Sequelize.INTEGER,
          defaultValue: 1
        },
        parentQuotationId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Quotation',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Quotation
      await queryInterface.addIndex('Quotation', ['quotation_number'], { transaction });
      await queryInterface.addIndex('Quotation', ['status'], { transaction });
      await queryInterface.addIndex('Quotation', ['customer_id'], { transaction });
      await queryInterface.addIndex('Quotation', ['inquiry_id'], { transaction });

      // QuotationItem table
      await queryInterface.createTable('QuotationItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        quotationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Quotation',
            key: 'id'
          }
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        unit: {
          type: Sequelize.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
          defaultValue: 'sqm'
        },
        unitPrice: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        discount: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ProformaInvoice table
      await queryInterface.createTable('ProformaInvoice', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        piNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        quotationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Quotation',
            key: 'id'
          }
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.ENUM('draft', 'sent', 'confirmed', 'cancelled'),
          defaultValue: 'draft'
        },
        subtotal: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        discount: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        tax: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        paymentTerms: {
          type: Sequelize.STRING,
          defaultValue: 'Net 30'
        },
        bankDetails: {
          type: Sequelize.JSON,
          defaultValue: {}
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        validUntil: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ProformaInvoiceItem table
      await queryInterface.createTable('ProformaInvoiceItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        proformaInvoiceId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'ProformaInvoice',
            key: 'id'
          }
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        unit: {
          type: Sequelize.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
          defaultValue: 'sqm'
        },
        unitPrice: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // SalesOrder table
      await queryInterface.createTable('SalesOrder', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        orderNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        proformaInvoiceId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'ProformaInvoice',
            key: 'id'
          }
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        factoryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Factory',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.ENUM('confirmed', 'in_production', 'ready', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled'),
          defaultValue: 'confirmed'
        },
        subtotal: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        discount: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        tax: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        paymentStatus: {
          type: Sequelize.ENUM('unpaid', 'partial', 'paid'),
          defaultValue: 'unpaid'
        },
        estimatedDelivery: {
          type: Sequelize.DATE,
          allowNull: true
        },
        actualDelivery: {
          type: Sequelize.DATE,
          allowNull: true
        },
        shippingMethod: {
          type: Sequelize.STRING,
          allowNull: true
        },
        trackingNumber: {
          type: Sequelize.STRING,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for SalesOrder
      await queryInterface.addIndex('SalesOrder', ['order_number'], { transaction });
      await queryInterface.addIndex('SalesOrder', ['status'], { transaction });
      await queryInterface.addIndex('SalesOrder', ['customer_id'], { transaction });
      await queryInterface.addIndex('SalesOrder', ['factory_id'], { transaction });

      // SalesOrderItem table
      await queryInterface.createTable('SalesOrderItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        unit: {
          type: Sequelize.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
          defaultValue: 'sqm'
        },
        unitPrice: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'in_production', 'ready', 'shipped', 'delivered'),
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // PurchaseOrder table
      await queryInterface.createTable('PurchaseOrder', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        poNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        factoryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Factory',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.ENUM('draft', 'sent', 'confirmed', 'in_production', 'ready', 'shipped', 'received', 'completed', 'cancelled'),
          defaultValue: 'draft'
        },
        subtotal: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        expectedDelivery: {
          type: Sequelize.DATE,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for PurchaseOrder
      await queryInterface.addIndex('PurchaseOrder', ['po_number'], { transaction });
      await queryInterface.addIndex('PurchaseOrder', ['status'], { transaction });
      await queryInterface.addIndex('PurchaseOrder', ['factory_id'], { transaction });
      await queryInterface.addIndex('PurchaseOrder', ['sales_order_id'], { transaction });

      // PurchaseOrderItem table
      await queryInterface.createTable('PurchaseOrderItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        purchaseOrderId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'PurchaseOrder',
            key: 'id'
          }
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        unit: {
          type: Sequelize.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
          defaultValue: 'sqm'
        },
        unitPrice: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'in_production', 'ready', 'shipped', 'received'),
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // PackingList table
      await queryInterface.createTable('PackingList', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        packingListNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.ENUM('draft', 'confirmed'),
          defaultValue: 'draft'
        },
        totalPackages: {
          type: Sequelize.INTEGER,
          defaultValue: 0
        },
        totalGrossWeight: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        totalNetWeight: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        totalVolume: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // PackingListItem table
      await queryInterface.createTable('PackingListItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        packingListId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'PackingList',
            key: 'id'
          }
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        unit: {
          type: Sequelize.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
          defaultValue: 'sqm'
        },
        packageNumber: {
          type: Sequelize.STRING,
          allowNull: true
        },
        grossWeight: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        },
        netWeight: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        },
        dimensions: {
          type: Sequelize.JSON,
          defaultValue: {}
        },
        marks: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ShippingDocument table
      await queryInterface.createTable('ShippingDocument', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        type: {
          type: Sequelize.ENUM('bill_of_lading', 'airway_bill', 'certificate_of_origin', 'insurance', 'customs', 'phytosanitary', 'fumigation', 'inspection_cert', 'other'),
          allowNull: false
        },
        documentNumber: {
          type: Sequelize.STRING,
          allowNull: false
        },
        fileUrl: {
          type: Sequelize.STRING,
          allowNull: true
        },
        uploadedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        issuedDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Shipment table
      await queryInterface.createTable('Shipment', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        shipmentNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        carrier: {
          type: Sequelize.STRING,
          allowNull: true
        },
        vesselName: {
          type: Sequelize.STRING,
          allowNull: true
        },
        voyageNumber: {
          type: Sequelize.STRING,
          allowNull: true
        },
        containerNumber: {
          type: Sequelize.STRING,
          allowNull: true
        },
        containerType: {
          type: Sequelize.ENUM('20ft', '40ft', '40hc', 'LCL'),
          allowNull: true
        },
        portOfLoading: {
          type: Sequelize.STRING,
          allowNull: true
        },
        portOfDischarge: {
          type: Sequelize.STRING,
          allowNull: true
        },
        etd: {
          type: Sequelize.DATE,
          allowNull: true
        },
        eta: {
          type: Sequelize.DATE,
          allowNull: true
        },
        actualDeparture: {
          type: Sequelize.DATE,
          allowNull: true
        },
        actualArrival: {
          type: Sequelize.DATE,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('booked', 'loaded', 'in_transit', 'at_port', 'customs', 'delivered'),
          defaultValue: 'booked'
        },
        currentLocation: {
          type: Sequelize.STRING,
          allowNull: true
        },
        trackingUrl: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Shipment
      await queryInterface.addIndex('Shipment', ['status'], { transaction });
      await queryInterface.addIndex('Shipment', ['sales_order_id'], { transaction });

      // ShipmentTracking table
      await queryInterface.createTable('ShipmentTracking', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        shipmentId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Shipment',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false
        },
        location: {
          type: Sequelize.STRING,
          allowNull: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        timestamp: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updatedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Inspection table
      await queryInterface.createTable('Inspection', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        inspectionNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        purchaseOrderId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'PurchaseOrder',
            key: 'id'
          }
        },
        factoryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Factory',
            key: 'id'
          }
        },
        inspectorId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        type: {
          type: Sequelize.ENUM('pre_production', 'during_production', 'pre_shipment', 'loading'),
          allowNull: false
        },
        scheduledDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        completedDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('scheduled', 'in_progress', 'passed', 'failed', 'conditional'),
          defaultValue: 'scheduled'
        },
        overallResult: {
          type: Sequelize.ENUM('pass', 'fail', 'conditional'),
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // InspectionItem table
      await queryInterface.createTable('InspectionItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        inspectionId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Inspection',
            key: 'id'
          }
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        checkPoint: {
          type: Sequelize.STRING,
          allowNull: false
        },
        criteria: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        result: {
          type: Sequelize.ENUM('pass', 'fail', 'na'),
          allowNull: true
        },
        value: {
          type: Sequelize.STRING,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        images: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // InspectionReport table
      await queryInterface.createTable('InspectionReport', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        inspectionId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Inspection',
            key: 'id'
          }
        },
        reportNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        summary: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        findings: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        recommendations: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        images: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        fileUrl: {
          type: Sequelize.STRING,
          allowNull: true
        },
        generatedAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Claim table
      await queryInterface.createTable('Claim', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        claimNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        type: {
          type: Sequelize.ENUM('quality', 'damage', 'shortage', 'wrong_item', 'delay', 'other'),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('submitted', 'under_review', 'investigating', 'resolved', 'rejected', 'closed'),
          defaultValue: 'submitted'
        },
        priority: {
          type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
          defaultValue: 'medium'
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        resolution: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        compensationType: {
          type: Sequelize.ENUM('replacement', 'refund', 'credit', 'repair'),
          allowNull: true
        },
        compensationAmount: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true
        },
        images: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        submittedAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        resolvedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Invoice table
      await queryInterface.createTable('Invoice', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        invoiceNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        salesOrderId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'SalesOrder',
            key: 'id'
          }
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        type: {
          type: Sequelize.ENUM('sales', 'purchase', 'credit_note', 'debit_note'),
          defaultValue: 'sales'
        },
        status: {
          type: Sequelize.ENUM('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'),
          defaultValue: 'draft'
        },
        subtotal: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        discount: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        tax: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        dueDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        paidAmount: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        balance: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        paymentTerms: {
          type: Sequelize.STRING,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Invoice
      await queryInterface.addIndex('Invoice', ['invoice_number'], { transaction });
      await queryInterface.addIndex('Invoice', ['status'], { transaction });
      await queryInterface.addIndex('Invoice', ['customer_id'], { transaction });
      await queryInterface.addIndex('Invoice', ['sales_order_id'], { transaction });

      // Payment table
      await queryInterface.createTable('Payment', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        invoiceId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Invoice',
            key: 'id'
          }
        },
        amount: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        method: {
          type: Sequelize.ENUM('bank_transfer', 'cheque', 'cash', 'lc', 'credit_card'),
          allowNull: false
        },
        reference: {
          type: Sequelize.STRING,
          allowNull: true
        },
        date: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('pending', 'confirmed', 'rejected'),
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Payment
      await queryInterface.addIndex('Payment', ['status'], { transaction });
      await queryInterface.addIndex('Payment', ['invoice_id'], { transaction });

      // Notification table
      await queryInterface.createTable('Notification', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        type: {
          type: Sequelize.ENUM('inquiry', 'quotation', 'order', 'shipment', 'inspection', 'claim', 'payment', 'system'),
          allowNull: false
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        data: {
          type: Sequelize.JSON,
          defaultValue: {}
        },
        isRead: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        link: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Notification
      await queryInterface.addIndex('Notification', ['user_id'], { transaction });
      await queryInterface.addIndex('Notification', ['is_read'], { transaction });

      // AuditLog table
      await queryInterface.createTable('AuditLog', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        action: {
          type: Sequelize.STRING,
          allowNull: false
        },
        entity: {
          type: Sequelize.STRING,
          allowNull: false
        },
        entityId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        changes: {
          type: Sequelize.JSON,
          defaultValue: {}
        },
        ipAddress: {
          type: Sequelize.STRING,
          allowNull: true
        },
        timestamp: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // InventoryItem table
      await queryInterface.createTable('InventoryItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        productId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Product',
            key: 'id'
          }
        },
        warehouseLocation: {
          type: Sequelize.STRING,
          allowNull: true
        },
        quantity: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        reservedQty: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        availableQty: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        reorderLevel: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        reorderQty: {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0
        },
        lastStockCheck: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // InventoryTransaction table
      await queryInterface.createTable('InventoryTransaction', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        inventoryItemId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'InventoryItem',
            key: 'id'
          }
        },
        type: {
          type: Sequelize.ENUM('in', 'out', 'adjustment', 'transfer'),
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        reference: {
          type: Sequelize.STRING,
          allowNull: true
        },
        referenceType: {
          type: Sequelize.STRING,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        performedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Document table
      await queryInterface.createTable('Document', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('template', 'generated', 'uploaded'),
          defaultValue: 'uploaded'
        },
        category: {
          type: Sequelize.ENUM('quotation', 'proforma_invoice', 'sales_order', 'purchase_order', 'invoice', 'packing_list', 'shipping', 'inspection', 'contract', 'other'),
          defaultValue: 'other'
        },
        fileUrl: {
          type: Sequelize.STRING,
          allowNull: true
        },
        fileName: {
          type: Sequelize.STRING,
          allowNull: true
        },
        fileSize: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        mimeType: {
          type: Sequelize.STRING,
          allowNull: true
        },
        templateData: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        customFields: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        entityType: {
          type: Sequelize.STRING,
          allowNull: true
        },
        entityId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        version: {
          type: Sequelize.INTEGER,
          defaultValue: 1
        },
        isDefault: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        createdBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        tags: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for Document
      await queryInterface.addIndex('Document', ['type'], { transaction });
      await queryInterface.addIndex('Document', ['category'], { transaction });
      await queryInterface.addIndex('Document', ['entity_type', 'entity_id'], { transaction });
      await queryInterface.addIndex('Document', ['created_by'], { transaction });
      await queryInterface.addIndex('Document', ['is_active'], { transaction });

      // CRM Models
      // Lead table
      await queryInterface.createTable('Leads', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        companyName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        contactName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: true
        },
        source: {
          type: Sequelize.ENUM('website', 'referral', 'trade_show', 'cold_call', 'social_media', 'advertisement', 'other'),
          defaultValue: 'other'
        },
        status: {
          type: Sequelize.ENUM('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'),
          defaultValue: 'new'
        },
        assignedToId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        industry: {
          type: Sequelize.STRING,
          allowNull: true
        },
        estimatedValue: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        probability: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        expectedCloseDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        address: {
          type: Sequelize.STRING,
          allowNull: true
        },
        city: {
          type: Sequelize.STRING,
          allowNull: true
        },
        country: {
          type: Sequelize.STRING,
          allowNull: true
        },
        lostReason: {
          type: Sequelize.STRING,
          allowNull: true
        },
        wonDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        lostDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        convertedCustomerId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        tags: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Deal table
      await queryInterface.createTable('Deals', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        dealNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        contactId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        assignedToId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        stage: {
          type: Sequelize.ENUM('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'),
          defaultValue: 'prospecting'
        },
        value: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'USD'
        },
        probability: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        expectedCloseDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        actualCloseDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        source: {
          type: Sequelize.STRING,
          allowNull: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        tags: {
          type: Sequelize.JSON,
          defaultValue: []
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Contact table
      await queryInterface.createTable('Contacts', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        factoryId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Factory',
            key: 'id'
          }
        },
        firstName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        lastName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: true
        },
        mobile: {
          type: Sequelize.STRING,
          allowNull: true
        },
        jobTitle: {
          type: Sequelize.STRING,
          allowNull: true
        },
        department: {
          type: Sequelize.STRING,
          allowNull: true
        },
        isPrimary: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        birthday: {
          type: Sequelize.DATE,
          allowNull: true
        },
        avatar: {
          type: Sequelize.STRING,
          allowNull: true
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Activity table
      await queryInterface.createTable('Activities', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        type: {
          type: Sequelize.ENUM('call', 'email', 'meeting', 'note', 'task', 'follow_up'),
          allowNull: false
        },
        subject: {
          type: Sequelize.STRING,
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        contactId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Contacts',
            key: 'id'
          }
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Customer',
            key: 'id'
          }
        },
        leadId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Leads',
            key: 'id'
          }
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'User',
            key: 'id'
          }
        },
        scheduledAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        completedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        duration: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        outcome: {
          type: Sequelize.STRING,
          allowNull: true
        },
        isCompleted: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        priority: {
          type: Sequelize.ENUM('low', 'medium', 'high'),
          defaultValue: 'medium'
        },
        reminder: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Campaign table
      await queryInterface.createTable('Campaigns', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('email', 'trade_show', 'advertisement', 'social_media', 'referral', 'other'),
          defaultValue: 'other'
        },
        status: {
          type: Sequelize.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
          defaultValue: 'draft'
        },
        startDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        endDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        budget: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true
        },
        actualCost: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        expectedRevenue: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true
        },
        actualRevenue: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        targetAudience: {
          type: Sequelize.STRING,
          allowNull: true
        },
        leadsCount: {
          type: Sequelize.INTEGER,
          defaultValue: 0
        },
        conversionsCount: {
          type: Sequelize.INTEGER,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop tables in reverse order of foreign key dependencies
      const tables = [
        'Campaigns', 'Activities', 'Contacts', 'Deals', 'Leads',
        'Document', 'InventoryTransaction', 'InventoryItem', 'AuditLog',
        'Notification', 'Payment', 'Invoice', 'Claim', 'InspectionReport',
        'InspectionItem', 'Inspection', 'ShipmentTracking', 'Shipment',
        'ShippingDocument', 'PackingListItem', 'PackingList',
        'PurchaseOrderItem', 'PurchaseOrder', 'SalesOrderItem', 'SalesOrder',
        'ProformaInvoiceItem', 'ProformaInvoice', 'QuotationItem', 'Quotation',
        'InquiryItem', 'Inquiry', 'ProductPrice', 'Product',
        'Factory', 'Customer', 'ProductCategory', 'User'
      ];

      for (const table of tables) {
        await queryInterface.dropTable(table, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
