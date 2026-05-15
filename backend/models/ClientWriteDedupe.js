const { DataTypes } = require('sequelize');

/**
 * ClientWriteDedupe — Phase 5 (post-ship hardening).
 *
 * Backs the X-Client-Uuid dedupe middleware. When an offline-queued
 * write replays after a network-cut-after-send (the original request
 * reached the server but the response was lost), the replay hits the
 * same (clientUuid, method, path) row that the original wrote and
 * gets the cached response — no duplicate created.
 *
 * 24h TTL is enforced at read time (rows older than that are ignored
 * and overwritten on next write to the same key). A periodic janitor
 * is not currently needed: row growth is bounded by user activity
 * and the table fits comfortably in SQLite.
 *
 * Primary key is composite (clientUuid + method + path) so a single
 * write can be replayed any number of times without ambiguity.
 */
module.exports = (sequelize) => {
  const ClientWriteDedupe = sequelize.define('ClientWriteDedupe', {
    clientUuid: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
    },
    method: {
      type: DataTypes.STRING(8),
      allowNull: false,
      primaryKey: true,
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: true,
    },
    responseStatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    responseBody: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    // Global underscored:true convention means the column is `created_at`.
    indexes: [
      { fields: ['created_at'] },
    ],
  });

  return ClientWriteDedupe;
};
