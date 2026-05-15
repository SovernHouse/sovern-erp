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

// Scopes requested during consent — all in one flow so user only authenticates once.
//
// Phase 4.7 follow-up: drive.readonly alone is insufficient for the AI
// attachment upload flow (POST /api/ai/attachments) and the new admin
// Drive folder setup endpoint (POST /api/admin/drive-setup, C-3). Both
// need to CREATE files / folders. drive.file grants per-app file
// management (we can read/write/delete anything WE created) without
// the broad consent of full drive scope. Pairing drive.readonly +
// drive.file gives us: read everything Alex has in Drive (needed for
// search_drive_files / read_drive_file) + write only inside the
// Sovern ERP namespace we provision. Users with prior tokens issued
// against the old scope set must reconnect via Settings -> Connected
// Accounts; that re-OAuth picks up the new scopes.
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',       // read + send + label emails
  'https://www.googleapis.com/auth/calendar.events',    // read + create/edit calendar events
  'https://www.googleapis.com/auth/drive.readonly',     // browse + read Drive files Alex already has
  'https://www.googleapis.com/auth/drive.file',         // create + manage files the ERP creates
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

    // Phase 4, C17: resolve brand from senderEmail before persisting.
    // New connects require a Brand row whose senderEmail matches; without
    // it we can't route Gmail polling output to the right brand.
    const brand = await db.Brand.findOne({
      where: db.sequelize.where(
        db.sequelize.fn('LOWER', db.sequelize.col('sender_email')),
        (profile.email || '').toLowerCase(),
      ),
    });
    const existing = await db.ConnectedGoogleAccount.findOne({ where: { email: profile.email } });

    if (!brand && !existing) {
      logger.warn(`[google-oauth] No Brand has senderEmail matching ${profile.email}; cannot connect`);
      return res.redirect(`${process.env.FRONTEND_URL || ''}/settings?google=no_brand_match`);
    }

    const accountData = {
      email: profile.email,
      displayName: profile.name || profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || existing?.refreshToken, // Google only sends refresh_token on first consent
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: GOOGLE_SCOPES,
      isActive: true,
      connectedByUserId: state !== 'anonymous' ? state : null,
      brandCode: brand?.code || existing?.brandCode || null,
    };

    if (existing) {
      await existing.update(accountData);
      logger.info(`[google-oauth] Updated connected account: ${profile.email} (brand=${accountData.brandCode || 'none'})`);
    } else {
      await db.ConnectedGoogleAccount.create(accountData);
      logger.info(`[google-oauth] Connected new Google account: ${profile.email} (brand=${accountData.brandCode})`);
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
    // Phase 4, C17: include brandCode so the triage reply composer can
    // filter accounts to the thread's brand.
    attributes: ['id', 'email', 'displayName', 'scopes', 'isActive', 'brandCode', 'lastGmailSyncAt', 'lastCalendarSyncAt', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
  return res.json({ success: true, data: accounts });
};

// ── GET /api/google/accounts/available ──────────────────────────────────────
// Returns the minimal set of fields (id, email, displayName, scopes,
// isActive) needed by feature pages — Drive, Calendar, Gmail — so they
// can populate account pickers. Available to any authenticated user.
//
// Why this is a separate endpoint from listAccounts: the management screen
// at /settings/connected-accounts is admin-only and shows last-sync
// timestamps + connection state useful for ops. Feature pages just need
// "which accounts can I query against" and don't need that telemetry.
//
// Optional ?scope=drive|gmail|calendar filter narrows to active accounts
// whose scopes string includes the named scope (substring match against
// the standard googleapis.com/auth/<scope>... URL).
exports.listAvailableAccounts = async (req, res) => {
  const { scope } = req.query;
  const all = await db.ConnectedGoogleAccount.findAll({
    where: { isActive: true },
    // Phase 4, C17: brandCode included so brand-aware feature pickers can
    // filter without a second fetch.
    attributes: ['id', 'email', 'displayName', 'scopes', 'isActive', 'brandCode'],
    order: [['createdAt', 'ASC']],
  });
  const filtered = scope
    ? all.filter(a => (a.scopes || []).some(s => s.includes(String(scope))))
    : all;
  return res.json({ success: true, data: filtered });
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
