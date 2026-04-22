const https = require('https');
const querystring = require('querystring');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../models');
const authConfig = require('../config/auth');

/**
 * SSO/OAuth2 Service
 * Supports Google and Microsoft OAuth2 login
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0/me';

/**
 * Get Google OAuth2 consent URL
 */
const getGoogleAuthUrl = () => {
  const params = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    state: uuidv4()
  };

  return `${GOOGLE_AUTH_URL}?${querystring.stringify(params)}`;
};

/**
 * Get Microsoft OAuth2 consent URL
 */
const getMicrosoftAuthUrl = () => {
  const params = {
    client_id: process.env.MICROSOFT_CLIENT_ID,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: uuidv4()
  };

  return `${MICROSOFT_AUTH_URL}?${querystring.stringify(params)}`;
};

/**
 * Exchange authorization code for tokens via HTTPS
 */
const httpsRequest = (url, options, postData) => {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (response.statusCode >= 400) {
            reject(new Error(parsed.error || `HTTP ${response.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    request.on('error', reject);

    if (postData) {
      request.write(postData);
    }

    request.end();
  });
};

/**
 * Handle Google OAuth2 callback
 * Exchange code for tokens, get user info, find/create user
 */
const handleGoogleCallback = async (code) => {
  try {
    // Exchange code for tokens
    const tokenData = querystring.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI
    });

    const tokenResponse = await httpsRequest(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData)
      }
    }, tokenData);

    // Get user info
    const userInfoResponse = await httpsRequest(
      `${GOOGLE_USERINFO_URL}?access_token=${tokenResponse.access_token}`,
      { method: 'GET' }
    );

    // Find or create user
    let user = await db.User.findOne({
      where: { email: userInfoResponse.email }
    });

    if (!user) {
      user = await db.User.create({
        id: uuidv4(),
        email: userInfoResponse.email,
        firstName: userInfoResponse.given_name || 'Google',
        lastName: userInfoResponse.family_name || 'User',
        password: uuidv4(), // Random password for OAuth users
        role: 'customer',
        isActive: true,
        avatar: userInfoResponse.picture
      });
    }

    // Link SSO account if not already linked
    const [ssoLink] = await db.SSOAccount.findOrCreate({
      where: {
        userId: user.id,
        provider: 'google'
      },
      defaults: {
        providerId: userInfoResponse.id,
        providerEmail: userInfoResponse.email,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000)
      }
    });

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      authConfig.jwt.secret,
      { expiresIn: authConfig.jwt.expiry }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      authConfig.jwtRefresh.secret,
      { expiresIn: authConfig.jwtRefresh.expiry }
    );

    return {
      success: true,
      user: user.toJSON(),
      tokens: { accessToken, refreshToken },
      ssoProvider: 'google'
    };
  } catch (error) {
    throw new Error(`Google OAuth callback failed: ${error.message}`);
  }
};

/**
 * Handle Microsoft OAuth2 callback
 * Exchange code for tokens, get user info, find/create user
 */
const handleMicrosoftCallback = async (code) => {
  try {
    // Exchange code for tokens
    const tokenData = querystring.stringify({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
      scope: 'openid email profile'
    });

    const tokenResponse = await httpsRequest(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData)
      }
    }, tokenData);

    // Get user info from Microsoft Graph
    const userInfoResponse = await httpsRequest(MICROSOFT_GRAPH_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResponse.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    // Find or create user
    let user = await db.User.findOne({
      where: { email: userInfoResponse.mail || userInfoResponse.userPrincipalName }
    });

    if (!user) {
      user = await db.User.create({
        id: uuidv4(),
        email: userInfoResponse.mail || userInfoResponse.userPrincipalName,
        firstName: userInfoResponse.givenName || 'Microsoft',
        lastName: userInfoResponse.surname || 'User',
        password: uuidv4(), // Random password for OAuth users
        role: 'customer',
        isActive: true
      });
    }

    // Link SSO account if not already linked
    const [ssoLink] = await db.SSOAccount.findOrCreate({
      where: {
        userId: user.id,
        provider: 'microsoft'
      },
      defaults: {
        providerId: userInfoResponse.id,
        providerEmail: userInfoResponse.mail || userInfoResponse.userPrincipalName,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000)
      }
    });

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      authConfig.jwt.secret,
      { expiresIn: authConfig.jwt.expiry }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      authConfig.jwtRefresh.secret,
      { expiresIn: authConfig.jwtRefresh.expiry }
    );

    return {
      success: true,
      user: user.toJSON(),
      tokens: { accessToken, refreshToken },
      ssoProvider: 'microsoft'
    };
  } catch (error) {
    throw new Error(`Microsoft OAuth callback failed: ${error.message}`);
  }
};

/**
 * Link SSO account to existing user
 */
const linkSSOAccount = async (userId, provider, providerId, providerEmail, accessToken, refreshToken, expiresAt) => {
  try {
    const user = await db.User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const [ssoAccount, created] = await db.SSOAccount.findOrCreate({
      where: {
        userId,
        provider
      },
      defaults: {
        providerId,
        providerEmail,
        accessToken,
        refreshToken,
        expiresAt
      }
    });

    if (!created) {
      // Update existing SSO account
      await ssoAccount.update({
        providerId,
        providerEmail,
        accessToken,
        refreshToken,
        expiresAt
      });
    }

    return {
      success: true,
      message: `${provider} account linked successfully`,
      ssoAccount: ssoAccount.toJSON()
    };
  } catch (error) {
    throw new Error(`Failed to link SSO account: ${error.message}`);
  }
};

/**
 * Unlink SSO account from user
 */
const unlinkSSOAccount = async (userId, provider) => {
  try {
    const result = await db.SSOAccount.destroy({
      where: {
        userId,
        provider
      }
    });

    if (result === 0) {
      throw new Error(`No ${provider} account linked to this user`);
    }

    return {
      success: true,
      message: `${provider} account unlinked successfully`
    };
  } catch (error) {
    throw new Error(`Failed to unlink SSO account: ${error.message}`);
  }
};

/**
 * Get user's linked SSO accounts
 */
const getUserSSOAccounts = async (userId) => {
  try {
    const accounts = await db.SSOAccount.findAll({
      where: { userId },
      attributes: ['provider', 'providerEmail', 'createdAt', 'updatedAt']
    });

    return {
      success: true,
      accounts
    };
  } catch (error) {
    throw new Error(`Failed to fetch SSO accounts: ${error.message}`);
  }
};

module.exports = {
  getGoogleAuthUrl,
  getMicrosoftAuthUrl,
  handleGoogleCallback,
  handleMicrosoftCallback,
  linkSSOAccount,
  unlinkSSOAccount,
  getUserSSOAccounts
};
