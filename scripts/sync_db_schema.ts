import { prisma } from '../apps/api/src/config/prisma.js';

async function main() {
  console.log('=== Checking and Applying Safe Additive Database Schema Updates ===');

  try {
    // 1. Create ProjectStatus enum if not exists
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectStatus') THEN
          CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
        END IF;
      END $$;
    `);
    console.log('✔ Checked ProjectStatus enum');

    // 2. Create projects table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "contractId" TEXT NOT NULL UNIQUE REFERENCES "contracts"("id") ON DELETE CASCADE,
        "clientId" TEXT NOT NULL REFERENCES "users"("id"),
        "workerId" TEXT NOT NULL REFERENCES "users"("id"),
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "scope" TEXT,
        "startDate" TIMESTAMP(3),
        "expectedCompletionDate" TIMESTAMP(3),
        "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
        "progressPercentage" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "projects_contractId_idx" ON "projects"("contractId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "projects_clientId_idx" ON "projects"("clientId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "projects_workerId_idx" ON "projects"("workerId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");`);
    console.log('✔ Checked projects table and indexes');

    // 3. Add projectId to contract_milestones if not exists
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "contract_milestones" 
      ADD COLUMN IF NOT EXISTS "projectId" TEXT REFERENCES "projects"("id") ON DELETE SET NULL;
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "contract_milestones_projectId_idx" ON "contract_milestones"("projectId");`);
    console.log('✔ Checked contract_milestones.projectId column and index');

    // 4. Create milestone_activities table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "milestone_activities" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "contractId" TEXT NOT NULL REFERENCES "contracts"("id") ON DELETE CASCADE,
        "projectId" TEXT REFERENCES "projects"("id") ON DELETE SET NULL,
        "milestoneId" TEXT REFERENCES "contract_milestones"("id") ON DELETE SET NULL,
        "actorId" TEXT NOT NULL REFERENCES "users"("id"),
        "actorRole" "UserRole" NOT NULL,
        "action" TEXT NOT NULL,
        "previousState" TEXT,
        "newState" TEXT,
        "version" INTEGER DEFAULT 1,
        "metadata" JSONB,
        "requestId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "milestone_activities_contractId_idx" ON "milestone_activities"("contractId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "milestone_activities_projectId_idx" ON "milestone_activities"("projectId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "milestone_activities_milestoneId_idx" ON "milestone_activities"("milestoneId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "milestone_activities_actorId_idx" ON "milestone_activities"("actorId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "milestone_activities_createdAt_idx" ON "milestone_activities"("createdAt");`);
    console.log('✔ Checked milestone_activities table and indexes');

    // 5. Create contract_versions table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "contract_versions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "contractId" TEXT NOT NULL REFERENCES "contracts"("id") ON DELETE CASCADE,
        "version" INTEGER NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "totalAmount" DECIMAL(12, 2) NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "scopeOfWork" TEXT,
        "termsAndConditions" TEXT,
        "cancellationTerms" TEXT,
        "revisionTerms" TEXT,
        "documentHash" TEXT NOT NULL,
        "milestonesSnapshot" JSONB NOT NULL,
        "versionReason" TEXT NOT NULL DEFAULT 'INITIAL_CONTRACT',
        "createdById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "contractStatusAtCreation" "ContractStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
        "isAccepted" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contract_versions_contractId_version_key" UNIQUE ("contractId", "version")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "contract_versions_contractId_idx" ON "contract_versions"("contractId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "contract_versions_version_idx" ON "contract_versions"("version");`);
    console.log('✔ Checked contract_versions table and indexes');

    // Test a full query through Prisma ORM to confirm zero schema drift!
    const testQuery = await prisma.contract.findMany({
      include: {
        milestones: true,
        acceptances: true,
        project: true,
        versions: true
      }
    });
    console.log(`✔ SUCCESS: Prisma contract query executed perfectly! Found ${testQuery.length} contracts.`);

  } catch (err) {
    console.error('Schema sync error:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();

