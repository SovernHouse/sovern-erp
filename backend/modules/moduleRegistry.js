/**
 * Module Registry - Central registry for all system modules
 * Each module self-registers its routes, models, and middleware
 */

class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.routes = [];
    this.models = {};
    this.middleware = [];
    this.hooks = {
      beforeStart: [],
      afterStart: [],
      beforeShutdown: []
    };
  }

  /**
   * Register a module with the system
   * @param {Object} moduleManifest - Module configuration object
   */
  register(moduleManifest) {
    if (!moduleManifest.name) {
      throw new Error('Module manifest must have a name');
    }

    if (this.modules.has(moduleManifest.name)) {
      console.warn(`Module "${moduleManifest.name}" is already registered, skipping`);
      return;
    }

    this.modules.set(moduleManifest.name, {
      name: moduleManifest.name,
      version: moduleManifest.version || '1.0.0',
      description: moduleManifest.description || '',
      dependencies: moduleManifest.dependencies || [],
      routes: moduleManifest.routes || [],
      models: moduleManifest.models || [],
      middleware: moduleManifest.middleware || [],
      config: moduleManifest.config || {},
      enabled: true
    });

    console.log(`Module registered: ${moduleManifest.name} v${moduleManifest.version}`);
  }

  /**
   * Get a registered module
   * @param {string} name - Module name
   * @returns {Object} Module manifest
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * Check if a module is enabled
   * @param {string} name - Module name
   * @returns {boolean} Module enabled status
   */
  isEnabled(name) {
    const module = this.modules.get(name);
    return module ? module.enabled : false;
  }

  /**
   * Enable/disable a module
   * @param {string} name - Module name
   * @param {boolean} enabled - Whether to enable the module
   */
  setEnabled(name, enabled) {
    const module = this.modules.get(name);
    if (module) {
      module.enabled = enabled;
      console.log(`Module "${name}" ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get all registered modules
   * @returns {Array} Array of module manifests
   */
  getAllModules() {
    return Array.from(this.modules.values());
  }

  /**
   * Get all enabled modules
   * @returns {Array} Array of enabled module manifests
   */
  getEnabledModules() {
    return Array.from(this.modules.values()).filter(m => m.enabled);
  }

  /**
   * Register a route with a module
   * @param {string} moduleName - Module name
   * @param {string} path - Route path
   * @param {Object} handler - Route handler
   */
  registerRoute(moduleName, path, handler) {
    this.routes.push({
      moduleName,
      path,
      handler
    });
  }

  /**
   * Get all registered routes
   * @returns {Array} Array of routes
   */
  getRoutes() {
    return this.routes;
  }

  /**
   * Register a model with a module
   * @param {string} moduleName - Module name
   * @param {string} modelName - Model name
   * @param {Object} model - Model definition
   */
  registerModel(moduleName, modelName, model) {
    this.models[modelName] = {
      moduleName,
      name: modelName,
      model
    };
  }

  /**
   * Get all registered models
   * @returns {Object} Object mapping model names to models
   */
  getModels() {
    return this.models;
  }

  /**
   * Register middleware
   * @param {string} moduleName - Module name
   * @param {Function} middleware - Middleware function
   */
  registerMiddleware(moduleName, middleware) {
    this.middleware.push({
      moduleName,
      middleware
    });
  }

  /**
   * Get all registered middleware
   * @returns {Array} Array of middleware
   */
  getMiddleware() {
    return this.middleware;
  }

  /**
   * Register a hook
   * @param {string} hookType - Hook type (beforeStart, afterStart, beforeShutdown)
   * @param {string} moduleName - Module name
   * @param {Function} callback - Hook callback
   */
  registerHook(hookType, moduleName, callback) {
    if (this.hooks[hookType]) {
      this.hooks[hookType].push({
        moduleName,
        callback
      });
    }
  }

  /**
   * Execute hooks
   * @param {string} hookType - Hook type
   * @returns {Promise} Resolved when all hooks complete
   */
  async executeHooks(hookType) {
    if (!this.hooks[hookType]) {
      return;
    }

    for (const hook of this.hooks[hookType]) {
      try {
        await hook.callback();
      } catch (error) {
        console.error(`Error in ${hookType} hook for module "${hook.moduleName}":`, error);
      }
    }
  }

  /**
   * Validate module dependencies
   * @returns {boolean} True if all dependencies are satisfied
   */
  validateDependencies() {
    for (const [name, module] of this.modules.entries()) {
      if (!module.enabled) continue;

      for (const dep of module.dependencies) {
        const depModule = this.modules.get(dep);
        if (!depModule || !depModule.enabled) {
          console.warn(
            `Module "${name}" depends on "${dep}" which is not enabled or not found`
          );
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Topologically sort modules by dependencies
   * @returns {Array} Sorted array of module names
   */
  topologicalSort() {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      visiting.add(name);

      const module = this.modules.get(name);
      if (module && module.enabled) {
        for (const dep of module.dependencies) {
          if (this.modules.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(name);
      visited.add(name);

      if (module && module.enabled) {
        sorted.push(name);
      }
    };

    for (const [name] of this.modules) {
      visit(name);
    }

    return sorted;
  }
}

module.exports = ModuleRegistry;
