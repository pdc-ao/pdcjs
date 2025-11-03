const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('adminpassword', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('Admin user created:', admin.email);

  const p1 = await prisma.product.upsert({
    where: { sku: 'SKU-001' },
    update: {},
    create: {
      name: 'Sample Product A',
      description: 'Example product',
      price: 9.99,
      sku: 'SKU-001',
      quantity: 100,
    },
  });

  console.log('Product created', p1.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });