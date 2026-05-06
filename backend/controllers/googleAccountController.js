/**
 * Google Account OAuth Controller
 * Handles OAuth2 flow for connecting Google Workspace accounts.
 * Covers Gmail, Calendar, and Drive in a single consent screen.
 */

const { google } = require('googleapis');
const db = require('../models');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

// ── OAuth2 client factory ─────────────────────────────────────────────────────

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI  // e.g. https://erp.sovernhouse.co/api/google/oauth/callback
  );
}

// Scopes requested during consent — all in one flow so user only authenticates once
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',       // read + send + label emails
  'https://www.googleapis.com/auth/calendar.readonly',  // read calendar events
  'https://www.googleapis.com/auth/drive.readonly',     // browse Drive files
];

// ── GET /api/google/oauth/init ────────────────────────────────────────────────
// Redirect user to Google consent screen.

exports.initiateOAuth = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      success: false,
      error: { message: 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
    });
  }

  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // get refresh token
    prompt: 'consent',           // always show consent screen so we always get refresh_token
    scope: GOOGLE_SCOPES,
    state: req.user?.id || 'anonymous', // carry the ERP user ID through the flow
  });

  return res.json({ success: true, data: { authUrl: url } });
};

// ── GET /api/google/oauth/callback ────────────────────────────────────────────
// Google redirects here after consent. Exchange code for tokens, store account.

exports.handleCallback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.warn('[google-oauth] User denied consent or error:', error);
    // Redirect to settings page with error flag
    return res.redirect(`${process.env.FRONTEND_URL || ''}/settings?google=denied`);
  }

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || ''}/settings?google=error`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get the user's Google profile to store their email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Upsert: one record per Google account email
    const existing = await db.ConnectedGoogleAccount.findOne({ where: { email: profile.email } });

    const accountData = {
      email: profile.email,
      displayName: profile.name || profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || existing?.refreshToken, // Google only sends refresh_token on first consent
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: GOOGLE_SCOPES,
      isActive: true,
      connectedByUserId: state !== 'anonymous' ? state : null,
    };

    if (existing) {
      await existing.update(accountData);
      logger.info(`[google-oauth] Updated connected account: ${profile.email}`);
    } else {
      await db.ConnectedGoogleAccount.create(accountData);
      logger.info(`[google-oauth] Connected new Google account: ${profile.email}`);
    }

    return res.redirect(`${process.env.FRONTEND_URL || ''}/settings?google=connected`);
  } catch (err) {
    logger.error('[google-oauth] Callback error:', err.message);
    return res.redirect(`${process.env.FRONTEND_URL || ''}/settings?google=error`);
  }
};

// ── GET /api/google/accounts ──────────────────────────────────────────────────

exports.listAccounts = async (req, res) => {
  const accounts = await db.ConnectedGoogleAccount.findAll({
    attributes: ['id', 'email', 'displayName', 'scopes', 'isActive', 'lastGmailSyncAt', 'lastCalendarSyncAt', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
  return res.json({ success: true, data: accounts });
};

// ── DELETE /api/google/accounts/:id ──────────────────────────────────────────

exports.disconnectAccount = async (req, res) => {
  const account = await db.ConnectedGoogleAccount.findByPk(req.params.id);
  if (!account) throw new NotFoundError('Google account not found');

  // Revoke the token at Google so it can't be used again
  try {
    const oauth2Client = getOAuth2Client();
    await oauth2Client.revokeToken(account.accessToken || account.refreshToken);
  } catch (revokeErr) {
    logger.warn('[google-oauth] Token revoke failed (may already be invalid):', revokeErr.message);
  }

  await account.destroy();
  return res.json({ success: true, message: `Disconnected ${account.email}` });
};

// ── PATCH /api/google/accounts/:id/toggle ────────────────────────────────────

exports.toggleAccount = async (req, res) => {
  const account = await db.ConnectedGoogleAccount.findByPk(req.params.id);
  if (!account) throw new NotFoundError('Google account not found');
  await account.update({ isActive: !account.isActive });
  return res.json({ success: true, data: account });
};

// ── Helper: get a refreshed OAuth2 client for a stored account ────────────────
// Used by sync jobs to make authenticated API calls.

exports.getAuthClientForAccount = async (account) => {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiry ? account.tokenExpiry.getTime() : null,
  });

  // Auto-refresh if within 5 minutes of expiry
  if (account.tokenExpiry && new Date() >= new Date(account.tokenExpiry.getTime() - 5 * 60 * 1000)) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await account.update({
        accessToken: credentials.access_token,
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      });
      oauth2Client.setCredentials(credentials);
    } catch (refreshErr) {
      logger.error(`[google-oauth] Token refresh failed for ${account.email}:`, refreshErr.message);
      await account.update({ isActive: false });
      throw new Error(`Token refresh failed for ${account.email} — account deactivated`);
    }
  }

  return oauth2Client;
};
