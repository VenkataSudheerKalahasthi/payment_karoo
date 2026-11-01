import { prisma } from '../../config/prisma.js';
import {
  LedgerTransactionType,
  LedgerTransactionStatus,
  LedgerEntryType,
  LedgerAccountType,
  LedgerAccountStatus,
  Prisma,
} from '@prisma/client';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

export interface PostTransactionEntryInput {
  accountCode: string;
  entryType: LedgerEntryType;
  amountMinor: bigint | number;
}

export interface PostTransactionInput {
  transactionReference?: string;
  transactionType: LedgerTransactionType;
  currency: string;
  description: string;
  sourceType: string;
  sourceId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
  entries: PostTransactionEntryInput[];
}

export class DoubleEntryLedgerService {
  /**
   * Posts a balanced double-entry transaction atomically.
   * Total debits MUST strictly equal total credits.
   */
  async postTransaction(input: PostTransactionInput) {
    const currency = input.currency.toUpperCase().trim();

    // 1. Idempotency Check
    const existing = await prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: {
        entries: {
          include: { ledgerAccount: true },
        },
      },
    });

    if (existing) {
      if (existing.status === LedgerTransactionStatus.POSTED) {
        return existing;
      }
      throw {
        statusCode: 409,
        code: 'DUPLICATE_IDEMPOTENCY_KEY',
        message: `Transaction with idempotency key "${input.idempotencyKey}" already exists in status ${existing.status}`,
      };
    }

    // 2. Minimum entries validation
    if (!input.entries || input.entries.length < 2) {
      throw {
        statusCode: 400,
        code: 'INVALID_ENTRY_COUNT',
        message: 'A double-entry transaction must contain at least two entries (one debit and one credit).',
      };
    }

    // 3. Balance verification
    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const e of input.entries) {
      const amount = BigInt(e.amountMinor);
      if (amount <= 0n) {
        throw {
          statusCode: 400,
          code: 'INVALID_AMOUNT',
          message: `Entry for account ${e.accountCode} has non-positive amount (${amount.toString()}). Amounts must be greater than zero.`,
        };
      }

      if (e.entryType === LedgerEntryType.DEBIT) {
        totalDebits += amount;
      } else if (e.entryType === LedgerEntryType.CREDIT) {
        totalCredits += amount;
      } else {
        throw {
          statusCode: 400,
          code: 'INVALID_ENTRY_TYPE',
          message: `Unrecognized entry type "${e.entryType}". Expected DEBIT or CREDIT.`,
        };
      }
    }

    if (totalDebits !== totalCredits) {
      throw {
        statusCode: 400,
        code: 'UNBALANCED_TRANSACTION',
        message: `Ledger transaction does not balance. Total debits (${totalDebits.toString()}) do not equal total credits (${totalCredits.toString()}). Discrepancy: ${(totalDebits - totalCredits).toString()} minor units.`,
      };
    }

    // 4. Validate accounts exist, are active, and match currency
    const accountCodes = [...new Set(input.entries.map((e) => e.accountCode))];
    const accounts = await prisma.ledgerAccount.findMany({
      where: { accountCode: { in: accountCodes } },
    });

    const accountMap = new Map(accounts.map((a) => [a.accountCode, a]));

    for (const code of accountCodes) {
      const acc = accountMap.get(code);
      if (!acc) {
        throw {
          statusCode: 404,
          code: 'ACCOUNT_NOT_FOUND',
          message: `Ledger account "${code}" was not found in the chart of accounts.`,
        };
      }

      if (acc.status !== LedgerAccountStatus.ACTIVE) {
        throw {
          statusCode: 400,
          code: 'ACCOUNT_FROZEN',
          message: `Ledger account "${code}" is in ${acc.status} status and cannot accept postings.`,
        };
      }

      if (acc.currency.toUpperCase() !== currency) {
        throw {
          statusCode: 400,
          code: 'CURRENCY_MISMATCH',
          message: `Currency mismatch: Account "${code}" uses ${acc.currency}, but transaction uses ${currency}.`,
        };
      }
    }

    const reference =
      input.transactionReference ||
      `LTX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 5. Post in single database transaction
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.ledgerTransaction.create({
        data: {
          transactionReference: reference,
          transactionType: input.transactionType,
          status: LedgerTransactionStatus.POSTED,
          currency,
          description: input.description,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
          postedAt: new Date(),
          entries: {
            create: input.entries.map((e) => {
              const account = accountMap.get(e.accountCode)!;
              return {
                ledgerAccountId: account.id,
                entryType: e.entryType,
                amountMinor: BigInt(e.amountMinor),
                currency,
              };
            }),
          },
        },
        include: {
          entries: {
            include: { ledgerAccount: true },
          },
        },
      });

      logger.info(
        `[LEDGER POSTED] ${transaction.transactionReference} | Type: ${transaction.transactionType} | Amount: ${totalDebits.toString()} ${currency}`,
      );

      return transaction;
    });
  }

  /**
   * Reverses an existing posted transaction with an explicit offsetting transaction.
   * Swaps debits and credits. Does NOT mutate posted entries.
   * Hardened against race conditions and duplicate reversal attempts.
   */
  async reverseTransaction(transactionReference: string, reason: string) {
    if (!reason || reason.trim().length < 5) {
      throw {
        statusCode: 400,
        code: 'INVALID_REVERSAL_REASON',
        message: 'A non-empty reversal justification (minimum 5 characters) is required.',
      };
    }

    const cleanReason = reason.trim();
    const reversalRef = `REV-${transactionReference}`;
    const reversalIdempotencyKey = `reversal_${transactionReference}`;

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch target transaction inside the transaction boundary
      const original = await tx.ledgerTransaction.findUnique({
        where: { transactionReference },
        include: {
          entries: {
            include: { ledgerAccount: true },
          },
        },
      });

      if (!original) {
        throw {
          statusCode: 404,
          code: 'TRANSACTION_NOT_FOUND',
          message: `Ledger transaction "${transactionReference}" was not found.`,
        };
      }

      if (original.transactionType === LedgerTransactionType.REVERSAL) {
        throw {
          statusCode: 400,
          code: 'CANNOT_REVERSE_REVERSAL',
          message: 'A reversal transaction cannot itself be reversed.',
        };
      }

      if (original.status !== LedgerTransactionStatus.POSTED) {
        throw {
          statusCode: 400,
          code: 'TRANSACTION_ALREADY_REVERSED',
          message: `Transaction "${transactionReference}" cannot be reversed because its current status is ${original.status}.`,
        };
      }

      // Check if a reversal transaction already exists
      const existingReversal = await tx.ledgerTransaction.findUnique({
        where: { idempotencyKey: reversalIdempotencyKey },
      });

      if (existingReversal) {
        throw {
          statusCode: 409,
          code: 'DUPLICATE_REVERSAL',
          message: `A reversal transaction for "${transactionReference}" has already been processed (${existingReversal.transactionReference}).`,
        };
      }

      // 2. Mark original as REVERSED
      await tx.ledgerTransaction.update({
        where: { id: original.id },
        data: { status: LedgerTransactionStatus.REVERSED },
      });

      // 3. Create offsetting reversal entries (swap DEBIT <-> CREDIT)
      const reversalEntries = original.entries.map((e) => ({
        accountCode: e.ledgerAccount.accountCode,
        entryType: e.entryType === LedgerEntryType.DEBIT ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT,
        amountMinor: e.amountMinor,
      }));

      // 4. Post reversal transaction
      const reversal = await tx.ledgerTransaction.create({
        data: {
          transactionReference: reversalRef,
          transactionType: LedgerTransactionType.REVERSAL,
          status: LedgerTransactionStatus.POSTED,
          currency: original.currency,
          description: `Reversal of ${original.transactionReference}: ${cleanReason}`,
          sourceType: 'REVERSAL',
          sourceId: original.id,
          idempotencyKey: reversalIdempotencyKey,
          postedAt: new Date(),
          entries: {
            create: reversalEntries.map((e) => ({
              ledgerAccountId: original.entries.find((oe) => oe.ledgerAccount.accountCode === e.accountCode)!.ledgerAccountId,
              entryType: e.entryType,
              amountMinor: e.amountMinor,
              currency: original.currency,
            })),
          },
        },
        include: {
          entries: {
            include: { ledgerAccount: true },
          },
        },
      });

      logger.info(`[LEDGER REVERSED] ${original.transactionReference} -> Reversal: ${reversal.transactionReference} | Reason: ${cleanReason}`);
      return reversal;
    });
  }

  /**
   * Calculates the true net balance of an account from immutable posted entries.
   */
  async getAccountBalance(accountCode: string) {
    const account = await prisma.ledgerAccount.findUnique({
      where: { accountCode },
    });

    if (!account) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: `Account "${accountCode}" not found.` };
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        ledgerAccountId: account.id,
        ledgerTransaction: { status: LedgerTransactionStatus.POSTED },
      },
      select: { entryType: true, amountMinor: true },
    });

    let debits = 0n;
    let credits = 0n;

    for (const e of entries) {
      if (e.entryType === LedgerEntryType.DEBIT) {
        debits += e.amountMinor;
      } else {
        credits += e.amountMinor;
      }
    }

    // Normal balance calculation by account type
    const netBalance =
      account.accountType === LedgerAccountType.ASSET || account.accountType === LedgerAccountType.EXPENSE
        ? debits - credits
        : credits - debits;

    return {
      account,
      debitsMinor: debits,
      creditsMinor: credits,
      netBalanceMinor: netBalance,
    };
  }

  /**
   * Generates a Trial Balance report verifying total system balancing.
   */
  async getTrialBalance(currency = 'USD') {
    const cleanCurr = currency.toUpperCase().trim();
    const accounts = await prisma.ledgerAccount.findMany({
      where: { currency: cleanCurr },
      include: {
        entries: {
          where: { ledgerTransaction: { status: LedgerTransactionStatus.POSTED } },
          select: { entryType: true, amountMinor: true },
        },
      },
      orderBy: { accountCode: 'asc' },
    });

    let totalDebits = 0n;
    let totalCredits = 0n;

    const items = accounts.map((acc) => {
      let debits = 0n;
      let credits = 0n;

      for (const e of acc.entries) {
        if (e.entryType === LedgerEntryType.DEBIT) {
          debits += e.amountMinor;
        } else {
          credits += e.amountMinor;
        }
      }

      totalDebits += debits;
      totalCredits += credits;

      const netBalance =
        acc.accountType === LedgerAccountType.ASSET || acc.accountType === LedgerAccountType.EXPENSE
          ? debits - credits
          : credits - debits;

      return {
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        debitTotalMinor: debits.toString(),
        creditTotalMinor: credits.toString(),
        netBalanceMinor: netBalance.toString(),
      };
    });

    return {
      currency: cleanCurr,
      generatedAt: new Date().toISOString(),
      isBalanced: totalDebits === totalCredits,
      totalDebitsMinor: totalDebits.toString(),
      totalCreditsMinor: totalCredits.toString(),
      items,
    };
  }

  /**
   * Retrieves paginated list of chart of accounts.
   */
  async listAccounts(filter: {
    page?: number;
    limit?: number;
    currency?: string;
    accountType?: LedgerAccountType;
    status?: LedgerAccountStatus;
  }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LedgerAccountWhereInput = {};
    if (filter.currency) where.currency = filter.currency.toUpperCase();
    if (filter.accountType) where.accountType = filter.accountType;
    if (filter.status) where.status = filter.status;

    const [total, accounts] = await Promise.all([
      prisma.ledgerAccount.count({ where }),
      prisma.ledgerAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { accountCode: 'asc' },
      }),
    ]);

    return {
      items: accounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves paginated ledger transactions with their entries.
   */
  async listTransactions(filter: {
    page?: number;
    limit?: number;
    currency?: string;
    status?: LedgerTransactionStatus;
    transactionType?: LedgerTransactionType;
    startDate?: string;
    endDate?: string;
  }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LedgerTransactionWhereInput = {};
    if (filter.currency) where.currency = filter.currency.toUpperCase();
    if (filter.status) where.status = filter.status;
    if (filter.transactionType) where.transactionType = filter.transactionType;
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    const [total, txs] = await Promise.all([
      prisma.ledgerTransaction.count({ where }),
      prisma.ledgerTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          entries: {
            include: { ledgerAccount: true },
          },
        },
      }),
    ]);

    const items = txs.map((t) => ({
      ...t,
      entries: t.entries.map((e) => ({
        ...e,
        amountMinor: e.amountMinor.toString(),
      })),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves a single transaction by its reference.
   */
  async getTransactionByReference(transactionReference: string) {
    const tx = await prisma.ledgerTransaction.findUnique({
      where: { transactionReference },
      include: {
        entries: {
          include: { ledgerAccount: true },
        },
      },
    });

    if (!tx) return null;

    return {
      ...tx,
      entries: tx.entries.map((e) => ({
        ...e,
        amountMinor: e.amountMinor.toString(),
      })),
    };
  }

  /**
   * Platform-wide financial overview combining escrow, contracts, and ledger status.
   */
  async getFinancialOverview() {
    const config = await prisma.platformFinancialConfig.findFirst();

    const [
      totalContractsCount,
      escrowCounts,
      escrowSums,
      trialBalance,
    ] = await Promise.all([
      prisma.contract.count(),
      prisma.escrowRecord.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.escrowRecord.aggregate({
        _sum: {
          contractualAmountMinor: true,
          fundedAmountMinor: true,
          releasedAmountMinor: true,
          refundedAmountMinor: true,
        },
      }),
      this.getTrialBalance('USD'),
    ]);

    const countMap = new Map(escrowCounts.map((c) => [c.status, c._count._all]));

    return {
      isLiveMoneyDisabled: config?.isLiveMoneyDisabled ?? true,
      activeProvider: config?.activeProvider ?? 'PENDING_SELECTION',
      totalContractsCount,
      fundedEscrowsCount: countMap.get('FUNDED') ?? 0,
      pendingEscrowsCount: (countMap.get('PENDING_FUNDING') ?? 0) + (countMap.get('NOT_INITIALIZED') ?? 0),
      disputedEscrowsCount: countMap.get('DISPUTED') ?? 0,
      totalContractualAgreedMinor: (escrowSums._sum.contractualAmountMinor ?? 0n).toString(),
      totalFundedInEscrowMinor: (escrowSums._sum.fundedAmountMinor ?? 0n).toString(),
      totalReleasedToWorkersMinor: (escrowSums._sum.releasedAmountMinor ?? 0n).toString(),
      totalRefundedToClientsMinor: (escrowSums._sum.refundedAmountMinor ?? 0n).toString(),
      systemTrialBalanceBalanced: trialBalance.isBalanced,
    };
  }
}

export const ledgerService = new DoubleEntryLedgerService();
