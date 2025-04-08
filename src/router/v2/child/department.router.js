import express from "express";
import { createDepartment, deleteDepartment, getDepartment, getDepartmentById, updateDepartment, updateDepartmentHead } from "../../../controller/v2/Department/department.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

router.get("/org/:orgId",getDepartment);
router.get("/:id",getDepartmentById);
router.post("/",createDepartment);
router.put("/:id",updateDepartment);
router.patch("/",updateDepartment);
router.delete("/:id",deleteDepartment);
router.put("/:id/head/:userId", validateToken, updateDepartmentHead);

export default router;