import prisma from "../../../db/connectDb.js"
import webpush from "web-push";

// Set VAPID details
const vapidDetails = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: 'mailto:contact@yourdomain.com'  // Change to your contact email
};

webpush.setVapidDetails(
  vapidDetails.subject,
  vapidDetails.publicKey,
  vapidDetails.privateKey
);

// Save user's push subscription
export const saveSubscription = async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Save or update subscription
    const existingSubscription = await prisma.pushSubscription.findFirst({
      where: { 
        userId,
        endpoint: subscription.endpoint
      }
    });
    
    if (existingSubscription) {
      await prisma.pushSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          keys: subscription.keys,
          expirationTime: subscription.expirationTime
        }
      });
    } else {
      await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          expirationTime: subscription.expirationTime
        }
      });
    }
    
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
};

// Send a push notification
export const sendPushNotification = async (userId, title, content, url) => {
  try {
    // Get all subscriptions for the user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });
    
    if (!subscriptions.length) return;
    
    const payload = JSON.stringify({
      title,
      content,
      url
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
  } catch (error) {
    console.error('Error in push notification process:', error);
  }
};