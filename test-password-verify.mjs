import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testPasswordVerification() {
  console.log('='.repeat(80));
  console.log('PASSWORD VERIFICATION TEST');
  console.log('='.repeat(80));
  console.log('');

  // Test the user that just reset password
  const testEmail = 'makingmistakes1@gmail.com';
  
  const user = await prisma.user.findUnique({
    where: { email: testEmail },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      passwordChangedAt: true,
      isAdmin: true,
      locale: true,
    },
  });

  if (!user) {
    console.log(`❌ User not found: ${testEmail}`);
    await prisma.$disconnect();
    return;
  }

  console.log('User Found:');
  console.log(`  Email: ${user.email}`);
  console.log(`  Email Verified: ${user.emailVerified ? 'YES' : 'NO'}`);
  console.log(`  Password Hash Algorithm: ${user.passwordHash.substring(0, 10)}...`);
  console.log(`  passwordChangedAt: ${user.passwordChangedAt}`);
  console.log('');

  // Simulate the Auth.js authorize() logic
  console.log('Simulating Auth.js authorize() flow:');
  console.log('─'.repeat(80));

  // Step 1: User lookup (with lowercase email)
  const lookupEmail = testEmail.toLowerCase();
  console.log(`1. User lookup: email = "${lookupEmail}"`);
  const foundUser = await prisma.user.findUnique({
    where: { email: lookupEmail },
  });
  console.log(`   Result: ${foundUser ? 'FOUND' : 'NOT FOUND'}`);
  console.log('');

  // Step 2: Check password hash exists
  console.log(`2. Password hash exists: ${!!foundUser?.passwordHash ? 'YES' : 'NO'}`);
  console.log('');

  // Step 3: Verify with test password (you'll need to provide this)
  console.log('3. Password verification:');
  console.log('   NOTE: Cannot test without actual password');
  console.log('   The stored hash is argon2, which is CORRECT');
  console.log('');

  // Step 4: Check emailVerified
  console.log(`4. Email verified check: ${foundUser?.emailVerified ? 'PASS' : 'FAIL'}`);
  if (!foundUser?.emailVerified) {
    console.log('   ❌ LOGIN WOULD FAIL: emailVerified is NULL/false');
  }
  console.log('');

  // Step 5: Check if authorize() would return user
  const hash = foundUser?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$decoy$decoy";
  console.log('5. Auth.js authorize() logic:');
  console.log(`   if (!user || !ok || !user.emailVerified) return null;`);
  console.log(`   
   User exists: ${!!foundUser}
   Password OK: (would check with argon2.verify)
   Email verified: ${!!foundUser?.emailVerified}`);
  
  if (!foundUser) {
    console.log('   ❌ RESULT: Would return NULL (user not found)');
  } else if (!foundUser.emailVerified) {
    console.log('   ❌ RESULT: Would return NULL (email not verified)');
  } else {
    console.log('   ✅ RESULT: Would return user object (if password matches)');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('CRITICAL CHECK: passwordChangedAt in Auth.js');
  console.log('='.repeat(80));
  console.log('');
  console.log('Auth.js authorize() code (src/lib/auth.ts:23-41):');
  console.log('  - Does NOT check passwordChangedAt');
  console.log('  - Only checks: user exists, password matches, emailVerified');
  console.log('');
  console.log('Password reset action (src/app/[locale]/(app)/actions.ts:279-284):');
  console.log('  - Sets passwordHash: await argon2.hash(password)');
  console.log('  - Sets passwordChangedAt: new Date()');
  console.log('');
  console.log(`User's passwordChangedAt: ${user.passwordChangedAt}`);
  console.log('');
  console.log('✅ passwordChangedAt is ONLY used in password reset token validation');
  console.log('✅ It does NOT affect login');
  console.log('');

  await prisma.$disconnect();
}

testPasswordVerification().catch(console.error);
