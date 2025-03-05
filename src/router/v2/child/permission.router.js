import express from "express";
import { createPermission, deletePermission, getPermissionById, getPermissions, updatePermission,getPermissionsByOrgId } from "../../../controller/v2/permission/Permission.controller.js";

const router = express.Router();

router.get("/", getPermissions);
router.get("/:id", getPermissionById);
router.post("/", createPermission);
router.put("/", updatePermission);
router.patch("/", updatePermission);
router.delete("/", deletePermission);

//extra routes
router.get("/org/:orgId", getPermissionsByOrgId);

export default router;