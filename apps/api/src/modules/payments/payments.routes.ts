import { Router } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { generalRateLimiter, financialRateLimiter } from '../../middleware/rateLimiter.js';
import {
  listPaymentTransactions,
  getPaymentTransaction,
  getPlatformFinancialConfig,
  createPaymentOrder,
  verifyPaymentStatus,
} from './payments.controller.js';

const router = Router();

router.use(authenticateUser());
router.use(generalRateLimiter);

// 1. Create Cashfree Sandbox Payment Order (Client role / contract owner only)
router.post('/orders', financialRateLimiter, createPaymentOrder);

// 2. Server-side payment status verification (Cashfree direct query)
router.get('/orders/:orderId/verify', verifyPaymentStatus);
router.get('/:paymentId/status', verifyPaymentStatus);

// 3. Payment transactions (Admin, Superadmin, or own transactions for Client/Worker)
router.get('/transactions', listPaymentTransactions);
router.get('/transactions/:reference', getPaymentTransaction);

// 4. Platform financial governance configuration (Read-only)
router.get('/config', getPlatformFinancialConfig);

export { router as paymentsRoutes };

