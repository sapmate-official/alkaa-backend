import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Ensure dynamic columns exist in DB
let schemaVerified = false;
export const ensureColumns = async () => {
    if (schemaVerified) return;
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessEmail" TEXT;`);
        schemaVerified = true;
    } catch (e) {
        // Safe to ignore if DB not connected yet or already exists
    }
};
ensureColumns();

export default prisma;
