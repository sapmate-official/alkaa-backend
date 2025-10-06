import express from "express";
import { 
    createRole, 
    deleteRole, 
    getRole, 
    getRoleById, 
    updateRole,
    addPermissionsToRole,
    removePermissionsFromRole 
} from "../../../controller/v2/role/Role.controller.js";

const router = express.Router();

router.get("/org/:orgId", getRole);
router.get("/:id", getRoleById);
router.post("/", createRole);
router.put("/:roleId", updateRole);
router.patch("/", updateRole);
router.delete("/:roleId", deleteRole);

// New permission management endpoints
router.post("/:roleId/permissions/add", addPermissionsToRole);
router.post("/:roleId/permissions/remove", removePermissionsFromRole);

export default router;