import express from "express";
import { createBank, deleteBank, getBank, getBankById, updateBank,getBankByUserId } from "../../../controller/v2/Bank/Bank.controller.js";
import validateToken from "../../../middleware/validateToken.js";



const router = express.Router();

// router.get("/user/:Userid",getBankByUserId);
router.get("/",getBank);
router.get("/:id",getBankById);
router.post("/",createBank);
router.put("/",updateBank);
router.patch("/",updateBank);
router.delete("/",deleteBank);

//extra routes

export default router;