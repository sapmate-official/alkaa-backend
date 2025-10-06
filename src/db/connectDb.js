import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    transactionOptions: {
        maxWait: 15000, // 15 seconds
        timeout: 30000, // 30 seconds
    },
    log: ['error', 'warn'], // Add logging for better debugging
});

export default prisma;