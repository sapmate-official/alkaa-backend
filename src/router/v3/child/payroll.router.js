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
    deletePayrollCycle,
    submitPayrollCycleForReview,
    getPayrollCycles,
    getPayrollCycleDetails,
    getPayrollCycleProcessingStatus,
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
    updateCalculationRule,
    deleteCalculationRule,
    assignTemplate,
    getTemplateAssignments,
    getAssignmentTargets
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

import {
    getEmployeeDisputes,
    submitEmployeeDispute
} from "../../../controller/v3/Payroll/employeeController.js";

import {
    getOrganizationDisputes,
    getManagerDisputes,
    updateOrganizationDisputeStatus,
    updateManagerDisputeStatus
} from "../../../controller/v3/Payroll/disputeController.js";

import {
    recordSalaryPayment,
    listSalaryTransactions,
    getSalaryTransactionsForRecord
} from "../../../controller/v3/Payroll/salaryTransactionController.js";
import {
    initiateCyclePayout,
    getCyclePayoutSummary
} from "../../../controller/v3/Payroll/payrollPayoutController.js";

// Import validation middleware
import {
    createTemplateValidation,
    updateTemplateValidation,
    deleteTemplateValidation,
    createCalculationRuleValidation,
    updateCalculationRuleValidation,
    deleteCalculationRuleValidation,
    assignTemplateValidation,
    approveRejectRecordValidation,
    rejectRecordValidation,
    bulkApproveValidation,
    updateWorkflowStepValidation,
    initializeWorkflowValidation,
    monthYearQueryValidation,
    statusQueryValidation,
    workflowQueryValidation,
    recordSalaryPaymentValidation,
    paymentStatusQueryValidation,
    initiatePayoutValidation,
    payoutSummaryValidation,
    disputeListQueryValidation,
    disputeUpdateValidation
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
router.post("/cycle/submit/:cycleId", validateToken, submitPayrollCycleForReview);
router.post("/cycle/approve/:cycleId", validateToken, approvePayrollCycle);
router.delete("/cycle/:cycleId", validateToken, deletePayrollCycle);
router.get("/cycles", validateToken, getPayrollCycles);
router.get("/cycle/:cycleId", validateToken, getPayrollCycleDetails);
router.get("/cycle/:cycleId/status", validateToken, getPayrollCycleProcessingStatus);
router.post("/cycle/:cycleId/payout/initiate", validateToken, initiatePayoutValidation, initiateCyclePayout);
router.get("/cycle/:cycleId/payout/summary", validateToken, payoutSummaryValidation, getCyclePayoutSummary);
router.get("/cycles/review", validateToken, getCyclesNeedingReview);
router.get("/statistics", validateToken, getPayrollStatistics);
router.post("/bulk-generate", validateToken, bulkGenerateSalaries);

// Employee self-service routes
router.get("/employee/disputes", validateToken, getEmployeeDisputes);
router.post("/employee/disputes", validateToken, submitEmployeeDispute);

// Admin & manager dispute management routes
router.get("/admin/disputes", validateToken, ...disputeListQueryValidation, getOrganizationDisputes);
router.patch("/admin/disputes/:disputeId", validateToken, ...disputeUpdateValidation, updateOrganizationDisputeStatus);
router.get("/manager/disputes", validateToken, ...disputeListQueryValidation, getManagerDisputes);
router.patch("/manager/disputes/:disputeId", validateToken, ...disputeUpdateValidation, updateManagerDisputeStatus);

// Salary transaction routes
router.post("/transactions/pay", validateToken, recordSalaryPaymentValidation, recordSalaryPayment);
router.get("/transactions", validateToken, paymentStatusQueryValidation, statusQueryValidation, listSalaryTransactions);
router.get("/transactions/:salaryRecordId", validateToken, getSalaryTransactionsForRecord);

// Template management routes
router.get("/templates", validateToken, getSalaryTemplates);
router.post("/templates", validateToken, createTemplateValidation, createSalaryTemplate);
router.put("/templates/:templateId", validateToken, updateTemplateValidation, updateSalaryTemplate);
router.delete("/templates/:templateId", validateToken, deleteTemplateValidation, deleteSalaryTemplate);
router.get("/templates/calculation-rules", validateToken, getCalculationRules);
router.post("/templates/calculation-rules", validateToken, createCalculationRuleValidation, createCalculationRule);
router.put("/templates/calculation-rules/:ruleId", validateToken, updateCalculationRuleValidation, updateCalculationRule);
router.delete("/templates/calculation-rules/:ruleId", validateToken, deleteCalculationRuleValidation, deleteCalculationRule);
router.post("/templates/assign", validateToken, assignTemplateValidation, assignTemplate);
router.get("/templates/assignment-summary", validateToken, getTemplateAssignments);
router.get("/templates/assignment-targets", validateToken, getAssignmentTargets);

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