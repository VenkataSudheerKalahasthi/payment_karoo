-- Phase 4: Financial Architecture, Double-Entry Ledger & Escrow Foundation Migration
-- Additive and non-destructive to existing Supabase records

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerAccountType') THEN
    CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerAccountStatus') THEN
    CREATE TYPE "LedgerAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerTransactionType') THEN
    CREATE TYPE "LedgerTransactionType" AS ENUM ('ESCROW_DEPOSIT', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'PLATFORM_FEE', 'ADJUSTMENT', 'REVERSAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerTransactionStatus') THEN
    CREATE TYPE "LedgerTransactionStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'REVERSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerEntryType') THEN
    CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowStatus') THEN
    CREATE TYPE "EscrowStatus" AS ENUM (
      'NOT_INITIALIZED', 'PENDING_FUNDING', 'FUNDING_PROCESSING', 'FUNDED',
      'PARTIALLY_ALLOCATED', 'RELEASE_PENDING', 'PARTIALLY_RELEASED', 'RELEASED',
      'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'FAILED', 'CANCELLED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentTransactionType') THEN
    CREATE TYPE "PaymentTransactionType" AS ENUM ('ESCROW_FUNDING', 'MILESTONE_RELEASE', 'REFUND', 'PLATFORM_FEE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentTransactionStatus') THEN
    CREATE TYPE "PaymentTransactionStatus" AS ENUM ('INITIATED', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebhookEventStatus') THEN
    CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');
  END IF;
END $$;

-- 2. Create Ledger Accounts Table
CREATE TABLE IF NOT EXISTS "ledger_accounts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountCode" TEXT NOT NULL UNIQUE,
  "accountName" TEXT NOT NULL,
  "accountType" "LedgerAccountType" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "ownerUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "status" "LedgerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ledger_accounts_accountCode_idx" ON "ledger_accounts"("accountCode");
CREATE INDEX IF NOT EXISTS "ledger_accounts_accountType_idx" ON "ledger_accounts"("accountType");
CREATE INDEX IF NOT EXISTS "ledger_accounts_ownerUserId_idx" ON "ledger_accounts"("ownerUserId");
CREATE INDEX IF NOT EXISTS "ledger_accounts_currency_idx" ON "ledger_accounts"("currency");

-- 3. Create Ledger Transactions Table
CREATE TABLE IF NOT EXISTS "ledger_transactions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionReference" TEXT NOT NULL UNIQUE,
  "transactionType" "LedgerTransactionType" NOT NULL,
  "status" "LedgerTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "description" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "metadata" JSONB,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ledger_transactions_transactionReference_idx" ON "ledger_transactions"("transactionReference");
CREATE INDEX IF NOT EXISTS "ledger_transactions_transactionType_idx" ON "ledger_transactions"("transactionType");
CREATE INDEX IF NOT EXISTS "ledger_transactions_status_idx" ON "ledger_transactions"("status");
CREATE INDEX IF NOT EXISTS "ledger_transactions_idempotencyKey_idx" ON "ledger_transactions"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ledger_transactions_createdAt_idx" ON "ledger_transactions"("createdAt");

-- 4. Create Ledger Entries Table
CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ledgerTransactionId" TEXT NOT NULL REFERENCES "ledger_transactions"("id") ON DELETE CASCADE,
  "ledgerAccountId" TEXT NOT NULL REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT,
  "entryType" "LedgerEntryType" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ledger_entries_ledgerTransactionId_idx" ON "ledger_entries"("ledgerTransactionId");
CREATE INDEX IF NOT EXISTS "ledger_entries_ledgerAccountId_idx" ON "ledger_entries"("ledgerAccountId");
CREATE INDEX IF NOT EXISTS "ledger_entries_entryType_idx" ON "ledger_entries"("entryType");

-- 5. Create Escrow Records Table
CREATE TABLE IF NOT EXISTS "escrow_records" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL UNIQUE REFERENCES "contracts"("id") ON DELETE CASCADE,
  "status" "EscrowStatus" NOT NULL DEFAULT 'NOT_INITIALIZED',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "contractualAmountMinor" BIGINT NOT NULL,
  "expectedFundedAmountMinor" BIGINT NOT NULL,
  "fundedAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "allocatedAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "releasedAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "refundedAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "disputeHold" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "escrow_records_contractId_idx" ON "escrow_records"("contractId");
CREATE INDEX IF NOT EXISTS "escrow_records_status_idx" ON "escrow_records"("status");

-- 6. Create Escrow Milestone Allocations Table
CREATE TABLE IF NOT EXISTS "escrow_milestone_allocations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "escrowRecordId" TEXT NOT NULL REFERENCES "escrow_records"("id") ON DELETE CASCADE,
  "milestoneId" TEXT NOT NULL UNIQUE REFERENCES "contract_milestones"("id") ON DELETE CASCADE,
  "allocatedAmountMinor" BIGINT NOT NULL,
  "releasedAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "refundedAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "isReleased" BOOLEAN NOT NULL DEFAULT false,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "escrow_milestone_allocations_escrowRecordId_idx" ON "escrow_milestone_allocations"("escrowRecordId");
CREATE INDEX IF NOT EXISTS "escrow_milestone_allocations_milestoneId_idx" ON "escrow_milestone_allocations"("milestoneId");

-- 7. Create Payment Transactions Table
CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionReference" TEXT NOT NULL UNIQUE,
  "escrowRecordId" TEXT REFERENCES "escrow_records"("id") ON DELETE SET NULL,
  "contractId" TEXT NOT NULL REFERENCES "contracts"("id") ON DELETE CASCADE,
  "payerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "payeeId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "type" "PaymentTransactionType" NOT NULL,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'INITIATED',
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "provider" TEXT DEFAULT 'PENDING_SELECTION',
  "providerTransactionId" TEXT,
  "providerOrderId" TEXT,
  "failureReason" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "payment_transactions_contractId_idx" ON "payment_transactions"("contractId");
CREATE INDEX IF NOT EXISTS "payment_transactions_payerId_idx" ON "payment_transactions"("payerId");
CREATE INDEX IF NOT EXISTS "payment_transactions_payeeId_idx" ON "payment_transactions"("payeeId");
CREATE INDEX IF NOT EXISTS "payment_transactions_status_idx" ON "payment_transactions"("status");
CREATE INDEX IF NOT EXISTS "payment_transactions_idempotencyKey_idx" ON "payment_transactions"("idempotencyKey");

-- 8. Create Webhook Events Table
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "signature" TEXT,
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_events_provider_eventId_key" UNIQUE ("provider", "eventId")
);
CREATE INDEX IF NOT EXISTS "webhook_events_provider_idx" ON "webhook_events"("provider");
CREATE INDEX IF NOT EXISTS "webhook_events_status_idx" ON "webhook_events"("status");

-- 9. Create Platform Financial Config Table
CREATE TABLE IF NOT EXISTS "platform_financial_configs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "platformFeePercentage" DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  "fixedFeeMinor" BIGINT NOT NULL DEFAULT 0,
  "supportedCurrencies" TEXT[] DEFAULT ARRAY['USD', 'EUR', 'GBP']::TEXT[],
  "activeProvider" TEXT NOT NULL DEFAULT 'PENDING_SELECTION',
  "isLiveMoneyDisabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedByUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Ledger Entries Immutability Trigger
CREATE OR REPLACE FUNCTION prevent_ledger_entry_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Double-Entry Ledger Governance: Posted ledger entries are immutable and cannot be updated or deleted.'
    USING ERRCODE = '23506';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_entries_immutable'
  ) THEN
    CREATE TRIGGER trg_ledger_entries_immutable
    BEFORE UPDATE OR DELETE ON "ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();
  END IF;
END $$;

-- 11. Ensure Private Supabase Storage Buckets Exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('evidence', 'evidence', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/zip']),
  ('agreement-attachments', 'agreement-attachments', false, 15728640, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('invoices', 'invoices', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

