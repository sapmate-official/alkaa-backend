import { scheduleJob } from 'node-schedule';
// import { runNotificationProcessor } from './notificationProcessor.js';
import { checkMissingCheckouts } from './attendanceProcessor.js';

/**
 * Scheduler for recurring jobs
 * Uses node-schedule to schedule jobs at specific times
 */
export const startScheduledJobs = () => {
  console.log('Starting scheduled jobs...');
  
  // Run notification processor every hour
  scheduleJob('0 * * * *', async () => {
    console.log('Running scheduled notification processor...');
    // await runNotificationProcessor();
  });
  
  // Check for missing checkouts every 30 minutes between 5 PM and midnight
  // Runs at 5:30 PM, 6:00 PM, 6:30 PM, etc. until midnight
  scheduleJob('30,0 17-23 * * *', async () => {
    console.log('Running scheduled missing checkout check...');
    await checkMissingCheckouts();
  });
  
  console.log('Scheduled jobs started successfully');
};

// If this script is called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startScheduledJobs();
  // Keep process running
  console.log('Scheduler running. Press Ctrl+C to exit.');
}
