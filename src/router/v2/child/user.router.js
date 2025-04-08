import express from "express";
import { createUser, deleteUser, fetchAllSubordinates, fetchAllUsersFromOrg, fetchManagers, getUser, getUserById, updateUser,updateUserDepartment,updateUserRole } from "../../../controller/v2/user/User.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

router.get("/fetch-managers/org/:orgId",validateToken,fetchManagers)
router.get("/subordinates/:managerId",validateToken,fetchAllSubordinates);
router.get("/subordinate-list",validateToken,fetchAllSubordinates);
router.get("/org/:orgId",validateToken,getUser);
router.get("/all",validateToken,fetchAllUsersFromOrg);
router.get("/user-list",validateToken,fetchAllUsersFromOrg)
router.get("/:id",getUserById);
router.post("/",createUser);
router.put("/:id",updateUser);
router.patch("/:id",updateUser);
router.delete("/",deleteUser);

//extra routes
router.put("/:userId/role/:prevRole/:roleId",updateUserRole);
router.put("/:userId/department/:departmentId", validateToken,updateUserDepartment);
export default router;