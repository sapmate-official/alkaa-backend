import express from "express";
import {
    getBillingDashboard,
    getBillHistory,
    getBillDetails,
    markBillAsPaid,
    downloadBillInvoice
} from "../../../controller/v3/Billing/billing.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();


// Get billing dashboard statistics
router.get("/dashboard", validateToken,getBillingDashboard);

// Get bill history with optional filters
router.get("/history",validateToken, getBillHistory);

// Get specific bill details
router.get("/bill/:id",validateToken, getBillDetails);

// Mark bill as paid (records payment intention)
router.post("/bill/:id/pay",validateToken, markBillAsPaid);

// Download bill invoice as PDF
router.get("/bill/:id/invoice", downloadBillInvoice);

export default router;
