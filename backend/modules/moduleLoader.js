/**
 * Module Loader
 * Scans and loads all modules from the modules directory
 */

const fs = require('fs');
const path = require('path');
const ModuleRegistry = require('./moduleRegistry');
const FeatureFlags = require('./featureFlags');
const logger = require('../utils/logger.js');

class ModuleLoader {
  constructor() {
    this.registry = new ModuleRegistry();
    this.featureFlags = new FeatureFlags();
    this.modulesPath = path.join(__dirname);
  }

  /**
   * Load all modules
   * @param {Object} app - Express app instance
   * @param {Object} sequelize - Sequelize instance
   * @param {Object} models - Models object
   * @returns {Promise} Resolved when all modules are loaded
   */
  async loadAll(app, sequelize, models) {
    try {
      logger.info('Starting module loading...');

      // Discover and load all modules
      this.discoverModules();

      // Validate dependencies
      if (!this.registry.validateDependencies()) {
        logger.warn('Some module dependencies are not satisfied');
      }

      // Get topologically sorted modules
      const sortedModules = this.registry.topologicalSort();
      logger.info(`Modules loaded in order: ${sortedModules.join(', ')}`);

      // Load and initialize each module
      for (const moduleName of sortedModules) {
        const module = this.registry.getModule(moduleName);
        if (module && this.featureFlags.isEnabled(`module:${moduleName}`)) {
          await this.initializeModule(app, sequelize, models, moduleName);
        }
      }

      logger.info('Module loading complete');
    } catch (error) {
      logger.error('Error loading modules:', error);
      throw error;
    }
  }

  /**
   * Discover modules by scanning the modules directory
   */
  discoverModules() {
    const entries = fs.readdirSync(this.modulesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        const modulePath = path.join(this.modulesPath, entry.name);
        const manifestPath = path.join(modulePath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(
              fs.readFileSync(manifestPath, 'utf8')
            );
            this.registry.register(manifest);
          } catch (error) {
            logger.error(`Failed to load manifest for module "${entry.name}":`, error.message);
          }
        }
      }
    }
  }

  /**
   * Initialize a single module
   * @param {Object} app - Express app instance
   * @param {Object} sequelize - Sequelize instance
   * @param {Object} models - Models object
   * @param {string} moduleName - Module name
   */
  async initializeModule(app, sequelize, models, moduleName) {
    const modulePath = path.join(this.modulesPath, moduleName);
    const indexPath = path.join(modulePath, 'index.js');

    if (fs.existsSync(indexPath)) {
      try {
        const moduleInit = require(indexPath);
        if (typeof moduleInit === 'function') {
          await moduleInit(app, sequelize, models, this.registry);
          logger.info(`Module initialized: ${moduleName}`);
        } else if (typeof moduleInit.init === 'function') {
          await moduleInit.init(app, sequelize, models, this.registry);
          logger.info(`Module initialized: ${moduleName}`);
        }
      } catch (error) {
        logger.error(`Failed to initialize module "${moduleName}":`, error.message);
      }
    } else {
      logger.warn(`Module index not found for: ${moduleName}`);
    }
  }

  /**
   * Get the module registry
   * @returns {ModuleRegistry} Registry instance
   */
  getRegistry() {
    return this.registry;
  }

  /**
   * Get the feature flags instance
   * @returns {FeatureFlags} 