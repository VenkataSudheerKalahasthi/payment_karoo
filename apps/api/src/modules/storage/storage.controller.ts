import { Request, Response } from 'express';
import { storageService } from './storage.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { authorizeUploadSchema, authorizeDownloadSchema } from './storage.schema.js';

export async function authorizeUpload(req: Request, res: Response): Promise<void> {
  const body = authorizeUploadSchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid upload request', body.error.format());
    return;
  }

  const user = req.user!;

  try {
    const result = await storageService.authorizeUpload(body.data, user);

    await recordAuditLog({
      actorId: user.id,
      action: 'STORAGE_UPLOAD_AUTHORIZED',
      resource: 'StorageBucket',
      resourceId: result.objectPath,
      details: {
        bucket: body.data.bucket,
        contractId: body.data.contractId,
        milestoneId: body.data.milestoneId,
        fileName: body.data.fileName,
        fileSizeBytes: body.data.fileSizeBytes,
      },
      req,
    });

    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Upload authorization failed');
      return;
    }
    logger.error('Error authorizing upload:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to authorize document upload');
  }
}

export async function authorizeDownload(req: Request, res: Response): Promise<void> {
  const body = authorizeDownloadSchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid download request', body.error.format());
    return;
  }

  const user = req.user!;

  try {
    const result = await storageService.authorizeDownload(body.data.contractId, body.data.objectPath, user);

    await recordAuditLog({
      actorId: user.id,
      action: 'STORAGE_DOWNLOAD_AUTHORIZED',
      resource: 'StorageBucket',
      resourceId: body.data.objectPath,
      details: {
        contractId: body.data.contractId,
      },
      req,
    });

    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Download authorization failed');
      return;
    }
    logger.error('Error authorizing download:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to authorize document download');
  }
}

export async function downloadFile(req: Request, res: Response): Promise<void> {
  const token = req.query.token as string | undefined;

  if (!token) {
    sendError(res, 401, 'MISSING_TOKEN', 'Download requires a valid signed token.');
    return;
  }

  try {
    const { objectPath } = storageService.verifyDownloadToken(token);

    // Provide safe download header
    res.setHeader('Content-Disposition', `attachment; filename="${objectPath.split('/').pop() || 'document'}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Return confirmation metadata stream
    res.status(200).json({
      success: true,
      data: {
        message: 'Signed document access verified.',
        objectPath,
        status: 'READY',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 401, err.code || 'UNAUTHORIZED', err.message || 'Invalid or expired download token');
  }
}

