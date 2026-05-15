/**
 * Phase 4.7, C-3 — Drive folder structure setup.
 *
 * Creates a standard folder hierarchy on each connected Google Drive
 * account so the AI assistant has predictable paths to suggest when a
 * file isn't found and Alex wants to upload it (see Phase 4.7 C-4).
 *
 * Idempotent: every folder lookup is "find or create", so re-running
 * the setup is a no-op once the structure exists. The endpoint
 * returns the folder IDs so the caller can use them downstream (e.g.
 * to deep-link to a folder for a manual drag-drop upload).
 *
 * Structure created on each account:
 *
 *   Brand Assets/
 *     IronLite Branding/
 *     Sovern House Branding/
 *     Reference/
 *
 *   Operations/
 *     Contracts/
 *     Factory Communications/
 *     Templates/
 *
 * Local-file constraint: the ERP backend runs on a Linux VM and
 * cannot reach Alex's Windows filesystem. This module only creates
 * folders. Bulk upload of local content (e.g. the IronLite Branding
 * folder on Alex's desktop) happens by drag-drop via drive.google.com
 * into the URL returned in each folder's webViewLink.
 */

const { google } = require('googleapis');
const { getAuthClientForAccount } = require('../controllers/googleAccountController');
const logger = require('../utils/logger');

// Canonical folder tree. parentPath uses '/' as the separator; the
// resolver walks the tree depth-first so children inherit their
// parent's Drive folderId. Order matters — parents must precede their
// children.
const FOLDER_TREE = [
  { path: 'Brand Assets',                              parent: null },
  { path: 'Brand Assets/IronLite Branding',            parent: 'Brand Assets' },
  { path: 'Brand Assets/Sovern House Branding',        parent: 'Brand Assets' },
  { path: 'Brand Assets/Reference',                    parent: 'Brand Assets' },
  { path: 'Operations',                                parent: null },
  { path: 'Operations/Contracts',                      parent: 'Operations' },
  { path: 'Operations/Factory Communications',         parent: 'Operations' },
  { path: 'Operations/Templates',                      parent: 'Operations' },
];

function leafName(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

/**
 * Find-or-create a folder by name under a parent. Mirrors the helper
 * in aiController.js so the AI attachment flow and this admin setup
 * use identical semantics. Returns { id, created }.
 */
async function findOrCreateFolder(drive, name, parentId) {
  const safe = String(name).replace(/'/g, "\\'");
  const q =
    `mimeType = 'application/vnd.google-apps.folder' and name = '${safe}' and trashed = false` +
    (parentId ? ` and '${parentId}' in parents` : ' and \'root\' in parents');
  // Phase 4.7+ C-4: include webViewLink in the list fields so the
  // found-not-created branch can return a clickable URL. Without this,
  // the setup endpoint returned webViewLink:null for any existing
  // folder, leaving the admin to dig through Drive manually.
  const list = await drive.files.list({ q, fields: 'files(id,name,webViewLink)', pageSize: 1 });
  if (list.data.files && list.data.files.length > 0) {
    const hit = list.data.files[0];
    return { id: hit.id, webViewLink: hit.webViewLink || null, created: false };
  }
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    },
    fields: 'id, webViewLink',
  });
  return { id: created.data.id, webViewLink: created.data.webViewLink || null, created: true };
}

/**
 * Build the entire folder tree on a single Drive account. Returns a
 * map { folderPath -> { id, created } } for every node walked.
 */
async function setupForAccount(account) {
  const auth = await getAuthClientForAccount(account);
  const drive = google.drive({ version: 'v3', auth });

  const pathToId = {}; // 'Brand Assets' -> { id, created }
  for (const node of FOLDER_TREE) {
    const parentId = node.parent ? pathToId[node.parent]?.id : null;
    const { id, created, webViewLink } = await findOrCreateFolder(drive, leafName(node.path), parentId);
    pathToId[node.path] = { id, created, webViewLink: webViewLink || null };
  }
  return pathToId;
}

/**
 * Run the setup against every active ConnectedGoogleAccount that has
 * the Drive scope. Skips accounts missing Drive scope with a warning.
 * Returns a per-account result map.
 */
async function setupDriveStructureForAllAccounts(db) {
  if (!db || !db.ConnectedGoogleAccount) {
    throw new Error('ConnectedGoogleAccount model not registered');
  }
  const accounts = await db.ConnectedGoogleAccount.findAll({ where: { isActive: true } });
  if (accounts.length === 0) {
    return { accounts: [], note: 'No active Google accounts connected.' };
  }
  const out = {};
  for (const acc of accounts) {
    // Phase 4.7 follow-up: folder creation needs drive.file or drive. The
    // earlier readonly-passing check let setup attempts hit the Drive API
    // and fail with "Insufficient Permission" only when we tried to
    // actually create a folder. Surface the missing-scope condition
    // before making the API call so the caller knows the account needs
    // re-authorization, not that Drive itself is broken.
    const scopes = acc.scopes || [];
    const hasDriveWrite = scopes.some((s) =>
      s.includes('drive.file') || s === 'https://www.googleapis.com/auth/drive',
    );
    if (!hasDriveWrite) {
      logger.warn(`[driveSetup] ${acc.email} missing Drive write scope (drive.file); needs re-authorization`);
      out[acc.email] = {
        skipped: true,
        reason: 'missing_drive_write_scope',
        currentScopes: scopes,
        fix: 'Reconnect this account via ERP Settings -> Connected Accounts. The OAuth consent will request drive.file as of Phase 4.7.',
      };
      continue;
    }
    try {
      out[acc.email] = await setupForAccount(acc);
    } catch (e) {
      logger.error(`[driveSetup] ${acc.email} failed: ${e.message}`);
      out[acc.email] = { error: e.message };
    }
  }
  return out;
}

module.exports = {
  FOLDER_TREE,
  setupForAccount,
  setupDriveStructureForAllAccounts,
};
