import { PrismaClient, UserRole, LedgerAccountType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('🌱 Starting TrustPay Enterprise Phase 2 Database Seed...');

  const roles = [
    {
      name: UserRole.CLIENT,
      description: 'Standard client seeking services, managing digital contracts and milestone escrow workflows',
      permissions: [
        'profile:read',
        'profile:update',
        'contracts:create',
        'contracts:read',
        'contracts:update',
        'submissions:review',
        'revisions:create',
        'conversations:read',
        'messages:create',
        'notifications:read',
      ],
    },
    {
      name: UserRole.WORKER,
      description: 'Verified worker offering specialized skills, submitting milestone deliverables, and communicating with clients',
      permissions: [
        'profile:read',
        'profile:update',
        'worker_profile:update',
        'contracts:read',
        'submissions:create',
        'conversations:read',
        'messages:create',
        'notifications:read',
      ],
    },
    {
      name: UserRole.ADMIN,
      description: 'Administrative portal user overseeing platform governance, dispute monitoring, user status management, and audit inspection',
      permissions: [
        'admin:dashboard:view',
        'admin:users:read',
        'admin:users:manage_status',
        'admin:contracts:read',
        'admin:audit_logs:read',
        'skills:manage',
      ],
    },
    {
      name: UserRole.SUPERADMIN,
      description: 'Privileged governance officer with full platform administration, role provisioning, and audit oversight',
      permissions: [
        '*',
        'admin:superadmin:all',
        'admin:roles:provision',
        'admin:governance:manage',
      ],
    },
  ];

  for (const role of roles) {
    const upserted = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: role.permissions,
      },
      create: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      },
    });
    console.log(`✅ Role seeded: ${upserted.name} (${upserted.id})`);
  }

  // Seed standard foundational skills
  const skills = [
    { name: 'TypeScript', category: 'Software Development' },
    { name: 'React.js', category: 'Software Development' },
    { name: 'Node.js', category: 'Software Development' },
    { name: 'PostgreSQL', category: 'Database & Cloud' },
    { name: 'UI/UX Design', category: 'Design' },
    { name: 'Technical Writing', category: 'Content' },
    { name: 'Security Auditing', category: 'Cybersecurity' },
  ];

  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: { category: skill.category },
      create: { name: skill.name, category: skill.category },
    });
  }
  console.log(`✅ Seeded ${skills.length} standard skills.`);

  // Seed foundational Chart of Accounts for Double-Entry Ledger
  const systemAccounts = [
    {
      accountCode: '1000-CASH-ESCROW',
      accountName: 'Custodial Escrow Holding Account',
      accountType: LedgerAccountType.ASSET,
      currency: 'USD',
    },
    {
      accountCode: '2000-CLIENT-ESCROW-LIABILITY',
      accountName: 'Client Escrow Balances Payable',
      accountType: LedgerAccountType.LIABILITY,
      currency: 'USD',
    },
    {
      accountCode: '2100-WORKER-PAYABLE',
      accountName: 'Worker Approved Milestones Payable',
      accountType: LedgerAccountType.LIABILITY,
      currency: 'USD',
    },
    {
      accountCode: '4000-PLATFORM-FEE-REVENUE',
      accountName: 'Platform Transaction Fee Revenue',
      accountType: LedgerAccountType.REVENUE,
      currency: 'USD',
    },
    {
      accountCode: '5000-PAYMENT-PROCESSING-EXPENSE',
      accountName: 'Payment Processor Fee Expense',
      accountType: LedgerAccountType.EXPENSE,
      currency: 'USD',
    },
  ];

  for (const acc of systemAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { accountCode: acc.accountCode },
      update: { accountName: acc.accountName, accountType: acc.accountType, currency: acc.currency },
      create: {
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        currency: acc.currency,
      },
    });
  }
  console.log(`✅ Seeded ${systemAccounts.length} system ledger accounts.`);

  // Seed Platform Financial Governance configuration
  const existingConfig = await prisma.platformFinancialConfig.findFirst();
  if (!existingConfig) {
    await prisma.platformFinancialConfig.create({
      data: {
        platformFeePercentage: 5.0,
        fixedFeeMinor: BigInt(0),
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        activeProvider: 'PENDING_SELECTION',
        isLiveMoneyDisabled: true,
      },
    });
    console.log('✅ Initialized platform financial governance config (Live money custody disabled).');
  }

  console.log('✨ Seed completed successfully.');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

