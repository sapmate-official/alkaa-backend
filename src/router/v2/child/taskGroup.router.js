import express from "express";
import { taskGroupController } from "../../../controller/v2/taskGroup/taskGroup.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

router.use(validateToken);

router.post("/", taskGroupController.createGroup);
router.get("/", taskGroupController.getAllGroups);
router.get("/:id", taskGroupController.getGroupById);
router.put("/:id", taskGroupController.updateGroup);
router.delete("/:id", taskGroupController.deleteGroup);
router.post("/:id/members", taskGroupController.addMembers);
router.delete("/:id/members", taskGroupController.removeMembers);

export default router;
