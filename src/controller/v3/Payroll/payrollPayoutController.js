import { validationResult } from "express-validator";
import { PayrollPayoutService } from "./services/payrollPayoutService.js";
import { PayrollPermissions } from "./validators/payrollValidators.js";

function resolveStatusCode(error) {
    if (!error?.message) {
        return 500;
    }

    if (error.message.includes("not found")) {
        return 404;
    }

    if (error.message.includes("Bank details missing") || error.message.includes("No salary records")) {
        return 409;
    }

    return 400;
}

export const initiateCyclePayout = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array()
        });
    }

    try {
        const { cycleId } = req.params;
        const { requireBankDetails = true, salaryRecordIds = [] } = req.body ?? {};
        const actorId = req.user.id;

        const canInitiate = await PayrollPermissions.canInitiatePayout(actorId, cycleId);
        if (!canInitiate) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to initiate payouts for this cycle"
            });
        }

        const result = await PayrollPayoutService.initiateCyclePayout(cycleId, actorId, {
            requireBankDetails,
            salaryRecordIds
        });

        return res.status(200).json({
            success: true,
            message: "Payroll payout initiated",
            data: result
        });
    } catch (error) {
        console.error("[PAYROLL_PAYOUT] Error initiating cycle payout", error);
        return res.status(resolveStatusCode(error)).json({
            success: false,
            message: error.message || "Failed to initiate payroll payout"
        });
    }
};

export const getCyclePayoutSummary = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array()
        });
    }

    try {
        const { cycleId } = req.params;
        const actorId = req.user.id;

        const canView = await PayrollPermissions.canViewPayrollCycleDetails(actorId, cycleId);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this payout summary"
            });
        }

        const summary = await PayrollPayoutService.getPayoutSummary(cycleId);

        return res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error("[PAYROLL_PAYOUT] Error fetching payout summary", error);
        return res.status(resolveStatusCode(error)).json({
            success: false,
            message: error.message || "Failed to fetch payout summary"
        });
    }
};
