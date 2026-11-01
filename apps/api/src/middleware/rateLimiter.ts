import rateLimit from 'express-rate-limit';
import { ApiResponse } from '@trustpay/shared';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const responsePayload: ApiResponse<null> = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again after 15 minutes.',
      },
      timestamp: new Date().toISOString(),
    };
    res.status(429).json(responsePayload);
  },
});
