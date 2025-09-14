import express from "express";
import { whatsappController } from "../../../controller/v2/whatsapp/whatsapp.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

router.use(validateToken);

router.post("/send", whatsappController.sendNotification);
router.post("/task-assignment", whatsappController.sendTaskAssignmentNotification);
router.post("/task-update", whatsappController.sendTaskUpdateNotification);

export default router;
