/**
 * expoPushService — Phase 4.26d.
 *
 * Shared helper for sending Expo push notifications to a user's
 * registered mobile devices. Used by:
 *   - workflowService.notifyAutoChain (Phase 4.26d order-to-cash chain hops)
 *   - devModeNotifier  (Phase 4.16)
 *   - researchNotifier (Phase 4.9.3)
 *
 * The legacy notifiers inlined this; pulling it out keeps the Expo API
 * contract and the dead-token cleanup logic in one place so every push
 * surface gets the same behavior (priority='high', sound default, dead-
 * token deactivation).
 *
 * Best-effort: every call swallows errors at the service boundary. A
 * failed push must never abort the upstream business operation (an
 * auto-created Pro Forma or Sales Order is more important than its
 * notification).
 */

const db = require('../models');
const logger = require('../utils/logger');

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * @param {string} userId — recipient
 * @param {object} payload
 * @param {string} payload.title — push notification title
 * @param {string} payload.body  — push notification body
 * @param {object} [payload.data] — arbitrary data passed to the app on tap
 * @param {string} [payload.channelId] — Android channel (default 'default')
 * @returns {Promise<{ ok: boolean, sent?: number, deactivated?: number, error?: string, skipped?: boolean, reason?: string }>}
 */
async function sendPushToUser(userId, payload) {
  if (!userId) return { ok: false, skipped: true, reason: 'no-user' };
  if (!db.ExpoPushToken) return { ok: false, skipped: true, reason: 'no-token-model' };
  if (!payload || !payload.title) return { ok: false, skipped: true, reason: 'no-payload' };

  try {
    const tokens = await db.ExpoPushToken.findAll({
      where: { userId, isActive: true },
      attributes: ['id', 'token'],
    });
    if (!tokens.length) return { ok: true, skipped: true, reason: 'no-active-tokens', sent: 0 };

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title: payload.title,
      body: payload.body || '',
      data: payload.data || {},
      priority: 'high',
      channelId: payload.channelId || 'default',
    }));

    const res = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      logger.warn(`[expoPushService] HTTP ${res.status}: ${txt.slice(0, 200)}`);
      return { ok: false, error: `HTTP ${res.status}`, sent: 0 };
    }

    // Expo returns a per-message ticket. DeviceNotRegistered tickets
    // indicate the token is gone (app uninstalled) — deactivate so we
    // stop sending. Other errors are transient + retryable.
    let deactivated = 0;
    try {
      const json = await res.json();
      const tickets = Array.isArray(json?.data) ? json.data : [];
      for (let i = 0; i < tickets.length; i += 1) {
        const ticket = tickets[i];
        if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
          const dead = tokens[i];
          if (dead?.id) {
            await db.ExpoPushToken.update({ isActive: false }, { where: { id: dead.id } });
            deactivated += 1;
          }
        }
      }
    } catch (_) { /* response parse non-fatal */ }

    return { ok: true, sent: messages.length, deactivated };
  } catch (e) {
    logger.warn(`[expoPushService] unexpected: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendPushToUser, EXPO_PUSH_API };
