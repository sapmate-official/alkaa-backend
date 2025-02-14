import express from "express";
import { createDepartment, deleteDepartment, getDepartment, getDepartmentById, updateDepartment } from "../../../controller/v2/Department/department.controller.js";


const router = express.Router();

router.get("/org/:orgId",getDepartment);
router.get("/:id",getDepartmentById);
router.post("/",createDepartment);
router.put("/:id",updateDepartment);
router.patch("/",updateDepartment);
router.delete("/",deleteDepartment);
export default router;