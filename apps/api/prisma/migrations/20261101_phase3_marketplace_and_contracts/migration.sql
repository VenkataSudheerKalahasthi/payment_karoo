-- Phase 3 Migration: Marketplace, Hiring Requests, Shortlist, Contract Acceptance & Versioning
-- Fully Non-Destructive: Adds Enums, Columns, Tables, Indexes, and Referential Constraints

-- 1. Create HiringRequestStatus Enum
DO $$ BEGIN
    CREATE TYPE "HiringRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'NEGOTIATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add New Notification Types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HIRING_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HIRING_REQUEST_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HIRING_REQUEST_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HIRING_REQUEST_NEGOTIATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTRACT_ACCEPTED';

-- 3. Enhance Contracts Table for Versioning, Scope and Terms
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "scopeOfWork" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cancellationTerms" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "revisionTerms" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "documentHash" TEXT;

-- 4. Create Hiring Requests Table
CREATE TABLE IF NOT EXISTS "hiring_requests" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposedBudget" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proposedStartDate" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "status" "HiringRequestStatus" NOT NULL DEFAULT 'PENDING',
    "clientMessage" TEXT,
    "workerResponse" TEXT,
    "contractId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiring_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "hiring_requests_clientId_idx" ON "hiring_requests"("clientId");
CREATE INDEX IF NOT EXISTS "hiring_requests_workerId_idx" ON "hiring_requests"("workerId");
CREATE INDEX IF NOT EXISTS "hiring_requests_status_idx" ON "hiring_requests"("status");
CREATE INDEX IF NOT EXISTS "hiring_requests_contractId_idx" ON "hiring_requests"("contractId");

DO $$ BEGIN
    ALTER TABLE "hiring_requests" ADD CONSTRAINT "hiring_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "hiring_requests" ADD CONSTRAINT "hiring_requests_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "hiring_requests" ADD CONSTRAINT "hiring_requests_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Create Worker Shortlists Table
CREATE TABLE IF NOT EXISTS "worker_shortlists" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_shortlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "worker_shortlists_clientId_workerProfileId_key" ON "worker_shortlists"("clientId", "workerProfileId");
CREATE INDEX IF NOT EXISTS "worker_shortlists_clientId_idx" ON "worker_shortlists"("clientId");
CREATE INDEX IF NOT EXISTS "worker_shortlists_workerProfileId_idx" ON "worker_shortlists"("workerProfileId");

DO $$ BEGIN
    ALTER TABLE "worker_shortlists" ADD CONSTRAINT "worker_shortlists_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "worker_shortlists" ADD CONSTRAINT "worker_shortlists_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. Create Contract Acceptances Table
CREATE TABLE IF NOT EXISTS "contract_acceptances" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "role" "UserRole" NOT NULL,
    "acceptanceMethod" TEXT NOT NULL DEFAULT 'DIGITAL_CONFIRMATION',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "documentHash" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_acceptances_contractId_userId_version_key" ON "contract_acceptances"("contractId", "userId", "version");
CREATE INDEX IF NOT EXISTS "contract_acceptances_contractId_idx" ON "contract_acceptances"("contractId");
CREATE INDEX IF NOT EXISTS "contract_acceptances_userId_idx" ON "contract_acceptances"("userId");
CREATE INDEX IF NOT EXISTS "contract_acceptances_version_idx" ON "contract_acceptances"("version");

DO $$ BEGIN
    ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

