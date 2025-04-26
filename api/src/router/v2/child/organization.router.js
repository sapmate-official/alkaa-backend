import express from "express";
import { getOrganization, getOrganizationById, createOrganization, updateOrganization, deleteOrganization, setOrgAdmin, getOrganizationAdmins, removeOrganizationAdmin } from "../../../controller/v2/organization/organization.controller.js";
import employeeRouter from "./employee.router.js";
import { validateSuperAdminTokenMiddleware } from "../../../middleware/validateToken.js";

const router = express.Router();
router.get("/subordinate-list/",(req,res)=>{res.send("this is the subordinate list")});

router.get("/",getOrganization);
router.get("/:id",getOrganizationById);
router.post("/",createOrganization);
router.put("/",updateOrganization);
router.patch("/",updateOrganization);
router.delete("/",deleteOrganization);

//extra routes
router.use("/employees/",employeeRouter)
router.post("/set-admin/",validateSuperAdminTokenMiddleware,setOrgAdmin)

// Organization admin management routes
router.get("/:id/admins", getOrganizationAdmins);
router.post("/:id/admins", setOrgAdmin);
router.delete("/:id/admins/:adminId", removeOrganizationAdmin);

export default router;