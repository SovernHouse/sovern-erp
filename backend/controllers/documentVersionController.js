const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const fs = require('fs');
const path = require('path');

/**
 * Upload a new version of an existing document
 * @route POST /api/documents/:id/versions
 * @param {File} file - New document file
 * @param {string} changeNotes - Notes about what changed
 */
const uploadNewVersion = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const document = await db.Document.findByPk(req.params.id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const { changeNotes } = req.body;

    // Get current max version for this document
    const maxVersion = await db.DocumentVersion.max('version', {
      where: { documentId: req.params.id }
    });

    const newVersion = (maxVersion || 0) + 1;

    // Create new version record
    const version = await db.DocumentVersion.create({
      id: uuidv4(),
      documentId: req.params.id,
      version: newVersion,
      filename: req.file.originalname,
      filePath: `/uploads/${document.type === 'template' ? 'templates' : 'documents'}/${req.file.filename}`,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
      changeNotes: changeNotes || null,
      isCurrent: true
    });

    // Mark all previous versions as not current
    await db.DocumentVersion.update(
      { isCurrent: false },
      { where: { documentId: req.params.id, id: { [Op.ne]: version.id } } }
    );

    // Update document with new file info
    await document.update({
      fileUrl: version.filePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      version: newVersion
    });

    // Fetch complete version with uploader info
    const completeVersion = await db.DocumentVersion.findByPk(version.id, {
      include: [{ model: db.User, as: 'uploader', attributes: ['firstName', 'lastName', 'email'] }]
    });

    res.status(201).json(getSuccessResponse(completeVersion, `Version ${newVersion} uploaded successfully`));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'CREATE', 'DocumentVersion', version.id, {
      documentId: req.params.id,
      version: newVersion,
      changeNotes,
      data: completeVersion.toJSON()
    }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * List version history for a document
 * @route GET /api/documents/:id/versions
 */
const listVersions = async (req, res, next) => {
  try {
    const document = await db.Document.findByPk(req.params.id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const versions = await db.DocumentVersion.findAll({
      where: { documentId: req.params.id },
      include: [{ model: db.User, as: 'uploader', attributes: ['firstName', 'lastName', 'email'] }],
      order: [['version', 'DESC']]
    });

    res.json(getSuccessResponse({
      document: {
        id: document.id,
        name: document.name,
        currentVersion: document.version
      },
      versions
    }, 'Document version history retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific version
 * @route GET /api/documents/:id/versions/:versionNumber
 */
const getVersion = async (req, res, next) => {
  try {
    const { id, versionNumber } = req.params;

    const document = await db.Document.findByPk(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const version = await db.DocumentVersion.findOne({
      where: {
        documentId: id,
        version: parseInt(versionNumber)
      },
      include: [{ model: db.User, as: 'uploader', attributes: ['firstName', 'lastName', 'email'] }]
    });

    if (!version) {
      throw new NotFoundError(`Version ${versionNumber} not found`);
    }

    res.json(getSuccessResponse(version, 'Document version retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Revert to a specific version
 * Sets an older version as the current active version
 * @route POST /api/documents/:id/versions/:versionNumber/revert
 */
const revertToVersion = async (req, res, next) => {
  try {
    const { id, versionNumber } = req.params;

    const document = await db.Document.findByPk(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const targetVersion = await db.DocumentVersion.findOne({
      where: {
        documentId: id,
        version: parseInt(versionNumber)
      }
    });

    if (!targetVersion) {
      throw new NotFoundError(`Version ${versionNumber} not found`);
    }

    // Create a new version that copies the target version
    const maxVersion = await db.DocumentVersion.max('version', {
      where: { documentId: id }
    });

    const newVersionNumber = maxVersion + 1;

    const newVersion = await db.DocumentVersion.create({
      id: uuidv4(),
      documentId: id,
      version: newVersionNumber,
      filename: targetVersion.filename,
      filePath: targetVersion.filePath,
      fileSize: targetVersion.fileSize,
      uploadedBy: req.user.id,
      changeNotes: `Reverted to version ${versionNumber}`,
      isCurrent: true
    });

    // Mark all other versions as not current
    await db.DocumentVersion.update(
      { isCurrent: false },
      { where: { documentId: id, id: { [Op.ne]: newVersion.id } } }
    );

    // Update document with reverted file info
    await document.update({
      fileUrl: targetVersion.filePath,
      fileName: targetVersion.filename,
      fileSize: targetVersion.fileSize,
      version: newVersionNumber
    });

    const completeVersion = await db.DocumentVersion.findByPk(newVersion.id, {
      include: [{ model: db.User, as: 'uploader', attributes: ['firstName', 'lastName', 'email'] }]
    });

    res.json(getSuccessResponse(completeVersion, `Reverted to version ${versionNumber} (created as version ${newVersionNumber})`));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'REVERT', 'DocumentVersion', newVersion.id, {
      documentId: id,
      revertedFromVersion: versionNumber,
      newVersion: newVersionNumber
    }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Compare two versions
 * Returns metadata comparison of two versions
 * @route GET /api/documents/:id/versions/compare
 * @query {number} fromVersion - First version number
 * @query {number} toVersion - Second version number
 */
const compareVersions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fromVersion, toVersion } = req.query;

    if (!fromVersion || !toVersion) {
      throw new ValidationError('fromVersion and toVersion query parameters are required');
    }

    const document = await db.Document.findByPk(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const v1 = await db.DocumentVersion.findOne({
      where: {
        documentId: id,
        version: parseInt(fromVersion)
      },
      include: [{ model: db.User, as: 'uploader', attributes: ['firstName', 'lastName'] }]
    });

    const v2 = await db.DocumentVersion.findOne({
      where: {
        documentId: id,
        version: parseInt(toVersion)
      },
      include: [{ model: db.User, as: 'uploader', attributes: ['firstName', 'lastName'] }]
    });

    if (!v1 || !v2) {
      throw new NotFoundError('One or both versions not found');
    }

    const comparison = {
      document: {
        id: document.id,
        name: document.name
      },
      version1: {
        number: v1.version,
        filename: v1.filename,
        fileSize: v1.fileSize,
        uploadedBy: v1.uploader?.firstName + ' ' + v1.uploader?.lastName,
        uploadedAt: v1.createdAt,
        changeNotes: v1.changeNotes
      },
      version2: {
        number: v2.version,
        filename: v2.filename,
        fileSize: v2.fileSize,
        uploadedBy: v2.uploader?.firstName + ' ' + v2.uploader?.lastName,
        uploadedAt: v2.createdAt,
        changeNotes: v2.changeNotes
      },
      differences: {
        filenameChanged: v1.filename !== v2.filename,
        fileSizeChanged: v1.fileSize !== v2.fileSize,
        timeBetweenVersions: calculateTimeDifference(v1.createdAt, v2.createdAt)
      }
    };

    res.json(getSuccessResponse(comparison, 'Version comparison retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a specific version (keeping document history)
 * @route DELETE /api/documents/:id/versions/:versionNumber
 */
const deleteVersion = async (req, res, next) => {
  try {
    const { id, versionNumber } = req.params;

    const document = await db.Document.findByPk(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const version = await db.DocumentVersion.findOne({
      where: {
        documentId: id,
        version: parseInt(versionNumber)
      }
    });

    if (!version) {
      throw new NotFoundError(`Version ${versionNumber} not found`);
    }

    if (version.isCurrent) {
      throw new ValidationError('Cannot delete the current active version. Revert to another version first.');
    }

    const beforeSnapshot = version.toJSON();
    await version.destroy();

    res.json(getSuccessResponse({ id: version.id }, `Version ${versionNumber} deleted`));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'DELETE', 'DocumentVersion', version.id, {
      documentId: id,
      version: versionNumber,
      before: beforeSnapshot
    }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get version statistics for a document
 * @route GET /api/documents/:id/versions/stats
 */
const getVersionStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await db.Document.findByPk(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const versions = await db.DocumentVersion.findAll({
      where: { documentId: id }
    });

    const stats = {
      totalVersions: versions.length,
      currentVersion: document.version,
      createdAt: document.createdAt,
      lastModifiedAt: versions.length > 0 ? versions[versions.length - 1].createdAt : document.createdAt,
      largestVersion: versions.length > 0 ? Math.max(...versions.map(v => v.fileSize)) : 0,
      smallestVersion: versions.length > 0 ? Math.min(...versions.map(v => v.fileSize)) : 0,
      averageSize: versions.length > 0 ? (versions.reduce((sum, v) => sum + v.fileSize, 0) / versions.length).toFixed(2) : 0,
      versionsWithChangeNotes: versions.filter(v => v.changeNotes).length
    };

    res.json(getSuccessResponse(stats, 'Version statistics retrieved'));
  } catch (error) {
    next(error);
  }
};

// Helper functions

function calculateTimeDifference(date1, date2) {
  const time1 = new Date(date1).getTime();
  const time2 = new Date(date2).getTime();
  const diffMs = Math.abs(time2 - time1);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} days, ${diffHours} hours`;
  } else if (diffHours > 0) {
    return `${diffHours} hours, ${diffMinutes} minutes`;
  } else {
    return `${diffMinutes} minutes`;
  }
}

module.exports = {
  uploadNewVersion,
  listVersions,
  getVersion,
  revertToVersion,
  compareVersions,
  deleteVersion,
  getVersionStats
};
