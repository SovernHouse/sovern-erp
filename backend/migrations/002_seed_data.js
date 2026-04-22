/**
 * Seed Data Migration
 * Creates default admin user and demo data for development
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Hash password for admin user
      const adminPassword = await bcrypt.hash('Admin123!', 10);

      // Create admin user
      const adminUserId = uuidv4();
      await queryInterface.bulkInsert('User', [
        {
          id: adminUserId,
          email: 'admin@erp.com',
          password: adminPassword,
          firstName: 'System',
          lastName: 'Administrator',
          phone: '+1-555-0100',
          avatar: null,
          role: 'admin',
          isActive: true,
          lastLogin: null,
          preferences: JSON.stringify({
            theme: 'light',
            language: 'en',
            notifications: true,
            emailNotifications: true
          }),
          created_at: new Date(),
          updated_at: new Date()
        }
      ], { transaction });

      // Create demo customers
      const customers = [
        {
          id: uuidv4(),
          name: 'Global Traders Inc',
          email: 'contact@globaltraders.com',
          phone: '+1-555-0101',
          country: 'United States',
          city: 'New York',
          address: '123 Trade Street, New York, NY 10001',
          taxId: 'US123456789',
          companyType: 'Importer',
          website: 'https://globaltraders.com',
          creditLimit: 100000.00,
          outstandingAmount: 0.00,
          status: 'active',
          notes: 'Preferred customer with strong payment history',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'European Wholesale Ltd',
          email: 'sales@eurowholesale.com',
          phone: '+44-20-7946-0958',
          country: 'United Kingdom',
          city: 'London',
          address: '456 Commerce Road, London, UK',
          taxId: 'GB987654321',
          companyType: 'Distributor',
          website: 'https://eurowholesale.com',
          creditLimit: 75000.00,
          outstandingAmount: 0.00,
          status: 'active',
          notes: 'Regular orders, reliable payment',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Asia Pacific Imports',
          email: 'business@asiapacific.sg',
          phone: '+65-6534-8888',
          country: 'Singapore',
          city: 'Singapore',
          address: '789 Business Hub, Singapore 039566',
          taxId: 'SG555555555',
          companyType: 'Importer',
          website: 'https://asiapacific.sg',
          creditLimit: 150000.00,
          outstandingAmount: 0.00,
          status: 'active',
          notes: 'High volume customer, negotiate pricing quarterly',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('Customer', customers, { transaction });

      // Create demo factories
      const factories = [
        {
          id: uuidv4(),
          name: 'Shanghai Manufacturing Co',
          email: 'sales@shanghaimfg.com',
          phone: '+86-21-5888-0088',
          country: 'China',
          city: 'Shanghai',
          address: 'No. 100 Industrial Park, Shanghai, China',
          certifications: JSON.stringify(['ISO 9001:2015', 'ISO 14001:2015', 'OHSAS 18001']),
          capacityPerMonth: 50000,
          status: 'active',
          notes: 'Main supplier, high capacity',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Vietnam Textiles Factory',
          email: 'export@vietnamtex.com',
          phone: '+84-28-3829-2828',
          country: 'Vietnam',
          city: 'Ho Chi Minh City',
          address: '200 Industrial Zone 1, HCMC, Vietnam',
          certifications: JSON.stringify(['GOTS', 'OEKO-TEX', 'Fair Trade Certified']),
          capacityPerMonth: 30000,
          status: 'active',
          notes: 'Specialty textiles, good quality',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('Factory', factories, { transaction });

      // Create product categories
      const categories = [
        {
          id: uuidv4(),
          name: 'Textiles',
          description: 'Fabric and textile products',
          parentId: null,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Electronics',
          description: 'Electronic components and devices',
          parentId: null,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Home & Garden',
          description: 'Household and garden products',
          parentId: null,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Furniture',
          description: 'Furniture and related products',
          parentId: null,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Sports & Outdoors',
          description: 'Sports equipment and outdoor gear',
          parentId: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const categoryIds = categories.map(c => c.id);
      await queryInterface.bulkInsert('ProductCategory', categories, { transaction });

      // Create products
      const products = [
        {
          id: uuidv4(),
          name: 'Cotton T-Shirt',
          sku: 'TSH-001',
          description: '100% cotton comfortable t-shirt',
          categoryId: categoryIds[0],
          factoryId: factories[0].id,
          unitOfMeasure: 'piece',
          weight: '0.200',
          dimensions: JSON.stringify({ length: 70, width: 50, height: 5 }),
          hsCode: '6109100010',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Denim Jeans',
          sku: 'JAN-001',
          description: 'Premium denim jeans, various sizes',
          categoryId: categoryIds[0],
          factoryId: factories[1].id,
          unitOfMeasure: 'piece',
          weight: '0.600',
          dimensions: JSON.stringify({ length: 100, width: 35, height: 10 }),
          hsCode: '6203428090',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'LED Light Bulb',
          sku: 'LED-001',
          description: '10W LED light bulb, warm white',
          categoryId: categoryIds[1],
          factoryId: factories[0].id,
          unitOfMeasure: 'piece',
          weight: '0.050',
          dimensions: JSON.stringify({ diameter: 60, height: 105 }),
          hsCode: '8539290090',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'USB Cable',
          sku: 'USB-001',
          description: '2m USB-C charging cable',
          categoryId: categoryIds[1],
          factoryId: factories[0].id,
          unitOfMeasure: 'piece',
          weight: '0.030',
          dimensions: JSON.stringify({ length: 2000, diameter: 5 }),
          hsCode: '8544301290',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Ceramic Vase',
          sku: 'VAS-001',
          description: 'Handmade ceramic vase, blue glaze',
          categoryId: categoryIds[2],
          factoryId: factories[1].id,
          unitOfMeasure: 'piece',
          weight: '0.800',
          dimensions: JSON.stringify({ height: 250, diameter: 150 }),
          hsCode: '6912009000',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Wooden Chair',
          sku: 'CHR-001',
          description: 'Modern wooden dining chair',
          categoryId: categoryIds[3],
          factoryId: factories[0].id,
          unitOfMeasure: 'piece',
          weight: '5.000',
          dimensions: JSON.stringify({ height: 900, width: 500, depth: 500 }),
          hsCode: '9401201090',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Yoga Mat',
          sku: 'MAT-001',
          description: 'Non-slip yoga mat, 6mm thickness',
          categoryId: categoryIds[4],
          factoryId: factories[1].id,
          unitOfMeasure: 'piece',
          weight: '0.700',
          dimensions: JSON.stringify({ length: 1800, width: 600, thickness: 6 }),
          hsCode: '9406003090',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Stainless Steel Spoon',
          sku: 'SPO-001',
          description: 'Durable stainless steel spoon set',
          categoryId: categoryIds[2],
          factoryId: factories[0].id,
          unitOfMeasure: 'set',
          weight: '0.400',
          dimensions: JSON.stringify({ length: 200, width: 40 }),
          hsCode: '8215991000',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Cotton Pillow Cover',
          sku: 'PIL-001',
          description: '100% cotton pillow cover, king size',
          categoryId: categoryIds[0],
          factoryId: factories[1].id,
          unitOfMeasure: 'piece',
          weight: '0.150',
          dimensions: JSON.stringify({ length: 900, width: 700 }),
          hsCode: '6302400000',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          name: 'Portable Speaker',
          sku: 'SPK-001',
          description: 'Waterproof Bluetooth speaker',
          categoryId: categoryIds[1],
          factoryId: factories[0].id,
          unitOfMeasure: 'piece',
          weight: '0.500',
          dimensions: JSON.stringify({ height: 80, width: 80, depth: 80 }),
          hsCode: '8518309099',
          imageUrl: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const productIds = products.map(p => p.id);
      await queryInterface.bulkInsert('Product', products, { transaction });

      // Create product prices
      const prices = [
        { productId: productIds[0], factoryId: factories[0].id, price: 5.00, currency: 'USD', minQuantity: 100, maxQuantity: 10000, leadTimeDays: 15 },
        { productId: productIds[1], factoryId: factories[1].id, price: 25.00, currency: 'USD', minQuantity: 50, maxQuantity: 5000, leadTimeDays: 20 },
        { productId: productIds[2], factoryId: factories[0].id, price: 3.50, currency: 'USD', minQuantity: 500, maxQuantity: 50000, leadTimeDays: 10 },
        { productId: productIds[3], factoryId: factories[0].id, price: 2.00, currency: 'USD', minQuantity: 1000, maxQuantity: 100000, leadTimeDays: 12 },
        { productId: productIds[4], factoryId: factories[1].id, price: 15.00, currency: 'USD', minQuantity: 10, maxQuantity: 1000, leadTimeDays: 25 },
        { productId: productIds[5], factoryId: factories[0].id, price: 45.00, currency: 'USD', minQuantity: 20, maxQuantity: 2000, leadTimeDays: 30 },
        { productId: productIds[6], factoryId: factories[1].id, price: 8.00, currency: 'USD', minQuantity: 200, maxQuantity: 20000, leadTimeDays: 14 },
        { productId: productIds[7], factoryId: factories[0].id, price: 4.50, currency: 'USD', minQuantity: 200, maxQuantity: 50000, leadTimeDays: 10 },
        { productId: productIds[8], factoryId: factories[1].id, price: 12.00, currency: 'USD', minQuantity: 50, maxQuantity: 5000, leadTimeDays: 18 },
        { productId: productIds[9], factoryId: factories[0].id, price: 35.00, currency: 'USD', minQuantity: 50, maxQuantity: 5000, leadTimeDays: 20 }
      ];

      const productPrices = prices.map(p => ({
        id: uuidv4(),
        ...p,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date()
      }));

      await queryInterface.bulkInsert('ProductPrice', productPrices, { transaction });

      // Create exchange rates
      const exchangeRates = [
        { id: uuidv4(), baseCurrency: 'USD', targetCurrency: 'EUR', rate: 0.92, effectiveDate: new Date(), source: 'manual', created_at: new Date(), updated_at: new Date() },
        { id: uuidv4(), baseCurrency: 'USD', targetCurrency: 'GBP', rate: 0.79, effectiveDate: new Date(), source: 'manual', created_at: new Date(), updated_at: new Date() },
        { id: uuidv4(), baseCurrency: 'USD', targetCurrency: 'CNY', rate: 7.25, effectiveDate: new Date(), source: 'manual', created_at: new Date(), updated_at: new Date() },
        { id: uuidv4(), baseCurrency: 'USD', targetCurrency: 'AED', rate: 3.67, effectiveDate: new Date(), source: 'manual', created_at: new Date(), updated_at: new Date() },
        { id: uuidv4(), baseCurrency: 'USD', targetCurrency: 'SGD', rate: 1.35, effectiveDate: new Date(), source: 'manual', created_at: new Date(), updated_at: new Date() },
        { id: uuidv4(), baseCurrency: 'USD', targetCurrency: 'VND', rate: 24450, effectiveDate: new Date(), source: 'manual', created_at: new Date(), updated_at: new Date() }
      ];

      await queryInterface.bulkInsert('ExchangeRate', exchangeRates, { transaction });

      await transaction.commit();
      console.log('[MIGRATION] ✓ Seed data created successfully');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Delete in reverse order of creation
      await queryInterface.bulkDelete('ExchangeRate', {}, { transaction });
      await queryInterface.bulkDelete('ProductPrice', {}, { transaction });
      await queryInterface.bulkDelete('Product', {}, { transaction });
      await queryInterface.bulkDelete('ProductCategory', {}, { transaction });
      await queryInterface.bulkDelete('Factory', {}, { transaction });
      await queryInterface.bulkDelete('Customer', {}, { transaction });
      await queryInterface.bulkDelete('User', {}, { transaction });

      await transaction.commit();
      console.log('[MIGRATION] ✓ Seed data removed successfully');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
