import express from "express";
import { getOrganization, getOrganizationById, createOrganization, updateOrganization, deleteOrganization } from "../../../controller/v2/organization/organization.controller.js";
import employeeRouter from "./employee.router.js";

const router = express.Router();

router.get("/",getOrganization);
router.get("/:id",getOrganizationById);
router.post("/",createOrganization);
router.put("/",updateOrganization);
router.patch("/",updateOrganization);
router.delete("/",deleteOrganization);

//extra routes
router.use("/employees/",employeeRouter)

export default router;