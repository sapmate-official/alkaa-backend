import { Expo } from 'expo-server-sdk';
import prisma from '../../../../db/connectDb.js';

// Create a new Expo SDK client
let expo = new Expo();

/**
 * Send push notification to specific user
 * @param {string} userId - User ID to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} - Result of sending notification
 */
export const sendExpoPushNotification = async (userId, title, body, data = {}) => {
  try {
    // Get all active mobile tokens for the user
    const tokens = await prisma.mobilePushToken.findMany({
      where: {
        userId,
        isActive: true
      }
    });

    if (!tokens.length) {
      console.log(`No active push tokens found for user ${userId}`);
      return { success: false, message: 'No push tokens found' };
    }

    // Prepare messages
    let messages = [];
    let skippedTokens = [];
    
    for (let token of tokens) {
      // Skip development tokens in all environments (they should not be in DB)
      if (token.token.startsWith('ExpoToken[DEVELOPMENT_')) {
        console.log(`Skipping development token: ${token.token}`);
        skippedTokens.push(token.token);
        // Mark development tokens as inactive since they shouldn't be in production DB
        await prisma.mobilePushToken.update({
          where: { id: token.id },
          data: { isActive: false }
        });
        continue;
      }

      // Check that the token is a valid Expo push token
      if (!Expo.isExpoPushToken(token.token)) {
        console.error(`Push token ${token.token} is not a valid Expo push token`);
        // Mark invalid tokens as inactive
        await prisma.mobilePushToken.update({
          where: { id: token.id },
          data: { isActive: false }
        });
        skippedTokens.push(token.token);
        continue;
      }

      // Construct a message
      messages.push({
        to: token.token,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'high',
        channelId: 'default',
      });
    }

    if (!messages.length) {
      let message = 'No valid push tokens found';
      if (skippedTokens.length > 0) {
        message += `. Skipped ${skippedTokens.length} invalid/development tokens`;
      }
      return { success: false, message };
    }

    // Send the notifications in chunks
    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    let errors = [];

    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
        errors.push(error);
      }
    }

    // Handle tickets and check for errors
    await handlePushTickets(tickets, tokens);

    return {
      success: true,
      message: `Sent ${messages.length} notifications`,
      tickets: tickets.length,
      errors: errors.length
    };

  } catch (error) {
    console.error('Error in sendExpoPushNotification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send push notification to multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} - Result of sending notifications
 */
export const sendBulkExpoPushNotification = async (userIds, title, body, data = {}) => {
  try {
    let totalMessages = 0;
    let totalTickets = 0;
    let totalErrors = 0;

    for (let userId of userIds) {
      const result = await sendExpoPushNotification(userId, title, body, data);
      if (result.success) {
        totalMessages += result.tickets;
        totalTickets += result.tickets;
      } else {
        totalErrors++;
      }
    }

    return {
      success: true,
      message: `Sent notifications to ${userIds.length} users`,
      totalMessages,
      totalTickets,
      totalErrors
    };

  } catch (error) {
    console.error('Error in sendBulkExpoPushNotification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send notification to all users in an organization
 * @param {string} orgId - Organization ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} - Result of sending notifications
 */
export const sendOrgWideExpoPushNotification = async (orgId, title, body, data = {}) => {
  try {
    // Get all active users in the organization
    const users = await prisma.user.findMany({
      where: {
        orgId,
        status: 'active'
      },
      select: { id: true }
    });

    if (!users.length) {
      return { success: false, message: 'No active users found in organization' };
    }

    const userIds = users.map(user => user.id);
    return await sendBulkExpoPushNotification(userIds, title, body, data);

  } catch (error) {
    console.error('Error in sendOrgWideExpoPushNotification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Handle push notification tickets and update token status
 * @param {Array} tickets - Array of push tickets
 * @param {Array} tokens - Array of token objects
 */
async function handlePushTickets(tickets, tokens) {
  for (let i = 0; i < tickets.length; i++) {
    let ticket = tickets[i];
    let token = tokens[i];

    if (ticket.status === 'error') {
      console.error(`Error sending notification to token ${token.token}:`, ticket.message);
      
      // If there's an error, check if the token is invalid
      if (ticket.details && 
          (ticket.details.error === 'DeviceNotRegistered' || 
           ticket.details.error === 'InvalidCredentials' ||
           ticket.message.includes('is not a valid Expo push token'))) {
        // Mark token as inactive
        try {
          await prisma.mobilePushToken.update({
            where: { id: token.id },
            data: { isActive: false }
          });
          console.log(`Marked token ${token.token} as inactive due to error: ${ticket.message}`);
        } catch (updateError) {
          console.error(`Failed to mark token ${token.id} as inactive:`, updateError);
        }
      }
    } else if (ticket.status === 'ok') {
      console.log(`Successfully sent notification to token ${token.token}`);
    }
  }
}

/**
 * Send a test notification to a user
 * @param {string} userId - User ID to send test notification to
 * @returns {Promise<object>} - Result of sending test notification
 */
export const sendTestExpoPushNotification = async (userId) => {
  const title = 'Test Notification from Alkaa';
  const body = 'This is a test push notification. Your notifications are working correctly!';
  const data = {
    type: 'test',
    timestamp: new Date().toISOString(),
    url: '/dashboard'
  };

  return await sendExpoPushNotification(userId, title, body, data);
};

/**
 * Clean up expired and invalid tokens
 * @returns {Promise<object>} - Result of cleanup operation
 */
export const cleanupInvalidTokens = async () => {
  try {
    // Remove tokens that have been inactive for more than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.mobilePushToken.deleteMany({
      where: {
        AND: [
          { isActive: false },
          { updatedAt: { lt: thirtyDaysAgo } }
        ]
      }
    });

    return {
      success: true,
      message: `Cleaned up ${result.count} expired tokens`
    };

  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    return { success: false, message: error.message };
  }
};
