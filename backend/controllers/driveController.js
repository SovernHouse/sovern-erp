/**
 * driveController.js
 *
 * Proxy for Google Drive API v3.
 * All requests use the OAuth tokens stored in ConnectedGoogleAccount.
 * Drive data is not stored in the DB — queried on demand.
 */

const { google } = require('googleapis');
const db = require('../models');
const { getAuthClientForAccount } = require('./googleAccountController');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

// Fields to request for each file — keeps response lean
const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,webContentLink,iconLink,thumbnailLink,owners,shared,trashed';
const LIST_FIELDS = `nextPageToken,files(${FILE_FIELDS})`;

// ── Helper: get Drive client for a stored account ─────────────────────────────

async function getDriveClient(accountId) {
  if (!accountId) throw new ValidationError('accountId is required');

  const account = await db.ConnectedGoogleAccount.findByPk(accountId);
  if (!account) throw new NotFoundError('Google account not found');
  if (!account.isActive) throw new ValidationError('Google account is inactive');

  const hasDriveScope = (account.scopes || []).some(s => s.includes('drive'));
  if (!hasDriveScope) throw new ValidationError('This account was connected without Drive access. Reconnect via Settings → Connected Accounts.');

  const auth = await getAuthClientForAccount(account);
  return google.drive({ version: 'v3', auth });
}

// ── GET /api/drive/files ──────────────────────────────────────────────────────
// List files/folders in a folder (default: root).

exports.listFiles = async (req, res) => {
  const { accountId, folderId = 'root', pageToken, pageSize = 50 } = req.query;

  const drive = await getDriveClient(accountId);

  // Query: list children of the folder, excluding trashed items
  const q = `'${folderId}' in parents and trashed = false`;

  const response = await drive.files.list({
    q,
    fields: LIST_FIELDS,
    orderBy: 'folder,name',
    pageSize: Math.min(parseInt(pageSize, 10) || 50, 200),
    pageToken: pageToken || undefined,
  });

  return res.json({
    success: true,
    data: {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null,
    },
  });
};

// ── GET /api/drive/files/:fileId ──────────────────────────────────────────────
// Get metadata for a single file.

exports.getFile = async (req, res) => {
  const { accountId } = req.query;
  const { fileId } = req.params;

  const drive = await getDriveClient(accountId);

  const response = await drive.files.get({
    fileId,
    fields: FILE_FIELDS,
  });

  return res.json({ success: true, data: response.data });
};

// ── GET /api/drive/search ─────────────────────────────────────────────────────
// Full-text search across Drive.

exports.searchFiles = async (req, res) => {
  const { accountId, q: searchQuery, pageToken, pageSize = 50 } = req.query;

  if (!searchQuery || !searchQuery.trim()) {
    throw new ValidationError('q (search query) is required');
  }

  const drive = await getDriveClient(accountId);

  // Full-text search, not trashed
  const q = `fullText contains '${searchQuery.replace(/'/g, "\'")}' and trashed = false`;

  const response = await drive.files.list({
    q,
    fields: LIST_FIELDS,
    orderBy: 'modifiedTime desc',
    pageSize: Math.min(parseInt(pageSize, 10) || 50, 200),
    pageToken: pageToken || undefined,
  });

  return res.json({
    success: true,
    data: {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null,
    },
  });
};

// ── GET /api/drive/breadcrumb ─────────────────────────────────────────────────
// Resolve a folder path from root → folderId for breadcrumb navigation.
// Returns an array of { id, name } from root to the current folder.

exports.getBreadcrumb = async (req, res) => {
  const { accountId, folderId } = req.query;

  if (!folderId || folderId === 'root') {
    return res.json({ success: true, data: [] });
  }

  const drive = await getDriveClient(accountId);

  // Walk up the parent chain (max 10 levels to avoid infinite loops)
  const crumbs = [];
  let currentId = folderId;

  for (let i = 0; i < 10; i++) {
    if (!currentId || currentId === 'root') break;

    const resp = await drive.files.get({
      fileId: currentId,
      fields: 'id,name,parents',
    });

    crumbs.unshift({ id: resp.data.id, name: resp.data.name });

    const parents = resp.data.parents;
    currentId = parents && parents.length > 0 ? parents[0] : null;
    if (!currentId) break;
  }

  return res.json({ success: true, data: crumbs });
};
