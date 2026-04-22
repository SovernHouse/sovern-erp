const express = require('express');
const router = express.Router();
const ssoService = require('../services/ssoService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');

/**
 * GET /api/auth/sso/google
 * Redirect to Google consent screen
 */
router.get('/google', (req, res) => {
  try {
    const authUrl = ssoService.getGoogleAuthUrl();
    res.json(getSuccessResponse({ authUrl }, 'Google OAuth URL generated'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/sso/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({ error: `Google auth error: ${error}` });
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    const result = await ssoService.handleGoogleCallback(code);

    // Redirect to frontend with tokens (or send as JSON)
    // In production, redirect to frontend with tokens in query/fragment
    res.json(getSuccessResponse(result, 'Google login successful'));
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * GET /api/auth/sso/microsoft
 * Redirect to Microsoft consent screen
 */
router.get('/microsoft', (req, res) => {
  try {
    const authUrl = ssoService.getMicrosoftAuthUrl();
    res.json(getSuccessResponse({ authUrl }, 'Microsoft OAuth URL generated'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/sso/microsoft/callback
 * Handle Microsoft OAuth callback
 */
router.get('/microsoft/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({
        error: `Microsoft auth error: ${error_description || error}`
      });
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    const result = await ssoService.handleMicrosoftCallback(code);

    res.json(getSuccessResponse(result, 'Microsoft login successful'));
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * POST /api/auth/sso/link
 * Link SSO provider to existing authenticated user
 * Body: { provider, providerId, providerEmail, accessToken, refreshToken, expiresAt }
 */
router.post('/link', requireAuth, async (req, res) => {
  try {
    const { provider, providerId, providerEmail, accessToken, refreshToken, expiresAt } = req.body;

    if (!provider || !providerId) {
      return res.status(400).json({ error: 'provider and providerId required' });
    }

    const validProviders = ['google', 'microsoft'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Invalid provider: ${provider}` });
    }

    const result = await ssoService.linkSSOAccount(
      req.user.id,
      provider,
      providerId,
      providerEmail,
      accessToken,
      refreshToken,
      expiresAt
    );

    res.json(getSuccessResponse(result, 'SSO account linked successfully'));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/auth/sso/unlink/:provider
 * Unlink SSO provider from authenticated user
 */
router.delete('/unlink/:provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;

    const validProviders = ['google', 'microsoft'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Invalid provider: ${provider}` });
    }

    const result = await ssoService.unlinkSSOAccount(req.user.id, provider);
    res.json(getSuccessResponse(result, 'SSO account unlinked successfully'));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/auth/sso/accounts
 * Get user's linked SSO accounts
 */
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const result = await ssoService.getUserSSOAccounts(req.user.id);
    res.json(getSuccessResponse(result, 'SSO accounts retrieved'));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
