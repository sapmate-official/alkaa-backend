import express from "express";
import { 
    getActivityLogs, 
    getActivityStats, 
    getUserRecentActivities 
} from "../../../controller/v2/ActivityLog/activityLog.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

// Get activity logs with filtering and pagination
// Accessible by managers and admins
router.get("/", validateToken, getActivityLogs);

// Get activity statistics for dashboard
router.get("/stats", validateToken, getActivityStats);

// Get recent activities for a specific user
router.get("/user/:targetUserId/recent", validateToken, getUserRecentActivities);

export default router;
