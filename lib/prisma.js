// Prisma client singleton to prevent connection exhaustion in serverless environments.
const { PrismaClient } = require('@prisma/client');

let prisma;

if (!global.__prisma) {
  global.__prisma = new PrismaClient();
  // Optional: log queries in development
  if (process.env.NODE_ENV === 'development') {
    global.__prisma.$on('query', (e) => {
      console.debug('Prisma Query', e.query);
    });
  }
}

prisma = global.__prisma;

module.exports = prisma;