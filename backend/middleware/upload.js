const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/storageService');

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Create local upload directory if using local storage
if (storageService.STORAGE_PROVIDER === 'local' && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Only used for local storage
    if (storageService.STORAGE_PROVIDER === 'local') {
      const entityType = req.query.entityType || 'general';
      const dir = path.join(uploadDir, entityType);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      cb(null, dir);
    } else {
      // For S3/MinIO, use temp directory
      const tempDir = path.join(__dirname, '..', '.tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = uuidv4() + ext;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = (process.env.ALLOWED_EXTENSIONS || 'pdf,jpg,jpeg,png,doc,docx,xls,xlsx').split(',');
  const ext = path.extname(file.originalname).substring(1).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type .${ext} not allowed`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || 52428800)
  }
});

/**
 * Wrapper for single file upload with storage service integration
 * Automatically handles local/S3/MinIO based on STORAGE_PROVIDER
 */
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return next(err);
      }

      if (!req.file) {
        return next();
      }

      try {
        const entityType = req.query.entityType || 'general';

        // Upload using storage service
        const uploadResult = await storageService.uploadFile(req.file, entityType);

        // Attach upload result to request
        req.uploadedFile = uploadResult;

        // Clean up temp file if S3/MinIO
        if (storageService.STORAGE_PROVIDER !== 'local' && req.file.path) {
          fs.unlinkSync(req.file.path);
        }

        next();
      } catch (uploadError) {
        next(uploadError);
      }
    });
  };
};

/**
 * Wrapper for multiple file upload with storage service integration
 */
const uploadMultiple = (fieldName = 'files', maxCount = 10) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) {
        return next(err);
      }

      if (!req.files || req.files.length === 0) {
        return next();
      }

      try {
        const entityType = req.query.entityType || 'general';

        // Upload all files using storage service
        const uploadResults = await Promise.all(
          req.files.map(file => storageService.uploadFile(file, entityType))
        );

        // Attach upload results to request
        req.uploadedFiles = uploadResults;

        // Clean up temp files if S3/MinIO
        if (storageService.STORAGE_PROVIDER !== 'local') {
          req.files.forEach(file => {
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }

        next();
      } catch (uploadError) {
        next(uploadError);
      }
    });
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadDir,
  storageService
};
