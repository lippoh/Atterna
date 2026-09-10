import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function diagnoseLoginFailure() {
  console.log('='.repeat(80));
  console.log('LOGIN FAILURE DIAGNOSIS - FOCUSED TEST');
  console.log('='.repeat(80));
  console.log('');

  const testEmail = 'makingmistakes1@gmail.com';
  
  // Step 1: Fetch user exactly as Auth.js authorize() does
  console.log('Step 1: User Lookup (as Auth.js does it)');
  console.log('─'.repeat(80));
  const user = await prisma.user.findUnique({
    where: { email: testEmail.toLowerCase() },
  });
  
  if (!user) {
    console.log('❌ User not found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ User found: ${user.email}`);
  console.log('');

  // Step 2: Check all fields that authorize() uses
  console.log('Step 2: Check Required Fields');
  console.log('─'.repeat(80));
  console.log(`user.id: ${user.id} (${typeof user.id})`);
  console.log(`user.email: ${user.email} (${typeof user.email})`);
  console.log(`user.locale: ${user.locale} (${typeof user.locale})`);
  console.log(`user.isAdmin: ${user.isAdmin} (${typeof user.isAdmin})`);
  console.log(`user.emailVerified: ${user.emailVerified} (${typeof user.emailVerified})`);
  console.log(`user.passwordHash exists: ${!!user.passwordHash}`);
  console.log('');

  // Step 3: Check if isAdmin field exists (critical for authorize() return)
  console.log('Step 3: Field Existence Check');
  console.log('─'.repeat(80));
  const hasIsAdmin = 'isAdmin' in user;
  console.log(`'isAdmin' field exists in user object: ${hasIsAdmin}`);
  
  if (!hasIsAdmin) {
    console.log('❌ CRITICAL: isAdmin field is MISSING from User table!');
    console.log('   This would cause authorize() to return { isAdmin: undefined }');
    console.log('   Auth.js callbacks might reject this.');
  } else {
    console.log(`✅ isAdmin field exists with value: ${user.isAdmin}`);
  }
  console.log('');

  // Step 4: Simulate the exact authorize() logic
  console.log('Step 4: Simulate authorize() Logic');
  console.log('─'.repeat(80));
  
  const hash = user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$decoy$decoy";
  console.log('Hash for verification:', hash.substring(0, 20) + '...');
  
  // We can't verify without the actual password, so simulate the checks
  console.log('');
  console.log('Authorization checks:');
  console.log(`  1. User exists: ${!!user} ✅`);
  console.log(`  2. Password OK: (needs actual password to test)`);
  console.log(`  3. Email verified: ${!!user.emailVerified} ${user.emailVerified ? '✅' : '❌'}`);
  console.log('');
  
  if (!user) {
    console.log('❌ Would return NULL: user not found');
  } else if (!user.emailVerified) {
    console.log('❌ Would return NULL: email not verified');
  } else {
    console.log('✅ Would return user object (if password matches):');
    console.log(JSON.stringify({
      id: user.id,
      email: user.email,
      locale: user.locale,
      isAdmin: user.isAdmin,
    }, null, 2));
  }
  console.log('');

  // Step 5: Check schema definition
  console.log('Step 5: Verify Schema Matches Database');
  console.log('─'.repeat(80));
  const allFields = Object.keys(user);
  console.log('Actual fields in database:');
  console.log(allFields.join(', '));
  console.log('');
  console.log('Expected by authorize() return:');
  console.log('id, email, locale, isAdmin');
  console.log('');

  const missingFields = ['id', 'email', 'locale', 'isAdmin'].filter(f => !allFields.includes(f));
  if (missingFields.length > 0) {
    console.log(`❌ MISSING FIELDS: ${missingFields.join(', ')}`);
  } else {
    console.log('✅ All required fields present');
  }
  console.log('');

  console.log('='.repeat(80));
  console.log('DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

diagnoseLoginFailure().catch(console.error);
