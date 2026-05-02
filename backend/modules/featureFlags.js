/**
 * Feature Flags System
 * Manages module enable/disable states based on environment variables and database settings
 */

class FeatureFlags {
  constructor() {
    this.flags = {};
    this.defaults = {
      'module:core': true,
      'module:crm': true,
      'module:products': true,
      'module:sales': true,
      'module:procurement': true,
      'module:finance': true,
      'module:logistics': true,
      'module:quality': true,
      'module:compliance': false,
      'module:warehouse': false,
      'module:analytics': true,
      'module:documents': true,
      'module:chatter': true,
      'module:internalApprovals': true,
    };

    this.initializeFlags();
  }

  /**
   * Initialize flags from defaults and environment variables
   */
  initializeFlags() {
    for (const [flag, defaultValue] of Object.entries(this.defaults)) {
      const envVarName = `MODULE_${flag.split(':')[1].toUpperCase()}_ENABLED`;
      const envValue = process.env[envVarName];

      if (envValue !== undefined) {
        this.flags[flag] = envValue === 'true' || envValue === '1';
      } else {
        this.flags[flag] = defaultValue;
      }
    }
  }

  /**
   * Check if a feature flag is enabled
   * @param {string} flag - Flag name (e.g., 'module:core')
   * @returns {boolean} Whether the flag is enabled
   */
  isEnabled(flag) {
    if (this.flags[flag] !== undefined) {
      return this.flags[flag];
    }

    // Default to false for unknown flags
    return false;
  }

  /**
   * Set a feature flag at runtime
   * @param {string} flag - Flag name
   * @param {boolean} value - New value
   */
  setFlag(flag, value) {
    this.flags[flag] = value;
    console.log(`Feature flag "${flag}" set to ${value}`);
  }

  /**
   * Get all flags and their current values
   * @returns {Object} Object with all flag values
   */
  getAll() {
    return { ...this.flags };
  }

  /**
   * Load flags from database settings (if available)
   * @param {Object} settingsModel - Sequelize Settings model
   */
  async loadFromDatabase(settingsModel) {
    try {
      const settings = await settingsModel.findAll();
      for (const setting of settings) {
        const flagName = setting.key;
        if (flagName.startsWith('module:')) {
          this.flags[flagName] = setting.value === 'true' || setting.value === '1';
        }
      }
      console.log('Feature flags loaded from database');
    } catch (error) {
      console.warn('Failed to load feature flags from database:', error.message);
    }
  }

  /**
   * Save flags to database (if available)
   * @param {Object} settingsModel - Sequelize Settings model
   */
  async saveToDatabase(settingsModel) {
    try {
      for (const [flag, value] of Object.entries(this.flags)) {
        if (flag.startsWith('module:')) {
          await settingsModel.upsert(
            { key: flag, value: value.toString() },
            { where: { key: flag } }
          );
        }
      }
      console.log('Feature flags saved to database');
    } catch (error) {
      console.warn('Failed to save feature flags to database:', error.message);
    }
  }

  /**
   * Get flags for a specific module
   * @param {string} moduleName - Module name
   * @returns {Object} Flags for the module
   */
  getModuleFlags(moduleName) {
    const moduleFlags = {};
    for (const [flag, value] of Object.entries(this.flags)) {
      if (flag.endsWith(`:${moduleName}`)) {
        moduleFlags[flag] = value;
      }
    }
    return moduleFlags;
  }
}

module.exports = FeatureFlags;
