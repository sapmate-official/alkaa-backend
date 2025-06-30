import e from "express";
import validateToken from "../../../middleware/validateToken.js";
import {
    getPaySlipBasedOnParams,
    generateSalaryBasedOnParams,
    getSalaryStatisticsBasedOnId,
    getPayslipDataForPDF,
    downloadPayslipAsPDF,
    checkMultiplePayslipStatus,
    preStatsSalaryGeneration
} from "../../../controller/v3/Payroll/payroll.controller.js";

const router = e.Router();
router.use((req, res, next) => {
    console.log("payslip Router Loaded");
    next();
})
router.get("/payslip/:month/:year/:userId",validateToken, getPaySlipBasedOnParams);
router.post("/salary-generate/:month/:year/:userId",validateToken, generateSalaryBasedOnParams);
router.get("/statistics/:salaryRecordId",validateToken, getSalaryStatisticsBasedOnId);
router.get("/pdf-data/:salaryRecordId",validateToken, getPayslipDataForPDF);
router.get("/download/:salaryRecordId",validateToken, downloadPayslipAsPDF);
router.post("/check-multiple-status", validateToken, checkMultiplePayslipStatus);
router.use((req, res, next) => {
    console.log("pre-stats Router Loaded");
    next();
})
router.get("/pre-stats/:month/:year/:userId", validateToken, preStatsSalaryGeneration);

export default router;