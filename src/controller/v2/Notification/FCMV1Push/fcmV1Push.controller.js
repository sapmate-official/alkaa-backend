import prisma from '../../../../db/connectDb.js';
import { fcmService } from '../../../../services/fcmService.js';
// import prisma from '../../../../db/connectDb.js';

/**
 * Send push notification to specific user using FCM V1
 * @param {string} userId - User ID to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} - Result of sending notification
 */
export const sendFCMV1PushNotification = async (userId, title, body, data = {}) => {
  try {
    // Get all active mobile tokens for the user
    const tokens = await prisma.mobilePushToken.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!tokens.length) {
      console.log(`No active push tokens found for user ${userId}`);
      return { success: false, message: 'No push tokens found' };
    }

    // Filter out development tokens (they shouldn't be in production DB anyway)
    const validTokens = tokens.filter(token => 
      !token.token.startsWith('ExpoToken[DEVELOPMENT_')
    );

    if (!validTokens.length) {
      return { success: false, message: 'No valid push tokens found (only development tokens)' };
    }

    // Send notifications using FCM V1
    const results = await fcmService.sendToMultipleDevices(
      validTokens.map(t => t.token),
      title,
      body,
      data
    );

    // Handle results and update token status
    await fcmService.handleInvalidTokens(results);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return {
      success: successCount > 0,
      message: `Sent ${successCount}/${validTokens.length} notifications`,
      successCount,
      errorCount,
      details: results
    };

  } catch (error) {
    console.error('Error in sendFCMV1PushNotification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send push notification to multiple users using FCM V1
 * @param {string[]} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} - Result of sending notifications
 */
export const sendBulkFCMV1PushNotification = async (userIds, title, body, data = {}) => {
  try {
    let totalSuccess = 0;
    let totalErrors = 0;
    const userResults = [];

    for (let userId of userIds) {
      const result = await sendFCMV1PushNotification(userId, title, body, data);
      userResults.push({ userId, ...result });
      
      if (result.success) {
        totalSuccess += result.successCount || 1;
      } else {
        totalErrors++;
      }
    }

    return {
      success: totalSuccess > 0,
      message: `Sent notifications to ${userIds.length} users`,
      totalSuccess,
      totalErrors,
      userResults
    };

  } catch (error) {
    console.error('Error in sendBulkFCMV1PushNotification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send notification to all users in an organization using FCM V1
 * @param {string} orgId - Organization ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} - Result of sending notifications
 */
export const sendOrgWideFCMV1PushNotification = async (orgId, title, body, data = {}) => {
  try {
    return await fcmService.sendToOrganization(orgId, title, body, data);
  } catch (error) {
    console.error('Error in sendOrgWideFCMV1PushNotification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send a test notification to a user using FCM V1
 * @param {string} userId - User ID to send test notification to
 * @returns {Promise<object>} - Result of sending test notification
 */
export const sendTestFCMV1PushNotification = async (userId) => {
  try {
    return await fcmService.sendTestNotification(userId);
  } catch (error) {
    console.error('Error in sendTestFCMV1PushNotification:', error);
    return { success: false, message: error.message };
  }
};
