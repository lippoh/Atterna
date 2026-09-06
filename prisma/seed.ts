import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await argon2.hash(process.env.ADMIN_PASSWORD || 'Admin123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@reputation-saas.gr' },
    update: {},
    create: {
      email: 'admin@reputation-saas.gr',
      passwordHash: adminPassword,
      locale: 'EL',
    },
  });

  console.log(`✅ Created admin user: ${admin.email}`);

  // Create default organization
  const org = await prisma.organization.create({
    data: {
      name: 'Default Organization',
      memberships: {
        create: {
          userId: admin.id,
          role: 'OWNER',
        },
      },
    },
  });

  console.log(`✅ Created organization: ${org.name}`);
  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });