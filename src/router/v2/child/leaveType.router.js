import express from "express";
import { createLeaveType, deleteLeaveType, getLeaveTypeById, getLeaveTypes, updateLeaveType } from "../../../controller/v2/LeaveType/leaveType.controller.js";


const router = express.Router();

router.get("/org/:org_id", getLeaveTypes);
router.get("/:id", getLeaveTypeById);
router.post("/", createLeaveType);
router.put("/:id", updateLeaveType);
router.patch("/:id", updateLeaveType);
router.delete("/:id", deleteLeaveType);

export default router;