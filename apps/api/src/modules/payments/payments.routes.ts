import { Router } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { generalRateLimiter, financialRateLimiter } from '../../middleware/rateLimiter.js';
import {
  listPaymentTransactions,
  getPaymentTransaction,
  getPlatformFinancialConfig,
  createPaymentOrder,
  verifyPaymentStatus,
  settleMilestone,
  processRefund,
  getWalletOverview,
} from './payments.controller.js';

const router = Router();

router.use(authenticateUser());
router.use(generalRateLimiter);

// 1. Virtual Wallet Overview (Client or Specialist derived from ledger)
router.get('/wallet', getWalletOverview);

// 2. Create Cashfree Sandbox Payment Order (Client role / contract owner only)
router.post('/orders', financialRateLimiter, createPaymentOrder);

// 3. Server-side payment status verification (Cashfree direct query)
router.get('/orders/:orderId/verify', verifyPaymentStatus);
router.get('/:paymentId/status', verifyPaymentStatus);

// 4. Milestone Settlement (Client or Specialist, authorized settlement)
router.post('/settlements/:milestoneId', financialRateLimiter, settleMilestone);

// 5. Escrow Refund Processing
router.post('/refunds', financialRateLimiter, processRefund);

// 6. Payment transactions (Admin, Superadmin, or own transactions for Client/Worker)
router.get('/transactions', listPaymentTransactions);
router.get('/transactions/:reference', getPaymentTransaction);

// 7. Platform financial governance configuration (Read-only)
router.get('/config', getPlatformFinancialConfig);

export { router as paymentsRoutes };

