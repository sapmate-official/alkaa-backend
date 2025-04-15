import express from "express";
import { getSuperAdmins ,
    deleteSuperAdmin, 
    getSuperAdminById, 
    updateSuperAdmin, 
    createSuperAdmin,
    loginSuperAdmin,
    logoutSuperAdmin,
    validateSuperAdminToken,
    getUserInfo,
    // New organization tracking and billing controllers
    getOrganizationsStats,
    getOrganizationDetails,
    getOrganizationUsers,
    getOrganizationAdmins,
    generateOrganizationBill,
    sendBillEmail,
    sendBillsToAllOrganizations

} from "../../../controller/v2/superAdmin/superAdmin.controller.js";
import { validateSuperAdminTokenMiddleware } from "../../../middleware/validateToken.js";

const router = express.Router();

router.post("/login",loginSuperAdmin)
router.post("/logout",validateSuperAdminTokenMiddleware,logoutSuperAdmin)


// user data
router.get("/get-user-info",validateSuperAdminTokenMiddleware,getUserInfo)
router.get("/validate-token",validateSuperAdminTokenMiddleware,validateSuperAdminToken)
router.get("/", getSuperAdmins);
router.get("/:id", getSuperAdminById);
router.post("/", createSuperAdmin);
router.put("/:id", updateSuperAdmin);
router.patch("/:id", updateSuperAdmin);
router.delete("/:id", deleteSuperAdmin);

// Organization tracking and billing routes
router.get("/organizations/stats", validateSuperAdminTokenMiddleware, getOrganizationsStats);
router.get("/organization/:id/details", validateSuperAdminTokenMiddleware, getOrganizationDetails);
router.get("/organization/:id/users", validateSuperAdminTokenMiddleware, getOrganizationUsers);
router.get("/organization/:id/admins", validateSuperAdminTokenMiddleware, getOrganizationAdmins);
router.post("/organization/:id/bill", validateSuperAdminTokenMiddleware, generateOrganizationBill);
router.post("/organization/:id/send-bill", validateSuperAdminTokenMiddleware, sendBillEmail);
router.post("/organizations/send-bills", validateSuperAdminTokenMiddleware, sendBillsToAllOrganizations);

export default router;