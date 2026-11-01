import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { generalRateLimiter } from '../../middleware/rateLimiter.js';
import {
  listAccounts,
  getAccountDetails,
  listTransactions,
  getTransactionDetails,
  getTrialBalance,
  reverseTransaction,
  getFinancialOverview,
} from './ledger.controller.js';

const router = Router();

// Apply authentication to all ledger endpoints
router.use(authenticateUser());
router.use(generalRateLimiter);

// 1. Chart of Accounts (Admin & Superadmin)
router.get('/accounts', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), listAccounts);
router.get('/accounts/:accountCode', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), getAccountDetails);

// 2. Financial Overview summary
router.get('/overview', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), getFinancialOverview);

// 3. Transactions inspection (Admin & Superadmin)
router.get('/transactions', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), listTransactions);
router.get('/transactions/:reference', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), getTransactionDetails);

// 4. System Trial Balance (Admin & Superadmin)
router.get('/trial-balance', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), getTrialBalance);

// 5. Reversal of posted transaction (SUPERADMIN strictly required)
router.post('/transactions/:reference/reverse', requireRole(UserRole.SUPERADMIN), reverseTransaction);

export { router as ledgerRoutes };

