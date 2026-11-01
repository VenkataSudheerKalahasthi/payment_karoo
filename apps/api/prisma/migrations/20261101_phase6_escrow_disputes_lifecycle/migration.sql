-- Phase 6: Advanced Escrow Operations, Dispute Management & Contract Lifecycle Migration
-- Strictly additive and non-destructive to existing Supabase data

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeCategory') THEN
    CREATE TYPE "DisputeCategory" AS ENUM (
      'QUALITY_OF_WORK', 'MISSED_DEADLINE', 'SCOPE_DISPUTE', 'UNRESPONSIVE_PARTY',
      'UNAUTHORIZED_MODIFICATION', 'PAYMENT_ISSUE', 'BREACH_OF_TERMS', 'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeStatus') THEN
    CREATE TYPE "DisputeStatus" AS ENUM (
      'OPEN', 'EVIDENCE_REQUESTED', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW',
      'RESPONSE_REQUIRED', 'MEDIATION', 'RESOLUTION_PROPOSED', 'RESOLUTION_ACCEPTED',
      'RESOLUTION_REJECTED', 'ESCALATED', 'RESOLVED', 'CLOSED', 'WITHDRAWN'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeResolutionType') THEN
    CREATE TYPE "DisputeResolutionType" AS ENUM (
      'FULL_REFUND_TO_CLIENT', 'FULL_RELEASE_TO_WORKER', 'SPLIT_SETTLEMENT',
      'CANCEL_CONTRACT', 'DISMISS_DISPUTE'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeResolutionStatus') THEN
    CREATE TYPE "DisputeResolutionStatus" AS ENUM (
      'PROPOSED', 'ACCEPTED_BY_PARTIES', 'REJECTED_BY_PARTY', 'ENFORCED_BY_ADMIN', 'SUPERSEDED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AmendmentStatus') THEN
    CREATE TYPE "AmendmentStatus" AS ENUM (
      'DRAFT', 'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TerminationStatus') THEN
    CREATE TYPE "TerminationStatus" AS ENUM (
      'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'RESOLVED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowOperationalState') THEN
    CREATE TYPE "EscrowOperationalState" AS ENUM (
      'PAYMENT_VERIFIED_SANDBOX', 'ALLOCATED', 'WORK_IN_PROGRESS', 'MILESTONE_SUBMITTED',
      'MILESTONE_UNDER_REVIEW', 'MILESTONE_APPROVED', 'REVISION_REQUESTED', 'DISPUTED',
      'ON_HOLD', 'RELEASE_ELIGIBLE', 'COMPLETED', 'TERMINATED'
    );
  END IF;
END $$;

-- 2. Extend NotificationType enum if not already present
DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_RAISED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_RESPONSE_SUBMITTED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_EVIDENCE_UPLOADED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_RESOLUTION_PROPOSED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_RESOLVED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AMENDMENT_PROPOSED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AMENDMENT_ACCEPTED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AMENDMENT_REJECTED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TERMINATION_REQUESTED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TERMINATION_ACCEPTED';
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TERMINATION_REJECTED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Extend escrow_records with operationalState
ALTER TABLE "escrow_records" 
ADD COLUMN IF NOT EXISTS "operationalState" "EscrowOperationalState" NOT NULL DEFAULT 'PAYMENT_VERIFIED_SANDBOX';

-- 4. Create disputes table
CREATE TABLE IF NOT EXISTS "disputes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "disputeNumber" TEXT NOT NULL UNIQUE,
  "contractId" TEXT NOT NULL REFERENCES "contracts"("id") ON DELETE CASCADE,
  "milestoneId" TEXT REFERENCES "contract_milestones"("id") ON DELETE SET NULL,
  "initiatorId" TEXT NOT NULL REFERENCES "users"("id"),
  "respondentId" TEXT NOT NULL REFERENCES "users"("id"),
  "category" "DisputeCategory" NOT NULL,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "claimedAmountMinor" BIGINT,
  "disputeHoldActive" BOOLEAN NOT NULL DEFAULT true,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "disputes_contractId_idx" ON "disputes"("contractId");
CREATE INDEX IF NOT EXISTS "disputes_milestoneId_idx" ON "disputes"("milestoneId");
CREATE INDEX IF NOT EXISTS "disputes_initiatorId_idx" ON "disputes"("initiatorId");
CREATE INDEX IF NOT EXISTS "disputes_respondentId_idx" ON "disputes"("respondentId");
CREATE INDEX IF NOT EXISTS "disputes_status_idx" ON "disputes"("status");
CREATE INDEX IF NOT EXISTS "disputes_category_idx" ON "disputes"("category");

-- 5. Create dispute_responses table
CREATE TABLE IF NOT EXISTS "dispute_responses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "disputeId" TEXT NOT NULL REFERENCES "disputes"("id") ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "users"("id"),
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "dispute_responses_disputeId_idx" ON "dispute_responses"("disputeId");
CREATE INDEX IF NOT EXISTS "dispute_responses_authorId_idx" ON "dispute_responses"("authorId");

-- 6. Create dispute_evidence table
CREATE TABLE IF NOT EXISTS "dispute_evidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "disputeId" TEXT NOT NULL REFERENCES "disputes"("id") ON DELETE CASCADE,
  "uploadedById" TEXT NOT NULL REFERENCES "users"("id"),
  "fileName" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSize" BIGINT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "dispute_evidence_disputeId_idx" ON "dispute_evidence"("disputeId");
CREATE INDEX IF NOT EXISTS "dispute_evidence_uploadedById_idx" ON "dispute_evidence"("uploadedById");

-- 7. Create dispute_resolutions table
CREATE TABLE IF NOT EXISTS "dispute_resolutions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "disputeId" TEXT NOT NULL REFERENCES "disputes"("id") ON DELETE CASCADE,
  "proposedById" TEXT NOT NULL REFERENCES "users"("id"),
  "resolutionType" "DisputeResolutionType" NOT NULL,
  "status" "DisputeResolutionStatus" NOT NULL DEFAULT 'PROPOSED',
  "clientAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "workerAmountMinor" BIGINT NOT NULL DEFAULT 0,
  "rationale" TEXT NOT NULL,
  "clientAgreed" BOOLEAN,
  "clientAgreedAt" TIMESTAMP(3),
  "workerAgreed" BOOLEAN,
  "workerAgreedAt" TIMESTAMP(3),
  "enforcedByAdminId" TEXT,
  "enforcedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "dispute_resolutions_disputeId_idx" ON "dispute_resolutions"("disputeId");
CREATE INDEX IF NOT EXISTS "dispute_resolutions_proposedById_idx" ON "dispute_resolutions"("proposedById");
CREATE INDEX IF NOT EXISTS "dispute_resolutions_status_idx" ON "dispute_resolutions"("status");

-- 8. Create dispute_internal_notes table
CREATE TABLE IF NOT EXISTS "dispute_internal_notes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "disputeId" TEXT NOT NULL REFERENCES "disputes"("id") ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "users"("id"),
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "dispute_internal_notes_disputeId_idx" ON "dispute_internal_notes"("disputeId");
CREATE INDEX IF NOT EXISTS "dispute_internal_notes_authorId_idx" ON "dispute_internal_notes"("authorId");

-- 9. Create contract_amendments table
CREATE TABLE IF NOT EXISTS "contract_amendments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "amendmentNumber" TEXT NOT NULL UNIQUE,
  "contractId" TEXT NOT NULL REFERENCES "contracts"("id") ON DELETE CASCADE,
  "proposedById" TEXT NOT NULL REFERENCES "users"("id"),
  "status" "AmendmentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "proposedVersion" INTEGER NOT NULL,
  "titleChange" TEXT,
  "descriptionChange" TEXT,
  "scopeChange" TEXT,
  "amountChangeMinor" BIGINT,
  "termsChange" TEXT,
  "milestonesSnapshot" JSONB,
  "reason" TEXT NOT NULL,
  "clientAcceptedAt" TIMESTAMP(3),
  "workerAcceptedAt" TIMESTAMP(3),
  "previousDocumentHash" TEXT,
  "updatedDocumentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "contract_amendments_contractId_idx" ON "contract_amendments"("contractId");
CREATE INDEX IF NOT EXISTS "contract_amendments_proposedById_idx" ON "contract_amendments"("proposedById");
CREATE INDEX IF NOT EXISTS "contract_amendments_status_idx" ON "contract_amendments"("status");

-- 10. Create contract_termination_requests table
CREATE TABLE IF NOT EXISTS "contract_termination_requests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL REFERENCES "contracts"("id") ON DELETE CASCADE,
  "initiatedById" TEXT NOT NULL REFERENCES "users"("id"),
  "status" "TerminationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reason" TEXT NOT NULL,
  "proposedSettlementMinor" BIGINT,
  "settlementTerms" TEXT,
  "respondedById" TEXT,
  "responseReason" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "contract_termination_requests_contractId_idx" ON "contract_termination_requests"("contractId");
CREATE INDEX IF NOT EXISTS "contract_termination_requests_initiatedById_idx" ON "contract_termination_requests"("initiatedById");
CREATE INDEX IF NOT EXISTS "contract_termination_requests_status_idx" ON "contract_termination_requests"("status");

-- 11. Create escrow_activities table
CREATE TABLE IF NOT EXISTS "escrow_activities" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "escrowRecordId" TEXT NOT NULL REFERENCES "escrow_records"("id") ON DELETE CASCADE,
  "milestoneId" TEXT,
  "actorId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "operationalState" "EscrowOperationalState" NOT NULL,
  "previousState" "EscrowOperationalState",
  "eventType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "isLiveFinancialMovement" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "escrow_activities_escrowRecordId_idx" ON "escrow_activities"("escrowRecordId");
CREATE INDEX IF NOT EXISTS "escrow_activities_milestoneId_idx" ON "escrow_activities"("milestoneId");
CREATE INDEX IF NOT EXISTS "escrow_activities_actorId_idx" ON "escrow_activities"("actorId");
CREATE INDEX IF NOT EXISTS "escrow_activities_operationalState_idx" ON "escrow_activities"("operationalState");

