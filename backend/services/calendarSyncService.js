/**
 * calendarSyncService.js
 *
 * Background sync: pulls Google Calendar events from all active ConnectedGoogleAccounts
 * and upserts them into the CalendarEvent table.
 *
 * Uses Google Calendar's incremental sync protocol (syncToken) — only fetches
 * events that changed since the last sync run. On the very first run (or if the
 * syncToken expires), falls back to a full fetch of events in a rolling window.
 *
 * Pattern mirrors gmailSyncService.js exactly.
 */

const { google } = require('googleapis');
const db = require('../models');
const { getAuthClientForAccount } = require('../controllers/googleAccountController');

// How far back to fetch events on the first sync (or when syncToken expires)
const INITIAL_SYNC_WINDOW_DAYS = 30;
// How far forward to fetch upcoming events
const LOOKAHEAD_DAYS = 90;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseEventTimes(event) {
  const isAllDay = !!(event.start?.date && !event.start?.dateTime);
  return {
    isAllDay,
    startAt:   event.start?.dateTime ? new Date(event.start.dateTime) : null,
    endAt:     event.end?.dateTime   ? new Date(event.end.dateTime)   : null,
    startDate: event.start?.date ?? null,
    endDate:   event.end?.date   ?? null,
    timeZone:  event.start?.timeZone ?? event.end?.timeZone ?? null,
  };
}

function extractMeetLink(event) {
  // Google Meet links can be in conferenceData or hangoutLink
  if (event.hangoutLink) return event.hangoutLink;
  const entryPoints = event.conferenceData?.entryPoints ?? [];
  const video = entryPoints.find(ep => ep.entryPointType === 'video');
  return video?.uri ?? null;
}

function mapAttendees(event) {
  return (event.attendees ?? []).map(a => ({
    email:          a.email,
    displayName:    a.displayName ?? null,
    responseStatus: a.responseStatus ?? 'needsAction',
    self:           a.self ?? false,
    organizer:      a.organizer ?? false,
  }));
}

// ─── Upsert a single event ────────────────────────────────────────────────────

async function upsertEvent(googleEvent, account) {
  const times     = parseEventTimes(googleEvent);
  const meetLink  = extractMeetLink(googleEvent);
  const attendees = mapAttendees(googleEvent);

  const fields = {
    googleCalendarId:  'primary',
    connectedAccountId: account.id,
    title:             googleEvent.summary     ?? '(No title)',
    description:       googleEvent.description ?? null,
    location:          googleEvent.location    ?? null,
    status:            googleEvent.status      ?? 'confirmed',
    organizerEmail:    googleEvent.organizer?.email ?? null,
    attendees,
    meetLink,
    googleUpdatedAt:   googleEvent.updated ? new Date(googleEvent.updated) : null,
    rawEventData:      googleEvent,
    ...times,
  };

  await db.CalendarEvent.upsert({
    googleEventId: googleEvent.id,
    ...fields,
  }, {
    conflictFields: ['google_event_id', 'connected_account_id'],
  });
}

// ─── Sync a single account ────────────────────────────────────────────────────

async function syncAccount(account) {
  let authClient;
  try {
    authClient = await getAuthClientForAccount(account);
  } catch (err) {
    console.error(`[calendar-sync] Auth failed for ${account.email}: ${err.message}`);
    // Deactivate account if tokens are permanently invalid
    if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired')) {
      await account.update({ isActive: false });
      console.warn(`[calendar-sync] Deactivated ${account.email} — refresh token invalid`);
    }
    return;
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  try {
    if (account.calendarSyncToken) {
      // ── Incremental sync ────────────────────────────────────────────────
      await incrementalSync(calendar, account);
    } else {
      // ── Full sync (first run or after syncToken expiry) ─────────────────
      await fullSync(calendar, account);
    }

    await account.update({ lastCalendarSyncAt: new Date() });
    console.log(`[calendar-sync] Synced ${account.email}`);
  } catch (err) {
    if (err.code === 410) {
      // 410 Gone — syncToken expired; fall back to full sync
      console.warn(`[calendar-sync] syncToken expired for ${account.email}, running full sync`);
      await account.update({ calendarSyncToken: null });
      await fullSync(calendar, account);
      await account.update({ lastCalendarSyncAt: new Date() });
    } else {
      console.error(`[calendar-sync] Sync error for ${account.email}: ${err.message}`);
    }
  }
}

// ─── Incremental sync (uses syncToken) ───────────────────────────────────────

async function incrementalSync(calendar, account) {
  let pageToken    = null;
  let newSyncToken = null;

  do {
    const params = {
      calendarId: 'primary',
      syncToken:  account.calendarSyncToken,
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await calendar.events.list(params);

    for (const event of data.items ?? []) {
      if (event.status === 'cancelled') {
        // Mark as cancelled in our DB (don't hard-delete)
        await db.CalendarEvent.update(
          { status: 'cancelled' },
          { where: { googleEventId: event.id, connectedAccountId: account.id } }
        );
      } else {
        await upsertEvent(event, account);
      }
    }

    pageToken    = data.nextPageToken ?? null;
    newSyncToken = data.nextSyncToken ?? newSyncToken;
  } while (pageToken);

  if (newSyncToken) {
    await account.update({ calendarSyncToken: newSyncToken });
  }
}

// ─── Full sync (first run or after 410) ──────────────────────────────────────

async function fullSync(calendar, account) {
  const now         = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - INITIAL_SYNC_WINDOW_DAYS);
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + LOOKAHEAD_DAYS);

  let pageToken    = null;
  let newSyncToken = null;

  do {
    const params = {
      calendarId:   'primary',
      timeMin:      windowStart.toISOString(),
      timeMax:      windowEnd.toISOString(),
      singleEvents: true,       // Expand recurring events
      orderBy:      'startTime',
      maxResults:   250,
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await calendar.events.list(params);

    for (const event of data.items ?? []) {
      await upsertEvent(event, account);
    }

    pageToken    = data.nextPageToken ?? null;
    newSyncToken = data.nextSyncToken ?? newSyncToken;
  } while (pageToken);

  // Store the syncToken for future incremental syncs
  if (newSyncToken) {
    await account.update({ calendarSyncToken: newSyncToken });
  }
}

// ─── Main entry point (called by cron) ───────────────────────────────────────

async function runCalendarSync() {
  const accounts = await db.ConnectedGoogleAccount.findAll({
    where: { isActive: true },
  });

  if (!accounts.length) return;

  console.log(`[calendar-sync] Starting sync for ${accounts.length} account(s)`);

  for (const account of accounts) {
    await syncAccount(account);
  }

  console.log('[calendar-sync] Done');
}

module.exports = { runCalendarSync };
