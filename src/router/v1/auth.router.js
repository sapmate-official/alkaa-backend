import express from "express";
import { 
    verifyLoginCredentials, 
    requestLoginOTP, 
    verifyLoginOTP, 
    resendLoginOTP,
    toggle2FA,
    updateNotificationPreferences 
} from "../../controller/v1/auth/auth.controller.js";
import validateToken from "../../middleware/validateToken.js";

const router = express.Router();

// Public routes (no authentication required)
router.post("/verify-credentials", verifyLoginCredentials);
router.post("/request-otp", requestLoginOTP);
router.post("/verify-otp", verifyLoginOTP);
router.post("/resend-otp", resendLoginOTP);

// Protected routes (authentication required)
router.post("/toggle-2fa", validateToken, toggle2FA);
router.put("/notification-preferences", validateToken, updateNotificationPreferences);

export default router;
