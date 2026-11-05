-- CreateTable: client_stamps
CREATE TABLE IF NOT EXISTS "client_stamps" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileNameSnapshot" TEXT NOT NULL,
    "verifiedMobileSnapshot" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfVersion" INTEGER NOT NULL DEFAULT 1,
    "stampPosition" TEXT NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "stampAssetPath" TEXT,
    "documentHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_stamps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "client_stamps_contractId_idx" ON "client_stamps"("contractId");
CREATE INDEX IF NOT EXISTS "client_stamps_clientId_idx" ON "client_stamps"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "client_stamps_contractId_pdfVersion_key" ON "client_stamps"("contractId", "pdfVersion");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_stamps_contractId_fkey') THEN
        ALTER TABLE "client_stamps" ADD CONSTRAINT "client_stamps_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_stamps_clientId_fkey') THEN
        ALTER TABLE "client_stamps" ADD CONSTRAINT "client_stamps_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

