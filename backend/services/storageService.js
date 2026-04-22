const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Storage Service - File Storage Abstraction
 * Supports local disk and S3/MinIO storage
 *
 * Installation: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Try to load AWS SDK (optional for S3 mode)
let S3Client = null;
let GetObjectCommand = null;
let PutObjectCommand = null;
let DeleteObjectCommand = null;
let ListObjectsV2Command = null;
let getSignedUrl = null;

if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') {
  try {
    const { S3Client: S3ClientImport } = require('@aws-sdk/client-s3');
    const { GetObjectCommand: GetObjectCommandImport, PutObjectCommand: PutObjectCommandImport,
      DeleteObjectCommand: DeleteObjectCommandImport, ListObjectsV2Command: ListObjectsV2CommandImport }
      = require('@aws-sdk/client-s3');
    const { getSignedUrl: getSignedUrlImport } = require('@aws-sdk/s3-request-presigner');

    S3Client = S3ClientImport;
    GetObjectCommand = GetObjectCommandImport;
    PutObjectCommand = PutObjectCommandImport;
    DeleteObjectCommand = DeleteObjectCommandImport;
    ListObjectsV2Command = ListObjectsV2CommandImport;
    getSignedUrl = getSignedUrlImport;
  } catch (err) {
    console.warn('AWS SDK not installed. Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner');
    console.warn('Falling back to local storage');
  }
}

let s3Client = null;

// Initialize S3/MinIO client if configured
if ((STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') && S3Client) {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';

  s3Client = new S3Client({
    ...(STORAGE_PROVIDER === 'minio' && { endpoint }),
    region,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  });
}

/**
 * Upload file to storage
 * @param {Object} file - Multer file object { fieldname, originalname, encoding, mimetype, size, buffer, path }
 * @param {string} filePath - Target path/directory in storage
 * @param {Object} options - Upload options { public, metadata }
 * @returns {Object} { url, path, size, provider }
 */
const uploadFile = async (file, filePath = 'general', options = {}) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const fileName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname || '')}`;
    const targetPath = path.join(filePath, fileName);

    if (STORAGE_PROVIDER === 'local') {
      return await uploadFileLocal(file, targetPath, options);
    } else if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') {
      return await uploadFileS3(file, targetPath, options);
    } else {
      throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
    }
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Upload to local filesystem
 */
const uploadFileLocal = async (file, filePath, options) => {
  const fullPath = path.join(LOCAL_UPLOAD_DIR, filePath);
  const dir = path.dirname(fullPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  const buffer = file.buffer || fs.readFileSync(file.path);
  fs.writeFileSync(fullPath, buffer);

  // Return file info
  return {
    url: `/uploads/${filePath.replace(/\\/g, '/')}`,
    path: filePath,
    size: buffer.length,
    provider: 'local',
    uploadedAt: new Date()
  };
};

/**
 * Upload to S3/MinIO
 */
const uploadFileS3 = async (file, filePath, options) => {
  if (!s3Client || !PutObjectCommand) {
    throw new Error('S3 client not initialized. Ensure AWS SDK is installed.');
  }

  const buffer = file.buffer || fs.readFileSync(file.path);
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error('S3_BUCKET environment variable not set');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: filePath,
    Body: buffer,
    ContentType: file.mimetype,
    Metadata: options.metadata || { 'uploaded-by': 'storage-service' }
  });

  await s3Client.send(command);

  return {
    url: `${process.env.S3_ENDPOINT || `https://${bucket}.s3.amazonaws.com`}/${filePath}`,
    path: filePath,
    size: buffer.length,
    provider: STORAGE_PROVIDER,
    uploadedAt: new Date()
  };
};

/**
 * Get file from storage
 * @param {string} filePath - File path in storage
 * @returns {Object} { stream, contentType, size }
 */
const getFile = async (filePath) => {
  try {
    if (STORAGE_PROVIDER === 'local') {
      return await getFileLocal(filePath);
    } else if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') {
      return await getFileS3(filePath);
    } else {
      throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
    }
  } catch (error) {
    throw new Error(`Failed to get file: ${error.message}`);
  }
};

/**
 * Get file from local filesystem
 */
const getFileLocal = async (filePath) => {
  const fullPath = path.join(LOCAL_UPLOAD_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(fullPath);
  const stream = fs.createReadStream(fullPath);

  return {
    stream,
    size: stat.size,
    provider: 'local'
  };
};

/**
 * Get file from S3/MinIO
 */
const getFileS3 = async (filePath) => {
  if (!s3Client || !GetObjectCommand) {
    throw new Error('S3 client not initialized');
  }

  const bucket = process.env.S3_BUCKET;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: filePath
  });

  const response = await s3Client.send(command);

  return {
    stream: response.Body,
    size: response.ContentLength,
    contentType: response.ContentType,
    provider: STORAGE_PROVIDER
  };
};

/**
 * Delete file from storage
 * @param {string} filePath - File path in storage
 */
const deleteFile = async (filePath) => {
  try {
    if (STORAGE_PROVIDER === 'local') {
      return await deleteFileLocal(filePath);
    } else if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') {
      return await deleteFileS3(filePath);
    } else {
      throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
    }
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Delete file from local filesystem
 */
const deleteFileLocal = async (filePath) => {
  const fullPath = path.join(LOCAL_UPLOAD_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  fs.unlinkSync(fullPath);

  return {
    success: true,
    path: filePath,
    deletedAt: new Date(),
    provider: 'local'
  };
};

/**
 * Delete file from S3/MinIO
 */
const deleteFileS3 = async (filePath) => {
  if (!s3Client || !DeleteObjectCommand) {
    throw new Error('S3 client not initialized');
  }

  const bucket = process.env.S3_BUCKET;

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: filePath
  });

  await s3Client.send(command);

  return {
    success: true,
    path: filePath,
    deletedAt: new Date(),
    provider: STORAGE_PROVIDER
  };
};

/**
 * Generate signed/presigned URL
 * @param {string} filePath - File path in storage
 * @param {number} expiresIn - Expiration time in seconds (for S3)
 * @returns {string} URL
 */
const getSignedUrlPath = async (filePath, expiresIn = 3600) => {
  try {
    if (STORAGE_PROVIDER === 'local') {
      return `/uploads/${filePath.replace(/\\/g, '/')}`;
    } else if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') {
      return await getSignedUrlS3(filePath, expiresIn);
    } else {
      throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
    }
  } catch (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Generate S3 signed URL
 */
const getSignedUrlS3 = async (filePath, expiresIn) => {
  if (!s3Client || !getSignedUrl || !GetObjectCommand) {
    throw new Error('S3 client not initialized');
  }

  const bucket = process.env.S3_BUCKET;
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: filePath
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
};

/**
 * List files in storage
 * @param {string} prefix - Directory prefix
 * @returns {Array} Files list
 */
const listFiles = async (prefix = '') => {
  try {
    if (STORAGE_PROVIDER === 'local') {
      return await listFilesLocal(prefix);
    } else if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') {
      return await listFilesS3(prefix);
    } else {
      throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
    }
  } catch (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
};

/**
 * List files from local filesystem
 */
const listFilesLocal = async (prefix) => {
  const fullPath = path.join(LOCAL_UPLOAD_DIR, prefix);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const files = fs.readdirSync(fullPath, { withFileTypes: true });

  return files
    .filter(f => f.isFile())
    .map(f => ({
      name: f.name,
      path: path.join(prefix, f.name).replace(/\\/g, '/'),
      url: `/uploads/${path.join(prefix, f.name).replace(/\\/g, '/')}`
    }));
};

/**
 * List files from S3/MinIO
 */
const listFilesS3 = async (prefix) => {
  if (!s3Client || !ListObjectsV2Command) {
    throw new Error('S3 client not initialized');
  }

  const bucket = process.env.S3_BUCKET;

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: 1000
  });

  const response = await s3Client.send(command);

  return (response.Contents || []).map(obj => ({
    name: path.basename(obj.Key),
    path: obj.Key,
    size: obj.Size,
    lastModified: obj.LastModified,
    url: `${process.env.S3_ENDPOINT || `https://${bucket}.s3.amazonaws.com`}/${obj.Key}`
  }));
};

/**
 * Move/rename file
 * @param {string} fromPath - Source path
 * @param {string} toPath - Destination path
 */
const moveFile = async (fromPath, toPath) => {
  try {
    if (STORAGE_PROVIDER === 'local') {
      return await moveFileLocal(fromPath, toPath);
    } else if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') {
      return await moveFileS3(fromPath, toPath);
    } else {
      throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
    }
  } catch (error) {
    throw new Error(`Failed to move file: ${error.message}`);
  }
};

/**
 * Move file in local filesystem
 */
const moveFileLocal = async (fromPath, toPath) => {
  const fromFullPath = path.join(LOCAL_UPLOAD_DIR, fromPath);
  const toFullPath = path.join(LOCAL_UPLOAD_DIR, toPath);

  if (!fs.existsSync(fromFullPath)) {
    throw new Error(`Source file not found: ${fromPath}`);
  }

  // Ensure destination directory exists
  const toDir = path.dirname(toFullPath);
  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true });
  }

  fs.renameSync(fromFullPath, toFullPath);

  return {
    success: true,
    from: fromPath,
    to: toPath,
    provider: 'local'
  };
};

/**
 * Move file in S3/MinIO (copy + delete)
 */
const moveFileS3 = async (fromPath, toPath) => {
  if (!s3Client || !PutObjectCommand || !DeleteObjectCommand || !GetObjectCommand) {
    throw new Error('S3 client not initialized');
  }

  const bucket = process.env.S3_BUCKET;

  // Get source file
  const getCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: fromPath
  });
  const response = await s3Client.send(getCommand);

  // Put to destination
  const putCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: toPath,
    Body: response.Body,
    ContentType: response.ContentType
  });
  await s3Client.send(putCommand);

  // Delete source
  const delCommand = new DeleteObjectCommand({
    Bucket: bucket,
    Key: fromPath
  });
  await s3Client.send(delCommand);

  return {
    success: true,
    from: fromPath,
    to: toPath,
    provider: STORAGE_PROVIDER
  };
};

module.exports = {
  uploadFile,
  getFile,
  deleteFile,
  getSignedUrlPath,
  listFiles,
  moveFile,
  STORAGE_PROVIDER
};
