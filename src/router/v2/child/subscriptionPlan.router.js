import express from "express";
import {
    getSubscriptionPlans,
    getSubscriptionPlanById,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    toggleSubscriptionPlanStatus
} from "../../../controller/v2/subscriptionPlan/subscriptionPlan.controller.js";
import { validateSuperAdminTokenMiddleware } from "../../../middleware/validateToken.js";

const router = express.Router();

// Apply middleware to all routes to ensure only super admins can access
router.use(validateSuperAdminTokenMiddleware);

router.get("/", getSubscriptionPlans);
router.get("/:id", getSubscriptionPlanById);
router.post("/", createSubscriptionPlan);
router.put("/:id", updateSubscriptionPlan);
router.patch("/:id", updateSubscriptionPlan);
router.delete("/:id", deleteSubscriptionPlan);
router.patch("/:id/toggle-status", toggleSubscriptionPlanStatus);

export default router;
