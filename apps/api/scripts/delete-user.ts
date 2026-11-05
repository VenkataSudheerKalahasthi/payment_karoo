import 'dotenv/config';
import { prisma, pool } from '../src/config/prisma.js';
import { createClerkClient } from '@clerk/backend';

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkClient = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;

async function listUsers() {
  const users = await prisma.user.findMany({
    include: {
      role: true,
      profile: true,
      workerProfile: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log('\n[TrustPay] No registered users found in the database.\n');
    return;
  }

  console.log(`\n=== REGISTERED USERS IN DATABASE (${users.length}) ===\n`);
  users.forEach((u, i) => {
    console.log(
      `${i + 1}. Email:    ${u.email}\n` +
      `   Role:     ${u.role.name}\n` +
      `   Name:     ${u.firstName || ''} ${u.lastName || ''}\n` +
      `   ID:       ${u.id}\n` +
      `   ClerkId:  ${u.clerkId}\n` +
      `   Created:  ${u.createdAt.toISOString()}\n`
    );
  });
}

async function deleteUserByTarget(target: string) {
  const normalized = target.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalized, mode: 'insensitive' } },
        { clerkId: target.trim() },
        { id: target.trim() },
      ],
    },
    include: {
      role: true,
    },
  });

  if (!user) {
    console.log(`\n[!] User not found in database for identifier: "${target}"`);

    // Check if user still exists in Clerk
    if (clerkClient) {
      try {
        console.log(`[*] Checking Clerk for user "${target}"...`);
        const clerkUsers = await clerkClient.users.getUserList({ emailAddress: [normalized] });
        if (clerkUsers.data.length > 0) {
          for (const cu of clerkUsers.data) {
            await clerkClient.users.deleteUser(cu.id);
            console.log(`[✓] Deleted orphan Clerk user: ${cu.id} (${normalized})`);
          }
          return;
        }
      } catch (err) {
        console.warn('Clerk search notice:', err instanceof Error ? err.message : err);
      }
    }
    return;
  }

  console.log(`\nFound User to delete:`);
  console.log(`- ID:      ${user.id}`);
  console.log(`- Email:   ${user.email}`);
  console.log(`- Role:    ${user.role.name}`);
  console.log(`- ClerkId: ${user.clerkId}`);

  // 1. Delete from Clerk Authentication
  if (clerkClient && user.clerkId) {
    try {
      console.log(`\n1. Deleting user from Clerk Authentication...`);
      await clerkClient.users.deleteUser(user.clerkId);
      console.log(`[✓] Successfully removed from Clerk.`);
    } catch (err: unknown) {
      console.warn(`[!] Clerk deletion notice (user may have already been removed in Clerk):`, err instanceof Error ? err.message : err);
    }
  }

  // 2. Delete from Database transactionally
  console.log(`\n2. Deleting user records and associations from Supabase Database...`);
  await prisma.$transaction(async (tx) => {
    // Delete audit logs
    await tx.auditLog.deleteMany({
      where: { OR: [{ actorId: user.id }, { resourceId: user.id }] },
    });

    // Delete notifications
    await tx.notification.deleteMany({
      where: { recipientId: user.id },
    });

    // Delete direct messages and participants
    await tx.message.deleteMany({
      where: { senderId: user.id },
    });
    await tx.conversationParticipant.deleteMany({
      where: { userId: user.id },
    });

    // Delete hiring requests & shortlists
    await tx.hiringRequest.deleteMany({
      where: { OR: [{ clientId: user.id }, { workerId: user.id }] },
    });
    await tx.workerShortlist.deleteMany({
      where: { clientId: user.id },
    });

    // Delete client stamps if any
    try {
      await (tx as any).clientStamp?.deleteMany({
        where: { clientId: user.id },
      });
    } catch {
      // ignore if model not present
    }

    // Delete worker profile skills & portfolio items
    const wp = await tx.workerProfile.findUnique({ where: { userId: user.id } });
    if (wp) {
      await tx.workerSkill.deleteMany({ where: { workerProfileId: wp.id } });
      await tx.portfolioItem.deleteMany({ where: { workerProfileId: wp.id } });
      await tx.workerProfile.delete({ where: { id: wp.id } });
    }

    // Delete user profile
    await tx.userProfile.deleteMany({ where: { userId: user.id } });

    // Handle any contracts associated with this user
    const contracts = await tx.contract.findMany({
      where: { OR: [{ clientId: user.id }, { workerId: user.id }] },
    });

    for (const c of contracts) {
      await tx.milestoneSubmission.deleteMany({ where: { milestone: { contractId: c.id } } });
      await tx.milestone.deleteMany({ where: { contractId: c.id } });
      await tx.contractAcceptance.deleteMany({ where: { contractId: c.id } });
      await tx.contractVersion.deleteMany({ where: { contractId: c.id } });
      await tx.contract.delete({ where: { id: c.id } });
    }

    // Finally delete user
    await tx.user.delete({
      where: { id: user.id },
    });
  });

  console.log(`[✓] Successfully removed user "${user.email}" from the database!`);
}

async function main() {
  const arg = process.argv[2];

  if (!arg || arg === '--help' || arg === '-h') {
    console.log(`
TrustPay User Removal Utility
Usage:
  npx tsx scripts/delete-user.ts --list
    Lists all registered users in the database.

  npx tsx scripts/delete-user.ts <email_or_clerkId>
    Completely deletes the specified user from both Clerk Auth and the Database.

Examples:
  npx tsx scripts/delete-user.ts testuser@gmail.com
  npx tsx scripts/delete-user.ts user_2tQ...
`);
    return;
  }

  if (arg === '--list') {
    await listUsers();
    return;
  }

  await deleteUserByTarget(arg);
}

main()
  .catch((err) => {
    console.error('\nError running delete-user:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

