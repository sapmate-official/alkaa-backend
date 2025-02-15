import express from "express";
import { getSuperAdmins ,
    deleteSuperAdmin, 
    getSuperAdminById, 
    updateSuperAdmin, 
    createSuperAdmin

} from "../../../controller/v2/superAdmin/superAdmin.controller.js";

const router = express.Router();

router.get("/", getSuperAdmins);
router.get("/:id", getSuperAdminById);
router.post("/", createSuperAdmin);
router.put("/:id", updateSuperAdmin);
router.patch("/:id", updateSuperAdmin);
router.delete("/:id", deleteSuperAdmin);

export default router;