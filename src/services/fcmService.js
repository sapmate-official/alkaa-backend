import { google } from 'googleapis';
import prisma from '../db/connectDb.js';

class FCMService {
  constructor() {
    this.projectId = 'alkaa-ac34c'; // Your Firebase project ID
    this.fcm = null;
    this.initializeFCM();
  }

  async initializeFCM() {
    try {
      let auth;
      
      // Check if we have service account credentials in environment
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        // Parse base64 encoded credentials for production
        const credentials = JSON.parse(
          Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString()
        );
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use file path for local development
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });
      } else {
        // Fallback to default credentials (EAS/environment)
        auth = new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });
      }

      this.fcm = google.firebase({ version: 'v1', auth });
      console.log('✅ FCM V1 service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FCM V1:', error);
      console.error('Please ensure Firebase service account credentials are properly configured');
    }
  }

  /**
   * Send notification to a single device
   */
  async sendToDevice(token, title, body, data = {}) {
    try {
      if (!this.fcm) {
        throw new Error('FCM service not initialized');
      }

      const message = {
        token: token,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          notification: {
            icon: 'notification_icon',
            color: '#ffffff',
            sound: 'default',
            channel_id: 'default',
          },
          priority: 'high',
        },
      };

      const response = await this.fcm.projects.messages.send({
        parent: `projects/${this.projectId}`,
        requestBody: {
          message,
        },
      });

      console.log('✅ Notification sent successfully:', response.data.name);
      return { success: true, messageId: response.data.name };
    } catch (error) {
      console.error('❌ Error sending FCM notification:', error);
      
      // Handle specific FCM errors
      if (error.code === 404 || error.message?.includes('not registered')) {
        return { success: false, error: 'INVALID_TOKEN', message: error.message };
      }
      
      return { success: false, error: 'SEND_FAILED', message: error.message };
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendToMultipleDevices(tokens, title, body, data = {}) {
    const results = [];
    
    for (const token of tokens) {
      const result = await this.sendToDevice(token, title, body, data);
      results.push({ token, ...result });
    }
    
    return results;
  }

  /**
   * Send notification to all users in an organization
   */
  async sendToOrganization(orgId, title, body, data = {}) {
    try {
      // Get all active tokens for users in the organization
      const tokens = await prisma.mobilePushToken.findMany({
        where: {
          isActive: true,
          user: {
            orgId: orgId,
            status: 'active',
          },
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (tokens.length === 0) {
        return { success: false, message: 'No active tokens found for organization' };
      }

      const results = await this.sendToMultipleDevices(
        tokens.map(t => t.token),
        title,
        body,
        data
      );

      // Update invalid tokens
      await this.handleInvalidTokens(results);

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: true,
        message: `Sent ${successCount}/${tokens.length} notifications`,
        results,
      };
    } catch (error) {
      console.error('Error sending organization-wide notification:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle invalid tokens by marking them as inactive
   */
  async handleInvalidTokens(results) {
    const invalidTokens = results
      .filter(r => !r.success && r.error === 'INVALID_TOKEN')
      .map(r => r.token);

    if (invalidTokens.length > 0) {
      await prisma.mobilePushToken.updateMany({
        where: {
          token: { in: invalidTokens },
        },
        data: {
          isActive: false,
        },
      });

      console.log(`Marked ${invalidTokens.length} invalid tokens as inactive`);
    }
  }

  /**
   * Test notification functionality
   */
  async sendTestNotification(userId) {
    try {
      const userTokens = await prisma.mobilePushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (userTokens.length === 0) {
        return { success: false, message: 'No active tokens found for user' };
      }

      const title = '🎉 Test Notification from Alkaa';
      const body = 'Your notification system is working perfectly! This is a test message.';
      const data = {
        type: 'test',
        action: 'open_dashboard',
        url: '/dashboard',
      };

      const results = await this.sendToMultipleDevices(
        userTokens.map(t => t.token),
        title,
        body,
        data
      );

      await this.handleInvalidTokens(results);

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: successCount > 0,
        message: `Test notification sent to ${successCount}/${userTokens.length} devices`,
        results,
      };
    } catch (error) {
      console.error('Error sending test notification:', error);
      return { success: false, message: error.message };
    }
  }
}

export const fcmService = new FCMService();
