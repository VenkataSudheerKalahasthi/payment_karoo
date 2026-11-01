import { Request, Response, NextFunction } from 'express';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { verifyClerkSessionToken } from '../config/clerk.js';
import { recordAuditLog } from '../utils/audit.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export interface AuthenticateOptions {
  allowUnregistered?: boolean;
}

/**
 * Express middleware to authenticate request using Clerk JWT token.
 * Independently validates token with Clerk and retrieves database user record.
 */
export function authenticateUser(options: AuthenticateOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication token required');
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await verifyClerkSessionToken(token);
      const clerkId = payload.sub;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        include: {
          role: true,
          profile: true,
          workerProfile: true,
        },
      });

      if (!user) {
        req.clerkAuth = {
          clerkId,
          email: typeof payload.email === 'string' ? payload.email : undefined,
          firstName: typeof payload.first_name === 'string' ? payload.first_name : undefined,
          lastName: typeof payload.last_name === 'string' ? payload.last_name : undefined,
        };

        if (options.allowUnregistered) {
          next();
          return;
        }

        sendError(
          res,
          401,
          'USER_NOT_REGISTERED',
          'User identity verified with Clerk but database account not synchronized. Please complete registration.',
        );
        return;
      }

      if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
        await recordAuditLog({
          actorId: user.id,
          action: 'ACCESS_BLOCKED_SUSPENDED_USER',
          resource: 'UserSession',
          resourceId: user.id,
          details: { status: user.status },
          req,
        });

        sendError(
          res,
          403,
          'ACCOUNT_INACTIVE',
          `Account is currently ${user.status.toLowerCase()}. Access denied.`,
        );
        return;
      }

      req.user = user;
      req.clerkAuth = {
        clerkId,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
      };

      next();
    } catch (error) {
      logger.warn('Authentication middleware rejected request:', error instanceof Error ? error.message : error);
      sendError(res, 401, 'INVALID_TOKEN', 'Session token is invalid or expired');
    }
  };
}

/**
 * Middleware to enforce Role-Based Access Control (RBAC).
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required before checking roles');
      return;
    }

    const userRole = req.user.role.name;

    if (!allowedRoles.includes(userRole)) {
      await recordAuditLog({
        actorId: req.user.id,
        action: 'UNAUTHORIZED_ROLE_ACCESS_ATTEMPT',
        resource: req.originalUrl,
        details: {
          attemptedRole: userRole,
          allowedRoles,
          method: req.method,
        },
        req,
      });

      sendError(
        res,
        403,
        'FORBIDDEN',
        `Access denied. Role ${userRole} is not authorized to access this resource.`,
      );
      return;
    }

    next();
  };
}

/**
 * Middleware to check specific granular permission.
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required before checking permissions');
      return;
    }

    const permissions = req.user.role.permissions;
    const hasPermission =
      permissions.includes('*') ||
      permissions.includes('admin:superadmin:all') ||
      permissions.includes(permission);

    if (!hasPermission) {
      await recordAuditLog({
        actorId: req.user.id,
        action: 'PERMISSION_DENIED',
        resource: req.originalUrl,
        details: {
          requiredPermission: permission,
          userRole: req.user.role.name,
        },
        req,
      });

      sendError(
        res,
        403,
        'PERMISSION_DENIED',
        `Access denied. Missing required permission: ${permission}`,
      );
      return;
    }

    next();
  };
}

/**
 * Middleware to verify resource ownership (preventing IDOR vulnerabilities).
 * Allows SUPERADMIN and ADMIN to bypass ownership when appropriate.
 */
export function requireOwnership(
  getOwnerId: (req: Request) => Promise<string | null> | string | null,
  options: { allowAdmin?: boolean } = { allowAdmin: true },
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required for ownership check');
      return;
    }

    if (
      options.allowAdmin &&
      (req.user.role.name === UserRole.SUPERADMIN || req.user.role.name === UserRole.ADMIN)
    ) {
      next();
      return;
    }

    try {
      const ownerId = await getOwnerId(req);

      if (!ownerId) {
        sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Requested resource not found');
        return;
      }

      if (ownerId !== req.user.id) {
        await recordAuditLog({
          actorId: req.user.id,
          action: 'IDOR_ACCESS_VIOLATION_ATTEMPT',
          resource: req.originalUrl,
          resourceId: ownerId,
          details: {
            actorId: req.user.id,
            targetOwnerId: ownerId,
            path: req.path,
          },
          req,
        });

        sendError(
          res,
          403,
          'FORBIDDEN',
          'Access denied. You do not have permission to access or modify this resource.',
        );
        return;
      }

      next();
    } catch (error) {
      logger.error('Error during ownership verification:', error);
      sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error verifying resource permissions');
    }
  };
}

