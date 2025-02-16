import express from "express";
import { createUser, deleteUser, getUser, getUserById, updateUser } from "../../../controller/v2/user/User.controller.js";
import validateToken from "../../../middleware/validateToken.js";



const router = express.Router();

router.get("/",getUser);
router.get("/:id",getUserById);
router.post("/",createUser);
router.put("/:id",updateUser);
router.patch("/:id",updateUser);
router.delete("/",deleteUser);
export default router;