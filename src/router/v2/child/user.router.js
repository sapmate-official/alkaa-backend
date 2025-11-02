import express from "express";
import { createUser, deleteUser, fetchAllSubordinates, fetchAllUsersFromOrg, fetchManagers, getUser, getUserById, hardDeleteUser, hardDeleteUserFromOrg, updateUser,updateUserDepartment,updateUserRole } from "../../../controller/v2/user/User.controller.js";
import validateToken from "../../../middleware/validateToken.js";
import { createUserValidation, updateUserValidation } from "../../../middleware/userValidation.js";

const router = express.Router();

router.get("/fetch-managers/org/:orgId",validateToken,fetchManagers)
router.get("/subordinates/:managerId",validateToken,fetchAllSubordinates);
router.get("/subordinate-list",validateToken,fetchAllSubordinates);
router.get("/org/:orgId",validateToken,getUser);
router.get("/all",validateToken,fetchAllUsersFromOrg);
router.get("/user-list",validateToken,fetchAllUsersFromOrg)
router.get("/:id",getUserById);
router.post("/", createUserValidation, createUser);
router.put("/:id", updateUserValidation, updateUser);
router.patch("/:id", updateUserValidation, updateUser);
router.delete("/",hardDeleteUser);

// Organization-specific hard delete route
router.delete("/org/:orgId/user/:userId", validateToken, hardDeleteUserFromOrg);

//extra routes
router.put("/:userId/role/:prevRole/:roleId",updateUserRole);
router.put("/:userId/department/:departmentId", validateToken,updateUserDepartment);
export default router;