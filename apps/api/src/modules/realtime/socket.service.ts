import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import crypto from 'crypto';
import { env } from '../../config/env.config.js';
import { logger } from '../../utils/logger.js';
import { verifyClerkSessionToken } from '../../config/clerk.js';
import { prisma } from '../../config/prisma.js';
import { UserRole } from '@prisma/client';

export interface AuthenticatedSocketUser {
  id: string;
  clerkId: string;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
}

export interface ContractRealtimeEvent<T = unknown> {
  eventId: string;
  eventType: string;
  contractId: string;
  version?: number;
  timestamp: string;
  payload: T;
}

let io: SocketIOServer | null = null;

/**
 * Initializes the Socket.IO real-time server with authenticated, authorized rooms.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = [
    env.CLIENT_URL,
    env.ADMIN_URL,
    env.SUPERADMIN_URL,
    ...env.CORS_ORIGINS,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
  ].filter(Boolean) as string[];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Socket.IO CORS origin rejected'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

      if (!token) {
        // In local/test development, allow guest connection for testing if configured
        if (env.NODE_ENV === 'test') {
          return next();
        }
        return next(new Error('AUTHENTICATION_REQUIRED: Missing authorization token'));
      }

      // Verify Clerk Session Token
      const verified = await verifyClerkSessionToken(token);
      const user = await prisma.user.findUnique({
        where: { clerkId: verified.sub },
        include: { role: true },
      });

      if (!user) {
        return next(new Error('USER_NOT_FOUND: User synchronization required'));
      }

      socket.data.user = {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        role: user.role.name as UserRole,
        firstName: user.firstName,
        lastName: user.lastName,
      };

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication verification failed';
      logger.warn(`[Socket.IO Auth] Connection rejected: ${msg}`);
      next(new Error(`AUTHENTICATION_FAILED: ${msg}`));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthenticatedSocketUser | undefined;
    logger.info(`[Socket.IO] Client connected: ${socket.id} (User: ${user?.email || 'anonymous'})`);

    // Automatically join isolated user room for authenticated users
    if (user) {
      socket.join(`user:${user.id}`);
      logger.info(`[Socket.IO] User ${user.email} joined personal channel user:${user.id}`);
    }

    // Automatically join administrative rooms for ADMIN and SUPERADMIN users
    if (user && (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN)) {
      socket.join('admin:contracts');
      socket.join('admin:dashboard');
      logger.info(`[Socket.IO] Admin ${user.email} joined administrative channels`);
    }

    // Authorize & Join Private User Notification Room
    socket.on('join:user', (targetUserId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        if (!targetUserId || typeof targetUserId !== 'string') {
          callback?.({ success: false, error: 'INVALID_USER_ID' });
          return;
        }

        if (!user) {
          callback?.({ success: false, error: 'UNAUTHENTICATED' });
          return;
        }

        const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
        if (!isPrivileged && user.id !== targetUserId) {
          logger.warn(`[Socket.IO User Authorization] User ${user.id} denied access to user room ${targetUserId}`);
          callback?.({ success: false, error: 'FORBIDDEN' });
          return;
        }

        const roomName = `user:${targetUserId}`;
        socket.join(roomName);
        logger.info(`[Socket.IO] Socket ${socket.id} joined personal room ${roomName}`);
        callback?.({ success: true });
      } catch (err) {
        logger.error('[Socket.IO join:user] Error:', err);
        callback?.({ success: false, error: 'INTERNAL_ERROR' });
      }
    });

    // Authorize & Join Contract Room
    socket.on('join:contract', async (contractId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        if (!contractId || typeof contractId !== 'string') {
          callback?.({ success: false, error: 'INVALID_CONTRACT_ID' });
          return;
        }

        if (!user) {
          callback?.({ success: false, error: 'UNAUTHENTICATED' });
          return;
        }

        // Authorize access: must be client, worker, or administrative governance
        const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
        if (!isPrivileged) {
          const contract = await prisma.contract.findUnique({
            where: { id: contractId },
            select: { clientId: true, workerId: true },
          });

          if (!contract || (contract.clientId !== user.id && contract.workerId !== user.id)) {
            logger.warn(`[Socket.IO Authorization] Access denied for user ${user.id} to contract ${contractId}`);
            socket.emit('error:unauthorized', { contractId, message: 'Access denied to contract real-time channel.' });
            callback?.({ success: false, error: 'FORBIDDEN' });
            return;
          }
        }

        const roomName = `contract:${contractId}`;
        socket.join(roomName);
        logger.info(`[Socket.IO] User ${user.email} joined ${roomName}`);
        callback?.({ success: true });
      } catch (err) {
        logger.error('[Socket.IO join:contract] Error:', err);
        callback?.({ success: false, error: 'INTERNAL_ERROR' });
      }
    });

    // Authorize & Join Project Room
    socket.on('join:project', async (projectId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        if (!projectId || typeof projectId !== 'string') {
          callback?.({ success: false, error: 'INVALID_PROJECT_ID' });
          return;
        }

        if (!user) {
          callback?.({ success: false, error: 'UNAUTHENTICATED' });
          return;
        }

        const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
        if (!isPrivileged) {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { clientId: true, workerId: true, contractId: true },
          });

          if (!project || (project.clientId !== user.id && project.workerId !== user.id)) {
            logger.warn(`[Socket.IO Authorization] Access denied for user ${user.id} to project ${projectId}`);
            socket.emit('error:unauthorized', { projectId, message: 'Access denied to project real-time channel.' });
            callback?.({ success: false, error: 'FORBIDDEN' });
            return;
          }
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);
        logger.info(`[Socket.IO] User ${user.email} joined ${roomName}`);
        callback?.({ success: true });
      } catch (err) {
        logger.error('[Socket.IO join:project] Error:', err);
        callback?.({ success: false, error: 'INTERNAL_ERROR' });
      }
    });

    // Leave Project Room
    socket.on('leave:project', (projectId: string) => {
      if (projectId && typeof projectId === 'string') {
        socket.leave(`project:${projectId}`);
      }
    });

    // Leave Contract Room
    socket.on('leave:contract', (contractId: string) => {
      if (contractId && typeof contractId === 'string') {
        socket.leave(`contract:${contractId}`);
      }
    });

    // Authorize & Join Conversation Room
    socket.on('join:conversation', async (conversationId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        if (!conversationId || typeof conversationId !== 'string') {
          callback?.({ success: false, error: 'INVALID_CONVERSATION_ID' });
          return;
        }

        if (!user) {
          callback?.({ success: false, error: 'UNAUTHENTICATED' });
          return;
        }

        const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
        if (!isPrivileged) {
          const participant = await prisma.conversationParticipant.findFirst({
            where: { conversationId, userId: user.id },
          });

          if (!participant) {
            logger.warn(`[Socket.IO Authorization] Access denied for user ${user.id} to conversation ${conversationId}`);
            callback?.({ success: false, error: 'FORBIDDEN' });
            return;
          }
        }

        const roomName = `conversation:${conversationId}`;
        socket.join(roomName);
        logger.info(`[Socket.IO] User ${user.email} joined ${roomName}`);
        callback?.({ success: true });
      } catch (err) {
        logger.error('[Socket.IO join:conversation] Error:', err);
        callback?.({ success: false, error: 'INTERNAL_ERROR' });
      }
    });

    // Leave Conversation Room
    socket.on('leave:conversation', (conversationId: string) => {
      if (conversationId && typeof conversationId === 'string') {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Handle Disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Returns the active Socket.IO server instance, or null if not yet initialized.
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emits an authorized contract lifecycle event to the contract-specific room.
 * Ensures stable event ID and authoritative timestamping.
 */
export function emitContractRealtimeEvent<T = unknown>(
  contractId: string,
  eventType: string,
  payload: T,
  version?: number,
): void {
  if (!io) {
    return;
  }

  const event: ContractRealtimeEvent<T> = {
    eventId: crypto.randomUUID(),
    eventType,
    contractId,
    version,
    timestamp: new Date().toISOString(),
    payload,
  };

  const roomName = `contract:${contractId}`;
  io.to(roomName).emit('contract:event', event);
  io.to(roomName).emit(eventType, event);

  // Administrative channels also receive telemetry
  io.to('admin:contracts').emit('contract:event', event);
}

/**
 * Emits an authorized milestone event to contract and project channels.
 */
export function emitMilestoneRealtimeEvent<T = unknown>(
  contractId: string,
  milestoneId: string,
  eventType: string,
  payload: T,
  projectId?: string | null,
): void {
  if (!io) {
    return;
  }

  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    contractId,
    milestoneId,
    projectId: projectId || undefined,
    timestamp: new Date().toISOString(),
    payload,
  };

  const contractRoom = `contract:${contractId}`;
  io.to(contractRoom).emit('milestone:event', event);
  io.to(contractRoom).emit(eventType, event);

  if (projectId) {
    const projectRoom = `project:${projectId}`;
    io.to(projectRoom).emit('milestone:event', event);
    io.to(projectRoom).emit(eventType, event);
  }

  io.to('admin:contracts').emit('milestone:event', event);
}

/**
 * Emits an authorized project lifecycle event.
 */
export function emitProjectRealtimeEvent<T = unknown>(
  projectId: string,
  eventType: string,
  payload: T,
  contractId?: string,
): void {
  if (!io) {
    return;
  }

  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    projectId,
    contractId,
    timestamp: new Date().toISOString(),
    payload,
  };

  const projectRoom = `project:${projectId}`;
  io.to(projectRoom).emit('project:event', event);
  io.to(projectRoom).emit(eventType, event);

  if (contractId) {
    const contractRoom = `contract:${contractId}`;
    io.to(contractRoom).emit('project:event', event);
    io.to(contractRoom).emit(eventType, event);
  }

  io.to('admin:contracts').emit('project:event', event);
}

/**
 * Emits a real-time notification to an isolated user channel.
 */
export function emitNotificationRealtimeEvent<T = unknown>(
  recipientId: string,
  notification: T,
): void {
  if (!io) {
    return;
  }

  const userRoom = `user:${recipientId}`;
  io.to(userRoom).emit('notification:new', notification);
  io.to(userRoom).emit('notification', notification);
}


