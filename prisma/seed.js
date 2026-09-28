/**
 * prisma/seed.js
 * Initial seed script for WowMyFlight CRM PostgreSQL Database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create or upsert Super Admin user
  const superAdmin = await prisma.user.upsert({
    where: { email: 'wael.madi@wowmyflight.com' },
    update: {},
    create: {
      name: 'Wael Madi (CEO)',
      email: 'wael.madi@wowmyflight.com',
      role: 'super_admin',
      phone: '+18333955554',
      status: 'active',
    },
  });

  console.log(`✅ Super Admin created/verified: ${superAdmin.name} (${superAdmin.email})`);

  // 2. Create or upsert Sample Consultant user
  const consultant = await prisma.user.upsert({
    where: { email: 'agent@wowmyflight.com' },
    update: {},
    create: {
      name: 'Sales Consultant',
      email: 'agent@wowmyflight.com',
      role: 'consultant',
      phone: '+18503329681',
      status: 'active',
    },
  });

  console.log(`✅ Default Consultant created/verified: ${consultant.name}`);
  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
