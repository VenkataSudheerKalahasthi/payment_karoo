import { z } from 'zod';
import {
  LedgerAccountType,
  LedgerAccountStatus,
  LedgerTransactionType,
  LedgerTransactionStatus,
} from '@prisma/client';

export const listAccountsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  currency: z.string().trim().toUpperCase().optional(),
  accountType: z.nativeEnum(LedgerAccountType).optional(),
  status: z.nativeEnum(LedgerAccountStatus).optional(),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  currency: z.string().trim().toUpperCase().optional(),
  status: z.nativeEnum(LedgerTransactionStatus).optional(),
  transactionType: z.nativeEnum(LedgerTransactionType).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const trialBalanceQuerySchema = z.object({
  currency: z.string().trim().toUpperCase().default('USD'),
});

export const reverseTransactionSchema = z.object({
  reason: z.string().trim().min(5, 'Reversal reason must be at least 5 characters'),
});

export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;
export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;

