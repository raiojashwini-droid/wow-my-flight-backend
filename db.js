/**
 * db.js
 * Centralized Prisma Database Client with auto-reconnection and graceful fallback
 */

const { PrismaClient } = require('@prisma/client');

let prisma = null;
let isConnected = false;

if (process.env.DATABASE_URL) {
  try {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    // Test connection asynchronously
    prisma.$connect()
      .then(() => {
        isConnected = true;
        console.log('✅ [PostgreSQL] Connected successfully to database via Prisma');
      })
      .catch((err) => {
        isConnected = false;
        console.warn('⚠️ [PostgreSQL] Database connection failed:', err.message);
      });
  } catch (e) {
    console.warn('⚠️ [PostgreSQL] Could not initialize Prisma client:', e.message);
  }
} else {
  console.log('ℹ️ [PostgreSQL] DATABASE_URL not set. Running in resilient memory mode.');
}

module.exports = {
  prisma,
  isDbConnected: () => isConnected,
};
