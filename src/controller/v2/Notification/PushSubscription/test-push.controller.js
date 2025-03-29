import prisma from "../../../../db/connectDb.js";
import webpush from "web-push";

// Set VAPID details
const vapidDetails = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: 'mailto:contact@yourdomain.com'
};

webpush.setVapidDetails(
  vapidDetails.subject,
  vapidDetails.publicKey,
  vapidDetails.privateKey
);

export const sendTestPushNotification = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all subscriptions for the user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });
    
    if (!subscriptions.length) {
      return res.status(404).json({ error: 'No subscriptions found for this user' });
    }
    
    const payload = JSON.stringify({
      title: 'Test Notification',
      content: 'This is a test push notification from Alkaa',
      url: '/p/notification'
    });
    
    // Send notification to all subscriptions
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: subscription.keys
        }, payload);
      } catch (error) {
        console.error('Error sending notification:', error);
        // If subscription is expired or invalid, remove it
        if (error.statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { id: subscription.id }
          });
        }
      }
    });
    
    await Promise.all(sendPromises);
    res.status(200).json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('Error in test push notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
};