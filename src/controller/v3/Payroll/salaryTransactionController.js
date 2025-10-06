import { validationResult } from "express-validator";
import { SalaryTransactionService } from "./services/salaryTransactionService.js";
import { PayrollPermissions } from "./validators/payrollValidators.js";

export const recordSalaryPayment = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array()
        });
    }

    try {
        const payload = {
            salaryRecordId: req.body.salaryRecordId,
            paymentMode: req.body.paymentMode,
            paymentReference: req.body.paymentReference,
            notes: req.body.notes,
            incentive: req.body.incentive,
            bonus: req.body.bonus,
            processedAt: req.body.processedAt,
            records: req.body.records,
            senderUserId: req.user.id
        };

        const salaryRecordIds = Array.isArray(payload.records) && payload.records.length > 0
            ? payload.records.map((record) => record.salaryRecordId).filter(Boolean)
            : (payload.salaryRecordId ? [payload.salaryRecordId] : []);

        if (salaryRecordIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide salaryRecordId or a non-empty records array"
            });
        }

        for (const recordId of salaryRecordIds) {
            const canProcess = await PayrollPermissions.canProcessSalaryPayment(req.user.id, recordId);
            if (!canProcess) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to process one or more salary payments"
                });
            }
        }

        const result = await SalaryTransactionService.recordPayment(payload);

        return res.status(201).json({
            success: true,
            message: salaryRecordIds.length > 1
                ? `${salaryRecordIds.length} salary payments recorded successfully`
                : "Salary payment recorded successfully",
            data: result
        });
    } catch (error) {
        console.error("[SALARY_PAYMENT] Error recording salary payment", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to record salary payment"
        });
    }
};

export const listSalaryTransactions = async (req, res) => {
    try {
        const { orgId, userId, cycleId, status, paymentStatus } = req.query;
        const transactions = await SalaryTransactionService.listTransactions({
            orgId: orgId || req.user.orgId,
            userId,
            cycleId,
            status,
            paymentStatus
        });

        return res.status(200).json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        console.error("[SALARY_PAYMENT] Error fetching salary transactions", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch salary transactions",
            error: error.message
        });
    }
};

export const getSalaryTransactionsForRecord = async (req, res) => {
    try {
        const { salaryRecordId } = req.params;
        const transactions = await SalaryTransactionService.getBySalaryRecordId(salaryRecordId);

        return res.status(200).json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        console.error("[SALARY_PAYMENT] Error fetching salary record payments", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch salary record payments",
            error: error.message
        });
    }
};
