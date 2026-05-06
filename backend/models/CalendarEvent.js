const { DataTypes } = require('sequelize');

/**
 * CalendarEvent — stores Google Calendar events synced from connected Google accounts.
 *
 * Sync is incremental via syncToken (Google Calendar sync protocol).
 * Events are upserted on each sync run — googleEventId is the stable identifier.
 */
module.exports = (sequelize) => {
  const CalendarEvent = sequelize.define('CalendarEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Google identity ────────────────────────────────────────────────────
    googleEventId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Google Calendar event ID (stable across updates)',
    },
    googleCalendarId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'primary',
      comment: 'Which calendar this event belongs to (usually "primary")',
    },
    connectedAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ConnectedGoogleAccounts', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'The ConnectedGoogleAccount that owns this event',
    },

    // ── Core event fields ──────────────────────────────────────────────────
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Event summary/title',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('confirmed', 'tentative', 'cancelled'),
      defaultValue: 'confirmed',
      comment: 'Google event status; cancelled = soft-deleted by user',
    },

    // ── Timing ────────────────────────────────────────────────────────────
    startAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Event start (null for all-day events with no time)',
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'For all-day events — date only (no time component)',
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    isAllDay: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    timeZone: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'IANA timezone string for the event (e.g. "Asia/Taipei")',
    },

    // ── Attendees & organiser ──────────────────────────────────────────────
    organizerEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attendees: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of { email, displayName, responseStatus }',
    },

    // ── Video / conferencing ───────────────────────────────────────────────
    meetLink: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Google Meet or other video conference URL if present',
    },

    // ── CRM linkage ────────────────────────────────────────────────────────
    linkedLeadId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Leads', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Manual or auto-linked CRM lead',
    },
    linkedContactId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Manual or auto-linked CRM contact (future)',
    },

    // ── Sync metadata ──────────────────────────────────────────────────────
    googleUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last-modified timestamp reported by Google (used for change detection)',
    },
    rawEventData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Full raw Google event object — for future field additions without migration',
    },
  }, {
    indexes: [
      // Unique per account — same event can appear in different accounts
      { unique: true, fields: ['google_event_id', 'connected_account_id'] },
      { fields: ['connected_account_id'] },
      { fields: ['start_at'] },
      { fields: ['status'] },
      { fields: ['linked_lead_id'] },
    ],
  });

  CalendarEvent.associate = (models) => {
    CalendarEvent.belongsTo(models.ConnectedGoogleAccount, {
      foreignKey: 'connectedAccountId',
      as: 'connectedAccount',
    });
    CalendarEvent.belongsTo(models.Lead, {
      foreignKey: 'linkedLeadId',
      as: 'linkedLead',
    });
  };

  return CalendarEvent;
};
