import express from "express";
import { 
    // Enhanced Multi-tenant + 2FA authentication flow (unified)
    discoverOrganizations,
    verifyLoginCredentials, 
    requestLoginOTP, 
    verifyLoginOTP, 
    resendLoginOTP,
    
    // Email OTP verification for inactive user password reset
    requestResetOTP,
    verifyResetOTP,
    
    // Core authentication functions
    setPassword,
    validatetoken,
    refreshToken,
    logout,
    Profiledetails,
    updateProfile,
    
    // User preferences
    toggle2FA,
    updateNotificationPreferences,
    changePassword
} from "../../controller/v1/auth/auth.controller.js";
import validateToken from "../../middleware/validateToken.js";

const router = express.Router();

// Enhanced Multi-tenant + 2FA authentication flow (unified - recommended)
router.post("/discover-organizations", discoverOrganizations);    // Step 1: Find organizations for email
router.post("/verify-credentials", verifyLoginCredentials);       // Step 2: Verify email/password for specific org
router.post("/request-otp", requestLoginOTP);                    // Step 3: Request OTP for verified session
router.post("/verify-login-otp", verifyLoginOTP);                // Step 4: Complete login with OTP verification
router.post("/resend-otp", resendLoginOTP);                      // Helper: Resend OTP if needed

// Email OTP verification for inactive user password reset
router.post("/request-reset-otp", requestResetOTP);              // Step 1.5: Request OTP for inactive user password reset
router.post("/verify-reset-otp", verifyResetOTP);                // Step 1.6: Verify OTP and generate reset token

// Core authentication routes
router.post("/set-password", setPassword);
router.get("/validate-token", validateToken, validatetoken);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.get("/profile/:id", Profiledetails);
router.put("/profile/:id", updateProfile);

// User preferences (authentication required)
router.post("/toggle-2fa", validateToken, toggle2FA);
router.put("/notification-preferences", validateToken, updateNotificationPreferences);
router.put("/change-password", validateToken, changePassword);

export default router;
