import { Request, Response } from 'express';
import { notificationsService } from './notifications.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export async function getMyNotifications(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  try {
    const data = await notificationsService.listUserNotifications(user.id);
    sendSuccess(res, 200, data);
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not retrieve notifications');
  }
}

export async function markNotificationAsRead(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  try {
    const updated = await notificationsService.markAsRead(id, user.id);
    sendSuccess(res, 200, updated);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Operation failed');
      return;
    }
    logger.error('Error marking notification as read:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update notification status');
  }
}

export async function markAllNotificationsAsRead(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  try {
    await notificationsService.markAllAsRead(user.id);
    sendSuccess(res, 200, { message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Error marking all notifications read:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update notifications');
  }
}
