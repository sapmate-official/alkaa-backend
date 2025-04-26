import express from "express";
import { createLeaveBalance, deleteLeaveBalance, getLeaveBalanceById, getLeaveBalances, updateLeaveBalance,getLeaveBalanceByleaveTypeIdAndUserId, getLeaveBalanceByUserId } from "../../../controller/v2/LeaveBalance/leaveBalance.controller.js";

const router = express.Router();

router.get("/", getLeaveBalances);
router.get("/:id", getLeaveBalanceById);
router.post("/", createLeaveBalance);
router.put("/:id", updateLeaveBalance);
router.patch("/:id", updateLeaveBalance);
router.delete("/:id", deleteLeaveBalance);

// extra routes
router.get("/user/:userId",getLeaveBalanceByUserId)
router.get("/:leavetypeId/:userId",getLeaveBalanceByleaveTypeIdAndUserId)

export default router;