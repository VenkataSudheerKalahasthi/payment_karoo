import { Router } from 'express';
import { healthRoutes } from '../modules/health/health.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { usersRoutes } from '../modules/users/users.routes.js';
import { profilesRoutes } from '../modules/profiles/profiles.routes.js';
import { workersRoutes } from '../modules/workers/workers.routes.js';
import { skillsRoutes } from '../modules/skills/skills.routes.js';
import { contractsRoutes } from '../modules/contracts/contracts.routes.js';
import { hiringRequestsRoutes } from '../modules/hiring-requests/hiring-requests.routes.js';
import { shortlistsRoutes } from '../modules/shortlists/shortlists.routes.js';
import { conversationsRoutes } from '../modules/conversations/conversations.routes.js';
import { notificationsRoutes } from '../modules/notifications/notifications.routes.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { adminRoutes } from '../modules/admin/admin.routes.js';
import { auditLogsRoutes } from '../modules/audit-logs/audit-logs.routes.js';

const apiRouter = Router();

// 1. Health Monitoring Module
apiRouter.use('/health', healthRoutes);

// 2. Authentication & Account Synchronization Module
apiRouter.use('/auth', authRoutes);

// 3. User Directory & Status Management Module
apiRouter.use('/users', usersRoutes);

// 4. User Profiles Module
apiRouter.use('/profiles', profilesRoutes);

// 5. Worker Marketplace & Portfolio Module
apiRouter.use('/workers', workersRoutes);

// 6. Platform Skills Taxonomy Module
apiRouter.use('/skills', skillsRoutes);

// 7. Hiring Requests & Proposal Management Module
apiRouter.use('/hiring-requests', hiringRequestsRoutes);

// 8. Client Shortlists Module
apiRouter.use('/shortlists', shortlistsRoutes);

// 9. Digital Contracts & Escrow Foundation Module
apiRouter.use('/contracts', contractsRoutes);

// 10. Secure Direct Conversations & Messaging Module
apiRouter.use('/conversations', conversationsRoutes);

// 11. User Notifications Module
apiRouter.use('/notifications', notificationsRoutes);

// 12. Dashboard Live Metrics Module
apiRouter.use('/dashboard', dashboardRoutes);

// 13. Administrative Governance & Metrics Module
apiRouter.use('/admin', adminRoutes);

// 14. Audit Log Oversight Module
apiRouter.use('/audit-logs', auditLogsRoutes);

export { apiRouter };
