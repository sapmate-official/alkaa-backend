import express from "express";
import { taskController } from "../../../controller/v2/task/task.controller.js";
import validateToken from "../../../middleware/validateToken.js";
import { checkUserRoles } from "../../../middleware/roleCheck.js";

const router = express.Router();

router.use(validateToken);
router.use(checkUserRoles);

router.post("/", taskController.createTask);
router.get("/", taskController.getAllTasks);
router.get("/:id", taskController.getTaskById);
router.put("/:id", taskController.updateTask);
router.patch("/:id", taskController.patchTask);
router.delete("/:id", taskController.deleteTask);
router.get("/user/:userId", taskController.getTasksByUser);
router.get("/manager/:managerId", taskController.getTasksByManager);
router.post("/:taskId/updates", taskController.addTaskUpdate);

export default router;
