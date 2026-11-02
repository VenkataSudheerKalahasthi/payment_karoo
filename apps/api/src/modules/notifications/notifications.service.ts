import { prisma } from '../../config/prisma.js';
import { NotificationType, Prisma } from '@prisma/client';
import { emitNotificationRealtimeEvent } from '../realtime/socket.service.js';
import { logger } from '../../utils/logger.js';

export interface CreateNotificationParams {
  recipientId: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, unknown>;
}

export class NotificationsService {
  /**
   * Persists a notification to the database and delivers it via Socket.IO to user:<recipientId>.
   */
  async createNotification(params: CreateNotificationParams) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        title: params.title,
        message: params.message,
        type: params.type,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
      },
    });

    try {
      emitNotificationRealtimeEvent(params.recipientId, notification);
    } catch (err) {
      logger.warn('[NotificationsService] Failed to emit realtime event:', err);
    }

    return notification;
  }

  /**
   * Lists notifications for a given user with pagination and unread count.
   */
  async listUserNotifications(userId: string, limit = 50) {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });

    return { items: notifications, unreadCount };
  }

  /**
   * Marks a single notification as read, enforcing strict recipient ownership.
   */
  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Notification not found' };
    }

    if (notification.recipientId !== userId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Access denied to target notification' };
    }

    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
  }
}

export const notificationsService = new NotificationsService();

