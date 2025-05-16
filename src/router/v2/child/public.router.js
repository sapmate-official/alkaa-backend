import express from "express";
import { sendDemoRequestEmail } from "../../../controller/v2/public/public.controller.js";

const router = express.Router();

/**
 * @route POST /demo-request
 * @desc Send a demo request email to specified recipients
 * @access Public
 */
router.post("/demo-request", sendDemoRequestEmail);

export default router;
