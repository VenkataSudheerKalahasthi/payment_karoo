import { createApp } from './app.js';
import { env } from './config/env.config.js';
import { disconnectDatabase } from './config/prisma.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(`TrustPay Enterprise API v2.0 running on http://${env.API_HOST}:${env.API_PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Allowed CORS Origins: ${env.CORS_ORIGINS.join(', ')}`);
  logger.info(`Health Check available at: http://${env.API_HOST}:${env.API_PORT}/api/v1/health`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      `Port ${env.API_PORT} is already in use by another process. ` +
      `To free it, terminate the existing process or run: ` +
      `Stop-Process -Id (Get-NetTCPConnection -LocalPort ${env.API_PORT}).OwningProcess -Force`
    );
  } else {
    logger.error('HTTP server encountered an unexpected error:', err);
  }
  process.exit(1);
});

// Graceful Termination Handling
async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await disconnectDatabase();
      logger.info('Database connections closed cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnection:', err);
      process.exit(1);
    }
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forceful shutdown triggered after 10s timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
  process.exit(1);
});
