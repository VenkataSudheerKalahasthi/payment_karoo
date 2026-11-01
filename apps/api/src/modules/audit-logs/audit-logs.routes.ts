import { Router } from 'express';
import { listAuditLogs } from './audit-logs.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';

const auditLogsRoutes = Router();

// Administrative audit log review (Admin & Superadmin only)
auditLogsRoutes.get(
  '/',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  listAuditLogs,
);

export { auditLogsRoutes };

