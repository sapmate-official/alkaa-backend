import express from "express";
import { createNotification, createNotificationTemplate, deleteNotification, deleteNotificationTemplate, getAllnotification, getAllnotificationTemplate, getNotificationByUserId, getNotificationTemplateById, updateNotification, updateNotificationTemplate } from "../../../controller/v2/Notification/Template/Notification.template.controller.js";
const router=  express.Router();

// notfication template
router.get("/",getAllnotification);
router.post("/",createNotification);
router.get("/:id",getNotificationByUserId);
router.put("/:id",updateNotification);
router.delete("/:id",deleteNotification);



// notfication template
router.get("/template",getAllnotificationTemplate);
router.post("/template",createNotificationTemplate);
router.get("/template/:id",getNotificationTemplateById);
router.put("/template/:id",updateNotificationTemplate);
router.delete("/template/:id",deleteNotificationTemplate);

export default router;