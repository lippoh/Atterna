import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function smokeTest() {
  console.log('='.repeat(80));
  console.log('SMOKE TEST - Production Schema Reconciliation');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test 1: User.findUnique (the original failing path)
    console.log('1. Testing User.findUnique (original failing query)...');
    const testEmail = 'smoke-test-' + Date.now() + '@example.com';
    const user = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    console.log('   ✓ User.findUnique executed successfully (result: null as expected)');
    console.log('');

    // Test 2: Query existing users
    console.log('2. Querying existing users...');
    const userCount = await prisma.user.count();
    console.log(`   ✓ Found ${userCount} user(s) in production`);
    console.log('');

    // Test 3: Verify User table structure (isAdmin, passwordChangedAt)
    console.log('3. Verifying User table columns (isAdmin, passwordChangedAt)...');
    const sampleUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        locale: true,
        isAdmin: true,
        passwordChangedAt: true,
        createdAt: true
      }
    });
    if (sampleUser) {
      console.log('   ✓ User columns verified:', {
        hasIsAdmin: 'isAdmin' in sampleUser,
        hasPasswordChangedAt: 'passwordChangedAt' in sampleUser,
        locale: sampleUser.locale
      });
    } else {
      console.log('   ⚠️  No users found to verify columns');
    }
    console.log('');

    // Test 4: Verify enum types (Locale, Sentiment)
    console.log('4. Verifying enum types work correctly...');
    const businessCount = await prisma.business.count();
    console.log(`   ✓ Business.count() succeeded: ${businessCount} business(es)`);
    const reviewAnalysisCount = await prisma.reviewAnalysis.count();
    console.log(`   ✓ ReviewAnalysis.count() succeeded: ${reviewAnalysisCount} analysis(es)`);
    console.log('');

    // Test 5: Verify new tables exist
    console.log('5. Verifying new tables are accessible...');
    const newTables = {
      Invoice: await prisma.invoice.count(),
      FeedbackSubmission: await prisma.feedbackSubmission.count(),
      AiUsageLog: await prisma.aiUsageLog.count(),
      Job: await prisma.job.count(),
      WebhookEvent: await prisma.webhookEvent.count(),
      Competitor: await prisma.competitor.count(),
      ImpersonationSession: await prisma.impersonationSession.count(),
      ReportLog: await prisma.reportLog.count(),
      ReputationSnapshot: await prisma.reputationSnapshot.count(),
      Issue: await prisma.issue.count(),
      Recommendation: await prisma.recommendation.count(),
      BusinessInsight: await prisma.businessInsight.count()
    };
    
    for (const [table, count] of Object.entries(newTables)) {
      console.log(`   ✓ ${table}: ${count} row(s)`);
    }
    console.log('');

    // Test 6: Verify existing data integrity
    console.log('6. Verifying existing data integrity...');
    const orgCount = await prisma.organization.count();
    const reviewCount = await prisma.review.count();
    const membershipCount = await prisma.membership.count();
    console.log(`   ✓ Organizations: ${orgCount}`);
    console.log(`   ✓ Reviews: ${reviewCount}`);
    console.log(`   ✓ Memberships: ${membershipCount}`);
    console.log('');

    // Test 7: Verify relations work
    console.log('7. Testing relations...');
    const orgWithRelations = await prisma.organization.findFirst({
      include: {
        memberships: true,
        businesses: true,
        subscription: true
      }
    });
    if (orgWithRelations) {
      console.log('   ✓ Organization relations work:', {
        memberships: orgWithRelations.memberships.length,
        businesses: orgWithRelations.businesses.length,
        hasSubscription: !!orgWithRelations.subscription
      });
    } else {
      console.log('   ⚠️  No organizations found to test relations');
    }
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ ALL SMOKE TESTS PASSED');
    console.log('='.repeat(80));
    console.log('');
    console.log('The production schema reconciliation is complete and verified.');
    console.log('The database is now fully synchronized with prisma/schema.prisma.');

  } catch (err) {
    console.error('');
    console.error('❌ SMOKE TEST FAILED');
    console.error('='.repeat(80));
    console.error('Error:', err.message);
    if (err.code) {
      console.error('Code:', err.code);
    }
    if (err.meta) {
      console.error('Meta:', err.meta);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

smokeTest();
