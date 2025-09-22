import express from "express";
import { 
    // Multi-tenant authentication flow (recommended)
    checkEmailForLogin,
    verifyPasswordAndSendOtp,
    verifyOtpAndLogin,
    
    // Advanced 2FA flow (alternative)
    verifyLoginCredentials, 
    requestLoginOTP, 
    verifyLoginOTP, 
    resendLoginOTP,
    
    // Legacy authentication (backward compatibility)
    setPassword,
    loginUser,
    validatetoken,
    refreshToken,
    logout,
    Profiledetails,
    updateProfile,
    
    // User preferences
    toggle2FA,
    updateNotificationPreferences 
} from "../../controller/v1/auth/auth.controller.js";
import validateToken from "../../middleware/validateToken.js";

const router = express.Router();

// Multi-tenant authentication flow (recommended)
router.post("/check-email", checkEmailForLogin);
router.post("/verify-password", verifyPasswordAndSendOtp);
router.post("/verify-otp", verifyOtpAndLogin);

// Advanced 2FA authentication flow (alternative)
router.post("/verify-credentials", verifyLoginCredentials);
router.post("/request-otp", requestLoginOTP);
router.post("/verify-login-otp", verifyLoginOTP);
router.post("/resend-otp", resendLoginOTP);

// Legacy authentication routes (backward compatibility)
router.post("/set-password", setPassword);
router.post("/login", loginUser);
router.get("/validate-token", validateToken, validatetoken);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.get("/profile/:id", Profiledetails);
router.put("/profile/:id", updateProfile);

// User preferences (authentication required)
router.post("/toggle-2fa", validateToken, toggle2FA);
router.put("/notification-preferences", validateToken, updateNotificationPreferences);

export default router;
