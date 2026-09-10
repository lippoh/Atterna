import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testAuthFlow() {
  console.log('='.repeat(80));
  console.log('AUTHENTICATION FLOW TEST - READ-ONLY DIAGNOSIS');
  console.log('='.repeat(80));
  console.log('');

  // Find a test user (the one that just reset password)
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      passwordChangedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  console.log(`Found ${users.length} recent user(s)`);
  console.log('');

  for (const user of users) {
    console.log('─'.repeat(80));
    console.log(`User: ${user.email}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email Verified: ${user.emailVerified ? 'YES' : 'NO'}`);
    console.log(`  Password Hash Exists: ${!!user.passwordHash}`);
    console.log(`  Password Hash Prefix: ${user.passwordHash ? user.passwordHash.substring(0, 10) + '...' : 'N/A'}`);
    console.log(`  passwordChangedAt: ${user.passwordChangedAt || 'NULL'}`);
    console.log(`  Created At: ${user.createdAt}`);
    
    if (user.passwordHash) {
      // Check if it's argon2
      if (user.passwordHash.startsWith('$argon2')) {
        console.log(`  Hash Algorithm: argon2 (CORRECT)`);
      } else if (user.passwordHash.startsWith('$2b$') || user.passwordHash.startsWith('$2a$')) {
        console.log(`  Hash Algorithm: bcrypt (INCOMPATIBLE WITH ARGON2!)`);
      } else {
        console.log(`  Hash Algorithm: UNKNOWN (prefix: ${user.passwordHash.substring(0, 10)})`);
      }
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

testAuthFlow().catch(console.error);
