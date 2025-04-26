import e from "express";
import validateToken from "../../../middleware/validateToken.js";
import { getPaySlipBasedOnParams, generateSalaryBasedOnParams, getSalaryStatisticsBasedOnId, downloadPayslipAsPDF, checkMultiplePayslipStatus } from "../../../controller/v3/Payroll/payroll.controller.js";

const router = e.Router();

router.get("/payslip/:month/:year/:userId",validateToken, getPaySlipBasedOnParams);
router.post("/salary-generate/:month/:year/:userId",validateToken, generateSalaryBasedOnParams);
router.get("/statistics/:salaryRecordId",validateToken, getSalaryStatisticsBasedOnId);
router.get("/download/:salaryRecordId",validateToken, downloadPayslipAsPDF);
router.post("/check-multiple-status", validateToken, checkMultiplePayslipStatus);

export default router;