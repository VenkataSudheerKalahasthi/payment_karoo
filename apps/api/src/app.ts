import express, { Express } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import { env } from './config/env.config.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers Middleware
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Strict CORS Configuration
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server or curl) in non-production
      if (!origin) {
        if (env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        return callback(new Error('CORS: Not allowed by policy'));
      }

      if (env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Blocked CORS request from origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours
  };
  app.use(cors(corsOptions));

  // 3. Rate Limiting Middleware
  app.use(globalRateLimiter);

  // 4. Request Body Parsing (with rawBody capture for webhook signature verification)
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. Mount API Version 1 Routes
  app.use('/api/v1', apiRouter);

  // 6. Catch-all for undefined routes
  app.use(notFoundHandler);

  // 7. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}
