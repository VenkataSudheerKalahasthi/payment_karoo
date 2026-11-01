import { Request } from 'express';
import { prisma } from '../config/prisma.js';
import { logger } from './logger.js';
import { Prisma } from '@prisma/client';

export interface AuditLogOptions {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  req?: Request;
}

export async function recordAuditLog(options: AuditLogOptions): Promise<void> {
  try {
    const ipAddress = options.req
      ? (options.req.headers['x-forwarded-for'] as string) || options.req.socket.remoteAddress || null
      : null;
    const userAgent = options.req ? options.req.headers['user-agent'] || null : null;

    await prisma.auditLog.create({
      data: {
        actorId: options.actorId ?? null,
        action: options.action,
        resource: options.resource,
        resourceId: options.resourceId ?? null,
        details: options.details ? (options.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: ipAddress ? String(ipAddress).slice(0, 45) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log:', err);
  }
}

export interface AdminActivityOptions {
  adminId: string;
  action: string;
  targetUserId?: string | null;
  targetResourceId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function recordAdminActivity(options: AdminActivityOptions): Promise<void> {
  try {
    await prisma.adminActivity.create({
      data: {
        adminId: options.adminId,
        action: options.action,
        targetUserId: options.targetUserId ?? null,
        targetResourceId: options.targetResourceId ?? null,
        details: options.details ? (options.details as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (err) {
    logger.error('Failed to record admin activity:', err);
  }
}

