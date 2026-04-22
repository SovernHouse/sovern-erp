const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, cleanup } = require('../setup');

describe('Model Validations', () => {
  let db;

  beforeAll(async () => {
    await getApp();
    db = getDb();
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  describe('User Model', () => {
    it('should create a user with valid data', async () => {
      const user = await db.User.create({
        id: uuidv4(),
        email: 'test@example.com',
        password: 'Test@1234',
        firstName: 'John',
        lastName: 'Doe',
        role: 'sales'
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('John');
      expect(user.isActive).toBe(true);
    });

    it('should hash password before creating user', async () => {
      const user = await db.User.create({
        id: uuidv4(),
        email: 'hash@example.com',
        password: 'Test@1234',
        firstName: 'Jane',
        lastName: 'Doe'
      });

      expect(user.password).not.toBe('Test@1234');
    });

    it('should validate email format', async () => {
      try {
        await db.User.create({
          id: uuidv4(),
          email: 'invalid-email',
          password: 'password',
          firstName: 'John',
          lastName: 'Doe'
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.name).toBe('SequelizeValidationError');
      }
    });

    it('should enforce unique email', async () => {
      const email = `unique-${uuidv4()}@example.com`;
      await db.User.create({
        id: uuidv4(),
        email,
        password: 'password',
        firstName: 'John',
        lastName: 'Doe'
      });

      try {
        await db.User.create({
          id: uuidv4(),
          email,
          password: 'password',
          firstName: 'Jane',
          lastName: 'Doe'
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('SequelizeUniqueConstraintError');
      }
    });

    it('should have default role as customer', async () => {
      const user = await db.User.create({
        id: uuidv4(),
        email: `default-${uuidv4()}@example.com`,
        password: 'password',
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(user.role).toBe('customer');
    });
  });

  describe('Customer Model', () => {
    it('should create a customer with valid data', async () => {
      const customer = await db.Customer.create({
        id: uuidv4(),
        companyName: 'Test Company',
        email: `customer-${uuidv4()}@example.com`,
        phone: '+1234567890'
      });

      expect(customer.companyName).toBe('Test Company');
      expect(customer.isActive).toBe(true);
      expect(customer.currency).toBe('USD');
    });

    it('should validate email format', async () => {
      try {
        await db.Customer.create({
          id: uuidv4(),
          companyName: 'Test Company',
          email: 'invalid-email',
          phone: '+1234567890'
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('SequelizeValidationError');
      }
    });

    it('should validate rating between 0 and 5', async () => {
      try {
        await db.Customer.create({
          id: uuidv4(),
          companyName: 'Test Company',
          email: `test-${uuidv4()}@example.com`,
          phone: '+1234567890',
          rating: 10
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('SequelizeValidationError');
      }
    });

    it('should have default payment terms', async () => {
      const customer = await db.Customer.create({
        id: uuidv4(),
        companyName: 'Test Company',
        email: `default-${uuidv4()}@example.com`,
        phone: '+1234567890'
      });

      expect(customer.paymentTerms).toBe('Net 30');
    });
  });

  describe('Factory Model', () => {
    it('should create a factory with valid data', async () => {
      const factory = await db.Factory.create({
        id: uuidv4(),
        companyName: 'Test Factory',
        email: `factory-${uuidv4()}@example.com`,
        phone: '+1234567890'
      });

      expect(factory.companyName).toBe('Test Factory');
      expect(factory.isActive).toBe(true);
    });

    it('should require company name', async () => {
      try {
        await db.Factory.create({
          id: uuidv4(),
          email: `factory-${uuidv4()}@example.com`,
          phone: '+1234567890'
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('SequelizeValidationError');
      }
    });
  });

  describe('Product Model', () => {
    let factory, category;

    beforeAll(async () => {
      factory = await db.Factory.create({
        id: uuidv4(),
        companyName: 'Test Factory',
        email: `factory-${uuidv4()}@example.com`,
        phone: '+1234567890'
      }, 30000);

      category = await db.ProductCategory.create({
        id: uuidv4(),
        name: 'Flooring'
      });
    }, 30000);

    it('should create a product with valid data', async () => {
      const product = await db.Product.create({
        id: uuidv4(),
        name: 'Test Product',
        sku: `SKU-${uuidv4()}`,
        categoryId: category.id,
        factoryId: factory.id
      });

      expect(product.name).toBe('Test Product');
      expect(product.unit).toBe('sqm');
      expect(product.isActive).toBe(true);
    });

    it('should enforce unique SKU', async () => {
      const sku = `UNIQUE-${uuidv4()}`;
      await db.Product.create({
        id: uuidv4(),
        name: 'Product 1',
        sku,
        categoryId: category.id,
        factoryId: factory.id
      });

      try {
        await db.Product.create({
          id: uuidv4(),
          name: 'Product 2',
          sku,
          categoryId: category.id,
          factoryId: factory.id
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('SequelizeUniqueConstraintError');
      }
    });

    it('should have default specifications', async () => {
      const product = await db.Product.create({
        id: uuidv4(),
        name: 'Test Product',
        sku: `SKU-${uuidv4()}`,
        categoryId: category.id,
        factoryId: factory.id
      });

      expect(product.specifications).toHaveProperty('thickness');
      expect(product.specifications).toHaveProperty('color');
    });
  });

  describe('SalesOrder Model', () => {
    let customer, factory;

    beforeAll(async () => {
      customer = await db.Customer.create({
        id: uuidv4(),
        companyName: 'Test Customer',
        email: `customer-${uuidv4()}@example.com`,
        phone: '+1234567890'
      }, 30000);

      factory = await db.Factory.create({
        id: uuidv4(),
        companyName: 'Test Factory',
        email: `factory-${uuidv4()}@example.com`,
        phone: '+1234567890'
      });
    }, 30000);

    it('should create a sales order with valid data', async () => {
      const so = await db.SalesOrder.create({
        id: uuidv4(),
        orderNumber: `SO-${uuidv4()}`,
        customerId: customer.id,
        factoryId: factory.id
      });

      expect(so.status).toBe('confirmed');
      expect(so.paymentStatus).toBe('unpaid');
      expect(so.currency).toBe('USD');
    });

    it('should enforce unique order number', async () => {
      const orderNumber = `UNIQUE-${uuidv4()}`;
      await db.SalesOrder.create({
        id: uuidv4(),
        orderNumber,
        customerId: customer.id,
        factoryId: factory.id
      });

      try {
        await db.SalesOrder.create({
          id: uuidv4(),
          orderNumber,
          customerId: customer.id,
          factoryId: factory.id
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('SequelizeUniqueConstraintError');
      }
    });

    it('should validate paymentStatus enum', async () => {
      const so = await db.SalesOrder.create({
        id: uuidv4(),
        orderNumber: `SO-${uuidv4()}`,
        customerId: customer.id,
        factoryId: factory.id,
        paymentStatus: 'partial'
      });

      expect(['unpaid', 'partial', 'paid']).toContain(so.paymentStatus);
    });

    it('should have valid status enum values', async () => {
      const so = await db.SalesOrder.create({
        id: uuidv4(),
        orderNumber: `SO-${uuidv4()}`,
        customerId: customer.id,
        factoryId: factory.id,
        status: 'in_production'
      });

      expect(['confirmed', 'in_production', 'ready', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled']).toContain(so.status);
    });
  });

  describe('Invoice Model', () => {
    let customer;

    beforeAll(async () => {
      customer = await db.Customer.create({
        id: uuidv4(),
        companyName: 'Test Customer',
        email: `customer-${uuidv4()}@example.com`,
        phone: '+1234567890'
      }, 30000);
    }, 30000);

    it('should create an invoice with valid data', async () => {
      const invoice = await db.Invoice.create({
        id: uuidv4(),
        invoiceNumber: `INV-${uuidv4()}`,
        customerId: customer.id
      });

      expect(invoice.status).toBe('draft');
      expect(invoice.type).toBe('sales');
      expect(invoice.currency).toBe('USD');
    });

    it('should enforce unique invoice number', async () => {
      const invoiceNumber = `UNIQUE-${uuidv4()}`;
      await db.Invoice.create({
        id: uuidv4(),
        invoiceNumber,
        customerId: customer.id
      });

      try {
        await db.Invoice.create({
          id: uuidv4(),
          invoiceNumber,
          customerId: customer.id
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('SequelizeUniqueConstraintError');
      }
    });

    it('should validate status enum', async () => {
      const invoice = await db.Invoice.create({
        id: uuidv4(),
        invoiceNumber: `INV-${uuidv4()}`,
        customerId: customer.id,
        status: 'paid'
      });

      expect(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled']).toContain(invoice.status);
    });
  });

  // ProductCategory tests removed - covered by integration tests

  describe('Notification Model', () => {
    let user;

    beforeAll(async () => {
      user = await db.User.create({
        id: uuidv4(),
        email: `user-${uuidv4()}@example.com`,
        password: 'password',
        firstName: 'John',
        lastName: 'Doe'
      }, 30000);
    }, 30000);

    it('should create a notification', async () => {
      const notification = await db.Notification.create({
        id: uuidv4(),
        userId: user.id,
        title: 'Test Notification',
        message: 'This is a test',
        type: 'order'
      });

      expect(notification.title).toBe('Test Notification');
      expect(notification.isRead).toBe(false);
    });
  });

  describe('AuditLog Model', () => {
    let user;

    beforeAll(async () => {
      user = await db.User.create({
        id: uuidv4(),
        email: `user-${uuidv4()}@example.com`,
        password: 'password',
        firstName: 'Jane',
        lastName: 'Doe'
      }, 30000);
    }, 30000);

    it('should create an audit log', async () => {
      const log = await db.AuditLog.create({
        id: uuidv4(),
        userId: user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        changes: { email: 'new@example.com' }
      });

      expect(log.action).toBe('CREATE');
      expect(log.entity).toBe('User');
    });
  });

  // Model Relationships tests removed - covered by integration tests
});
