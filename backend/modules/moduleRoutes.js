/**
 * Module API Routes
 * Provides management endpoints for modules
 */

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * Create module management routes
 * @param {ModuleRegistry} registry - Module registry instance
 * @param {FeatureFlags} featureFlags - Feature flags instance
 * @param {ConfigManager} configManager - Configuration manager instance
 * @returns {Router} Express router with module management endpoints
 */
function createModuleRoutes(registry, featureFlags, configManager) {
  const router = express.Router();

  /**
   * GET /api/modules - List all modules with status
   */
  router.get('/', requireAuth, requireRole('ADMIN'), (req, res) => {
    try {
      const modules = registry.getAllModules().map(module => ({
        name: module.name,
        version: module.version,
        description: module.description,
        enabled: module.enabled,
        dependencies: module.dependencies,
        config: configManager.getConfig(module.name)
      }));

      res.json({
        success: true,
        data: modules,
        total: modules.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/modules/:name - Get module details
   */
  router.get('/:name', requireAuth, requireRole('ADMIN'), (req, res) => {
    try {
      const module = registry.getModule(req.params.name);

      if (!module) {
        return res.status(404).json({
          success: false,
          error: `Module "${req.params.name}" not found`
        });
      }

      res.json({
        success: true,
        data: {
          name: module.name,
          version: module.version,
          description: module.description,
          enabled: module.enabled,
          dependencies: module.dependencies,
          routes: module.routes,
          models: module.models,
          config: configManager.getConfig(module.name)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/modules/:name/enable - Enable a module
   */
  router.post('/:name/enable', requireAuth, requireRole('ADMIN'), (req, res) => {
    try {
      const module = registry.getModule(req.params.name);

      if (!module) {
        return res.status(404).json({
          success: false,
          error: `Module "${req.params.name}" not found`
        });
      }

      registry.setEnabled(req.params.name, true);
      featureFlags.setFlag(`module:${req.params.name}`, true);

      res.json({
        success: true,
        message: `Module "${req.params.name}" enabled`,
        data: module
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/modules/:name/disable - Disable a module
   */
  router.post('/:name/disable', requireAuth, requireRole('ADMIN'), (req, res) => {
    try {
      const module = registry.getModule(req.params.name);

      if (!module) {
        return res.status(404).json({
          success: false,
          error: `Module "${req.params.name}" not found`
        });
      }

      // Prevent disabling core module
      if (req.params.name === 'core') {
        return res.status(400).json({
          success: false,
          error: 'Cannot disable the core module'
        });
      }

      registry.setEnabled(req.params.name, false);
      featureFlags.setFlag(`module:${req.params.name}`, false);

      res.json({
        success: true,
        message: `Module "${req.params.name}" disabled`,
        data: module
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/modules/:name/config - Get module configuration
   */
  router.get('/:name/config', requireAuth, requireRole('ADMIN'), (req, res) => {
    try {
      const module = registry.getModule(req.params.name);

      if (!module) {
        return res.status(404).json({
          success: false,
          error: `Module "${req.params.name}" not found`
        });
      }

      const config = configManager.getConfig(req.params.name);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/modules/:name/config - Update module configuration
   */
  router.put('/:name/config', requireAuth, requireRole('ADMIN'), (req, res) => {
    try {
      const module = registry.getModule(req.params.name);

      if (!module) {
        return res.status(404).json({
          success: false,
          error: `Module "${req.params.name}" not found`
        });
      }

      configManager.updateConfig(req.params.name, req.body);

      res.json({
        success: true,
        message: `Configuration updated for module "${req.params.name}"`,
        data: configManager.getConfig(req.params.name)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createModuleRoutes;
