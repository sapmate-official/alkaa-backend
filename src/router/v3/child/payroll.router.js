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

// Import new cycle management controllers
import {
    createPayrollCycle,
    startPayrollCycle,
    approvePayrollCycle,
    getPayrollCycles,
    getPayrollCycleDetails,
    getCyclesNeedingReview,
    getPayrollStatistics,
    bulkGenerateSalaries,
    getPayrollDashboard
} from "../../../controller/v3/Payroll/payrollCycleController.js";

// Import template management controllers
import {
    getSalaryTemplates,
    createSalaryTemplate,
    updateSalaryTemplate,
    deleteSalaryTemplate,
    getCalculationRules,
    createCalculationRule,
    assignTemplate
} from "../../../controller/v3/Payroll/templateController.js";

// Import manager review controllers
import {
    getTeamPayrollRecords,
    getTeamStatistics,
    approvePayrollRecord,
    rejectPayrollRecord,
    bulkApproveRecords,
    getPendingReviewRecords
} from "../../../controller/v3/Payroll/managerController.js";

// Import workflow management controllers
import {
    getWorkflowStatus,
    getWorkflowSteps,
    updateWorkflowStep,
    getWorkflowProgress,
    initializeWorkflow
} from "../../../controller/v3/Payroll/workflowController.js";

// Import validation middleware
import {
    createTemplateValidation,
    updateTemplateValidation,
    deleteTemplateValidation,
    createCalculationRuleValidation,
    assignTemplateValidation,
    approveRejectRecordValidation,
    rejectRecordValidation,
    bulkApproveValidation,
    updateWorkflowStepValidation,
    initializeWorkflowValidation,
    monthYearQueryValidation,
    statusQueryValidation,
    workflowQueryValidation
} from "../../../controller/v3/Payroll/validators/newPayrollValidators.js";

const router = e.Router();

// Existing routes
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
router.get("/pre-stats/:month/:year/:userId", validateToken, preStatsSalaryGeneration);

// Cycle management routes
router.get("/dashboard", validateToken, getPayrollDashboard);
router.post("/cycle/create", validateToken, createPayrollCycle);
router.post("/cycle/start/:cycleId", validateToken, startPayrollCycle);
router.post("/cycle/approve/:cycleId", validateToken, approvePayrollCycle);
router.get("/cycles", validateToken, getPayrollCycles);
router.get("/cycle/:cycleId", validateToken, getPayrollCycleDetails);
router.get("/cycles/review", validateToken, getCyclesNeedingReview);
router.get("/statistics", validateToken, getPayrollStatistics);
router.post("/bulk-generate", validateToken, bulkGenerateSalaries);

// Template management routes
router.get("/templates", validateToken, getSalaryTemplates);
router.post("/templates", validateToken, createTemplateValidation, createSalaryTemplate);
router.put("/templates/:templateId", validateToken, updateTemplateValidation, updateSalaryTemplate);
router.delete("/templates/:templateId", validateToken, deleteTemplateValidation, deleteSalaryTemplate);
router.get("/templates/calculation-rules", validateToken, getCalculationRules);
router.post("/templates/calculation-rules", validateToken, createCalculationRuleValidation, createCalculationRule);
router.post("/templates/assign", validateToken, assignTemplateValidation, assignTemplate);

// Manager review routes
router.get("/manager/team-payroll", validateToken, monthYearQueryValidation, statusQueryValidation, getTeamPayrollRecords);
router.get("/manager/team-statistics", validateToken, monthYearQueryValidation, getTeamStatistics);
router.post("/manager/approve/:recordId", validateToken, approveRejectRecordValidation, approvePayrollRecord);
router.post("/manager/reject/:recordId", validateToken, rejectRecordValidation, rejectPayrollRecord);
router.post("/manager/bulk-approve", validateToken, bulkApproveValidation, bulkApproveRecords);
router.get("/manager/pending-review", validateToken, getPendingReviewRecords);

// Workflow management routes
router.get("/workflow/status", validateToken, monthYearQueryValidation, getWorkflowStatus);
router.get("/workflow/steps", validateToken, monthYearQueryValidation, workflowQueryValidation, getWorkflowSteps);
router.put("/workflow/steps/:stepId", validateToken, updateWorkflowStepValidation, updateWorkflowStep);
router.get("/workflow/progress", validateToken, monthYearQueryValidation, getWorkflowProgress);
router.post("/workflow/initialize", validateToken, initializeWorkflowValidation, initializeWorkflow);

export default router;