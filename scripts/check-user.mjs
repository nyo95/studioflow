import { PrismaClient } from '../src/generated/prisma/index.js';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  console.log('--- Database & User Connectivity Check ---');
  console.log('Using DATABASE_URL:', connectionString);
  try {
    const userCount = await prisma.user.count();
    console.log(`✅ Connection successful. Total users: ${userCount}`);

    if (userCount > 0) {
      const users = await prisma.user.findMany({
        take: 5,
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });
      console.log('📋 Sample Users:');
      console.table(users);
    } else {
      console.warn('⚠️ No users found in the database. You might need to seed the database.');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
