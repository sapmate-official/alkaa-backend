import express from 'express'
import { 
    setPassword, 
    loginUser, 
    validatetoken, 
    refreshToken, 
    logout, 
    Profiledetails, 
    updateProfile,
    checkEmailForLogin,
    verifyPasswordAndSendOtp,
    verifyOtpAndLogin
} from '../../controller/v1/general/general.controller.js'
import validateToken from '../../middleware/validateToken.js'
import { loginSuperAdmin } from '../../controller/v2/superAdmin/superAdmin.controller.js'
const router = express.Router()

// New multi-tenant authentication flow
router.post("/check-email", checkEmailForLogin)
router.post("/verify-password", verifyPasswordAndSendOtp)
router.post("/verify-otp", verifyOtpAndLogin)

// Legacy routes (keeping for backward compatibility)
router.post("/set-password", setPassword)
router.post("/login", loginUser)
router.get("/validate-token", validateToken, validatetoken)
router.post("/refresh-token", refreshToken)
router.post("/logout", logout)
router.get("/profile/:id", Profiledetails)
router.put("/profile/:id", updateProfile)

export default router