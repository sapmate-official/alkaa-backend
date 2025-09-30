import { validationResult } from "express-validator";
import { SalaryTransactionService } from "./services/salaryTransactionService.js";

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
        const { salaryRecordId, paymentMode, paymentReference, notes } = req.body;
        const result = await SalaryTransactionService.recordPayment({
            salaryRecordId,
            senderUserId: req.user.id,
            paymentMode,
            paymentReference,
            notes
        });

        return res.status(201).json({
            success: true,
            message: "Salary payment recorded successfully",
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
