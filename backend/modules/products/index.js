/**
 * Products Module
 * Provides product management: Products, Categories, Pricing, Inventory
 */

async function initProducts(app, sequelize, models, registry) {
  // Register products routes
  const productRoutes = require('../../routes/productRoutes');
  const inventoryRoutes = require('../../routes/inventoryRoutes');

  app.use('/api/products', productRoutes);
  app.use('/api/inventory', inventoryRoutes);

  // Register products models
  registry.registerModel('products', 'Product', models.Product);
  registry.registerModel('products', 'ProductCategory', models.ProductCategory);
  registry.registerModel('products', 'ProductPrice', models.ProductPrice);
  registry.registerModel('products', 'InventoryItem', models.InventoryItem);
  registry.registerModel('products', 'InventoryTransaction', models.InventoryTransaction);
}

module.exports = initProducts;
