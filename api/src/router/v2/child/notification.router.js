import express from "express";
import { saveSubscription } from "../../../controller/v3/PushNotification/pushNotification.controller.js"; 
import { createNotification, createNotificationTemplate, deleteNotification, deleteNotificationTemplate, getAllnotification, getAllnotificationTemplate, getNotificationByUserId, getNotificationTemplateById, updateNotification, updateNotificationTemplate } from "../../../controller/v2/Notification/Template/Notification.template.controller.js";
import { sendTestPushNotification } from "../../../controller/v2/Notification/PushSubscription/test-push.controller.js";
import { scheduleNotificationController } from "../../../controller/v2/Notification/Schedule/notification.schedule.controller.js";

const router = express.Router();

// notification routes
router.get("/", getAllnotification);
router.post("/", createNotification);
router.get("/:id", getNotificationByUserId);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);
router.post("/subscription", saveSubscription);
router.get("/test-push/:userId", sendTestPushNotification);
router.post("/schedule", scheduleNotificationController);

// notification template routes
router.get("/template", getAllnotificationTemplate);
router.post("/template", createNotificationTemplate);
router.get("/template/:id", getNotificationTemplateById);
router.put("/template/:id", updateNotificationTemplate);
router.delete("/template/:id", deleteNotificationTemplate);

export default router;