import express from "express";
import { getOrganization, getOrganizationById, createOrganization, updateOrganization, deleteOrganization, setOrgAdmin, getOrganizationAdmins, removeOrganizationAdmin, createCompleteOrganization } from "../../../controller/v2/organization/organization.controller.js";
import { getOrganizationChart, getManagerSubordinateChart } from "../../../controller/v2/organization/organization.chart.controller.js";
import employeeRouter from "./employee.router.js";
import { validateSuperAdminTokenMiddleware } from "../../../middleware/validateToken.js";
import { listOfEmployees } from "../../../controller/v2/organization/Employee/employee.queries.js";

const router = express.Router();
router.get("/subordinate-list/",(req,res)=>{
    
    res.send("this is the subordinate list")});

router.get("/",getOrganization);
router.get("/:id",getOrganizationById);
router.get("/:orgId/chart",getOrganizationChart);
router.get("/:orgId/manager-chart",getManagerSubordinateChart);
router.post("/",createOrganization);
router.post("/complete", validateSuperAdminTokenMiddleware, createCompleteOrganization);
router.put("/",updateOrganization);
router.patch("/",updateOrganization);
router.delete("/",deleteOrganization);

//extra routes
router.use("/employees/",employeeRouter)
router.get("/employee-list/:orgId", listOfEmployees); 
router.post("/set-admin/",validateSuperAdminTokenMiddleware,setOrgAdmin)

// Organization admin management routes
router.get("/:id/admins", getOrganizationAdmins);
router.post("/:id/admins", setOrgAdmin);
router.delete("/:id/admins/:adminId", removeOrganizationAdmin);

export default router;