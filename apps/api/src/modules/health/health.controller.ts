import { Request, Response, NextFunction } from 'express';
import { HealthService } from './health.service.js';
import { sendSuccess } from '../../utils/response.js';

export class HealthController {
  public static getHealth(_req: Request, res: Response, next: NextFunction): void {
    try {
      const healthData = HealthService.getSystemHealth();
      sendSuccess(res, healthData, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getDatabaseHealth(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dbHealth = await HealthService.getDatabaseHealth();
      if (dbHealth.status === 'connected') {
        sendSuccess(res, dbHealth, 200);
      } else {
        // Return 503 Service Unavailable when DB is unreachable
        res.status(503).json({
          success: false,
          data: dbHealth,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: dbHealth.error || 'PostgreSQL database connection is unavailable',
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      next(error);
    }
  }
}
