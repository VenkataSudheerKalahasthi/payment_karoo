import { Router } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { generalRateLimiter } from '../../middleware/rateLimiter.js';
import {
  authorizeUpload,
  authorizeDownload,
  downloadFile,
} from './storage.controller.js';

const router = Router();

// Public download verification endpoint using short-lived signed tokens
router.get('/file', generalRateLimiter, downloadFile);

// Authenticated authorization endpoints
router.use(authenticateUser());
router.use(generalRateLimiter);

router.post('/authorize-upload', authorizeUpload);
router.post('/authorize-download', authorizeDownload);

export { router as storageRoutes };

