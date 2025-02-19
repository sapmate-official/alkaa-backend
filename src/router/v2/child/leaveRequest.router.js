import express from "express";
import { createLeaveRequest, deleteLeaveRequest, getLeaveRequestById, getLeaveRequestByUserId, getLeaveRequests, updateLeaveRequest, getLeaveRequestByManagerId,rejectLeaveRequest,approveLeaveRequest,cancelLeaveRequest } from "../../../controller/v2/leaveRequest/leaveRequest.controller.js";

const router = express.Router();

router.get("/org/:id", getLeaveRequests);
router.get("/:id", getLeaveRequestById);
router.post("/", createLeaveRequest);
router.put("/:id", updateLeaveRequest);
router.patch("/:id", updateLeaveRequest);
router.delete("/:id", deleteLeaveRequest);

// extra routes
router.get("/user/:id", getLeaveRequestByUserId);
router.get("/manager/:id", getLeaveRequestByManagerId);
router.post("/approve/:id", approveLeaveRequest);
router.post("/reject/:id", rejectLeaveRequest);
router.post("/cancel/:id", cancelLeaveRequest);


export default router;