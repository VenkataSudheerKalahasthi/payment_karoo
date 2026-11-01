import { Router } from 'express';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './notifications.controller.js';
import { authenticateUser } from '../../middleware/auth.js';

const notificationsRoutes = Router();

notificationsRoutes.get('/', authenticateUser(), getMyNotifications);
notificationsRoutes.patch('/mark-all-read', authenticateUser(), markAllNotificationsAsRead);
notificationsRoutes.patch('/:id/read', authenticateUser(), markNotificationAsRead);

export { notificationsRoutes };

