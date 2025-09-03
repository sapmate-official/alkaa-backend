/**
 * Script to clean up development tokens from the database
 * Run this script to remove any development tokens that were accidentally stored
 */

import prisma from '../src/db/connectDb.js';

async function cleanupDevelopmentTokens() {
  try {
    console.log('🧹 Starting cleanup of development tokens...');
    
    // Find all development tokens
    const developmentTokens = await prisma.mobilePushToken.findMany({
      where: {
        token: {
          startsWith: 'ExpoToken[DEVELOPMENT_'
        }
      }
    });

    console.log(`Found ${developmentTokens.length} development tokens to clean up`);

    if (developmentTokens.length === 0) {
      console.log('✅ No development tokens found. Database is clean!');
      return;
    }

    // Delete all development tokens
    const result = await prisma.mobilePushToken.deleteMany({
      where: {
        token: {
          startsWith: 'ExpoToken[DEVELOPMENT_'
        }
      }
    });

    console.log(`✅ Successfully deleted ${result.count} development tokens`);
    
    // Also clean up any inactive tokens older than 1 day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const inactiveResult = await prisma.mobilePushToken.deleteMany({
      where: {
        AND: [
          { isActive: false },
          { updatedAt: { lt: oneDayAgo } }
        ]
      }
    });

    console.log(`✅ Also cleaned up ${inactiveResult.count} old inactive tokens`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDevelopmentTokens().then(() => {
  console.log('🎉 Cleanup completed!');
}).catch((error) => {
  console.error('💥 Cleanup failed:', error);
  process.exit(1);
});
