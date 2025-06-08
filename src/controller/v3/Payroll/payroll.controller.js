import { PayrollService } from "./services/payrollService.js";
import { PayslipPDFGenerator } from "./services/pdfGenerator.js";
import { PayrollPermissions, PayrollValidators } from "./validators/payrollValidators.js";
import { formatPayslipData, formatSalaryStatistics, formatMultiplePayslipStatus } from "./models/payrollModels.js";

/**
 * Get payslip based on provided parameters
 * 📁 Payroll/
├── 📄 payroll.controller.js          # New modular controller
├── 📄 payrollController.js           # Original monolithic file (preserved)
├── 📁 services/
│   ├── 📄 payrollService.js          # Main business logic service
│   └── 📄 pdfGenerator.js            # PDF generation functionality
├── 📁 utils/
│   ├── 📄 salaryCalculations.js      # Salary calculation utilities
│   ├── 📄 attendanceUtils.js         # Attendance and working days calculations
│   └── 📄 adjustmentUtils.js         # Leave and attendance adjustment processing
├── 📁 validators/
│   └── 📄 payrollValidators.js       # Permission checks and input validation
└── 📁 models/
    └── 📄 payrollModels.js           # Data formatting and response models
 */
export const getPaySlipBasedOnParams = async (req, res) => {
    try {
        const { month, year, userId } = req.params;
        const currentUserId = req.user.id;

        // Determine target user ID
        const targetUserId = userId && userId !== 'undefined' ? userId : currentUserId;

        // Check permissions
        const canView = await PayrollPermissions.canViewPayslip(currentUserId, targetUserId);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to this payslip"
            });
        }

        // Get payslips from service
        const payslips = await PayrollService.getPayslips(targetUserId, month, year);

        // Format response data
        const formattedPayslips = formatPayslipData(payslips);

        return res.status(200).json({
            success: true,
            count: formattedPayslips.length,
            data: formattedPayslips
        });

    } catch (error) {
        console.error("Error fetching payslips:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payslips",
            error: error.message
        });
    }
};

/**
 * Generate salary based on provided parameters
 */
export const generateSalaryBasedOnParams = async (req, res) => {
    try {
        const { month, year, userId } = req.params;
        const currentUserId = req.user.id;

        console.log("[SALARY_GENERATE] Starting salary generation process", {
            requestParams: req.params,
            requestUser: req.user.id
        });

        // Validate parameters
        const { month: validMonth, year: validYear } = PayrollValidators.validateMonthYear(month, year);

        // Determine target user ID
        const targetUserId = userId && userId !== 'undefined' ? userId : currentUserId;

        // Check permissions
        const canGenerate = await PayrollPermissions.canGenerateSalary(currentUserId, targetUserId);
        if (!canGenerate) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to generate salary for this user"
            });
        }

        // Generate salary using service
        const salaryRecord = await PayrollService.generateSalary(targetUserId, validMonth, validYear);

        console.log("[SALARY_GENERATE] Salary generated successfully", {
            salaryRecordId: salaryRecord.id,
            userId: targetUserId,
            month: validMonth,
            year: validYear,
            netSalary: salaryRecord.netSalary
        });

        return res.status(201).json({
            success: true,
            message: "Salary generated successfully",
            data: salaryRecord
        });

    } catch (error) {
        console.error("[SALARY_GENERATE] Error generating salary:", error);
        return res.status(500).json({
            success: false,
            message: error.message.includes("already exists") ? error.message : "Failed to generate salary",
            error: error.message
        });
    }
};

/**
 * Get salary statistics based on salary record ID
 */
export const getSalaryStatisticsBasedOnId = async (req, res) => {
    try {
        const { salaryRecordId } = req.params;
        const currentUserId = req.user.id;

        // Validate parameters
        PayrollValidators.validateSalaryRecordId(salaryRecordId);

        // Get salary statistics from service
        const statisticsData = await PayrollService.getSalaryStatistics(salaryRecordId);

        // Check permissions
        const canView = await PayrollPermissions.canViewStatistics(currentUserId, statisticsData.salaryRecord);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view these salary statistics"
            });
        }

        // Format response data
        const formattedStatistics = formatSalaryStatistics(statisticsData.salaryRecord, statisticsData);

        return res.status(200).json({
            success: true,
            data: formattedStatistics
        });

    } catch (error) {
        console.error("Error fetching salary statistics:", error);
        return res.status(500).json({
            success: false,
            message: error.message.includes("not found") ? error.message : "Failed to fetch salary statistics",
            error: error.message
        });
    }
};

/**
 * Download payslip as PDF based on salary record ID
 */
export const downloadPayslipAsPDF = async (req, res) => {
    try {
        const { salaryRecordId } = req.params;
        const currentUserId = req.user.id;

        // Validate parameters
        PayrollValidators.validateSalaryRecordId(salaryRecordId);

        // Get salary record data
        const statisticsData = await PayrollService.getSalaryStatistics(salaryRecordId);

        // Check permissions
        const canDownload = await PayrollPermissions.canDownloadPayslip(currentUserId, statisticsData.salaryRecord);
        if (!canDownload) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to download this payslip"
            });
        }

        // Generate and send PDF
        await PayslipPDFGenerator.generatePayslipPDF(statisticsData.salaryRecord, res);

    } catch (error) {
        console.error("Error generating payslip PDF:", error);
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: error.message.includes("not found") ? error.message : "Failed to generate payslip PDF",
                error: error.message
            });
        }
    }
};

/**
 * Check multiple payslip status
 */
export const checkMultiplePayslipStatus = async (req, res) => {
    try {
        const { payslipData } = req.body;

        // Validate parameters
        const validatedData = PayrollValidators.validatePayslipData(payslipData);

        // Check status using service
        const statusMap = await PayrollService.checkMultiplePayslipStatus(validatedData);

        // Format response data
        const formattedStatus = formatMultiplePayslipStatus(statusMap);

        return res.status(200).json({
            success: true,
            data: formattedStatus
        });

    } catch (error) {
        console.error("Error checking multiple payslip status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to check payslip status",
            error: error.message
        });
    }
};
