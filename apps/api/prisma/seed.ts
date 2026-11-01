import { PrismaClient, UserRole } from '@prisma/client';
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

