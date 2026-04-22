/**
 * Module Configuration Manager
 * Manages module configurations from manifests and environment variables
 */

class ConfigManager {
  constructor() {
    this.configs = new Map();
    this.overrides = new Map();
  }

  /**
   * Register a module configuration
   * @param {string} moduleName - Module name
   * @param {Object} config - Configuration object
   */
  registerConfig(moduleName, config) {
    this.configs.set(moduleName, config || {});
    this.loadEnvironmentOverrides(moduleName);
  }

  /**
   * Load environment variable overrides for a module
   * @param {string} moduleName - Module name
   */
  loadEnvironmentOverrides(moduleName) {
    const prefix = `MODULE_${moduleName.toUpperCase()}`;

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key
          .substring(prefix.length + 1)
          .toLowerCase();
        this.setOverride(moduleName, configKey, value);
      }
    }
  }

  /**
   * Get configuration for a module
   * @param {string} moduleName - Module name
   * @param {string} key - Configuration key (supports dot notation)
   * @returns {any} Configuration value
   */
  getConfig(moduleName, key = null) {
    let config = this.configs.get(moduleName) || {};

    // Apply overrides
    const overrides = this.overrides.get(moduleName) || {};
    config = { ...config, ...overrides };

    if (!key) {
      return config;
    }

    // Support dot notation (e.g., 'database.host')
    return this.getNestedValue(config, key);
  }

  /**
   * Get a nested value from an object using dot notation
   * @param {Object} obj - Object to search
   * @param {string} path - Dot-separated path (e.g., 'a.b.c')
   * @returns {any} Value at the path
   */
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a configuration override
   * @param {string} moduleName - Module name
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   */
  setOverride(moduleName, key, value) {
    if (!this.overrides.has(moduleName)) {
      this.overrides.set(moduleName, {});
    }

    const overrides = this.overrides.get(moduleName);
    overrides[key] = this.parseValue(value);
  }

  /**
   * Parse a string value to its appropriate type
   * @param {string} value - String value to parse
   * @returns {any} Parsed value
   */
  parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (!isNaN(value) && value !== '') return Number(value);
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Get all configurations for all modules
   * @returns {Object} Object mapping module names to their configs
   */
  getAllConfigs() {
    const all = {};
    for (const [moduleName] of this.configs) {
      all[moduleName] = this.getConfig(moduleName);
    }
    return all;
  }

  /**
   * Update module configuration
   * @param {string} moduleName - Module name
   * @param {Object} newConfig - New configuration object (merged with existing)
   */
  updateConfig(moduleName, newConfig) {
    const existing = this.configs.get(moduleName) || {};
    this.configs.set(moduleName, { ...existing, ...newConfig });
  }
}

module.exports = ConfigManager;
