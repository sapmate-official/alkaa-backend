import prisma from './src/db/connectDb.js';

async function testActivityLog() {
    try {
        console.log('Testing Prisma connection and ActivityLog model...');
        
        // Check if prisma is available
        console.log('Prisma client available:', !!prisma);
        
        // Check if activityLog model is available
        console.log('ActivityLog model available:', !!prisma.activityLog);
        
        // Try to count activity logs
        const count = await prisma.activityLog.count();
        console.log('ActivityLog count:', count);
        
        console.log('Test successful!');
    } catch (error) {
        console.error('Test failed:', error);
        console.error('Error stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testActivityLog();
