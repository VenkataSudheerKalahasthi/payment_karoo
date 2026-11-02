import { describe, it, expect } from 'vitest';
import { DoubleEntryLedgerService } from '../apps/api/src/modules/ledger/ledger.service.js';
import {
  LedgerTransactionType,
  LedgerEntryType,
} from '@prisma/client';
import { majorToMinor, minorToMajor, formatCurrencyMinor } from '@trustpay/shared';

describe('Double-Entry Accounting Ledger Domain Tests', () => {
  it('converts major currency to integer minor units accurately without floating-point error', () => {
    expect(majorToMinor(100.5, 'USD')).toBe(10050n);
    expect(majorToMinor(0.01, 'USD')).toBe(1n);
    expect(majorToMinor(1000, 'JPY')).toBe(1000n);
    expect(majorToMinor(1.234, 'BHD')).toBe(1234n);
  });

  it('converts minor units back to major units accurately', () => {
    expect(minorToMajor(10050n, 'USD')).toBe(100.5);
    expect(minorToMajor('10050', 'USD')).toBe(100.5);
    expect(formatCurrencyMinor(10050n, 'USD')).toBe('$100.50');
  });

  it('rejects an unbalanced transaction where debits do not equal credits', async () => {
    const service = new DoubleEntryLedgerService();

    await expect(
      service.postTransaction({
        transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
        currency: 'USD',
        description: 'Unbalanced deposit attempt',
        sourceType: 'TEST',
        idempotencyKey: 'test_unbalanced_1',
        entries: [
          { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: 10000n },
          { accountCode: '2000-CLIENT-ESCROW-LIABILITY', entryType: LedgerEntryType.CREDIT, amountMinor: 5000n },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'UNBALANCED_TRANSACTION',
    });
  }, 15000);

  it('rejects transactions with fewer than 2 entries (single-leg)', async () => {
    const service = new DoubleEntryLedgerService();

    await expect(
      service.postTransaction({
        transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
        currency: 'USD',
        description: 'Single-leg attempt',
        sourceType: 'TEST',
        idempotencyKey: 'test_single_leg',
        entries: [
          { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: 10000n },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_ENTRY_COUNT',
    });
  }, 15000);

  it('rejects zero or negative amounts', async () => {
    const service = new DoubleEntryLedgerService();

    await expect(
      service.postTransaction({
        transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
        currency: 'USD',
        description: 'Zero amount attempt',
        sourceType: 'TEST',
        idempotencyKey: 'test_zero_amount',
        entries: [
          { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: 0n },
          { accountCode: '2000-CLIENT-ESCROW-LIABILITY', entryType: LedgerEntryType.CREDIT, amountMinor: 0n },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_AMOUNT',
    });

    await expect(
      service.postTransaction({
        transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
        currency: 'USD',
        description: 'Negative amount attempt',
        sourceType: 'TEST',
        idempotencyKey: 'test_negative_amount',
        entries: [
          { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: -500n },
          { accountCode: '2000-CLIENT-ESCROW-LIABILITY', entryType: LedgerEntryType.CREDIT, amountMinor: -500n },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_AMOUNT',
    });
  }, 15000);
});
