import { checkDatabaseConnection } from '../../config/prisma.js';
import { env } from '../../config/env.config.js';
import { SystemHealthStatus, DatabaseHealthStatus } from '@trustpay/shared';

const START_TIME = Date.now();

export class HealthService {
  public static getSystemHealth(): SystemHealthStatus {
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
    return {
      status: 'healthy',
      service: 'TrustPay Enterprise API',
      version: '2.0.0',
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    };
  }

  public static async getDatabaseHealth(): Promise<DatabaseHealthStatus> {
    const dbResult = await checkDatabaseConnection();
    return {
      status: dbResult.status,
      database: dbResult.database,
      latencyMs: dbResult.latencyMs,
      timestamp: new Date().toISOString(),
      error: dbResult.error,
    };
  }
}
