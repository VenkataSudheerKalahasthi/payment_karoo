import crypto from 'crypto';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { UserRole } from '@prisma/client';
import { BUCKET_LIMITS, AuthorizeUploadInput } from './storage.schema.js';
import { logger } from '../../utils/logger.js';

const STORAGE_SECRET = process.env.STORAGE_SIGNING_SECRET || crypto.createHash('sha256').update(process.env.DATABASE_URL || 'tp_secret').digest('hex');

export class StorageService {
  /**
   * Authorizes upload intent by validating bucket rules, contract ownership,
   * milestone ownership, MIME types, and file sizes.
   */
  async authorizeUpload(input: AuthorizeUploadInput, user: { id: string; role: { name: UserRole } }) {
    // 1. Bucket restrictions check
    const bucketConfig = BUCKET_LIMITS[input.bucket];
    if (!(bucketConfig.allowedMimes as readonly string[]).includes(input.mimeType)) {
      throw {
        statusCode: 400,
        code: 'INVALID_MIME_TYPE',
        message: `MIME type "${input.mimeType}" is not permitted in bucket "${input.bucket}". Allowed: ${bucketConfig.allowedMimes.join(', ')}`,
      };
    }

    if (input.fileSizeBytes > bucketConfig.maxBytes) {
      throw {
        statusCode: 400,
        code: 'FILE_TOO_LARGE',
        message: `File size (${input.fileSizeBytes} bytes) exceeds maximum limit (${bucketConfig.maxBytes} bytes) for bucket "${input.bucket}".`,
      };
    }

    // 2. Contract ownership check
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      select: { id: true, clientId: true, workerId: true, contractNumber: true },
    });

    if (!contract) {
      throw {
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
        message: `Contract "${input.contractId}" not found.`,
      };
    }

    const isClient = contract.clientId === user.id;
    const isWorker = contract.workerId === user.id;
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You are not an authorized participant in this contract.',
      };
    }

    // 3. Milestone verification if milestoneId provided (e.g. deliverable evidence)
    if (input.milestoneId) {
      const milestone = await prisma.contractMilestone.findFirst({
        where: { id: input.milestoneId, contractId: contract.id },
      });
      if (!milestone) {
        throw {
          statusCode: 404,
          code: 'MILESTONE_NOT_FOUND',
          message: `Milestone "${input.milestoneId}" does not belong to contract "${contract.id}".`,
        };
      }
    }

    // 4. Generate safe object path avoiding directory traversal
    const safeBaseName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `contracts/${contract.id}/${input.bucket}/${crypto.randomUUID()}-${safeBaseName}`;

    // 5. Generate secure upload token
    const expiresIn = 900; // 15 minutes
    const expiresAt = Date.now() + expiresIn * 1000;
    const payload = `${user.id}:${input.bucket}:${objectPath}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', STORAGE_SECRET).update(payload).digest('hex');
    const uploadToken = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');

    logger.info(`[STORAGE UPLOAD AUTHORIZED] User ${user.id} authorized for ${objectPath} in bucket ${input.bucket}`);

    return {
      bucket: input.bucket,
      objectPath,
      uploadToken,
      expiresIn,
      maxBytes: bucketConfig.maxBytes,
    };
  }

  /**
   * Generates a signed download URL for an authorized participant.
   */
  async authorizeDownload(contractId: string, objectPath: string, user: { id: string; role: { name: UserRole } }) {
    // 1. Prevent path traversal
    if (objectPath.includes('..') || objectPath.startsWith('/') || objectPath.startsWith('\\')) {
      throw {
        statusCode: 400,
        code: 'INVALID_OBJECT_PATH',
        message: 'Object path contains illegal directory traversal characters.',
      };
    }

    // 2. Contract ownership check
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, clientId: true, workerId: true },
    });

    if (!contract) {
      throw {
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
        message: 'Target contract not found',
      };
    }

    const isClient = contract.clientId === user.id;
    const isWorker = contract.workerId === user.id;
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied to confidential contract documents.',
      };
    }

    // Ensure objectPath is strictly bound to contract
    if (!objectPath.startsWith(`contracts/${contract.id}/`)) {
      throw {
        statusCode: 403,
        code: 'PATH_CONTRACT_MISMATCH',
        message: 'Target object path does not match specified contract.',
      };
    }

    const expiresIn = 900; // 15 minutes
    const expiresAt = Date.now() + expiresIn * 1000;
    const payload = `${user.id}:${objectPath}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', STORAGE_SECRET).update(payload).digest('hex');
    const downloadToken = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');

    return {
      downloadUrl: `/api/v1/storage/file?token=${downloadToken}`,
      expiresIn,
      fileName: path.basename(objectPath),
    };
  }

  /**
   * Validates a signed download token using timing-safe verification.
   */
  verifyDownloadToken(token: string): { userId: string; objectPath: string } {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
      const { payload, signature } = decoded;

      const expectedSig = crypto.createHmac('sha256', STORAGE_SECRET).update(payload).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('Invalid signature');
      }

      const [userId, objectPath, expiresAtStr] = payload.split(':');
      const expiresAt = parseInt(expiresAtStr, 10);

      if (Date.now() > expiresAt) {
        throw new Error('Download token expired');
      }

      return { userId, objectPath };
    } catch {
      throw {
        statusCode: 401,
        code: 'INVALID_DOWNLOAD_TOKEN',
        message: 'Signed download token is invalid or has expired.',
      };
    }
  }

  /**
   * Validates a signed upload token using timing-safe verification.
   */
  verifyUploadToken(token: string): { userId: string; bucket: string; objectPath: string } {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
      const { payload, signature } = decoded;

      const expectedSig = crypto.createHmac('sha256', STORAGE_SECRET).update(payload).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('Invalid signature');
      }

      const [userId, bucket, objectPath, expiresAtStr] = payload.split(':');
      const expiresAt = parseInt(expiresAtStr, 10);

      if (Date.now() > expiresAt) {
        throw new Error('Upload token expired');
      }

      return { userId, bucket, objectPath };
    } catch {
      throw {
        statusCode: 401,
        code: 'INVALID_UPLOAD_TOKEN',
        message: 'Signed upload token is invalid or has expired.',
      };
    }
  }
}

export const storageService = new StorageService();
