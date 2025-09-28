import express from "express";
import { createBank, deleteBank, getBank, getBankById, updateBank, getBankByUserId } from "../../../controller/v2/Bank/Bank.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

// Protect all bank routes with authentication
router.use(validateToken);

// Add user bank details route with proper protection
router.get("user/:Userid", getBankByUserId);
router.get("/", getBank);
router.get("/:id", getBankById);
router.post("/", createBank);
router.put("/", updateBank);    
router.patch("/", updateBank);
router.delete("/", deleteBank);

export default router;