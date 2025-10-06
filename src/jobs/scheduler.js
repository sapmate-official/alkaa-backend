import { scheduleJob } from 'node-schedule';
// import { runNotificationProcessor } from './notificationProcessor.js';
import { checkMissingCheckouts } from './attendanceProcessor.js';
import { sendUpcomingHolidayReminders } from './holidayReminderProcessor.js';
import { processBirthdayEmails } from './birthdayService.js';

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
  
  // Send holiday reminders each day at 9 AM server time
  scheduleJob('0 9 * * *', async () => {
    console.log('Running scheduled holiday reminder processor...');
    await sendUpcomingHolidayReminders();
  });

  // Check for missing checkouts every 30 minutes between 5 PM and midnight
  // Runs at 5:30 PM, 6:00 PM, 6:30 PM, etc. until midnight
  scheduleJob('30,0 17-23 * * *', async () => {
    console.log('Running scheduled missing checkout check...');
    await checkMissingCheckouts();
  });
  
  // Check for birthdays and send birthday emails daily at 9:00 AM
  // This runs every hour from 8 AM to 11 AM to handle different timezones
  scheduleJob('0 8-11 * * *', async () => {
    console.log('🎂 Running scheduled birthday email check...');
    try {
      const result = await processBirthdayEmails();
      console.log('🎉 Birthday email check completed:', result);
    } catch (error) {
      console.error('❌ Error in birthday email check:', error);
    }
  });
  
  console.log('Scheduled jobs started successfully');
};

// If this script is called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  // startScheduledJobs();
  // Keep process running
  console.log('Scheduler running. Press Ctrl+C to exit.');
}
