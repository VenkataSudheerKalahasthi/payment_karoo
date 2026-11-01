import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export async function getMyNotifications(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  try {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { recipientId: user.id, isRead: false },
    });

    sendSuccess(res, 200, {
      items: notifications,
      unreadCount,
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not retrieve notifications');
  }
}

export async function markNotificationAsRead(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      sendError(res, 404, 'NOT_FOUND', 'Notification not found');
      return;
    }

    // Strict cross-user prevention
    if (notification.recipientId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to target notification');
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update notification status');
  }
}

export async function markAllNotificationsAsRead(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  try {
    await prisma.notification.updateMany({
      where: { recipientId: user.id, isRead: false },
      data: { isRead: true },
    });

    sendSuccess(res, 200, { message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Error marking all notifications read:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update notifications');
  }
}

