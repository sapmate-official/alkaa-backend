import { PayrollCycleService } from "./services/payrollCycleService.js";
import { PayrollPermissions, PayrollValidators } from "./validators/payrollValidators.js";

/**
 * PayrollCycleController - Handles bulk payroll operations and cycle management
 * 
 * Endpoints:
 * - POST /create-cycle - Create new payroll cycle
 * - POST /start-cycle/:cycleId - Start bulk generation
 * - POST /approve-cycle/:cycleId - Approve entire cycle
 * - GET /cycles - List organization cycles
 * - GET /cycles/:cycleId - Get cycle details
 * - GET /cycles/review - Get cycles needing review
 * - GET /statistics - Payroll statistics
 */

/**
 * Create a new payroll cycle
 */
export const createPayrollCycle = async (req, res) => {
    try {
        const { month, year, templateId } = req.body;
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;

        // Validate permissions
        const canCreate = await PayrollPermissions.canCreatePayrollCycle(currentUserId);
        if (!canCreate) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to create payroll cycles"
            });
        }

        // Validate input
        const { month: validMonth, year: validYear } = PayrollValidators.validateMonthYear(month, year);

        // Create cycle
        const cycle = await PayrollCycleService.createPayrollCycle(
            orgId,
            validMonth,
            validYear,
            templateId,
            currentUserId
        );

        return res.status(201).json({
            success: true,
            message: "Payroll cycle created successfully",
            data: cycle
        });

    } catch (error) {
        console.error("Error creating payroll cycle:", error);
        const isDuplicate = error.message && error.message.includes("already exists");
        return res.status(isDuplicate ? 409 : 500).json({
            success: false,
            message: isDuplicate ? error.message : "Failed to create payroll cycle",
            error: error.message
        });
    }
};

/**
 * Start bulk salary generation for a cycle
 */
export const startPayrollCycle = async (req, res) => {
    try {
        const { cycleId } = req.params;
        const currentUserId = req.user.id;

        // Validate permissions
        const canStart = await PayrollPermissions.canStartPayrollCycle(currentUserId, cycleId);
        if (!canStart) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to start this payroll cycle"
            });
        }

        // Queue cycle for background processing
        const result = await PayrollCycleService.startPayrollCycle(cycleId, currentUserId);

        const statusCode = result.duplicate ? 200 : 202;
        const message = result.duplicate
            ? "Payroll cycle processing is already in progress"
            : "Payroll cycle queued for background processing";

        return res.status(statusCode).json({
            success: true,
            message,
            data: {
                queued: true,
                cycle: result.cycle,
                job: {
                    id: result.job.id,
                    status: result.job.status,
                    scheduledFor: result.job.scheduledFor,
                    attempts: result.job.attempts,
                    maxAttempts: result.job.maxAttempts,
                    priority: result.job.priority
                }
            }
        });

    } catch (error) {
        console.error("Error starting payroll cycle:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to start payroll cycle",
            error: error.message
        });
    }
};

/**
 * Approve a payroll cycle (bulk approve all salaries)
 */
export const approvePayrollCycle = async (req, res) => {
    try {
        const { cycleId } = req.params;
        const { notes } = req.body;
        const currentUserId = req.user.id;

        // Validate permissions
        const canApprove = await PayrollPermissions.canApprovePayrollCycle(currentUserId, cycleId);
        if (!canApprove) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to approve this payroll cycle"
            });
        }

        // Approve cycle
        const cycle = await PayrollCycleService.approvePayrollCycle(cycleId, currentUserId, notes);

        return res.status(200).json({
            success: true,
            message: "Payroll cycle approved successfully",
            data: cycle
        });

    } catch (error) {
        console.error("Error approving payroll cycle:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to approve payroll cycle",
            error: error.message
        });
    }
};

export const deletePayrollCycle = async (req, res) => {
    try {
        const { cycleId } = req.params;
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;

        const canDelete = await PayrollPermissions.canDeletePayrollCycle(currentUserId);
        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to delete payroll cycles"
            });
        }

        const result = await PayrollCycleService.deletePayrollCycle(cycleId, currentUserId, { orgId });

        return res.status(200).json({
            success: true,
            message: "Payroll cycle deleted successfully",
            data: result
        });
    } catch (error) {
        console.error("Error deleting payroll cycle:", error);

        const statusMap = {
            NOT_FOUND: 404,
            FORBIDDEN: 403,
            INVALID_STATUS: 409,
            PROCESSING: 409
        };

        const statusCode = statusMap[error.code] || 500;
        const message = error.message || "Failed to delete payroll cycle";

        return res.status(statusCode).json({
            success: false,
            message,
            error: error.message
        });
    }
};

export const submitPayrollCycleForReview = async (req, res) => {
    try {
        const { cycleId } = req.params;
        const { force = false } = req.body || {};
        const currentUserId = req.user.id;

        const canSubmit = await PayrollPermissions.canSubmitPayrollCycle(currentUserId, cycleId);
        if (!canSubmit) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to submit this payroll cycle for review"
            });
        }

        const result = await PayrollCycleService.submitPayrollCycleForReview(cycleId, currentUserId, {
            force: Boolean(force)
        });

        if (!result.canSubmit) {
            return res.status(409).json({
                success: false,
                message: result.reason === 'PENDING_RECORDS'
                    ? 'Some salaries are still processing. Resolve them before submitting for review.'
                    : 'Some salaries failed or were rejected. Address them before submitting for review.',
                data: {
                    blockers: result.blockers
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: result.forced
                ? 'Payroll cycle submitted for review with outstanding issues.'
                : 'Payroll cycle submitted for review successfully.',
            data: {
                cycle: result.cycle,
                blockers: result.blockers,
                forced: result.forced
            }
        });
    } catch (error) {
        console.error("Error submitting payroll cycle for review:", error);
        const message = error.message || "Failed to submit payroll cycle for review";

        const normalizedMessage = message.includes('not found')
            ? 'Payroll cycle not found'
            : message;

        const statusCode = message.includes('not found') ? 404 : message.includes('Only IN_PROGRESS cycles') ? 400 : 500;

        return res.status(statusCode).json({
            success: false,
            message: normalizedMessage,
            error: error.message
        });
    }
};

/**
 * Get organization payroll cycles
 */
export const getPayrollCycles = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;
        const { page = 1, limit = 10, status } = req.query;

        // Validate permissions
        const canView = await PayrollPermissions.canViewPayrollCycles(currentUserId);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view payroll cycles"
            });
        }

        // Get cycles
        const result = await PayrollCycleService.getPayrollCycles(
            orgId,
            parseInt(page),
            parseInt(limit),
            status
        );

        return res.status(200).json({
            success: true,
            data: result.cycles,
            pagination: result.pagination
        });

    } catch (error) {
        console.error("Error fetching payroll cycles:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payroll cycles",
            error: error.message
        });
    }
};

/**
 * Get detailed payroll cycle information
 */
export const getPayrollCycleDetails = async (req, res) => {
    try {
        const { cycleId } = req.params;
        const currentUserId = req.user.id;

        // Validate permissions
        const canView = await PayrollPermissions.canViewPayrollCycleDetails(currentUserId, cycleId);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this payroll cycle"
            });
        }

        // Get cycle details
        const cycle = await PayrollCycleService.getPayrollCycleDetails(cycleId);

        return res.status(200).json({
            success: true,
            data: cycle
        });

    } catch (error) {
        console.error("Error fetching payroll cycle details:", error);
        return res.status(500).json({
            success: false,
            message: error.message.includes("not found") ? error.message : "Failed to fetch payroll cycle details",
            error: error.message
        });
    }
};

export const getPayrollCycleProcessingStatus = async (req, res) => {
    try {
        const { cycleId } = req.params;
        const currentUserId = req.user.id;

        const canView = await PayrollPermissions.canViewPayrollCycleDetails(currentUserId, cycleId);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this payroll cycle"
            });
        }

        const status = await PayrollCycleService.getPayrollCycleProcessingStatus(cycleId);

        return res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error("Error fetching payroll cycle processing status:", error);
        if (error.code === 'NOT_FOUND') {
            return res.status(404).json({
                success: false,
                message: 'Payroll cycle not found'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payroll cycle processing status',
            error: error.message
        });
    }
};

/**
 * Get cycles needing review (for dashboard)
 */
export const getCyclesNeedingReview = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;

        // Validate permissions
        const canReview = await PayrollPermissions.canReviewPayrollCycles(currentUserId);
        if (!canReview) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to review payroll cycles"
            });
        }

        // Get cycles needing review
        const cycles = await PayrollCycleService.getCyclesNeedingReview(orgId);

        return res.status(200).json({
            success: true,
            data: cycles,
            count: cycles.length
        });

    } catch (error) {
        console.error("Error fetching cycles needing review:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch cycles needing review",
            error: error.message
        });
    }
};

/**
 * Get payroll statistics for organization
 */
export const getPayrollStatistics = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;
        const { year } = req.query;

        // Validate permissions
        const canView = await PayrollPermissions.canViewPayrollStatistics(currentUserId);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view payroll statistics"
            });
        }

        // Get statistics
        const statistics = await PayrollCycleService.getPayrollStatistics(
            orgId,
            year ? parseInt(year) : null
        );

        return res.status(200).json({
            success: true,
            data: statistics
        });

    } catch (error) {
        console.error("Error fetching payroll statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payroll statistics",
            error: error.message
        });
    }
};

/**
 * Get payroll dashboard data
 * Combines cycles needing review, statistics, and recent cycles
 */
export const getPayrollDashboard = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;
        const { year } = req.query;

        // Validate permissions
        const canView = await PayrollPermissions.canViewPayrollStatistics(currentUserId);
        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view payroll dashboard"
            });
        }

        // Get all dashboard data in parallel
        const [cyclesNeedingReview, statistics, recentCycles] = await Promise.all([
            PayrollCycleService.getCyclesNeedingReview(orgId),
            PayrollCycleService.getPayrollStatistics(orgId, year ? parseInt(year) : null),
            PayrollCycleService.getPayrollCycles(orgId, 1, 5) // Get 5 most recent cycles
        ]);

        return res.status(200).json({
            success: true,
            data: {
                cyclesNeedingReview,
                statistics,
                recentCycles: recentCycles.cycles || []
            }
        });

    } catch (error) {
        console.error("Error fetching payroll dashboard data:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payroll dashboard data",
            error: error.message
        });
    }
};

/**
 * Bulk generate salaries for multiple users
 */
export const bulkGenerateSalaries = async (req, res) => {
    try {
        const { month, year, userIds } = req.body; // userIds is optional - if not provided, generates for all
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;

        // Validate permissions
        const canGenerate = await PayrollPermissions.canBulkGenerateSalaries(currentUserId);
        if (!canGenerate) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to bulk generate salaries"
            });
        }

        // Validate input
        const { month: validMonth, year: validYear } = PayrollValidators.validateMonthYear(month, year);

        // First create a cycle
        const cycle = await PayrollCycleService.createPayrollCycle(
            orgId,
            validMonth,
            validYear,
            null,
            currentUserId
        );

        // Then start the cycle
        const result = await PayrollCycleService.startPayrollCycle(cycle.id, currentUserId);

        return res.status(200).json({
            success: true,
            message: "Bulk salary generation completed",
            data: {
                cycleId: cycle.id,
                ...result
            }
        });

    } catch (error) {
        console.error("Error in bulk salary generation:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to generate salaries",
            error: error.message
        });
    }
};
