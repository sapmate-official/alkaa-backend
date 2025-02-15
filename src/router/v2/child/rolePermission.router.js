import express from "express";
import { createRolePermission, deleteRolePermission, getRolePermissionById, getRolePermissions, updateRolePermission } from "../../../controller/v2/RolePermission/rolePermission.controller.js";

const router = express.Router();

router.get("/", getRolePermissions);
router.get("/:id", getRolePermissionById);
router.post("/", createRolePermission);
router.put("/:id", updateRolePermission);
router.patch("/:id", updateRolePermission);
router.delete("/:id", deleteRolePermission);

export default router;