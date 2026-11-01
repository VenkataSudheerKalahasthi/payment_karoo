import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { Prisma } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 25;
  const action = req.query.action as string | undefined;
  const resource = req.query.resource as string | undefined;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (resource) where.resource = { contains: resource, mode: 'insensitive' };

  try {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    sendSuccess(res, 200, {
      items: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error listing audit logs:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve audit logs');
  }
}

