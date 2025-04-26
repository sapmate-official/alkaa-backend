import prisma from "../db/connectDb.js";
import { sendPushNotification } from "../controller/v3/PushNotification/pushNotification.controller.js";

/**
 * Send a notification to a user immediately
 * @param {string} userId - The recipient user ID
 * @param {string} templateId - The notification template ID
 * @param {object} variables - Variables to populate the template
 * @param {object} metadata - Additional metadata for the notification
 * @returns {Promise<object>} - The created notification
 */
export const sendImmediateNotification = async (userId, templateId, variables = {}, metadata = {}) => {
  try {
    // Fetch the template
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: templateId }
    });
    
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }
    
    // Process template content with variables
    let content = template.content;
    
    // Replace variables in content
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        templateId,
        content,
        metadata
      },
      include: {
        template: true
      }
    });
    
    // Send push notification if template type is PUSH
    if (template.type === 'PUSH') {
      await sendPushNotification(
        userId,
        template.subject,
        content,
        metadata?.url || '/'
      );
    }
    
    return notification;
  } catch (error) {
    console.error('Error sending immediate notification:', error);
    throw error;
  }
};

/**
 * Schedule a notification to be sent at a specific time
 * @param {string} userId - The recipient user ID
 * @param {string} templateId - The notification template ID
 * @param {Date} scheduledTime - When to send the notification
 * @param {object} variables - Variables to populate the template
 * @param {object} metadata - Additional metadata for the notification
 * @returns {Promise<object>} - The created background job
 */
export const scheduleNotification = async (userId, templateId, scheduledTime, variables = {}, metadata = {}) => {
  try {
    // Validate inputs
    if (!userId || !templateId || !scheduledTime) {
      throw new Error('Missing required parameters');
    }

    if (!(scheduledTime instanceof Date) || isNaN(scheduledTime.getTime())) {
      throw new Error('Invalid scheduled time');
    }
    
    // Create a background job to send the notification at the scheduled time
    const job = await prisma.backgroundJob.create({
      data: {
        type: 'NOTIFICATION_DISPATCH',
        status: 'PENDING',
        scheduledFor: scheduledTime,
        priority: 1,
        payload: {
          userId,
          templateId,
          variables,
          metadata
        }
      }
    });
    
    return job;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
};

/**
 * Process scheduled notifications that are due
 * Called by a job processor/scheduler
 */
export const processScheduledNotifications = async () => {
  try {
    const now = new Date();
    
    // Find pending notification jobs that are due
    const dueJobs = await prisma.backgroundJob.findMany({
      where: {
        type: 'NOTIFICATION_DISPATCH',
        status: 'PENDING',
        scheduledFor: {
          lte: now
        }
      }
    });
    
    console.log(`Processing ${dueJobs.length} scheduled notifications`);
    
    // Process each due job
    for (const job of dueJobs) {
      try {
        // Mark job as processing
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSING' }
        });
        
        const { userId, templateId, variables, metadata } = job.payload;
        
        // Send the notification
        await sendImmediateNotification(userId, templateId, variables, metadata);
        
        // Mark job as completed
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: { 
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
      } catch (error) {
        console.error(`Error processing notification job ${job.id}:`, error);
        
        // Update job with error and increment attempt count
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: job.attempts >= job.maxAttempts - 1 ? 'FAILED' : 'PENDING',
            attempts: { increment: 1 },
            error: error.message
          }
        });
      }
    }
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
  }
};