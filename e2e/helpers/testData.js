/**
 * Centralized test data factory for E2E tests
 * Provides helper functions to create test data with all required fields
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');

let db = null;

const initDb = (database) => {
  db = database;
};

/**
 * Create a test user with all required fields
 */
const createTestUser = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  const defaults = {
    email: `user${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1234567890',
    role: 'admin',
    isActive: true,
    ...overrides
  };

  const hashedPassword = await bcrypt.hash(defaults.password, 10);

  return db.User.create({
    ...defaults,
    password: hashedPassword
  });
};

/**
 * Create a test customer with all required fields
 */
const createTestCustomer = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  const defaults = {
    companyName: `Test Customer ${Date.now()}`,
    contactPerson: 'John Smith',
    email: `customer${Date.now()}@test.com`,
    phone: '+1234567890',
    address: '123 Business St',
    city: 'New York',
    country: 'USA',
    currency: 'USD',
    paymentTerms: 'Net 30',
    creditLimit: 50000,
    rating: 5.0,
    isActive: true,
    ...overrides
  };

  return db.Customer.create(defaults);
};

/**
 * Create a test factory with all required fields
 */
const createTestFactory = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  const defaults = {
    companyName: `Test Factory ${Date.now()}`,
    contactPerson: 'Wang Wei',
    email: `factory${Date.now()}@test.com`,
    phone: '+86-10-1234567',
    address: '456 Industrial Ave',
    city: 'Shanghai',
    country: 'China',
    currency: 'USD',
    paymentTerms: 'Net 60',
    leadTimeDays: 30,
    rating: 5.0,
    certifications: ['ISO 9001', 'ISO 14001'],
    isActive: true,
    ...overrides
  };

  return db.Factory.create(defaults);
};

/**
 * Create a test product category with all required fields
 */
const createTestCategory = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  const defaults = {
    name: `Category ${Date.now()}`,
    description: 'Test product category',
    isActive: true,
    ...overrides
  };

  return db.ProductCategory.create(defaults);
};

/**
 * Create a test product with all required fields
 * Auto-creates a category and factory if not provided
 */
const createTestProduct = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let categoryId = overrides.categoryId;
  let factoryId = overrides.factoryId;

  // Auto-create category if not provided
  if (!categoryId) {
    const category = await createTestCategory();
    categoryId = category.id;
  }

  // Auto-create factory if not provided
  if (!factoryId) {
    const factory = await createTestFactory();
    factoryId = factory.id;
  }

  const defaults = {
    name: `Test Product ${Date.now()}`,
    sku: `SKU${Date.now()}`,
    description: 'Test product description',
    categoryId,
    factoryId,
    unit: 'sqm',
    specifications: {
      thickness: 10,
      width: 60,
      length: 60,
      material: 'ceramic',
      finish: 'glossy',
      color: 'white',
      pattern: 'solid',
      grade: 'A',
      wearLayer: null
    },
    minOrderQty: 1,
    weight: 25.5,
    hsCode: '6908901000',
    isActive: true,
    ...overrides,
    categoryId, // ensure these aren't overridden
    factoryId
  };

  return db.Product.create(defaults);
};

/**
 * Create a test sales order with all required fields
 * Auto-creates customer and factory if not provided
 */
const createTestSalesOrder = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let customerId = overrides.customerId;
  let factoryId = overrides.factoryId;

  // Auto-create customer if not provided
  if (!customerId) {
    const customer = await createTestCustomer();
    customerId = customer.id;
  }

  // Auto-create factory if not provided
  if (!factoryId) {
    const factory = await createTestFactory();
    factoryId = factory.id;
  }

  const defaults = {
    orderNumber: `SO${Date.now()}`,
    customerId,
    factoryId,
    status: 'confirmed',
    subtotal: 5000,
    discount: 0,
    tax: 500,
    total: 5500,
    currency: 'USD',
    paymentStatus: 'unpaid',
    estimatedDelivery: dayjs().add(30, 'days').toDate(),
    shippingMethod: 'Sea',
    notes: 'Test sales order',
    ...overrides,
    customerId, // ensure these aren't overridden
    factoryId
  };

  return db.SalesOrder.create(defaults);
};

/**
 * Create a test sales order item
 */
const createTestSalesOrderItem = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let salesOrderId = overrides.salesOrderId;
  let productId = overrides.productId;

  // Auto-create sales order if not provided
  if (!salesOrderId) {
    const so = await createTestSalesOrder();
    salesOrderId = so.id;
  }

  // Auto-create product if not provided
  if (!productId) {
    const product = await createTestProduct();
    productId = product.id;
  }

  const defaults = {
    salesOrderId,
    productId,
    quantity: 100,
    unitPrice: 50,
    total: 5000,
    description: 'Test item',
    ...overrides,
    salesOrderId, // ensure these aren't overridden
    productId
  };

  return db.SalesOrderItem.create(defaults);
};

/**
 * Create a test purchase order with all required fields
 * Auto-creates factory if not provided
 */
const createTestPurchaseOrder = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let factoryId = overrides.factoryId;

  // Auto-create factory if not provided
  if (!factoryId) {
    const factory = await createTestFactory();
    factoryId = factory.id;
  }

  const defaults = {
    poNumber: `PO${Date.now()}`,
    factoryId,
    status: 'draft',
    subtotal: 4500,
    total: 4500,
    currency: 'USD',
    expectedDelivery: dayjs().add(60, 'days').toDate(),
    notes: 'Test purchase order',
    ...overrides,
    factoryId // ensure this isn't overridden
  };

  return db.PurchaseOrder.create(defaults);
};

/**
 * Create a test purchase order item
 */
const createTestPurchaseOrderItem = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let purchaseOrderId = overrides.purchaseOrderId;
  let productId = overrides.productId;

  // Auto-create purchase order if not provided
  if (!purchaseOrderId) {
    const po = await createTestPurchaseOrder();
    purchaseOrderId = po.id;
  }

  // Auto-create product if not provided
  if (!productId) {
    const product = await createTestProduct();
    productId = product.id;
  }

  const defaults = {
    purchaseOrderId,
    productId,
    quantity: 100,
    unitPrice: 45,
    total: 4500,
    description: 'Test PO item',
    ...overrides,
    purchaseOrderId, // ensure these aren't overridden
    productId
  };

  return db.PurchaseOrderItem.create(defaults);
};

/**
 * Create a test invoice with all required fields
 * Auto-creates customer if not provided
 */
const createTestInvoice = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let customerId = overrides.customerId;

  // Auto-create customer if not provided
  if (!customerId) {
    const customer = await createTestCustomer();
    customerId = customer.id;
  }

  const dueDate = dayjs().add(30, 'days').toDate();
  const total = 5500;

  const defaults = {
    invoiceNumber: `INV${Date.now()}`,
    customerId,
    type: 'sales',
    status: 'sent',
    subtotal: 5000,
    discount: 0,
    tax: 500,
    total,
    currency: 'USD',
    dueDate,
    paidAmount: 0,
    balance: total,
    paymentTerms: 'Net 30',
    notes: 'Test invoice',
    ...overrides,
    customerId // ensure this isn't overridden
  };

  return db.Invoice.create(defaults);
};

/**
 * Create a test invoice item
 */
const createTestInvoiceItem = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let invoiceId = overrides.invoiceId;
  let productId = overrides.productId;

  // Auto-create invoice if not provided
  if (!invoiceId) {
    const invoice = await createTestInvoice();
    invoiceId = invoice.id;
  }

  // Auto-create product if not provided
  if (!productId) {
    const product = await createTestProduct();
    productId = product.id;
  }

  const defaults = {
    invoiceId,
    productId,
    quantity: 100,
    unitPrice: 50,
    total: 5000,
    description: 'Test invoice item',
    ...overrides,
    invoiceId, // ensure these aren't overridden
    productId
  };

  return db.InvoiceItem.create(defaults);
};

/**
 * Create a test shipment with all required fields
 * Auto-creates sales order if not provided
 */
const createTestShipment = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let salesOrderId = overrides.salesOrderId;

  // Auto-create sales order if not provided
  if (!salesOrderId) {
    const so = await createTestSalesOrder();
    salesOrderId = so.id;
  }

  const eta = dayjs().add(45, 'days').toDate();

  const defaults = {
    salesOrderId,
    shipmentNumber: `SHIP${Date.now()}`,
    carrier: 'MSC',
    vesselName: 'Test Vessel',
    voyageNumber: 'TEST001',
    containerNumber: 'CONT123456789',
    containerType: '40ft',
    portOfLoading: 'Shanghai',
    portOfDischarge: 'Los Angeles',
    etd: dayjs().add(5, 'days').toDate(),
    eta,
    status: 'booked',
    currentLocation: 'Shanghai Port',
    notes: 'Test shipment',
    ...overrides,
    salesOrderId // ensure this isn't overridden
  };

  return db.Shipment.create(defaults);
};

/**
 * Create a test payment
 */
const createTestPayment = async (overrides = {}) => {
  if (!db) throw new Error('Database not initialized in testData');

  let invoiceId = overrides.invoiceId;

  // Auto-create invoice if not provided
  if (!invoiceId) {
    const invoice = await createTestInvoice();
    invoiceId = invoice.id;
  }

  const defaults = {
    invoiceId,
    amount: 5500,
    currency: 'USD',
    method: 'bank_transfer',
    reference: `PAY${Date.now()}`,
    status: 'completed',
    notes: 'Test payment',
    ...overrides,
    invoiceId // ensure this isn't overridden
  };

  return db.Payment.create(defaults);
};

module.exports = {
  initDb,
  createTestUser,
  createTestCustomer,
  createTestFactory,
  createTestCategory,
  createTestProduct,
  createTestSalesOrder,
  createTestSalesOrderItem,
  createTestPurchaseOrder,
  createTestPurchaseOrderItem,
  createTestInvoice,
  createTestInvoiceItem,
  createTestShipment,
  createTestPayment
};
