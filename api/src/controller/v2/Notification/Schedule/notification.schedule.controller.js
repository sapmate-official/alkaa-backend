import { scheduleNotification } from "../../../../util/notificationUtil.js";

/**
 * Schedule a notification for future delivery
 * @param {object} req - The request object
 * @param {object} res - The response object
 */
export const scheduleNotificationController = async (req, res) => {
  try {
    const { userId, templateId, scheduledTime, variables, metadata } = req.body;
    
    if (!userId || !templateId || !scheduledTime) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const scheduledTimeDate = new Date(scheduledTime);
    if (isNaN(scheduledTimeDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduled time' });
    }
    
    const job = await scheduleNotification(userId, templateId, scheduledTimeDate, variables, metadata);
    
    res.status(201).json(job);
  } catch (error) {
    console.error('Error scheduling notification via API:', error);
    res.status(500).json({ error: 'Failed to schedule notification' });
  }
};