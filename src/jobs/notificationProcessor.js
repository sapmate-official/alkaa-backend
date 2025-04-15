import { processScheduledNotifications } from "../util/notificationUtil.js";

/**
 * Process scheduled notifications
 * Can be called by a cron job or scheduler
 */
export const runNotificationProcessor = async () => {
  try {
    console.log('Starting notification processor...');
    await processScheduledNotifications();
    console.log('Completed notification processor run');
  } catch (error) {
    console.error('Error in notification processor:', error);
  }
};

// If this script is called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runNotificationProcessor()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error in notification processor:', error);
      process.exit(1);
    });
}