import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.config.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error(`Unhandled error during ${req.method} ${req.originalUrl}`, err);

  if (err instanceof ZodError) {
    sendError(res, 'VALIDATION_ERROR', 'Request validation failed', 400, err.flatten().fieldErrors);
    return;
  }

  // Ensure internal details and secrets are not leaked
  const isProduction = env.NODE_ENV === 'production';
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message =
    isProduction && statusCode === 500
      ? 'An unexpected internal server error occurred'
      : err.message || 'Internal Server Error';

  sendError(res, err.code || 'INTERNAL_SERVER_ERROR', message, statusCode);
};

export const notFoundHandler = (req: { originalUrl: string }, res: import('express').Response) => {
  sendError(res, 'RESOURCE_NOT_FOUND', `Route ${req.originalUrl} not found`, 404);
};
