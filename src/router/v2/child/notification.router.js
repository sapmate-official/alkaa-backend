import express from "express";
// import { saveSubscription } from "../../../controller/v3/PushNotification/pushNotification.controller.js"; 
import { createNotification, createNotificationTemplate, deleteNotification, deleteNotificationTemplate, getAllnotification, getAllnotificationTemplate, getNotificationByUserId, getNotificationTemplateById, updateNotification, updateNotificationTemplate } from "../../../controller/v2/Notification/Template/Notification.template.controller.js";
import { sendTestPushNotification } from "../../../controller/v2/Notification/PushSubscription/test-push.controller.js";
import { registerMobileToken, getUserTokens, deactivateToken, cleanupTokens } from "../../../controller/v2/Notification/MobileToken/mobileToken.controller.js";
import { sendExpoPushNotification, sendBulkExpoPushNotification, sendOrgWideExpoPushNotification, sendTestExpoPushNotification, cleanupInvalidTokens } from "../../../controller/v2/Notification/ExpoPush/expoPush.controller.js";
import { sendFCMV1PushNotification, sendBulkFCMV1PushNotification, sendOrgWideFCMV1PushNotification, sendTestFCMV1PushNotification } from "../../../controller/v2/Notification/FCMV1Push/fcmV1Push.controller.js";
// import { scheduleNotificationController } from "../../../controller/v2/Notification/Schedule/notification.schedule.controller.js";

const router = express.Router();

// notification routes
router.get("/", getAllnotification);
router.post("/", createNotification);
router.get("/:id", getNotificationByUserId);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);
// router.post("/subscription", saveSubscription);
router.get("/test-push/:userId", sendTestPushNotification);
// router.post("/schedule", scheduleNotificationController);

// Mobile token routes
router.post("/register-token", registerMobileToken);
router.get("/tokens/:userId", getUserTokens);
router.delete("/tokens/:tokenId", deactivateToken);
router.post("/tokens/cleanup", cleanupTokens);

// Expo push notification routes
router.post("/expo-push/single", async (req, res) => {
  const { userId, title, body, data } = req.body;
  const result = await sendExpoPushNotification(userId, title, body, data);
  res.json(result);
});

router.post("/expo-push/bulk", async (req, res) => {
  const { userIds, title, body, data } = req.body;
  const result = await sendBulkExpoPushNotification(userIds, title, body, data);
  res.json(result);
});

router.post("/expo-push/org-wide", async (req, res) => {
  const { orgId, title, body, data } = req.body;
  const result = await sendOrgWideExpoPushNotification(orgId, title, body, data);
  res.json(result);
});

router.get("/expo-push/test/:userId", async (req, res) => {
  const { userId } = req.params;
  const result = await sendTestExpoPushNotification(userId);
  res.json(result);
});

router.post("/expo-push/cleanup", async (req, res) => {
  const result = await cleanupInvalidTokens();
  res.json(result);
});

// FCM V1 push notification routes (Production-ready)
router.post("/fcm-v1/single", async (req, res) => {
  const { userId, title, body, data } = req.body;
  const result = await sendFCMV1PushNotification(userId, title, body, data);
  res.json(result);
});

router.post("/fcm-v1/bulk", async (req, res) => {
  const { userIds, title, body, data } = req.body;
  const result = await sendBulkFCMV1PushNotification(userIds, title, body, data);
  res.json(result);
});

router.post("/fcm-v1/org-wide", async (req, res) => {
  const { orgId, title, body, data } = req.body;
  const result = await sendOrgWideFCMV1PushNotification(orgId, title, body, data);
  res.json(result);
});

router.get("/fcm-v1/test/:userId", async (req, res) => {
  const { userId } = req.params;
  const result = await sendTestFCMV1PushNotification(userId);
  res.json(result);
});

// notification template routes
router.get("/template", getAllnotificationTemplate);
router.post("/template", createNotificationTemplate);
router.get("/template/:id", getNotificationTemplateById);
router.put("/template/:id", updateNotificationTemplate);
router.delete("/template/:id", deleteNotificationTemplate);

export default router;