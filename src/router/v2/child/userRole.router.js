import express from "express";
import { createUserRole, deleteUserRole, getUserRoleById, getUserRoles, updateUserRole } from "../../../controller/v2/userRole/userRole.controller.js";


const router = express.Router();

router.get("/", getUserRoles);
router.get("/:id", getUserRoleById);
router.post("/", createUserRole);
router.put("/:id", updateUserRole);
router.patch("/:id", updateUserRole);
router.delete("/:id", deleteUserRole);

export default router;